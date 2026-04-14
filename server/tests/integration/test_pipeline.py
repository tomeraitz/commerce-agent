"""Integration tests for the core pipeline — all agents are mocked."""

import pytest
from unittest.mock import AsyncMock, patch

from src.core.pipeline import run_turn
from src.core.errors import AgentError
from src.schemas import (
    ChatResponse,
    Intent,
    IntentType,
    Product,
    Recommendation,
    Requirements,
)
from src.agents.sales import SalesDecision
from src.services.session_store import Session
from src.services.dummyjson_client import DummyJsonClient
from src.schemas.search_plan import SearchPlan, ApiCall, PostFilters


# ── Helpers ──────────────────────────────────────────────────────────

def _make_product(id: int = 1, title: str = "Widget", price: float = 9.99, rating: float = 4.5) -> Product:
    return Product(
        id=id,
        title=title,
        description="A nice widget",
        price=price,
        rating=rating,
        brand="Acme",
        category="widgets",
    )


def _make_recommendation(products: list[Product]) -> Recommendation:
    return Recommendation(
        top_pick=products[0],
        alternatives=products[1:],
        message="I recommend the first one!",
    )


def _make_client() -> AsyncMock:
    """Create a mocked DummyJsonClient."""
    client = AsyncMock(spec=DummyJsonClient)
    return client


PATCH_CLASSIFY = "src.core.pipeline.classify_intent"
PATCH_SALES = "src.core.pipeline.run_sales"
PATCH_RECOMMEND = "src.core.pipeline.recommend"


# ── Test 1: Greeting ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_greeting_returns_direct_response():
    intent = Intent(
        intent=IntentType.greeting,
        route_to="direct",
        context="user said hi",
        direct_response="Hello! How can I help you today?",
    )

    with patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent):
        session = Session()
        client = _make_client()
        session, response = await run_turn(session, "hi", client)

    assert response.message == "Hello! How can I help you today?"
    assert response.products == []
    assert response.recommendation is None
    assert len(session.history) == 2


# ── Test 2: Out of scope ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_out_of_scope_returns_direct_response():
    intent = Intent(
        intent=IntentType.out_of_scope,
        route_to="direct",
        context="not shopping related",
        direct_response="I can only help with shopping. What product are you looking for?",
    )

    with patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent):
        session = Session()
        client = _make_client()
        session, response = await run_turn(session, "What is the weather?", client)

    assert "shopping" in response.message.lower() or "product" in response.message.lower()
    assert response.products == []


# ── Test 3: Product discovery → ask_user ────────────────────────────

@pytest.mark.asyncio
async def test_product_discovery_ask_user():
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants a laptop",
    )
    sales_decision = SalesDecision(
        action="ask_user",
        requirements=Requirements(category="laptops"),
        message="What is your budget?",
    )

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
    ):
        session = Session()
        client = _make_client()
        session, response = await run_turn(session, "I need a laptop", client)

    assert response.message == "What is your budget?"
    assert response.products == []
    assert session.requirements is not None
    assert session.requirements.category == "laptops"


# ── Test 4: Product discovery → search → recommend (happy path) ─────

@pytest.mark.asyncio
async def test_product_discovery_search_and_recommend():
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants laptops",
    )
    reqs = Requirements(category="laptops", sort_by="rating", sort_order="desc")
    sales_decision = SalesDecision(
        action="search",
        requirements=reqs,
        message="Let me find laptops for you!",
    )
    products = [_make_product(id=1, title="Laptop A", price=999), _make_product(id=2, title="Laptop B", price=799)]
    rec = _make_recommendation(products)

    client = _make_client()
    client.execute_plan.return_value = products

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
        patch(PATCH_RECOMMEND, new_callable=AsyncMock, return_value=rec),
    ):
        session = Session()
        session, response = await run_turn(session, "Find me a laptop", client)

    assert len(response.products) == 2
    assert response.recommendation is not None
    assert response.recommendation.top_pick.id == 1


# ── Test 5: Product discovery → search → no recommend (single result)

@pytest.mark.asyncio
async def test_single_product_no_recommendation():
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants a specific widget",
    )
    reqs = Requirements(category="widgets", sort_by="rating", sort_order="desc")
    sales_decision = SalesDecision(
        action="search",
        requirements=reqs,
        message="Found a widget for you!",
    )
    products = [_make_product(id=1)]

    client = _make_client()
    client.execute_plan.return_value = products

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
    ):
        session = Session()
        session, response = await run_turn(session, "Find me a widget", client)

    assert len(response.products) == 1
    assert response.recommendation is None
    assert response.message == "Found a widget for you!"


# ── Test 6: Orchestrator failure → fallback to product_discovery ────

@pytest.mark.asyncio
async def test_orchestrator_failure_falls_back():
    sales_decision = SalesDecision(
        action="ask_user",
        requirements=Requirements(),
        message="What are you looking for?",
    )

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, side_effect=RuntimeError("LLM down")),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
    ):
        session = Session()
        client = _make_client()
        session, response = await run_turn(session, "hello", client)

    # Should not raise; falls back to sales flow
    assert response.message == "What are you looking for?"


# ── Test 7: DummyJSON failure → empty products with apology ─────────

@pytest.mark.asyncio
async def test_dummyjson_failure_returns_apology():
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants laptop",
    )
    reqs = Requirements(category="laptops", sort_by="rating", sort_order="desc")
    sales_decision = SalesDecision(
        action="search",
        requirements=reqs,
        message="Searching for laptops!",
    )

    client = _make_client()
    client.execute_plan.side_effect = RuntimeError("Connection refused")

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
    ):
        session = Session()
        session, response = await run_turn(session, "laptops please", client)

    assert response.products == []
    assert "sorry" in response.message.lower() or "trouble" in response.message.lower()


# ── Test 8: Recommendation failure → products without recommendation ─

@pytest.mark.asyncio
async def test_recommendation_failure_returns_products():
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants laptops",
    )
    reqs = Requirements(category="laptops", sort_by="rating", sort_order="desc")
    sales_decision = SalesDecision(
        action="search",
        requirements=reqs,
        message="Here are some laptops!",
    )
    products = [_make_product(id=1, title="Laptop A"), _make_product(id=2, title="Laptop B")]

    client = _make_client()
    client.execute_plan.return_value = products

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
        patch(PATCH_RECOMMEND, new_callable=AsyncMock, side_effect=RuntimeError("LLM down")),
    ):
        session = Session()
        session, response = await run_turn(session, "laptops", client)

    assert len(response.products) == 2
    assert response.recommendation is None
    assert response.message == "Here are some laptops!"


# ── Test 9: Product detail → single product returned ────────────────

@pytest.mark.asyncio
async def test_product_detail_returns_single_product():
    intent = Intent(
        intent=IntentType.product_detail,
        route_to="direct",
        context="product id 42",
    )
    product = _make_product(id=42, title="Super Widget")

    client = _make_client()
    client.get_by_id.return_value = product

    with patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent):
        session = Session()
        session, response = await run_turn(session, "Tell me about product 42", client)

    assert len(response.products) == 1
    assert response.products[0].id == 42
    assert response.products[0].title == "Super Widget"
    client.get_by_id.assert_called_once_with(42)


# ── Test 10: Follow-up → goes through sales flow ────────────────────

@pytest.mark.asyncio
async def test_follow_up_goes_through_sales():
    intent = Intent(
        intent=IntentType.follow_up,
        route_to="sales",
        context="user is refining search",
    )
    reqs = Requirements(category="laptops", max_price=500, sort_by="price", sort_order="asc")
    sales_decision = SalesDecision(
        action="search",
        requirements=reqs,
        message="Searching for cheaper laptops!",
    )
    products = [
        _make_product(id=3, title="Budget Laptop", price=399),
        _make_product(id=4, title="Cheap Laptop", price=449),
    ]
    rec = _make_recommendation(products)

    client = _make_client()
    client.execute_plan.return_value = products

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_decision),
        patch(PATCH_RECOMMEND, new_callable=AsyncMock, return_value=rec),
    ):
        session = Session(requirements=Requirements(category="laptops"))
        session, response = await run_turn(session, "Show me cheaper ones under 500", client)

    assert len(response.products) == 2
    assert response.recommendation is not None
    assert session.requirements.max_price == 500

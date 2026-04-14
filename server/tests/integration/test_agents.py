import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set — skipping integration tests",
)


@pytest.mark.asyncio
async def test_classify_intent_returns_intent():
    from src.agents.orchestrator import classify_intent
    from src.schemas.intent import Intent

    result = await classify_intent("hello", history=[])
    assert isinstance(result, Intent)
    assert result.intent.value == "greeting"
    assert result.route_to == "direct"
    assert result.direct_response is not None


@pytest.mark.asyncio
async def test_classify_intent_product_discovery():
    from src.agents.orchestrator import classify_intent
    from src.schemas.intent import Intent

    result = await classify_intent("I need a laptop under $500", history=[])
    assert isinstance(result, Intent)
    assert result.intent.value == "product_discovery"
    assert result.route_to == "sales"


@pytest.mark.asyncio
async def test_run_sales_returns_decision():
    from src.agents.sales import SalesDecision, run_sales

    result = await run_sales("I need a laptop under $500", history=[])
    assert isinstance(result, SalesDecision)
    assert result.action in ("ask_user", "search")
    assert isinstance(result.message, str)
    assert len(result.message) > 0


@pytest.mark.asyncio
async def test_recommend_returns_recommendation():
    from src.agents.recommendation import recommend
    from src.schemas.product import Product
    from src.schemas.recommendation import Recommendation
    from src.schemas.requirements import Requirements

    products = [
        Product(
            id=1,
            title="Budget Laptop",
            description="A great budget laptop",
            price=399.99,
            rating=4.2,
            brand="Acer",
            category="laptops",
        ),
        Product(
            id=2,
            title="Premium Laptop",
            description="A high-end laptop",
            price=899.99,
            rating=4.8,
            brand="Dell",
            category="laptops",
        ),
    ]
    requirements = Requirements(category="laptops", max_price=500, priority="price")

    result = await recommend(products, requirements, "which laptop should I get?")
    assert isinstance(result, Recommendation)
    assert result.top_pick.id in (1, 2)
    assert isinstance(result.message, str)
    assert len(result.message) > 0

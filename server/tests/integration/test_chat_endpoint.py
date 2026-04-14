"""Integration tests for POST /chat endpoint — agents are mocked, HTTP is real."""

import pytest
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient, ASGITransport

from src.main import create_app
from src.schemas import ChatResponse, Intent, IntentType, Requirements
from src.agents.sales import SalesDecision
from src.core.errors import AgentError


PATCH_CLASSIFY = "src.core.pipeline.classify_intent"
PATCH_SALES = "src.core.pipeline.run_sales"
PATCH_RECOMMEND = "src.core.pipeline.recommend"


@pytest.fixture
def app():
    application = create_app()
    # Manually initialise app.state — ASGITransport does not trigger lifespan.
    from src.services.session_store import InMemorySessionStore
    from src.services.dummyjson_client import DummyJsonClient

    application.state.session_store = InMemorySessionStore()
    application.state.dummyjson_client = DummyJsonClient("https://dummyjson.com")
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await app.state.dummyjson_client.close()


# ── Test 1: Happy path greeting ────────────────────────────────────

@pytest.mark.asyncio
async def test_greeting_returns_200_with_message(client):
    intent = Intent(
        intent=IntentType.greeting,
        route_to="direct",
        context="user said hi",
        direct_response="Hello! How can I help you find products today?",
    )

    with patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent):
        resp = await client.post("/chat", json={"sessionId": "s1", "message": "hi"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Hello! How can I help you find products today?"
    assert body["products"] == []
    assert body["recommendation"] is None


# ── Test 2: Multi-turn persistence ─────────────────────────────────

@pytest.mark.asyncio
async def test_multi_turn_persists_requirements(client):
    """Same sessionId across two calls — requirements should persist."""
    # Turn 1: sales agent asks for budget, saves partial requirements
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants laptop",
    )
    sales_ask = SalesDecision(
        action="ask_user",
        requirements=Requirements(category="laptops"),
        message="What is your budget?",
    )

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=intent),
        patch(PATCH_SALES, new_callable=AsyncMock, return_value=sales_ask),
    ):
        resp1 = await client.post("/chat", json={"sessionId": "persist-1", "message": "I want a laptop"})

    assert resp1.status_code == 200
    assert resp1.json()["message"] == "What is your budget?"

    # Turn 2: follow-up with same session — the pipeline receives the stored session
    follow_intent = Intent(
        intent=IntentType.follow_up,
        route_to="sales",
        context="budget info",
    )
    sales_ask2 = SalesDecision(
        action="ask_user",
        requirements=Requirements(category="laptops", max_price=1000),
        message="Got it, under $1000. Any brand preference?",
    )

    # Capture history at call time (before _update_session mutates it)
    captured_history_len = None

    async def capturing_sales(message, history, requirements):
        nonlocal captured_history_len
        captured_history_len = len(history)
        return sales_ask2

    with (
        patch(PATCH_CLASSIFY, new_callable=AsyncMock, return_value=follow_intent),
        patch(PATCH_SALES, side_effect=capturing_sales),
    ):
        resp2 = await client.post("/chat", json={"sessionId": "persist-1", "message": "Under 1000"})

    assert resp2.status_code == 200
    assert resp2.json()["message"] == "Got it, under $1000. Any brand preference?"
    # Verify sales agent received conversation history from turn 1
    assert captured_history_len == 2  # one user + one assistant message from turn 1


# ── Test 3: Session isolation ──────────────────────────────────────

@pytest.mark.asyncio
async def test_session_isolation(client):
    """Different sessionIds should not leak state."""
    intent = Intent(
        intent=IntentType.product_discovery,
        route_to="sales",
        context="user wants laptop",
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
        await client.post("/chat", json={"sessionId": "session-A", "message": "I want a laptop"})

    # Now call with a different sessionId — sales agent should get empty history
    greeting_intent = Intent(
        intent=IntentType.greeting,
        route_to="direct",
        context="user said hello",
        direct_response="Hi there!",
    )

    # Capture history at call time (before _update_session mutates it)
    captured_history_len = None

    async def capturing_classify(message, history):
        nonlocal captured_history_len
        captured_history_len = len(history)
        return greeting_intent

    with patch(PATCH_CLASSIFY, side_effect=capturing_classify):
        resp = await client.post("/chat", json={"sessionId": "session-B", "message": "hello"})

    assert resp.status_code == 200
    # Verify classify_intent received empty history for the new session
    assert captured_history_len == 0


# ── Test 4: Error path — AgentError returns friendly message ───────

@pytest.mark.asyncio
async def test_agent_error_returns_friendly_message(client):
    """When the pipeline raises AgentError, we get 200 with a friendly message, never 500."""
    with patch(PATCH_CLASSIFY, new_callable=AsyncMock, side_effect=AgentError("LLM exploded")):
        # AgentError is raised inside run_turn which calls classify_intent;
        # however classify_intent failures are caught inside _run_pipeline.
        # We need to patch run_turn itself to raise AgentError.
        pass

    with patch("src.api.chat.run_turn", new_callable=AsyncMock, side_effect=AgentError("LLM exploded")):
        resp = await client.post("/chat", json={"sessionId": "err-1", "message": "find me shoes"})

    assert resp.status_code == 200
    body = resp.json()
    assert "hiccup" in body["message"].lower() or "rephrase" in body["message"].lower()
    assert body["products"] == []


# ── Test 5: Error path — unexpected Exception returns friendly message

@pytest.mark.asyncio
async def test_unexpected_error_returns_friendly_message(client):
    """Unexpected exceptions should also return 200 with a friendly message."""
    with patch("src.api.chat.run_turn", new_callable=AsyncMock, side_effect=RuntimeError("totally unexpected")):
        resp = await client.post("/chat", json={"sessionId": "err-2", "message": "find me shoes"})

    assert resp.status_code == 200
    body = resp.json()
    assert "wrong" in body["message"].lower() or "try again" in body["message"].lower()
    assert body["products"] == []

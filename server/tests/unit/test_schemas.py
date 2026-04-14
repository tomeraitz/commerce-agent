import pytest
from pydantic import ValidationError

from src.schemas.intent import Intent, IntentType
from src.schemas.requirements import Requirements
from src.schemas.search_plan import ApiCall, PostFilters, SearchPlan
from src.schemas.product import Product
from src.schemas.recommendation import Recommendation
from src.schemas.chat import ChatRequest, ChatResponse


# --- Fixtures ---

@pytest.fixture
def sample_product_data():
    return {
        "id": 1,
        "title": "Test Laptop",
        "description": "A great laptop",
        "price": 999.99,
        "rating": 4.5,
    }


@pytest.fixture
def sample_product(sample_product_data):
    return Product(**sample_product_data)


# --- IntentType ---

def test_intent_type_from_string():
    assert IntentType("greeting") == IntentType.greeting


def test_intent_type_invalid_raises():
    with pytest.raises(ValueError):
        IntentType("invalid_intent")


# --- Intent ---

def test_intent_full():
    intent = Intent(
        intent=IntentType.greeting,
        route_to="direct",
        context="user said hello",
        direct_response="Hi there!",
    )
    assert intent.intent == IntentType.greeting
    assert intent.direct_response == "Hi there!"
    data = intent.model_dump()
    assert data["intent"] == "greeting"
    roundtrip = Intent.model_validate(data)
    assert roundtrip == intent


def test_intent_without_direct_response():
    intent = Intent(
        intent="product_discovery",
        route_to="sales_agent",
        context="looking for laptops",
    )
    assert intent.direct_response is None
    assert intent.intent == IntentType.product_discovery


def test_intent_enum_coercion():
    """String value is coerced to IntentType enum."""
    intent = Intent(intent="follow_up", route_to="sales_agent", context="ctx")
    assert isinstance(intent.intent, IntentType)
    assert intent.intent is IntentType.follow_up


def test_intent_invalid_enum():
    with pytest.raises(ValidationError):
        Intent(intent="not_real", route_to="x", context="y")


# --- Requirements ---

def test_requirements_defaults():
    req = Requirements()
    assert req.category is None
    assert req.keywords == []
    assert req.min_price is None
    assert req.max_price is None
    assert req.brand is None
    assert req.min_rating is None
    assert req.sort_by == "rating"
    assert req.sort_order == "desc"
    assert req.priority is None


def test_requirements_full():
    req = Requirements(
        category="laptops",
        keywords=["gaming", "16gb"],
        min_price=500,
        max_price=1500,
        brand="Dell",
        min_rating=4.0,
        sort_by="price",
        sort_order="asc",
        priority="quality",
    )
    data = req.model_dump()
    roundtrip = Requirements.model_validate(data)
    assert roundtrip == req


# --- SearchPlan ---

def test_search_plan_roundtrip():
    plan = SearchPlan(
        api_calls=[
            ApiCall(path="/products/category/laptops"),
            ApiCall(method="GET", path="/products/search?q=gaming+laptop"),
        ],
        post_filters=PostFilters(min_price=500, max_price=1500),
        limit=5,
    )
    data = plan.model_dump()
    roundtrip = SearchPlan.model_validate(data)
    assert roundtrip == plan
    assert len(roundtrip.api_calls) == 2
    assert roundtrip.api_calls[0].method == "GET"


def test_search_plan_defaults():
    plan = SearchPlan(api_calls=[ApiCall(path="/products")])
    assert plan.post_filters == PostFilters()
    assert plan.limit == 10


# --- Product ---

def test_product_minimal(sample_product_data):
    product = Product(**sample_product_data)
    assert product.brand == ""
    assert product.category == ""
    assert product.thumbnail == ""
    assert product.images == []
    assert product.stock == 0


def test_product_full():
    product = Product(
        id=2,
        title="Phone",
        description="A phone",
        price=799.0,
        rating=4.8,
        brand="Apple",
        category="smartphones",
        thumbnail="https://img.com/thumb.jpg",
        images=["https://img.com/1.jpg", "https://img.com/2.jpg"],
        stock=50,
    )
    data = product.model_dump()
    roundtrip = Product.model_validate(data)
    assert roundtrip == product


def test_product_roundtrip(sample_product):
    data = sample_product.model_dump()
    roundtrip = Product.model_validate(data)
    assert roundtrip == sample_product


# --- Recommendation ---

def test_recommendation(sample_product):
    rec = Recommendation(
        top_pick=sample_product,
        alternatives=[sample_product],
        cross_sell="Consider a laptop bag",
        message="Here is our top pick!",
    )
    data = rec.model_dump()
    roundtrip = Recommendation.model_validate(data)
    assert roundtrip == rec


def test_recommendation_minimal(sample_product):
    rec = Recommendation(top_pick=sample_product, message="Top pick")
    assert rec.alternatives == []
    assert rec.cross_sell is None


# --- ChatRequest ---

def test_chat_request():
    req = ChatRequest(sessionId="abc-123", message="I need a laptop")
    data = req.model_dump()
    assert data["sessionId"] == "abc-123"
    roundtrip = ChatRequest.model_validate(data)
    assert roundtrip == req


# --- ChatResponse ---

def test_chat_response_minimal():
    resp = ChatResponse(message="Hello!")
    assert resp.products == []
    assert resp.recommendation is None


def test_chat_response_with_products(sample_product):
    resp = ChatResponse(
        message="Found products",
        products=[sample_product],
    )
    data = resp.model_dump()
    roundtrip = ChatResponse.model_validate(data)
    assert roundtrip == resp
    assert len(roundtrip.products) == 1


def test_chat_response_with_recommendation(sample_product):
    rec = Recommendation(top_pick=sample_product, message="Best choice")
    resp = ChatResponse(
        message="Here you go",
        products=[sample_product],
        recommendation=rec,
    )
    data = resp.model_dump()
    roundtrip = ChatResponse.model_validate(data)
    assert roundtrip == resp
    assert roundtrip.recommendation is not None
    assert roundtrip.recommendation.top_pick.id == 1

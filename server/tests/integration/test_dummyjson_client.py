import json

import httpx
import pytest

from src.schemas.search_plan import ApiCall, SearchPlan
from src.services.dummyjson_client import DummyJsonClient

SAMPLE_PRODUCT = {
    "id": 1,
    "title": "Test Phone",
    "description": "A phone",
    "price": 599.0,
    "rating": 4.5,
    "brand": "TestBrand",
    "category": "smartphones",
    "thumbnail": "https://example.com/img.jpg",
    "images": [],
    "stock": 10,
}

SAMPLE_PRODUCT_2 = {
    "id": 2,
    "title": "Test Laptop",
    "description": "A laptop",
    "price": 999.0,
    "rating": 4.8,
    "brand": "LaptopBrand",
    "category": "laptops",
    "thumbnail": "https://example.com/img2.jpg",
    "images": [],
    "stock": 5,
}


def _make_transport(handler):
    return httpx.MockTransport(handler)


def _success_list_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={"products": [SAMPLE_PRODUCT, SAMPLE_PRODUCT_2]},
    )


def _success_single_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=SAMPLE_PRODUCT)


@pytest.fixture
def list_client():
    client = DummyJsonClient.__new__(DummyJsonClient)
    client._base_url = "https://dummyjson.com"
    client._client = httpx.AsyncClient(
        base_url="https://dummyjson.com",
        transport=_make_transport(_success_list_handler),
    )
    return client


@pytest.fixture
def single_client():
    client = DummyJsonClient.__new__(DummyJsonClient)
    client._base_url = "https://dummyjson.com"
    client._client = httpx.AsyncClient(
        base_url="https://dummyjson.com",
        transport=_make_transport(_success_single_handler),
    )
    return client


async def test_get_products_parses_list(list_client):
    products = await list_client.get_products(limit=20)
    assert len(products) == 2
    assert products[0].id == 1
    assert products[1].title == "Test Laptop"
    await list_client.close()


async def test_search_parses_list(list_client):
    products = await list_client.search("phone", limit=10)
    assert len(products) == 2
    await list_client.close()


async def test_get_by_category_parses_list(list_client):
    products = await list_client.get_by_category("smartphones")
    assert len(products) == 2
    await list_client.close()


async def test_get_by_id_parses_single(single_client):
    product = await single_client.get_by_id(1)
    assert product.id == 1
    assert product.title == "Test Phone"
    await single_client.close()


async def test_execute_plan_deduplicates(list_client):
    plan = SearchPlan(
        api_calls=[
            ApiCall(path="/products/category/smartphones?limit=20"),
            ApiCall(path="/products/search?q=phone"),
        ],
    )
    products = await list_client.execute_plan(plan)
    # Both calls return the same 2 products, should be deduplicated
    assert len(products) == 2
    assert {p.id for p in products} == {1, 2}
    await list_client.close()


async def test_retry_on_500():
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(500, json={"message": "Internal Server Error"})
        return httpx.Response(200, json={"products": [SAMPLE_PRODUCT]})

    client = DummyJsonClient.__new__(DummyJsonClient)
    client._base_url = "https://dummyjson.com"
    client._client = httpx.AsyncClient(
        base_url="https://dummyjson.com",
        transport=_make_transport(handler),
    )

    products = await client.get_products()
    assert len(products) == 1
    assert call_count == 3  # 1 initial + 2 retries
    await client.close()


async def test_no_retry_on_404():
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(404, json={"message": "Not Found"})

    client = DummyJsonClient.__new__(DummyJsonClient)
    client._base_url = "https://dummyjson.com"
    client._client = httpx.AsyncClient(
        base_url="https://dummyjson.com",
        transport=_make_transport(handler),
    )

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await client.get_products()
    assert exc_info.value.response.status_code == 404
    assert call_count == 1  # no retries for 4xx
    await client.close()


async def test_execute_plan_concurrent_calls():
    """Verify that execute_plan makes all API calls (concurrently via gather)."""
    paths_called = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths_called.append(request.url.path + ("?" + request.url.query.decode() if request.url.query else ""))
        return httpx.Response(
            200,
            json={"products": [SAMPLE_PRODUCT]},
        )

    client = DummyJsonClient.__new__(DummyJsonClient)
    client._base_url = "https://dummyjson.com"
    client._client = httpx.AsyncClient(
        base_url="https://dummyjson.com",
        transport=_make_transport(handler),
    )

    plan = SearchPlan(
        api_calls=[
            ApiCall(path="/products/category/laptops?limit=20"),
            ApiCall(path="/products/search?q=laptop"),
        ],
    )
    products = await client.execute_plan(plan)
    assert len(paths_called) == 2
    assert len(products) == 1  # deduplicated (same product from both calls)
    await client.close()

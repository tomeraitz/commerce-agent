import pytest

from src.schemas.requirements import Requirements
from src.services.search_planner import build_search_plan


@pytest.mark.parametrize(
    "requirements, expected_paths, expected_filters",
    [
        pytest.param(
            Requirements(category="Laptops"),
            ["/products/category/laptops?limit=20"],
            {"min_price": None, "max_price": None, "min_rating": None, "brand": None},
            id="category_only",
        ),
        pytest.param(
            Requirements(keywords=["gaming", "mouse"]),
            ["/products/search?q=gaming+mouse"],
            {"min_price": None, "max_price": None, "min_rating": None, "brand": None},
            id="keywords_only",
        ),
        pytest.param(
            Requirements(category="Phones", keywords=["samsung"]),
            [
                "/products/category/phones?limit=20",
                "/products/search?q=samsung",
            ],
            {"min_price": None, "max_price": None, "min_rating": None, "brand": None},
            id="category_and_keywords",
        ),
        pytest.param(
            Requirements(
                min_price=100,
                max_price=500,
                min_rating=4.0,
                brand="Apple",
            ),
            ["/products?limit=20"],
            {"min_price": 100, "max_price": 500, "min_rating": 4.0, "brand": "Apple"},
            id="price_rating_brand_filters",
        ),
        pytest.param(
            Requirements(),
            ["/products?limit=20"],
            {"min_price": None, "max_price": None, "min_rating": None, "brand": None},
            id="no_category_no_keywords_fallback",
        ),
    ],
)
def test_build_search_plan(requirements, expected_paths, expected_filters):
    plan = build_search_plan(requirements)

    actual_paths = [call.path for call in plan.api_calls]
    assert actual_paths == expected_paths

    assert plan.post_filters.min_price == expected_filters["min_price"]
    assert plan.post_filters.max_price == expected_filters["max_price"]
    assert plan.post_filters.min_rating == expected_filters["min_rating"]
    assert plan.post_filters.brand == expected_filters["brand"]


def test_category_slug_with_spaces():
    plan = build_search_plan(Requirements(category="Home Decoration"))
    assert plan.api_calls[0].path == "/products/category/home-decoration?limit=20"

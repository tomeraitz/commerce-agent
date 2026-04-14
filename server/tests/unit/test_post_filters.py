import pytest

from src.schemas.product import Product
from src.schemas.search_plan import PostFilters
from src.services.post_filters import apply_filters, sort_and_slice


def _make_product(**overrides) -> Product:
    defaults = dict(
        id=1,
        title="Test",
        description="desc",
        price=100.0,
        rating=4.0,
        brand="BrandA",
    )
    defaults.update(overrides)
    return Product(**defaults)


PRODUCTS = [
    _make_product(id=1, title="Alpha", price=50.0, rating=4.5, brand="Apple"),
    _make_product(id=2, title="Beta", price=150.0, rating=3.5, brand="Samsung"),
    _make_product(id=3, title="Gamma", price=200.0, rating=4.0, brand="apple"),
    _make_product(id=4, title="Delta", price=300.0, rating=5.0, brand="Sony"),
]


class TestApplyFilters:
    def test_min_price_inclusive(self):
        result = apply_filters(PRODUCTS, PostFilters(min_price=150.0))
        assert all(p.price >= 150.0 for p in result)
        assert len(result) == 3

    def test_max_price_inclusive(self):
        result = apply_filters(PRODUCTS, PostFilters(max_price=150.0))
        assert all(p.price <= 150.0 for p in result)
        assert len(result) == 2

    def test_min_and_max_price(self):
        result = apply_filters(PRODUCTS, PostFilters(min_price=100.0, max_price=200.0))
        assert len(result) == 2
        assert {p.id for p in result} == {2, 3}

    def test_brand_case_insensitive(self):
        result = apply_filters(PRODUCTS, PostFilters(brand="apple"))
        assert len(result) == 2
        assert {p.id for p in result} == {1, 3}

    def test_rating_threshold(self):
        result = apply_filters(PRODUCTS, PostFilters(min_rating=4.0))
        assert len(result) == 3
        assert all(p.rating >= 4.0 for p in result)

    def test_no_filters(self):
        result = apply_filters(PRODUCTS, PostFilters())
        assert len(result) == 4

    def test_empty_product_list(self):
        result = apply_filters([], PostFilters(min_price=10.0))
        assert result == []


class TestSortAndSlice:
    def test_sort_price_asc(self):
        result = sort_and_slice(PRODUCTS, "price", "asc", 10)
        assert [p.price for p in result] == [50.0, 150.0, 200.0, 300.0]

    def test_sort_price_desc(self):
        result = sort_and_slice(PRODUCTS, "price", "desc", 10)
        assert [p.price for p in result] == [300.0, 200.0, 150.0, 50.0]

    def test_sort_rating(self):
        result = sort_and_slice(PRODUCTS, "rating", "desc", 10)
        assert result[0].rating == 5.0

    def test_sort_title(self):
        result = sort_and_slice(PRODUCTS, "title", "asc", 10)
        assert [p.title for p in result] == ["Alpha", "Beta", "Delta", "Gamma"]

    def test_limit_slicing(self):
        result = sort_and_slice(PRODUCTS, "price", "asc", 2)
        assert len(result) == 2
        assert result[0].price == 50.0
        assert result[1].price == 150.0

    def test_empty_list(self):
        result = sort_and_slice([], "price", "asc", 10)
        assert result == []

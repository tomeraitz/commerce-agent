from urllib.parse import quote_plus

from src.schemas.requirements import Requirements
from src.schemas.search_plan import ApiCall, PostFilters, SearchPlan


def _slug(value: str) -> str:
    return value.strip().lower().replace(" ", "-").replace("_", "-")


def build_search_plan(requirements: Requirements) -> SearchPlan:
    """Build a plan of DummyJSON calls to satisfy *requirements*.

    When a category is given we *always* issue both a category lookup and a
    keyword search for that same term. If the category slug happens to match
    DummyJSON exactly (e.g. "smartphones"), the category call wins and the
    search call is redundant but cheap. If the slug is slightly off (e.g.
    "smartphone" — singular), the category call returns nothing and the
    search call recovers the results. `DummyJsonClient.execute_plan`
    deduplicates across calls, so callers see a single merged list either
    way.
    """
    api_calls: list[ApiCall] = []

    if requirements.category:
        category_slug = _slug(requirements.category)
        api_calls.append(ApiCall(path=f"/products/category/{category_slug}?limit=20"))
        # Belt-and-braces: also search for the category text, so a wrong slug
        # still returns something.
        api_calls.append(
            ApiCall(path=f"/products/search?q={quote_plus(requirements.category.strip())}&limit=20")
        )

    if requirements.keywords:
        joined = " ".join(requirements.keywords)
        api_calls.append(
            ApiCall(path=f"/products/search?q={quote_plus(joined)}&limit=20")
        )

    if not api_calls:
        api_calls.append(ApiCall(path="/products?limit=20"))

    post_filters = PostFilters(
        min_price=requirements.min_price,
        max_price=requirements.max_price,
        min_rating=requirements.min_rating,
        brand=requirements.brand,
    )

    return SearchPlan(
        api_calls=api_calls,
        post_filters=post_filters,
        limit=10,
    )

from src.schemas.requirements import Requirements
from src.schemas.search_plan import ApiCall, PostFilters, SearchPlan


def build_search_plan(requirements: Requirements) -> SearchPlan:
    api_calls: list[ApiCall] = []

    if requirements.category:
        slug = requirements.category.lower().replace(" ", "-")
        api_calls.append(ApiCall(path=f"/products/category/{slug}?limit=20"))

    if requirements.keywords:
        joined = "+".join(requirements.keywords)
        api_calls.append(ApiCall(path=f"/products/search?q={joined}"))

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

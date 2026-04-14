from src.schemas.product import Product
from src.schemas.search_plan import PostFilters


def apply_filters(products: list[Product], post_filters: PostFilters) -> list[Product]:
    result = products

    if post_filters.min_price is not None:
        result = [p for p in result if p.price >= post_filters.min_price]

    if post_filters.max_price is not None:
        result = [p for p in result if p.price <= post_filters.max_price]

    if post_filters.min_rating is not None:
        result = [p for p in result if p.rating >= post_filters.min_rating]

    if post_filters.brand is not None:
        brand_lower = post_filters.brand.lower()
        result = [p for p in result if p.brand.lower() == brand_lower]

    return result


def sort_and_slice(
    products: list[Product],
    sort_by: str,
    sort_order: str,
    limit: int,
) -> list[Product]:
    reverse = sort_order == "desc"
    sorted_products = sorted(
        products,
        key=lambda p: getattr(p, sort_by),
        reverse=reverse,
    )
    return sorted_products[:limit]

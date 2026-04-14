from pydantic import BaseModel

class Requirements(BaseModel):
    category: str | None = None
    keywords: list[str] = []
    min_price: float | None = None
    max_price: float | None = None
    brand: str | None = None
    min_rating: float | None = None
    sort_by: str = "rating"  # "price", "rating", "title"
    sort_order: str = "desc"  # "asc", "desc"
    priority: str | None = None  # "quality", "price", "brand"

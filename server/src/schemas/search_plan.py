from pydantic import BaseModel

class ApiCall(BaseModel):
    method: str = "GET"
    path: str  # e.g. "/products/category/laptops" or "/products/search?q=laptop"

class PostFilters(BaseModel):
    min_price: float | None = None
    max_price: float | None = None
    min_rating: float | None = None
    brand: str | None = None

class SearchPlan(BaseModel):
    api_calls: list[ApiCall]
    post_filters: PostFilters = PostFilters()
    limit: int = 10

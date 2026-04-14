from pydantic import BaseModel
from src.schemas.product import Product

class Recommendation(BaseModel):
    top_pick: Product
    alternatives: list[Product] = []
    cross_sell: str | None = None
    message: str

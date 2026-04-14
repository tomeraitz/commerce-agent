from pydantic import BaseModel
from src.schemas.product import Product
from src.schemas.recommendation import Recommendation

class ChatRequest(BaseModel):
    sessionId: str
    message: str

class ChatResponse(BaseModel):
    message: str
    products: list[Product] = []
    recommendation: Recommendation | None = None

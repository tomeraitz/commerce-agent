from pydantic import BaseModel

class Product(BaseModel):
    id: int
    title: str
    description: str
    price: float
    rating: float
    brand: str = ""
    category: str = ""
    thumbnail: str = ""
    images: list[str] = []
    stock: int = 0

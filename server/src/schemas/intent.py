from enum import Enum
from pydantic import BaseModel

class IntentType(str, Enum):
    greeting = "greeting"
    out_of_scope = "out_of_scope"
    product_discovery = "product_discovery"
    follow_up = "follow_up"
    product_detail = "product_detail"
    comparison = "comparison"

class Intent(BaseModel):
    intent: IntentType
    route_to: str  # agent name or "direct"
    context: str  # brief reasoning
    direct_response: str | None = None  # only for greeting/out_of_scope

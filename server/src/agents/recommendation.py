from functools import lru_cache
from pathlib import Path

from pydantic_ai import Agent

from src.config import settings
from src.schemas.product import Product
from src.schemas.recommendation import Recommendation
from src.schemas.requirements import Requirements

_prompt = (Path(__file__).parent / "prompts" / "recommendation.md").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _get_agent() -> Agent[None, Recommendation]:
    return Agent(
        model=f"openai:{settings.model_mini}",
        system_prompt=_prompt,
        result_type=Recommendation,
    )


async def recommend(
    products: list[Product],
    requirements: Requirements,
    user_message: str,
) -> Recommendation:
    """Generate a product recommendation from a list of products."""
    products_json = "\n".join(p.model_dump_json() for p in products)

    user_prompt = (
        f"User requirements:\n{requirements.model_dump_json(exclude_none=True)}\n\n"
        f"Available products:\n{products_json}\n\n"
        f"User message: {user_message}"
    )
    result = await _get_agent().run(user_prompt)
    return result.data

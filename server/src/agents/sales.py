from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel
from pydantic_ai import Agent

from src.config import settings
from src.schemas.requirements import Requirements

_prompt = (Path(__file__).parent / "prompts" / "sales.md").read_text(encoding="utf-8")


class SalesDecision(BaseModel):
    action: str  # "ask_user" or "search"
    requirements: Requirements | None = None
    message: str  # question to user or search confirmation


@lru_cache(maxsize=1)
def _get_agent() -> Agent[None, SalesDecision]:
    return Agent(
        model=f"openai:{settings.model_mini}",
        system_prompt=_prompt,
        result_type=SalesDecision,
    )


async def run_sales(
    message: str,
    history: list[dict],
    partial_requirements: Requirements | None = None,
) -> SalesDecision:
    """Gather requirements from the user or decide to search."""
    parts: list[str] = []

    if history:
        lines = []
        for turn in history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            lines.append(f"{role}: {content}")
        parts.append("Conversation history:\n" + "\n".join(lines))

    if partial_requirements:
        parts.append(
            f"Requirements gathered so far:\n{partial_requirements.model_dump_json(exclude_none=True)}"
        )

    parts.append(f"Current user message: {message}")

    user_prompt = "\n\n".join(parts)
    result = await _get_agent().run(user_prompt)
    return result.data

from functools import lru_cache
from pathlib import Path

import structlog
from pydantic import BaseModel
from pydantic_ai import Agent

from src.config import settings
from src.schemas.requirements import Requirements
from src.services.dummyjson_client import DummyJsonClient

_prompt = (Path(__file__).parent / "prompts" / "sales.md").read_text(encoding="utf-8")
_logger = structlog.get_logger()


class SalesDecision(BaseModel):
    action: str  # "ask_user" or "search"
    requirements: Requirements | None = None
    message: str  # question to user or search confirmation


@lru_cache(maxsize=1)
def _get_agent() -> Agent[None, SalesDecision]:
    return Agent(
        model=f"openai:{settings.model_mini}",
        system_prompt=_prompt,
        output_type=SalesDecision,
    )


async def run_sales(
    message: str,
    history: list[dict],
    partial_requirements: Requirements | None = None,
    client: DummyJsonClient | None = None,
) -> SalesDecision:
    """Gather requirements from the user or decide to search."""
    parts: list[str] = []

    # Inject the live catalog category list so the agent picks a real slug
    # (or leaves `category` null) instead of inventing one like "wall art".
    if client is not None:
        try:
            categories = await client.get_categories()
            if categories:
                parts.append(
                    "Valid `category` slugs in the current catalog (use EXACTLY one "
                    "of these for `requirements.category`, or leave it null and rely "
                    "on `keywords`):\n"
                    + ", ".join(categories)
                )
        except Exception as exc:
            _logger.warning("get_categories failed, continuing without injection", error=str(exc))

        # Inject a per-category snapshot of real product titles so the agent
        # only offers product *types* that actually exist in the catalog.
        try:
            snapshot = await client.get_catalog_snapshot()
            if snapshot:
                lines = [
                    f"- {slug}: {', '.join(titles)}"
                    for slug, titles in sorted(snapshot.items())
                ]
                parts.append(
                    "Catalog snapshot (real product titles per category — use these "
                    "as the ground truth for what the store actually sells; do NOT "
                    "offer or promise product types that do not appear here):\n"
                    + "\n".join(lines)
                )
        except Exception as exc:
            _logger.warning("get_catalog_snapshot failed, continuing without injection", error=str(exc))

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
    return result.output

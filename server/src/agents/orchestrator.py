from functools import lru_cache
from pathlib import Path

from pydantic_ai import Agent

from src.config import settings
from src.schemas.intent import Intent

_prompt = (Path(__file__).parent / "prompts" / "orchestrator.md").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _get_agent() -> Agent[None, Intent]:
    return Agent(
        model=f"openai:{settings.model_nano}",
        system_prompt=_prompt,
        output_type=Intent,
    )


async def classify_intent(message: str, history: list[dict]) -> Intent:
    """Classify a user message into an intent using conversation history."""
    history_text = ""
    if history:
        lines = []
        for turn in history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            lines.append(f"{role}: {content}")
        history_text = "Conversation history:\n" + "\n".join(lines) + "\n\n"

    user_prompt = f"{history_text}Current user message: {message}"
    result = await _get_agent().run(user_prompt)
    return result.output

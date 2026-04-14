# AI Shopping Copilot Server

## Setup

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY in .env
uv sync
```

## Run

```bash
uv run uvicorn src.main:app --reload
```

## Test

```bash
uv run pytest
```

## Eval

```bash
uv run pytest tests/eval/
```

# AI Shopping Copilot Server

## Setup

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY in .env
uv sync
```

## Run

```bash
python -m uv run uvicorn src.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

## Test

```bash
uv run pytest
```

## Eval

```bash
uv run pytest tests/eval/
```

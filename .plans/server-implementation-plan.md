# Server Implementation Plan — AI Shopping Copilot

Source of truth: [.design/project-server-system-design.md](../../.design/project-server-system-design.md). Every phase below maps to files and decisions already fixed in the design doc — when in doubt, the design doc wins.

The phases are ordered so each one **compiles, tests, and runs on its own**. No phase depends on code that hasn't been written yet. You should be able to stop after any phase and have a working (if reduced) system.

---

## Phase 0 — Project scaffolding

**Goal:** an empty FastAPI app that boots, responds to `/health`, and has the full folder tree in place.

**Deliverables**
- `server/pyproject.toml` with deps: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `python-dotenv`, `pydantic-ai`, `httpx`, `tenacity`, `structlog`, `pytest`, `pytest-asyncio`.
- `server/.python-version` → `3.12`.
- `server/.env.example` listing `OPENAI_API_KEY`, `DUMMYJSON_BASE_URL`, `MODEL_NANO`, `MODEL_MINI`, `LOG_LEVEL`.
- `server/README.md` with run/test/eval commands.
- Full empty folder tree from the design doc: `src/{api,agents,schemas,services,core,middleware}`, `tests/{unit,integration,eval}`, `agents/prompts/`.
- `src/config.py` — `pydantic-settings` `Settings` class loading from env.
- `src/main.py` — FastAPI app factory, no routers yet.
- `src/api/health.py` — `GET /health` → `{"status": "ok"}`.

**Done when**
- `uv run uvicorn src.main:app` boots cleanly.
- `curl localhost:8000/health` returns 200.
- `pytest` runs (zero tests, zero failures).

---

## Phase 1 — Schemas (the typed boundaries)

**Goal:** every pydantic model the pipeline passes between agents and services exists and is unit-tested in isolation. No behavior yet — just shapes.

**Deliverables** (all under `src/schemas/`)
- `intent.py` — `IntentType` enum (`greeting`, `out_of_scope`, `product_discovery`, `follow_up`, `product_detail`, `comparison`), `Intent` model (`intent`, `route_to`, `context`, `direct_response?`).
- `requirements.py` — `Requirements` (category, keywords, min/max price, brand, min rating, sort_by, sort_order, priority).
- `search_plan.py` — `ApiCall`, `PostFilters`, `SearchPlan { api_calls[], post_filters, limit }`.
- `product.py` — DummyJSON product shape (id, title, description, price, rating, brand, category, thumbnail, images, stock).
- `recommendation.py` — `Recommendation { top_pick, alternatives, cross_sell?, message }`.
- `chat.py` — wire contract: `ChatRequest { sessionId, message }`, `ChatResponse { message, products[], recommendation? }`.

**Tests** — `tests/unit/test_schemas.py` — validation round-trip per model, required-vs-optional fields, enum coercion.

**Done when**
- All schemas import without circular-import issues.
- `pytest tests/unit/test_schemas.py` green.

---

## Phase 2 — Deterministic services (no LLMs yet)

**Goal:** everything in `services/` that is pure Python, because these are the easiest to test and the pipeline leans on them.

**Deliverables**
- `services/session_store.py` — `SessionStore` Protocol (`get`, `save`, `clear`) + `InMemorySessionStore` dict-backed default. Session shape: `history`, `requirements`, `last_products`.
- `services/search_planner.py` — `build_search_plan(requirements: Requirements) -> SearchPlan`. Deterministic mapping: category → `/products/category/{slug}`, free-text → `/products/search?q=…`, everything else → `post_filters`.
- `services/post_filters.py` — `apply_filters(products, post_filters) -> list[Product]` + `sort_and_slice(products, sort_by, sort_order, limit)`. Handles `minPrice`, `maxPrice`, `minRating`, `brand`.
- `services/dummyjson_client.py` — `DummyJsonClient` wrapping `httpx.AsyncClient`. Methods: `get_by_category`, `search`, `get_by_id`. Timeouts per design (`connect=3s, read=10s`). `tenacity` retry decorator: **2 retries, backoff 0.5s → 2s, only on 5xx / network errors**.

**Tests** — `tests/unit/`
- `test_session_store.py` — get/save/clear semantics, missing-session returns empty.
- `test_search_planner.py` — table of (Requirements → SearchPlan) mappings covering category-only, keyword-only, combined, and post-filter-only cases.
- `test_post_filters.py` — min/max price boundaries, brand exact-match, rating threshold, sort stability, limit slicing.
- `tests/integration/test_dummyjson_client.py` — mocked transport verifying retry on 500, no retry on 404, timeout enforcement.

**Done when** — `pytest` green, no LLM keys required to run the suite.

---

## Phase 3 — Agents (one at a time)

**Goal:** all three `pydantic-ai` agents exist as isolated callable units. Each is developed and tested independently before the pipeline wires them together.

**Order matters** — do them in this order so each has its inputs available from the previous phase's schemas.

### 3a — Orchestrator agent
- `src/agents/prompts/orchestrator.md` — system prompt for intent classification.
- `src/agents/orchestrator.py` — `classify_intent(message, history) -> Intent` using `gpt-5.4-nano`.
- **Eval harness seed** — `tests/eval/intent_classification.jsonl` with **20–50** labeled pairs. Marker: `pytest -m eval`. Target: ≥90% accuracy.

### 3b — Sales agent
- `src/agents/prompts/sales.md` — system prompt.
- `src/agents/sales.py` — `run_sales(message, history, partial_requirements) -> SalesDecision` where `SalesDecision = { action: "ask_user" | "search", requirements?, message }`. Model: `gpt-5.4-mini`.

### 3c — Recommendation agent
- `src/agents/prompts/recommendation.md` — system prompt.
- `src/agents/recommendation.py` — `recommend(products, requirements, user_message) -> Recommendation`. Model: `gpt-5.4-mini`.

**Tests** — `tests/integration/test_agents.py` — one smoke test per agent using real OpenAI (gated behind an env flag so CI without a key still passes). Assertions focus on **schema validity**, not phrasing.

**Done when** — each agent can be invoked from a REPL and returns a valid pydantic object for a known-good input.

---

## Phase 4 — Core pipeline (the seam)

**Goal:** `core/pipeline.py` glues agents + services into `run_turn(session, message) -> (updated_session, ChatResponse)`. This is the only place the branching logic from the sequence diagram lives.

**Deliverables**
- `src/core/errors.py` — `AgentError`, `UpstreamError`, `PipelineTimeoutError`.
- `src/core/pipeline.py` — implements the 6 steps from the sequence diagram:
  1. Orchestrator → intent (fallback to `product_discovery` on failure).
  2. Short-circuit branches for `greeting` / `out_of_scope` / `product_detail` / `comparison`.
  3. Sales → `ask_user` or `search`.
  4. `build_search_plan` → execute `api_calls` concurrently via `asyncio.gather`.
  5. `apply_filters` + `sort_and_slice`.
  6. Recommendation **only if** `len(products) >= 2` OR intent is `comparison` OR priority in {`quality`, `price`}.
- Per-turn budget: `asyncio.wait_for(pipeline(...), timeout=20.0)`.
- Read-once / write-once session semantics — session mutation is confined to the pipeline entry/exit.

**Tests** — `tests/integration/test_pipeline.py` — each branch of the sequence diagram, with agents stubbed to return canned pydantic objects and `DummyJsonClient` stubbed with VCR-style fixtures.

**Done when**
- Every branch in the sequence diagram has a passing test.
- Failure isolation matches the design doc (Orchestrator soft, Sales hard, DummyJSON isolated, Recommendation isolated).

---

## Phase 5 — API layer

**Goal:** the HTTP surface. Thin — the router calls `run_turn` and nothing else.

**Deliverables**
- `src/api/chat.py` — `POST /chat`:
  1. Validate `ChatRequest`.
  2. `session = store.get(sessionId)`.
  3. `updated_session, response = await run_turn(session, request.message)`.
  4. `store.save(sessionId, updated_session)`.
  5. Return `ChatResponse`.
- Wire `chat` + `health` routers into `src/main.py`.
- Inject `SessionStore` + `DummyJsonClient` via FastAPI dependencies (constructed once at app startup via `lifespan`).

**Tests** — `tests/integration/test_chat_endpoint.py` using `httpx.AsyncClient` + `ASGITransport`:
- Happy path: greeting → direct response.
- Multi-turn: partial requirements persist across calls with same `sessionId`.
- Different `sessionId` values don't leak state.
- Error path: upstream failure returns 200 with a friendly message (never 500 for expected failure modes).

**Done when** — full turn round-trip through real HTTP, no mocks above the agent layer.

---

## Phase 6 — Middleware & observability

**Goal:** every request is traceable from a single log line.

**Deliverables**
- `src/middleware/logging.py` — `structlog` setup; per-request correlation id; one structured event per agent call with `session_id`, `intent`, `agent`, `model`, `latency_ms`, `tokens`.
- `src/middleware/errors.py` — unhandled exception → JSON response with correlation id; exceptions logged with full traceback.
- Wire both into `src/main.py`.

**Tests** — assert that a simulated pipeline error produces a log event with the expected fields (capture via `structlog.testing.capture_logs`).

**Done when** — a full turn's logs can be grep'd by `session_id` and read top-to-bottom to reconstruct what happened.

---

## Phase 7 — Reliability hardening

**Goal:** the **Reliability & Operations** section of the design doc is fully implemented and verified.

**Checklist**
- Timeouts on every `httpx` call (Phase 2) — confirm in tests.
- Per-turn `asyncio.wait_for` budget (Phase 4) — confirm in tests.
- Tenacity on DummyJSON: 2 retries, exponential backoff, 5xx/network only (Phase 2) — confirm in tests.
- LLM calls **do not** auto-retry — add an explicit test that a `ValidationError` propagates, not retried.
- Structured-output failure handling — when `pydantic-ai` raises `ValidationError`, endpoint returns the "I hit a hiccup — could you rephrase?" fallback and logs the raw output snippet.

**Done when** — every bullet in the design doc's Reliability section has a corresponding test.

---

## Out of scope (explicit non-goals)

These are intentionally **not** in the plan because the design doc either excludes them or defers them:

- Response caching / catalog caching — the design is explicit: session store is state, not a cache.
- Redis/SQLite `SessionStore` — swap path exists (Phase 2's Protocol), but not built now.
- Auth on `/chat` — out of assignment scope.
- Multi-worker deployment — forbidden until the session store is swapped.
- Streaming responses — the response contract is a single JSON object.

---

## Suggested execution order

Phases are linear by default. The only safe parallelization:
- **Phase 3a, 3b, 3c** can overlap if you have multiple contributors (each agent is independent and stubs the others for its own tests).
- **Phase 6** (middleware) can start in parallel with Phase 5 since logging only attaches — it doesn't change pipeline behavior.

Everything else has a hard ordering dependency.

# Client Implementation Plan — AI Shopping Copilot

Source of truth: [.design/project-frontend-design.md](../../.design/project-frontend-design.md). Every phase below maps to files, components, and decisions already fixed in the design doc — when in doubt, the design doc wins.

The phases are ordered so each one **builds, type-checks, and runs on its own**. No phase depends on code that hasn't been written yet. You should be able to stop after any phase and have a working (if reduced) client.

---

## Phase 0 — Project scaffolding

**Goal:** an empty Vite + React + TS app that boots, shows a placeholder screen, and has the full folder tree in place.

**Deliverables**
- `client/package.json` with deps: `react`, `react-dom`, `zustand`, `uuid`, `@fontsource/inter`; dev deps: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/uuid`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- `client/vite.config.ts` — React plugin, dev server on `5173`, proxy `/chat` → `http://localhost:8000`.
- `client/tsconfig.json` — strict mode, `"jsx": "react-jsx"`, path alias `@/*` → `src/*`.
- `client/tailwind.config.ts` — content globs, theme extension reading from CSS variables.
- `client/postcss.config.js`, `client/index.html`, `client/.env.example` (`VITE_API_BASE_URL=http://localhost:8000`).
- `client/README.md` with run/test/build commands.
- Full empty folder tree from the design doc §3: `src/{api,store,components/{Sidebar,Chat/ProductWidget},theme,hooks,assets}`.
- `src/main.tsx` — mounts `<App/>` with `@fontsource/inter` + `theme/globals.css` imports.
- `src/App.tsx` — returns a single `<div>Bazak</div>` placeholder.

**Done when**
- `npm run dev` serves a blank page with no console errors.
- `npm run build` produces `dist/` without TS errors.
- `npm run test` runs (zero tests, zero failures).

---

## Phase 1 — Theme & design tokens

**Goal:** the emerald+cream palette from design doc §2 exists as CSS variables and is wired through Tailwind, so every later component can consume `bg-primary` / `text-muted` without hardcoding hex.

**Deliverables**
- `src/theme/tokens.css` — `:root { --color-bg, --color-surface, --color-surface-muted, --color-primary, --color-primary-hover, --color-primary-soft, --color-accent, --color-text, --color-text-muted, --color-border, --color-danger }` per design doc §2.1.
- `src/theme/globals.css` — resets, base `body` styles (bg, color, Inter font), imports `tokens.css`.
- `tailwind.config.ts` — maps Tailwind color names (`bg`, `surface`, `primary`, `accent`, etc.) to `var(--color-…)`; font family `sans: ["Inter", …]`; custom font sizes 12/14/16/18/20/24.
- `src/assets/mascot.svg` — Olive the owl (emerald feathers, amber round glasses, small shopping tag). Flat illustrated SVG, single file, viewBox square so it scales from 32 px to 220 px per design doc §2.3.

**Tests** — none (visual-only layer).

**Done when**
- A throwaway `<div className="bg-bg text-text border border-border">` renders with the right colors.
- `<img src={mascot}/>` renders Olive cleanly at 32 px and at 220 px.

---

## Phase 2 — Wire contract & HTTP client

**Goal:** the types and fetch wrapper that every later store/component will lean on. No UI yet — just the boundary with the server.

**Deliverables** (all under `src/api/`)
- `types.ts` — mirrors design doc §4.2 + §6:
  - `Role = "user" | "assistant"`.
  - `ProductSummary`, `Recommendation` — exactly the shapes from design doc §4.2.
  - `ChatRequest { sessionId, message, history: {role, text}[] }`.
  - `ChatResponse { message, products, recommendation }`.
  - `ChatClientError` class with `{ status, message, kind: "timeout" | "abort" | "http" | "network" }`.
- `chatClient.ts` — `postChat(req, signal?): Promise<ChatResponse>`:
  - `fetch(\`${VITE_API_BASE_URL}/chat\`, { method: "POST", headers, body, signal })`.
  - **25 s** client-side `AbortController` timeout per design doc §6 (combines with caller's signal).
  - Non-2xx → throw `ChatClientError({kind:"http"})`.
  - `AbortError` caused by user-stop → throw `ChatClientError({kind:"abort"})`; caused by timeout → `{kind:"timeout"}`.
  - Network failure → `{kind:"network"}`.

**Tests** — `src/api/chatClient.test.ts` with `vitest` + `msw` (or `fetch` mock):
- Happy path returns parsed `ChatResponse`.
- 500 → `ChatClientError` with `kind: "http"`, status 500.
- User abort (external signal) → `kind: "abort"`.
- Timeout → `kind: "timeout"` (fake timers).

**Done when** — `npm run test` green, `chatClient` usable from a REPL against a mocked fetch.

---

## Phase 3 — Zustand store

**Goal:** the single source of truth for conversations, per design doc §4. No UI yet — the store is independently testable.

**Deliverables** (all under `src/store/`)
- `types.ts` — `Role`, `ProductSummary`, `Recommendation`, `Message`, `Session` exactly per design doc §4.2.
- `chatStore.ts` — Zustand store with `persist` middleware:
  - State: `sessions: Record<string, Session>`, `sessionOrder: string[]`, `activeSessionId: string | null`, `isThinking: boolean`, `abortController: AbortController | null`.
  - Actions:
    - `startNewSession(): string` — uuid v4, prepends to `sessionOrder`, sets active, returns id. Matches the flow in design doc §4.4.
    - `selectSession(id)` — sets `activeSessionId`.
    - `deleteSession(id)` — removes from `sessions` and `sessionOrder`; if active, falls back to next (or `null`).
    - `sendMessage(text)` — appends user `Message`, sets `isThinking=true`, on first user message sets `session.title = text.slice(0, 40)`, creates `AbortController`, calls `postChat`, appends assistant `Message` on success, sets `message.error` on failure, always clears `isThinking` + `abortController`. Sends `history: last 10 turns` per design doc §6.
    - `stopGeneration()` — calls `abortController.abort()` per design doc §4.4; resulting abort is recorded as an assistant message with `error: "stopped"`.
  - `persist` config exactly per design doc §4.3: `name: "bazak.chat.v1"`, `version: 1`, `partialize` excludes `isThinking` and `abortController`, stub `migrate` for future versions.

**Tests** — `src/store/chatStore.test.ts` (reset store between tests):
- `startNewSession` creates a session with `title: "New chat"` and empty messages.
- `sendMessage` happy path: user message appended, thinking toggles, assistant message appended with `products` / `recommendation` from mocked client.
- `sendMessage` error path: assistant message gets `error`, `isThinking` cleared.
- `stopGeneration` aborts in-flight call and records a stopped assistant message.
- First user message sets `session.title` to first 40 chars; subsequent ones don't overwrite it.
- `updatedAt` advances and `sessionOrder` re-sorts most-recent-first.
- `persist.partialize` excludes `isThinking` and `abortController` (serialize + check).

**Done when** — the store fully drives a session end-to-end against a mocked `chatClient`, with no React involved.

---

## Phase 4 — Chat primitives (dumb presentational components)

**Goal:** the leaf components from the UML in design doc §5 that take props and render — no store access. Built in isolation so they can be styled and smoke-tested cheaply.

**Deliverables** (all under `src/components/Chat/`)
- `MascotAvatar.tsx` — renders `mascot.svg` at a configurable `size` prop.
- `MessageBubble.tsx` — `{ role, text }`; emerald-soft bg for `user`, white + border for `assistant`, per design doc §5.1.
- `TypingIndicator.tsx` — three animated dots matching `tinking.png`. Uses CSS keyframes, not a JS animation library.
- `ProductWidget/ProductCard.tsx` — `{ product: ProductSummary }`; image, title, description (clamp 2 lines), brand, price in amber accent, "View product" link → `https://dummyjson.com/products/{id}` `target="_blank" rel="noopener noreferrer"` per design doc §7.
- `ProductWidget/ProductWidget.tsx` — `{ products }`; horizontal scroll carousel of `ProductCard`s (CSS `scroll-snap-x`; no external carousel lib).
- `RecommendationBanner.tsx` — `{ recommendation }`; highlighted block with `top_pick` title + reasoning + `cross_sell` if set, per design doc §5.1.
- `SuggestionChips.tsx` — `{ onPick: (text: string) => void }`; four canned English prompts per design doc §5.1 (e.g. *"I'm looking for a new smartphone"*, *"Show me laptops under $1000"*, *"Recommend a gift under $50"*, *"Compare these two"*).

**Tests** — `src/components/Chat/*.test.tsx` with RTL:
- `MessageBubble` role → correct class set.
- `ProductCard` renders title/price/link with the DummyJSON URL format.
- `ProductWidget` renders N cards for N products.
- `RecommendationBanner` hides `cross_sell` block when null.
- `SuggestionChips` calls `onPick` with the chip's text.

**Done when** — each component renders in isolation and its test file passes. Still no real chat.

---

## Phase 5 — Chat container components (store-wired)

**Goal:** the smart components that subscribe to `chatStore` and assemble Phase 4's primitives into actual chat UI.

**Deliverables**
- `src/hooks/useAutoScroll.ts` — ref + effect that scrolls to bottom when `messages.length` or `isThinking` changes; bail out if the user has scrolled up.
- `src/hooks/useSendMessage.ts` — thin adapter returning `{ send, stop, isThinking }` selecting only the relevant slices from `chatStore`.
- `src/components/Chat/Message.tsx` — `{ message: Message }`; renders `MessageBubble`, then conditionally `ProductWidget` and `RecommendationBanner`. For assistant-role messages shows `MascotAvatar size={32}` on the left per design doc §2.3. Renders the friendly error text *"Something went wrong — please try again."* when `message.error` is set (and distinguishes the `stopped` variant).
- `src/components/Chat/MessageList.tsx` — subscribes via selector to active session's `messages` + `isThinking`; maps to `<Message/>`s; appends `<TypingIndicator/>` while `isThinking`; wires `useAutoScroll`.
- `src/components/Chat/WelcomeScreen.tsx` — centered `MascotAvatar size={220}` + greeting headline + `<SuggestionChips onPick={sendMessage}/>`; matches `init_stage.png` per design doc §8.
- `src/components/Chat/Composer.tsx` — textarea + Send button; Enter to submit, Shift+Enter newline; while `isThinking` the Send button swaps to Stop per design doc §4.4 / `tinking.png`; textarea disabled except for Stop. Empty/whitespace input is a no-op.
- `src/components/Chat/ChatPane.tsx` — selects active session; if `session.messages.length === 0` renders `<WelcomeScreen/>` else `<MessageList/>`; always renders `<Composer/>` at the bottom. Matches design doc §8 mapping.

**Tests** — `src/components/Chat/*.test.tsx`:
- `ChatPane` shows `WelcomeScreen` on empty session, `MessageList` once a message exists.
- `Composer` submits on Enter, newlines on Shift+Enter, swaps to Stop while thinking.
- `MessageList` shows `TypingIndicator` iff `isThinking`.

**Done when** — with a fake/mocked `chatClient`, a user can type in the composer and see their message + an assistant reply with product cards render.

---

## Phase 6 — Sidebar & app shell

**Goal:** the left-hand conversation history and the two-column layout from design doc §2.4.

**Deliverables**
- `src/components/Sidebar/BrandHeader.tsx` — mini mascot + "Bazak" wordmark.
- `src/components/Sidebar/NewChatButton.tsx` — calls `chatStore.startNewSession()`.
- `src/components/Sidebar/ConversationListItem.tsx` — `{ sessionId, title, isActive }`; click → `selectSession(id)`; hover reveals a delete button calling `deleteSession`.
- `src/components/Sidebar/ConversationList.tsx` — subscribes to `sessionOrder` + `sessions` (selector only returns `{id, title, isActive}[]` to avoid re-renders on message changes); maps to items.
- `src/components/Sidebar/Sidebar.tsx` — stacks `BrandHeader` + `NewChatButton` + `ConversationList`; fixed width 280 px per design doc §2.4.
- `src/components/AppShell.tsx` — flex row: `<ChatPane/>` (flex-1) + `<Sidebar/>`; on `<768px` the sidebar becomes a slide-over triggered by a hamburger in the top bar per design doc §2.4.
- `src/App.tsx` — on mount: if `sessionOrder` is empty, call `startNewSession()` once (per design doc §4.4). Renders `<AppShell/>`.

**Tests** — `src/components/Sidebar/*.test.tsx`:
- `ConversationList` renders one item per session in `sessionOrder`.
- Clicking an item calls `selectSession` with the right id.
- `NewChatButton` prepends a new session and makes it active.
- `App` auto-creates a session on first load when storage is empty; does **not** create one when a persisted session exists.

**Done when** — full app runs end-to-end: multi-session, switch between them, new chat button works, history persists across reload (via Zustand `persist`).

---

## Phase 7 — Error & abort UX polish

**Goal:** the failure modes from design doc §6 and §4.4 are visually correct and don't look like bugs.

**Deliverables**
- Error banner / inline assistant message styles using `--color-danger` for the border, neutral text for the body. Friendly copy *"Something went wrong — please try again."*
- Stopped-turn styling: italic muted *"Stopped."* — visually different from errors (no red).
- Timeout vs. HTTP vs. network: same friendly copy by default, but the error object is preserved for dev-mode `console.error` with details.
- Composer "Stop" button disables itself after one click while the abort propagates, to avoid double-aborts.
- Empty history safety: re-sending immediately after an error doesn't double-append the user message.

**Tests** — `src/components/Chat/Message.test.tsx`:
- Error message renders the friendly text, not the raw status code.
- Stopped message renders distinctly from an error message.
- `sendMessage` after an error still produces exactly one user bubble + one assistant bubble.

**Done when** — every failure path from design doc §6 has a corresponding visual state with a test.

---

## Out of scope (explicit non-goals)

These are intentionally **not** in the plan because the design doc either excludes them or defers them:

- **Streaming responses (SSE)** — design doc §7 keeps v1 single-JSON; future work changes `MessageList` + `sendMessage` only.
- **Dark mode** — design doc §2.1 keeps v1 light-only; tokens are already CSS variables so a `[data-theme="dark"]` override can be added later.
- **Auth / per-user sync** — design doc §7: history is per-browser `localStorage`, no auth.
- **react-router** — design doc §3: single screen, no routing.
- **A carousel library / axios / a form library** — design doc §3 explicitly keeps deps minimal.
- **E2E test framework (Playwright/Cypress)** — Phase 9 is manual; automated E2E is out of scope for v1.

---

## Suggested execution order

Phases are linear by default. Safe parallelization:
- **Phase 4** (dumb components) can be split across contributors — each file is independent.

Everything else has a hard ordering dependency: tokens before components, types before store, store before store-wired components, primitives before containers, chat before sidebar.

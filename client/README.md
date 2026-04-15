# Bazak — AI Shopping Copilot (Client)

Vite + React + TypeScript single-page app that talks to the Bazak FastAPI server.

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults are fine for local dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server on http://localhost:5173 (proxies `/chat` → `http://localhost:8000`). |
| `npm run build` | Type-check then produce a production build in `dist/`. |
| `npm run preview` | Serve the built app locally. |
| `npm run test` | Run the Vitest unit-test suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |

## Layout

See [.design/project-frontend-design.md](../.design/project-frontend-design.md) §3 for the source-of-truth folder tree.

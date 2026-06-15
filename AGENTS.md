# SparkGate Extension

Chrome Extension MV3 + React 18 + TW3 + Vite.
Academic project (UNAB Chile). Spanish UI text.

## Source of truth

`SPEC.md` at root. Implementation follows §T tasks.

## Backend

Separate repo at `../sparkgate-api`. FastAPI + Supabase + Ollama/Groq.
CORS allows `chrome-extension://*`. Never edit backend from this repo.

## Key gotchas

- **Auth body**: JSON (`application/json`). Same as passwords endpoints.
- **Login response**: `{access_token, user_id, premium?}` (not `token`).
- **Error format**: ∀ 4xx/5xx → `{detail: string}`.
- **Generate length**: backend validates 12–64 (slider must match).
- **JWT storage**: `chrome.storage.local` (⊥ sync). Read before every API call.
- **401 handling**: `client.ts` clears storage, throws `ApiError`. AuthScreen navigates.
- **Auth state**: `useAuth()` called ONLY in `App.tsx`. Pass login/register/logout as props. Duplicate calls create independent state — UI won't transition on login/logout.
- **Dark mode**: init from `chrome.storage.local` (⊥ `prefers-color-scheme`). TW3 `dark:` class on `<html>`.
- **Plan badge**: mock "Gratuito" only. Upgrade btn disabled. No plan endpoint exists.
- **Popup**: 360×500px (`index.html` inline style). No SSO (backlog).

## Build

```bash
pnpm run dev          # vite watch (no hot-reload, extension must reload)
pnpm run build        # vite build + cp manifest.json → dist/
```

Output `dist/`. Load unpacked in `chrome://extensions`. Rebuild + reload on every change.

## .env

- `.env` — `VITE_API_URL=http://localhost:8000` (dev)
- `.env.production` — if exists, overrides `.env` during `vite build`
- `VITE_API_URL` inlined at build time (no runtime env)
- **Note: `.env` not in `.gitignore`** — ensure it stays untracked

## Endpoints consumed

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/auth/register` | ⊥ | JSON |
| POST | `/api/v1/auth/login` | ⊥ | JSON |
| POST | `/api/v1/auth/logout` | ⊥ | — |
| POST | `/api/v1/passwords/evaluate` | JWT | JSON |
| POST | `/api/v1/passwords/generate` | JWT | JSON |
| GET | `/api/v1/health` | ⊥ | — |

## Architecture quirks

- `vite.config.ts` has `remove-crossorigin` plugin — strips `crossorigin` from script tags (fixes MIME type in unpacked extensions).
- `client.ts` `post()` has unused `isForm` param (kept for future form-urlencoded endpoints).
- `@types/chrome` is devDependency — needed for `chrome.storage.*` type inference.
- tsconfig has `noUnusedLocals: true`, `noUnusedParameters: true` — code must not have unused imports/vars.
- `pnpm build` manually copies `manifest.json` to `dist/` (CRXJS not used).

## Cross-browser

- **Chrome/Edge/Brave/Opera/Vivaldi**: Cargar `dist/` desempaquetada.
- **Firefox**: `about:debugging#/runtime/this-firefox` → Cargar temporal → `dist/`.
- Firefox soporta `chrome.*` API en MV3 desde v109. No polyfill needed.

## Constraints

- Spanish UI text (user-facing). Code/comments can be English.
- `.env` not committed (no `.env.example` in extension repo).
- Academic project — keep it simple, no production polish needed.

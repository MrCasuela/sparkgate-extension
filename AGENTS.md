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
- **Logout**: requiere JWT Bearer (`client.ts` lo adjunta automáticamente). Backend revoca la sesión propia via Admin API `sign_out(scope='global')`. No puede revocar guarda; el offboarding de un miembro que se va va por el endpoint revoke del dashboard.
- **Error format**: ∀ 4xx/5xx → `{detail: string}`.
- **Generate length**: backend validates 12–64 (slider must match).
- **JWT storage**: `chrome.storage.local` (⊥ sync). Read before every API call.
- **401 handling**: `client.ts` clears storage, throws `ApiError`. AuthScreen navigates.
- **Auth state**: `useAuth()` called once per page root — `App.tsx` (popup) y `DashboardApp.tsx` (dashboard). Cada page root independiente (no es duplicado bug). Datos auth cruzados via `chrome.storage.local` compartido. Pass login/register/logout como props.
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
| POST | `/api/v1/auth/logout` | JWT Bearer | — |
| POST | `/api/v1/passwords/evaluate` | JWT | JSON |
| POST | `/api/v1/passwords/generate` | JWT | JSON |
| GET | `/api/v1/health` | ⊥ | — |
| GET | `/api/v1/dashboard/members` | JWT admin | — |
| GET | `/api/v1/dashboard/audit-log` | JWT admin | — |
| POST | `/api/v1/dashboard/credentials/{id}/revoke` | JWT admin | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/suggest` | JWT admin | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/restore` | JWT admin | — |

## Offboarding dashboard (SP-1)

Panel independiente en `chrome-extension://[id]/dashboard.html` (multi-entry vite: `index.html` + `dashboard.html`). Backend endpoints en `sparkgate-api`. Demo seed: 4 miembros (AC1) — seed via `scripts/seed_dashboard_demo.py`.

- **Tipos de credencial**: `interna` (SparkGate, tiene `supabase_user_id`) / `externa` (fuera de control).
- **Estados**: `activa`, `revocada`, `pendiente_aplicacion_manual`.
- **Interna (AC2)**: revoke → backend `update_user_by_id` ban (`ban_duration`) + rotación de password server-side (o `new_password` override 12-64). Bloquea logins futuros de inmediato; access token emitido sigue válido ~1h (AC6, no oculto).
- **Externa (AC3)**: suggest → backend genera propuesta y deja `pendiente_aplicacion_manual`; SparkGate NO promete cambio real sobre el servicio. El frontend muestra/copia la password (generada localmente via `/passwords/generate`) para aplicación manual.
- **No revocable**: propia cuenta admin (self) ni cuenta interna ya revocada / externa ya pendiente (400 del backend).
- **AC4**: password NUNCA se registra en `dashboard_audit_log` ni se persiste. Solo se muestra para copiar.

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

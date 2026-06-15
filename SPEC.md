# SparkGate Extension — SPEC

> Chrome Extension MV3 + React 18 + TW3 + Vite/CRXJS
> Backend: `sparkgate-api` (FastAPI + Supabase + Ollama)

---

## §G — Goals

Popup extension (360×500px). Generate & evaluate passwords via SparkGate API.
Auth via Supabase JWT. Dark mode. Mock plan badge.

## §C — Constraints

- Popup ≤360×500px, no scroll ideal (scroll ok if needed)
- JWT ∈ `chrome.storage.local` (⊥ `sync`)
- Backend URL: dev `localhost:8000`, prod Railway (configurable `chrome.storage.sync`)
- CORS backend ya permite `chrome-extension://*`
- TW3 + `tailwind.config.ts` + `dark:` class strategy
- Sin SSO (Google/Apple) — backlog
- Plan badge mock visual "Gratuito", Upgrade disabled

## §I — Interfaces

| Id | Kind | Shape | Auth |
|---|---|---|---|
| I.auth-register | api | POST `/api/v1/auth/register` JSON `{email,password}` → `{message,user_id}` | ⊥ |
| I.auth-login | api | POST `/api/v1/auth/login` JSON `{email,password}` → `{access_token,user_id,premium?}` | ⊥ |
| I.auth-logout | api | POST `/api/v1/auth/logout` → `{message}` | ⊥ |
| I.health | api | GET `/api/v1/health` → `{status,ollama,supabase}` | ⊥ |
| I.evaluate | api | POST `/api/v1/passwords/evaluate` `{password,context?}` → `{is_compromised,pwned_count,entropy_bits,entropy_threshold_met,ai_score,ai_feedback,ai_suggestions}` | JWT Bearer |
| I.generate | api | POST `/api/v1/passwords/generate` `{length[12-64],mode[ai|random],context?,complexity_level?}` → `{generated_password,explanation,entropy_bits}` | JWT Bearer |
| I.error | api | ∀ error → `{detail:string}` (status 4xx/5xx) | — |
| I.storage | chrome-api | `chrome.storage.local`: `{jwt,user_id,theme}` | — |
| I.manifest | mv3 | `host_permissions: [backend_url/*]`, `action: {default_popup:popup/index.html}` | — |

## §V — Invariants

```
V1: ∀ api call → client.ts read JWT from chrome.storage.local, attach Authorization: Bearer
V2: 401 response → clear JWT from storage, navigate AuthScreen
V3: Auth body ! JSON (same as passwords)
V4: Generate length ≥12 ≤64 (backend valida, slider replica)
V5: Dark mode init from chrome.storage.local (⊥ prefers-color-scheme)
V6: Plan badge = mock "Gratuito", Upgrade btn disabled
V7: Popup ≤360×500px
```

## §T — Tasks

| id | status | task | cites |
|---|---|---|---|
| T1 | x | Scaffold: Vite+CRXJS+TW3+manifest+host_permissions+icons | I.manifest |
| T2 | x | Types TS: PasswordEvaluateRequest/Response, GenerateRequest/Response, ErrorResponse, AuthResponse | I.evaluate, I.generate, I.error |
| T3 | x | API client: fetch wrapper, form-urlencoded auth, Bearer JWT, 401→V2 | V1, V2, V3, I.auth-login, I.auth-register |
| T4 | x | Storage wrapper + useAuth hook: login/logout/register, chrome.storage JWT | I.storage |
| T5 | x | AuthScreen: login/register tabs, plan badge mock, dark toggle | V6, V5 |
| T6 | x | Navigator + App.tsx: tabs Generar|Detectar, logout | V7 |
| T7 | x | GeneratorScreen: AlphanumericTab (slider 12-64, toggles charset) + MemorableTab | V4, I.generate |
| T8 | x | DetectorScreen: input→evaluate→resultados (entropy gauge, AI score, HIBP) | I.evaluate |
| T9 | x | Polish: copy btn, LoadingSpinner, ErrorAlert, dark mode sync | V5 |

### Status legend

`.` pending · `~` wip · `x` done

## §B — Backlog

| id | date | cause | fix |
|---|---|---|---|

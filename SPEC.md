# SparkGate Extension — SPEC

> Chrome Extension MV3 + React 18 + TW3 + Vite (sin CRXJS)
> Backend: `sparkgate-api` (FastAPI + Supabase + Ollama)

---

## §G — Goals

Popup extension (360×500px). Generate & evaluate passwords via SparkGate API.
Auth via Supabase JWT. Dark mode. Mock plan badge.

## §C — Constraints

- Popup ≤360×500px, no scroll ideal (scroll ok if needed)
- JWT ∈ `chrome.storage.local` (⊥ `sync`)
- Backend URL: dev `http://localhost:8000`, prod `https://*.vercel.app` (inlineada en build via `VITE_API_URL`, no configurable en runtime)
- CORS backend ya permite `chrome-extension://*`
- TW3 + `tailwind.config.ts` + `dark:` class strategy
- Sin SSO (Google/Apple) — backlog
- Plan badge mock visual "Gratuito", Upgrade disabled

## §I — Interfaces

| Id | Kind | Shape | Auth |
|---|---|---|---|
| I.auth-register | api | POST `/api/v1/auth/register` JSON `{email,password}` → `{message,user_id}` | ⊥ |
| I.auth-login | api | POST `/api/v1/auth/login` JSON `{email,password}` → `{access_token,user_id,premium?}` | ⊥ |
| I.auth-logout | api | POST `/api/v1/auth/logout` → `{message}` — requiere Bearer; revoca sesión propia via Admin API `sign_out(scope='global')`. No revoca sesión de otro usuario (offboarding usa revoke) | JWT Bearer |
| I.health | api | GET `/api/v1/health` → `{status,ollama,supabase}` | ⊥ |
| I.evaluate | api | POST `/api/v1/passwords/evaluate` `{password,context?}` → `{is_compromised,pwned_count,entropy_bits,entropy_threshold_met,ai_score,ai_feedback,ai_suggestions}` | JWT Bearer |
| I.generate | api | POST `/api/v1/passwords/generate` `{length[12-64],mode[ai|random],context?,complexity_level?}` → `{generated_password,explanation,entropy_bits}` | JWT Bearer |
| I.dashboard-members | api | GET `/api/v1/dashboard/members` → `[{id,full_name,email,role_title?,credentials:[{id,type[interna|externa],service_name,status,updated_at,supabase_user_id?}]}]` | JWT Bearer + admin |
| I.dashboard-audit-log | api | GET `/api/v1/dashboard/audit-log` → `[{id,actor_email,member_id,credential_id,credential_type,action,created_at}]` (created_at desc, nunca contraseñas) | JWT Bearer + admin |
| I.dashboard-revoke | api | POST `/api/v1/dashboard/credentials/{id}/revoke` `{new_password?[12-64]}` → `{credential,admin_api_success}` (solo interna) | JWT Bearer + admin |
| I.dashboard-suggest | api | POST `/api/v1/dashboard/credentials/{id}/suggest` `{new_password?[12-64]}` → `{credential,admin_api_success}` (solo externa, `pendiente_aplicacion_manual`) | JWT Bearer + admin |
| I.dashboard-restore | api | POST `/api/v1/dashboard/credentials/{id}/restore` → `{credential,admin_api_success}` | JWT Bearer + admin |
| I.error | api | ∀ error → `{detail:string}` (status 4xx/5xx) | — |
| I.storage | chrome-api | `chrome.storage.local`: `{jwt,user_id,theme}` | — |
| I.manifest | mv3 | `host_permissions: [localhost:8000, *.vercel.app]`, `action: {default_popup:index.html}`, multi-entry vite: `index.html` + `dashboard.html` | — |
| I.dashboard-page | chrome-api | página `chrome-extension://[id]/dashboard.html`, abierta desde popup via `chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')})` | — |

## §V — Invariants

```
V1: ∀ api call → client.ts read JWT from chrome.storage.local, attach Authorization: Bearer
V2: 401 response → clear JWT from storage, navigate AuthScreen
V3: Auth body JSON (same as passwords)
V4: Generate length ≥12 ≤64 (backend valida, slider replica)
V5: Dark mode init from chrome.storage.local (⊥ prefers-color-scheme)
V6: Plan badge = mock "Gratuito", Upgrade btn disabled
V7: Popup ≤360×500px
V8: Dashboard endpoints requieren admin (is_admin). 403 → UI "Solo administradores". Verificación via require_admin backend
V9: Password (draft local / sugerida) NUNCA se envía al audit log ni se persiste; solo se muestra para copiar (externa AC3). AC4
V10: Revoke interna bloquea logins futuros de inmediato (ban_duration); access token emitido sigue válido ~1h (AC6, no oculto)
V11: Logout usa Bearer, revoca sesión propia (scope global). No revoca otro usuario → offboarding de miembro via revoke dashboard
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
| T10 | x | Dashboard shell: vite multi-entry `dashboard.html`, entrada en popup via chrome.tabs.create | I.dashboard-page, I.manifest |
| T11 | x | Tipos + api client dashboard: Member/Credential/AuditLogEntry/CredentialActionResponse; getMembers/getAuditLog/revokeInternal/suggestExternal/restoreCredential | I.dashboard-members, I.dashboard-audit-log, I.dashboard-revoke, I.dashboard-suggest, I.dashboard-restore |
| T12 | x | Lista miembros + credenciales (interna/externa, estado) + modales claim action (revoke AC2 / suggest AC3 / restore), self-revoke hidden | V8, V9, V10, I.dashboard-revoke, I.dashboard-suggest |
| T13 | x | Audit log tabla + export CSV (sin password, AC4) | V9, I.dashboard-audit-log |
| T14 | x | Dashboard en AGENTS.md endpoints + logout real actualizado; build verificado (popup+dashboard) | V8-V11 |

### Status legend

`.` pending · `~` wip · `x` done

## §B — Backlog

| id | date | cause | fix |
|---|---|---|---|

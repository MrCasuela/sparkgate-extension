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
| I.auth-register | api | POST `/api/v1/auth/register` JSON `{email,password,type_account[personal\|enterprise],organization_name?}` → `{message,user_id,plan,access_token?,type_account}`. `enterprise` sin `organization_name` → 422; crea la fila en `organizations` | ⊥ |
| I.auth-login | api | POST `/api/v1/auth/login` JSON `{email,password}` → `{access_token,user_id,premium?,type_account}` | ⊥ |
| I.auth-logout | api | POST `/api/v1/auth/logout` → `{message}` — requiere Bearer; revoca sesión propia via Admin API `sign_out(scope='global')`. No revoca sesión de otro usuario (offboarding usa revoke) | JWT Bearer |
| I.health | api | GET `/api/v1/health` → `{status,ollama,supabase}` | ⊥ |
| I.evaluate | api | POST `/api/v1/passwords/evaluate` `{password,context?}` → `{is_compromised,pwned_count,entropy_bits,entropy_threshold_met,ai_score,ai_feedback,ai_suggestions}` | JWT Bearer |
| I.generate | api | POST `/api/v1/passwords/generate` `{length[12-64],mode[ai|random],context?,complexity_level?}` → `{generated_password,explanation,entropy_bits}` | JWT Bearer |
| I.dashboard-members | api | GET `/api/v1/dashboard/members` → `[{id,full_name,email,role_title?,supabase_user_id?,credentials:[{id,type[interna\|externa],service_name,status,updated_at,supabase_user_id?}]}]`. Solo los de la organización del caller | JWT Bearer + enterprise |
| I.dashboard-audit-log | api | GET `/api/v1/dashboard/audit-log` → `[{id,actor_email,member_id,credential_id?,credential_type?,vault_item_id?,action,created_at}]` (created_at desc, filtrado por org, nunca contraseñas). `credential_id`/`credential_type` van en null en los eventos de bóveda | JWT Bearer + enterprise |
| I.dashboard-revoke | api | POST `/api/v1/dashboard/credentials/{id}/revoke` `{new_password?[12-64]}` → `{credential,admin_api_success}` (solo interna); credencial de otra organización → 404 | JWT Bearer + enterprise |
| I.dashboard-suggest | api | POST `/api/v1/dashboard/credentials/{id}/suggest` `{new_password?[12-64]}` → `{credential,admin_api_success}` (solo externa, `pendiente_aplicacion_manual`); credencial ajena → 404 | JWT Bearer + enterprise |
| I.dashboard-restore | api | POST `/api/v1/dashboard/credentials/{id}/restore` → `{credential,admin_api_success}`; credencial ajena → 404 | JWT Bearer + enterprise |
| I.dashboard-create-member | api | POST `/api/v1/dashboard/members` `{full_name,email,role_title?}` → 201 `{member,temporary_password}`. La contraseña temporal se devuelve UNA vez y no se persiste; email duplicado → 409 | JWT Bearer + enterprise |
| I.dashboard-member-vault | api | GET `/api/v1/dashboard/members/{id}/vault` → `[{id,service_name,username?,created_at,updated_at}]` (metadata, nunca descifra). Integrante sin cuenta vinculada → 200 `[]`; de otra organización → 404. No depende de la clave maestra | JWT Bearer + enterprise |
| I.dashboard-member-vault-reveal | api | POST `/api/v1/dashboard/members/{mid}/vault/{iid}/reveal` → `{id,service_name,username?,password,notes?}`. POST y no GET a propósito (escribe auditoría, no debe quedar en el historial). 503 sin clave maestra; ítem inexistente o ajeno → 404 | JWT Bearer + enterprise |
| I.error | api | ∀ error → `{detail:string}` (status 4xx/5xx) | — |
| I.storage | chrome-api | `chrome.storage.local`: `{jwt,user_id,type_account,theme}`. `type_account` es respaldo del claim del JWT | — |
| I.manifest | mv3 | `host_permissions: [localhost:8000, *.vercel.app]`, `action: {default_popup:index.html}`, multi-entry vite: `index.html` + `dashboard.html` | — |
| I.dashboard-page | chrome-api | página `chrome-extension://[id]/dashboard.html`, abierta desde popup via `chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')})` | — |
| I.vault-save | api | POST `/api/v1/vault/items` `{service_name,username?,password,notes?}` → `{id,service_name,username?,created_at,updated_at}` (201, cifra AES-256-GCM en el backend, HU17 AC1/AC2) | JWT Bearer |
| I.vault-list | api | GET `/api/v1/vault/items` → `[{id,service_name,username?,created_at,updated_at}]` (nunca descifra) | JWT Bearer |
| I.vault-get | api | GET `/api/v1/vault/items/{id}` → `{id,service_name,username?,password,notes?}`; ítem de otro usuario → 404 (AC3) | JWT Bearer |
| I.vault-delete | api | DELETE `/api/v1/vault/items/{id}` → 204; ítem de otro usuario → 404. No exige clave maestra (Ley 21.719) | JWT Bearer |
| I.vault-purge | api | DELETE `/api/v1/vault/items` → `{deleted_count}` (Ley 21.719) | JWT Bearer |
| I.vault-audit | api | GET `/api/v1/vault/audit` → `[{id,user_id,item_id?,action,result,actor_user_id?,created_at}]` (nunca service_name ni secretos, HU19). `actor_user_id` no nulo = alguien de la empresa abrió ese ítem | JWT Bearer |
| I.auth-delete-account | api | DELETE `/api/v1/auth/account` `{confirm_email,password}` → 204 (purga vault + borra el usuario). 400 si `confirm_email` no coincide (trim+lower), 401 si `password` es incorrecta. Irreversible | JWT Bearer |

## §V — Invariants

```
V1: ∀ api call → client.ts read JWT from chrome.storage.local, attach Authorization: Bearer
V2: 401 response → clear JWT from storage, navigate AuthScreen
V3: Auth body JSON (same as passwords)
V4: Generate length ≥12 ≤64 (backend valida, slider replica)
V5: Dark mode init from chrome.storage.local (⊥ prefers-color-scheme)
V6: Plan badge = mock "Gratuito", Upgrade btn disabled
V7: Popup ≤360×500px
V8: Los endpoints del dashboard exigen `type_account = enterprise` **verificado contra la tabla `organizations`**, no contra el claim del token. `is_admin` ya no existe. El 403 se renderiza con el `detail` del backend, que distingue "no es cuenta de empresa" de "cuenta de empresa sin organización". Verificación via `require_enterprise`
V9: Password del detector (draft local) y sugerida (dashboard) NUNCA se persisten ni se envían al audit log; solo se muestran para copiar (externa AC3, dashboard AC4). Las credenciales del vault SÍ se persisten, pero siempre cifradas en el backend (AES-256-GCM, HU17 AC2) — su audit log registra la acción, nunca el secreto (HU17 AC4)
V10: Revoke interna bloquea logins futuros de inmediato (ban_duration); access token emitido sigue válido ~1h (AC6, no oculto)
V11: Logout usa Bearer, revoca sesión propia (scope global). No revoca otro usuario → offboarding de miembro via revoke dashboard
V12: Vault sin clave maestra en el backend → 503 en guardar/consultar (HU17 AC5). El borrado (ítem, purga total o cuenta) nunca depende de la clave maestra — es el mecanismo de supresión de datos (Ley 21.719) y debe seguir funcionando con el módulo caído
V13: El secreto de un ítem del vault solo se pide on-demand al presionar "Ver" (GET `/items/{id}` el dueño, POST `.../reveal` la empresa); nunca se persiste en chrome.storage ni se precarga al listar. La bóveda de un integrante tampoco se pide hasta que alguien la expande: abrirla ya deja rastro
V15: El botón "Panel de administración" solo se renderiza con `isEnterprise`. Antes se ofrecía a todos y el backend respondía 403 — una puerta cerrada con cartel de bienvenida. `isEnterprise` se resuelve una sola vez en la raíz de página y baja por props
V16: Toda lectura de una bóveda ajena queda registrada en los DOS logs: el de la empresa y el del propio trabajador (con `actor_user_id`). El modal lo dice explícitamente. Es la mitigación de privacidad de HU21, no un detalle de implementación
V17: Aislamiento por organización: un recurso de otra empresa responde 404, nunca 403 ni 200. El `org_id` del filtro lo resuelve el backend contra la tabla en cada request
V18: El AAD del descifrado es el `user_id` del DUEÑO del ítem, nunca el del caller. Que la empresa pueda leer no debilita el cifrado: una fila movida a otro usuario sigue fallando el tag GCM

V14: Eliminar cuenta exige escribir el correo exacto de la sesión (normalizado trim+lower, igual que el backend) más la contraseña; acción irreversible, sin atajo de "solo un click"
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
| T15 | x | Tipos + api client vault: VaultItem/VaultSecret/VaultItemCreate/VaultPurgeResponse; saveItem/listItems/getSecret/deleteItem/purgeVault + helper `del` en client.ts (maneja 204 sin body) | I.vault-save, I.vault-list, I.vault-get, I.vault-delete, I.vault-purge |
| T16 | x | VaultScreen (tercer tab del Navigator): sub-tabs Guardar/Mis credenciales, useVault hook, ver/copiar/ocultar credencial on-demand, eliminar por ítem, banner de módulo no operativo (503) | V9, V12, V13, I.vault-save, I.vault-list, I.vault-get, I.vault-delete |
| T17 | x | DangerZone: purga total del vault + eliminación de cuenta (correo exacto vía `getJwtEmail` + contraseña, modal de confirmación) | V14, I.vault-purge, I.auth-delete-account |
| T18 | x | Tipo de cuenta: `getJwtAccountType` + respaldo en storage, `isEnterprise` en useAuth bajado por props, gateo del botón del panel, selector personal/empresa en el registro | V8, V15, I.auth-register, I.auth-login, I.storage |
| T19 | x | Panel: alta de trabajador con modal de contraseña temporal, bóveda por integrante con carga perezosa, modal de "Ver contraseña" con aviso de auditoría, auditoría y CSV tolerantes a nulos | V16, V17, V18, I.dashboard-create-member, I.dashboard-member-vault, I.dashboard-member-vault-reveal |

### Status legend

`.` pending · `~` wip · `x` done

## §B — Backlog

| id | date | cause | fix |
|---|---|---|---|
| B1 | 2026-08-31 | Cliente SDK con `sign_in` reutilizado como singleton: supabase-py reescribe el header `Authorization` del cliente en `SIGNED_IN`, dejándolo como el último usuario para todo el proceso | Revocar con token explícito (`admin.sign_out(jwt, scope="global")`); el camino de sign-in usa cliente efímero `create_auth_client()` cerrado en `finally`. Ver `_Leccion-singleton-sdk-muta-estado-global` |

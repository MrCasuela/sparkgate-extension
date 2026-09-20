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
| I.dashboard-members | api | GET `/api/v1/dashboard/members` → `[{id,full_name,email,role_title?,supabase_user_id?,credentials:[Credential]}]`, con `Credential = {id,type[interna\|externa],service_name,status,updated_at,supabase_user_id?,member_id?,username?,secret_updated_at?,has_secret,rotation_required}` (nunca el secreto). Solo los de la organización del caller | JWT Bearer + enterprise |
| I.dashboard-audit-log | api | GET `/api/v1/dashboard/audit-log` → `[{id,actor_email?,actor_user_id?,member_id?,target_member_id?,credential_id?,credential_type?,vault_item_id?,action,denied_reason,created_at}]` (created_at desc, filtrado por org, nunca contraseñas). `denied_reason` (HU18) es `totp_no_enrolado\|totp_invalido\|totp_reutilizado\|totp_bloqueado\|integridad` en las entradas `*_denegado` y null en el resto; nunca el código que se intentó. `credential_id`/`credential_type` van en null en los eventos de bóveda; `actor_email` en null = el actor ejerció su supresión; `member_id` en null = credencial del pool; en `reasignar_credencial`, `target_member_id` es a quién pasó | JWT Bearer + enterprise |
| I.dashboard-revoke | api | POST `/api/v1/dashboard/credentials/{id}/revoke` `{new_password?[12-64]}` → `{credential,admin_api_success,applied_password?,secret_stored,rotation_suggested:[{credential_id,service_name,type,member_name?}]}` (solo interna). Sin `new_password` la genera el backend. `applied_password` solo viene si Auth confirmó; credencial de otra organización → 404 | JWT Bearer + enterprise + TOTP (`X-SparkGate-TOTP`) |
| I.dashboard-suggest | api | POST `/api/v1/dashboard/credentials/{id}/suggest` `{new_password?[12-64]}` → `{credential,admin_api_success,suggested_password,secret_stored,rotation_suggested}` (solo externa, `pendiente_aplicacion_manual`); credencial ajena → 404 | JWT Bearer + enterprise + TOTP (`X-SparkGate-TOTP`) |
| I.dashboard-restore | api | POST `/api/v1/dashboard/credentials/{id}/restore` → `{credential,admin_api_success}`; credencial ajena → 404. La UI lo presenta según el tipo: en una interna revocada es «Restaurar acceso» (desbanea); en una externa pendiente es «Confirmar contraseña» (el admin ya aplicó la sugerida en el servicio; solo vuelve a `activa`) | JWT Bearer + enterprise |
| I.dashboard-create-member | api | POST `/api/v1/dashboard/members` `{full_name,email,role_title?}` → 201 `{member,temporary_password,secret_stored}`. La contraseña temporal se guarda cifrada como la vigente de su cuenta interna (`secret_stored=false` = la respuesta es la única copia); email duplicado → 409 | JWT Bearer + enterprise |
| I.dashboard-member-vault | api | GET `/api/v1/dashboard/members/{id}/vault` → `[{id,service_name,username?,created_at,updated_at}]` (metadata, nunca descifra). Integrante sin cuenta vinculada → 200 `[]`; de otra organización → 404. No depende de la clave maestra | JWT Bearer + enterprise |
| I.dashboard-member-vault-reveal | api | POST `/api/v1/dashboard/members/{mid}/vault/{iid}/reveal` → `{id,service_name,username?,password,notes?}`. POST y no GET a propósito (escribe auditoría, no debe quedar en el historial). 503 sin clave maestra; ítem inexistente o ajeno → 404 | JWT Bearer + enterprise + TOTP (`X-SparkGate-TOTP`) |
| I.dashboard-credentials-pool | api | GET `/api/v1/dashboard/credentials?assigned=false` → `[Credential]` sin asignar (no aparecen en `/members`) | JWT Bearer + enterprise |
| I.dashboard-credential-create | api | POST `/api/v1/dashboard/credentials` `{member_id?,service_name,username?,password?,notes?}` → 201 `Credential` (siempre externa). `member_id` null = pool. 503 si viene `password` y falta la clave maestra | JWT Bearer + enterprise |
| I.dashboard-credential-secret | api | PUT `/api/v1/dashboard/credentials/{id}/secret` `{password,username?,notes?,apply_to_account?}` → `{credential,admin_api_success,secret_stored}`. Nunca devuelve el plaintext. `apply_to_account` solo interna | JWT Bearer + enterprise + TOTP (`X-SparkGate-TOTP`) |
| I.dashboard-credential-reveal | api | POST `/api/v1/dashboard/credentials/{id}/secret/reveal` → `{id,service_name,type,username?,password,notes?,secret_updated_at?}`. POST por auditar. 404 sin contraseña guardada, 503 sin clave maestra. En una interna escribe además en el log del trabajador | JWT Bearer + enterprise + TOTP (`X-SparkGate-TOTP`) |
| I.dashboard-credential-reassign | api | POST `/api/v1/dashboard/credentials/{id}/reassign` `{member_id?}` → `{credential,rotation_suggested}`. `member_id` null = al pool. 400 si es interna o ya está asignada a ese integrante; 404 si integrante o credencial son de otra organización | JWT Bearer + enterprise |
| I.me-credentials | api | GET `/api/v1/me/credentials` → `[{id,organization_name,service_name,type,username?,status,secret_updated_at?,updated_at,has_secret}]`: lo que la empresa le asignó al usuario. Nunca el secreto; no audita | JWT Bearer |
| I.me-credential-reveal | api | POST `/api/v1/me/credentials/{id}/reveal` → `CredentialSecret`. 403 si su cuenta interna está revocada o la credencial no está `activa`; 404 si no es suya. La empresa ve quién la retiró | JWT Bearer + TOTP (`X-SparkGate-TOTP`) |
| I.error | api | ∀ error → `{detail:string}` (status 4xx/5xx). Algunos suman un `code:string` de primer nivel; hoy solo el 403 del segundo factor | — |
| I.step-up | api | Header `X-SparkGate-TOTP: <6 dígitos>` en las seis operaciones sobre un secreto AJENO: revoke, suggest, `PUT …/secret`, `…/secret/reveal`, `…/members/{id}/vault/{item}/reveal` y `/me/credentials/{id}/reveal`. Rechazo → 403 `{detail,code}` con `code` ∈ `totp_no_enrolado` (no hay factor activo: un factor pendiente cuenta como ninguno) · `totp_invalido` (falta, mal formado, equivocado o vencido) · `totp_reutilizado` (válido pero ya usado: anti-replay, un código por paso de 30 s) · `totp_bloqueado` (5 fallos: 15 min, ni un código correcto pasa). Sin `TOTP_MASTER_KEY` el backend responde 503 y no omite el factor. Restaurar, reasignar, alta de trabajador y registrar cuenta NO lo piden (R-HU18-10) | JWT Bearer |
| I.mfa-status | api | GET `/api/v1/me/mfa` → `{enrolled,pending,confirmed_at?,last_used_at?,locked_until?}`. Nunca el secreto. `enrolled` solo si está confirmado | JWT Bearer |
| I.mfa-enroll | api | POST `/api/v1/me/mfa/enroll` → 201 `{secret,otpauth_uri,issuer,account_name,digits,period,algorithm}`. La ÚNICA respuesta de toda la API con el secreto TOTP en claro, y solo esta vez. Deja el factor PENDIENTE. 409 si ya hay uno confirmado; 503 sin `TOTP_MASTER_KEY`. El QR lo dibuja el cliente: el backend no sirve una imagen | JWT Bearer |
| I.mfa-confirm | api | POST `/api/v1/me/mfa/confirm` con el código en `X-SparkGate-TOTP` → `MfaStatus`. El primer código correcto activa el factor | JWT Bearer |
| I.mfa-disable | api | DELETE `/api/v1/me/mfa` con el código en `X-SparkGate-TOTP` → 204. Exige un código vigente: un JWT robado no puede apagar el factor | JWT Bearer |
| I.storage | chrome-api | `chrome.storage.local`: `{jwt,user_id,type_account,theme}`. `type_account` es respaldo del claim del JWT | — |
| I.manifest | mv3 | `host_permissions: [localhost:8000, *.vercel.app]`, `action: {default_popup:index.html}`, multi-entry vite: `index.html` + `dashboard.html` | — |
| I.dashboard-page | chrome-api | página `chrome-extension://[id]/dashboard.html`, abierta desde popup via `chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')})` | — |
| I.vault-save | api | POST `/api/v1/vault/items` `{service_name,username?,password,notes?}` → `{id,service_name,username?,created_at,updated_at}` (201, cifra AES-256-GCM en el backend, HU17 AC1/AC2) | JWT Bearer |
| I.vault-list | api | GET `/api/v1/vault/items` → `[{id,service_name,username?,created_at,updated_at}]` (nunca descifra) | JWT Bearer |
| I.vault-get | api | GET `/api/v1/vault/items/{id}` → `{id,service_name,username?,password,notes?}`; ítem de otro usuario → 404 (AC3) | JWT Bearer |
| I.vault-delete | api | DELETE `/api/v1/vault/items/{id}` → 204; ítem de otro usuario → 404. No exige clave maestra (Ley 21.719) | JWT Bearer |
| I.vault-purge | api | DELETE `/api/v1/vault/items` → `{deleted_count}` (Ley 21.719) | JWT Bearer |
| I.vault-audit | api | GET `/api/v1/vault/audit` → `[{id,user_id,item_id?,action,result,actor_user_id?,created_at}]` (nunca service_name ni secretos, HU19). `actor_user_id` no nulo = alguien de la empresa abrió ese ítem. Desde HU18 también trae `mfa_enrolar\|mfa_activar\|mfa_desactivar\|mfa_denegado` (el ciclo de vida del propio factor, con `actor_user_id` null) | JWT Bearer |
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
V9: **Invertida en la etapa C.** Antes: "la contraseña sugerida/aplicada no se persiste". Ahora la organización SÍ guarda la contraseña de sus cuentas, siempre cifrada en el backend (AES-256-GCM) y siempre desde el backend: la que muestra el panel es la que DEVUELVE el backend (`applied_password`/`suggested_password`), nunca una generada en el navegador. Lo que NO cambia: ninguna contraseña llega a un audit log, ni de la empresa ni del trabajador (HU17 AC4). Si `secret_stored=false` la respuesta es la única copia y el modal lo dice; nunca se afirma que quedó guardada sin que el backend lo haya confirmado. El draft del detector sigue siendo local y no se envía
V10: Revoke interna bloquea la cuenta en el acto (`ban_duration`) y rota su contraseña real. **Corregida:** antes decía "el access token emitido sigue válido ~1h"; medido contra el backend real, banear o cambiar la contraseña invalida el token ya emitido en la SIGUIENTE petición (401), porque `verify_token` consulta a Auth en cada request (E2E paso 21b0 del backend). Los textos de la UI dicen eso. Re-medido en HU18 (E2E del backend, pasos 22-24, y `hu18-contrato-real.txt` desde el cliente real de la extensión): el access token previo responde 401; login con la contraseña vieja y con la nueva → `user_banned`; el refresh token previo → `refresh_token_not_found` (GoTrue elimina la sesión, no es «bloqueado por el ban»). Si el backend pasara a validar el JWT localmente, esta invariante y esos textos se revisan juntos
V11: Logout usa Bearer, revoca sesión propia (scope global). No revoca otro usuario → offboarding de miembro via revoke dashboard
V12: Vault sin clave maestra en el backend → 503 en guardar/consultar (HU17 AC5). El borrado (ítem, purga total o cuenta) nunca depende de la clave maestra — es el mecanismo de supresión de datos (Ley 21.719) y debe seguir funcionando con el módulo caído
V13: El secreto de un ítem del vault solo se pide on-demand al presionar "Ver" (GET `/items/{id}` el dueño, POST `.../reveal` la empresa); nunca se persiste en chrome.storage ni se precarga al listar. La bóveda de un integrante tampoco se pide hasta que alguien la expande: abrirla ya deja rastro
V15: El botón "Panel de administración" solo se renderiza con `isEnterprise`. Antes se ofrecía a todos y el backend respondía 403 — una puerta cerrada con cartel de bienvenida. `isEnterprise` se resuelve una sola vez en la raíz de página y baja por props
V16: Toda lectura de una bóveda ajena queda registrada en los DOS logs: el de la empresa y el del propio trabajador (con `actor_user_id`). El modal lo dice explícitamente. Es la mitigación de privacidad de HU21, no un detalle de implementación
V17: Aislamiento por organización: un recurso de otra empresa responde 404, nunca 403 ni 200. El `org_id` del filtro lo resuelve el backend contra la tabla en cada request
V18: El AAD del descifrado es el identificador del SUJETO DUEÑO del dato, leído de la misma fila del criptograma, nunca el del caller: `user_id` en un ítem de bóveda personal, `org_id` en una credencial de la organización. Que la empresa pueda leer no debilita el cifrado: una fila movida a otro dueño sigue fallando el tag GCM. Con `org_id` como AAD, reasignar una credencial es un `UPDATE` y no re-cifra nada, y la supresión de datos del trabajador no puede destruir un secreto de la empresa
V19: Todo secreto ajeno pasa por un único punto de paso en el backend (`secret_access`). **Corregida en HU18:** antes decía que el segundo factor se resolvería agregando un header a las tres llamadas de «ver contraseña» y que nada más cambiaría. Quedó corto por dos motivos: el backend gatea también las ESCRITURAS (revocar, sugerir, guardar una contraseña, que entran por `require_step_up`), así que son seis llamadas y no tres; y pedir el código exige pantallas nuevas (el campo, el modal y el enrolamiento). Ver V23-V28. Ninguna de las tres lecturas se cachea ni se precarga (V13)
V20: El panel muestra el `detail` del backend en los 403/404/503 de estas acciones, sin reinterpretarlo. El aviso de un secreto que no se pudo guardar (`secret_stored=false`) es un `role="alert"`, no un texto informativo
V21: La credencial es de la ORGANIZACIÓN y el integrante es solo su portador: sobrevive a que se borre su cuenta y puede quedar sin asignar (`member_id=null`, sección "Cuentas sin asignar"). Reasignar solo aplica a externas (400 en una interna: pasársela al reemplazo es darle la identidad del anterior). Tras revocar o reasignar se sugiere rotar (`rotation_required`), y la marca se apaga solo guardando una contraseña nueva: no hay botón de "descartar"
V22: Revelar la contraseña de una cuenta INTERNA avisa que la empresa puede iniciar sesión como el trabajador y que esa sesión queda a nombre de él (R-HU21-5). Lo que queda visible para él es que la contraseña se retiró, no su uso. La pestaña «Accesos» del trabajador es el único lugar de la UI donde se entera: `GET /vault/audit` existía sin ninguna pantalla que lo consumiera
V23: El código del segundo factor es un parámetro OBLIGATORIO de cada una de las seis funciones de la API y viaja SOLO en el header `X-SparkGate-TOTP`: nunca en la URL (queda en el historial) ni en el body (un DELETE con body lo pierden algunos proxies). TypeScript no deja llamarlas sin él, así que una séptima pantalla no puede olvidarse de pedirlo. Y NO viaja a las operaciones que el backend no gatea: enviarlo de más lo filtra a endpoints que no lo necesitan. Un test fija las dos direcciones. Tampoco se guarda ni se muestra: se borra del campo tras cada rechazo, porque uno ya usado o equivocado no sirve de nuevo
V24: Un rechazo del segundo factor se distingue por el `code` de primer nivel del 403 y NO por el texto: otros 403 (cuenta revocada, credencial no activa) no llevan `code`. `totp_no_enrolado` no dice «código incorrecto» —no hay código que corregir—: ofrece configurar el factor y abre el enrolamiento. `totp_invalido`, `totp_reutilizado` y `totp_bloqueado` piden de nuevo o esperar. El mensaje es el `detail` del backend sin reinterpretar (V20), y se ve DENTRO del modal que pidió el código, que sigue abierto. Un botón que ofrece configurar solo aparece cuando hay quien lo atienda
V25: El secreto TOTP vive únicamente en el estado del componente que lo generó, desde `enroll` hasta que el factor se activa o se abandona. Nunca en `chrome.storage`, ni en un log, ni en el DOM como texto (el QR es un SVG sin texto y su `aria-label` no lo lleva). Sale de memoria al activarse. El backend no lo vuelve a entregar: un factor pendiente sin su secreto en pantalla solo se puede reiniciar, no recuperar
V26: Un factor PENDIENTE (enrolado pero sin confirmar) no se presenta como activo, y no habilita nada: el backend lo trata como `totp_no_enrolado`. Sin esa regla, abandonar el enrolamiento a mitad dejaría a la persona sin salida
V27: El trabajador también configura su segundo factor (pestaña «Seguridad» de la bóveda): retirar la credencial que la empresa le asignó lo exige, porque ese secreto es de la ORGANIZACIÓN. Orden de despliegue, igual que en el backend: el enrolamiento va ANTES de que se exija el código, o queda una ventana donde nadie puede leer nada ni enrolarse
V28: La interfaz no simula un control que el backend no tiene. Restaurar, reasignar, dar de alta un trabajador y registrar una cuenta NO piden código porque el backend no los gatea (R-HU18-10); si un día los gatea, la firma de esas funciones cambia y TypeScript marca cada llamador. Cada código se puede usar una sola vez: los modales lo dicen, porque «esperá al siguiente» no es evidente
V29: La auditoría del panel etiqueta las tres acciones `*_denegado` y explica el motivo (`denied_reason`) en lenguaje de persona, en la tabla y en el CSV (columna «Motivo», con el texto legible y no el identificador). Un motivo que el panel no conoce se muestra tal cual en vez de esconderse. El trabajador ve en «Accesos» el ciclo de vida de su propio factor (`mfa_*`)
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

| T20 | x | Etapa C, cliente: tipos `Credential`/`CredentialSecret`/`RotationSuggestion`/`AssignedCredential`, `put` en client.ts, `createCredential`/`saveCredentialSecret`/`revealCredentialSecret`/`reassignCredential`/`getUnassignedCredentials`, `api/me.ts`, `getAudit`; `newPassword` de revoke/suggest pasa a opcional | V9, V21, I.dashboard-credential-create, I.dashboard-credential-secret, I.dashboard-credential-reveal, I.dashboard-credential-reassign, I.dashboard-credentials-pool |
| T21 | x | Etapa C, panel: la contraseña mostrada es la que devuelve el backend; ver/guardar/cambiar contraseña, registrar cuenta externa, reasignar, sección «Cuentas sin asignar», chip «Rotar pendiente» y aviso tras revocar/reasignar; auditoría con actor/integrante nulos y etiquetas de las 15 acciones. Se reescriben los textos «no se guarda en ningún lado» y «token válido ~1h» | V9, V10, V20, V21, V22 |
| T22 | x | Etapa C, trabajador: pestañas «Empresa» (retirar lo asignado) y «Accesos» (`GET /vault/audit`, con las consultas de la empresa resaltadas) en VaultScreen | V19, V22, I.me-credentials, I.me-credential-reveal, I.vault-audit |

| T23 | x | HU18, base: `ApiError.code`, cabeceras extra en `post/put/del`, `withTotp`, `api/mfa.ts`, `types/mfa.ts`, `utils/stepUp.ts` (clasifica el 403 por su `code`) | V23, V24, I.error, I.step-up, I.mfa-status, I.mfa-enroll, I.mfa-confirm, I.mfa-disable |
| T24 | x | HU18, componentes: `QrCode` (SVG sin innerHTML, dependencia nueva `qrcode-generator`), `TotpCodeField`, `StepUpAlert`, `StepUpModal` + `useStepUpPrompt`, `useMfa`, `MfaEnrollment`; montados en el encabezado del panel y en la pestaña «Seguridad» de la bóveda | V25, V26, V27 |
| T25 | x | HU18, las seis operaciones: el código pasa a ser obligatorio en la firma de `revokeInternal`, `suggestExternal`, `saveCredentialSecret`, `revealCredentialSecret`, `revealMemberVaultItem` y `revealAssignedCredential`; campo de código en los modales de revocar/sugerir/guardar y `useStepUpPrompt` en las tres lecturas | V19, V23, V24, V28, I.step-up |
| T26 | x | HU18, auditoría: etiquetas de `revocar_interna_denegado`/`sugerir_externa_denegado`/`guardar_secreto_denegado` y de `mfa_*`, `denied_reason` legible en la tabla y columna «Motivo» del CSV | V29, I.dashboard-audit-log, I.vault-audit |
| T27 | x | HU18, contrato REAL: `src/test/contract.real.test.ts` (apagado por defecto) corre el código de la extensión contra el backend y Supabase reales; claves de cada respuesta comparadas con el tipo TS. Evidencia en `docs/evidencia/hu18-contrato-real.txt` | I.step-up, V10 |

### Status legend

`.` pending · `~` wip · `x` done

## §B — Backlog

| id | date | cause | fix |
|---|---|---|---|
| B1 | 2026-08-31 | Cliente SDK con `sign_in` reutilizado como singleton: supabase-py reescribe el header `Authorization` del cliente en `SIGNED_IN`, dejándolo como el último usuario para todo el proceso | Revocar con token explícito (`admin.sign_out(jwt, scope="global")`); el camino de sign-in usa cliente efímero `create_auth_client()` cerrado en `finally`. Ver `_Leccion-singleton-sdk-muta-estado-global` |
| B2 | 2026-09-18 | El panel mostraba una contraseña generada en el navegador y `suggest` la descartaba en el backend: el comentario decía "se devuelve al caller" y era falso. Nadie la tenía guardada, así que no había cómo entregarla a un reemplazo ni comprobar que era la aplicada | La genera y guarda el backend, y el panel muestra lo que este devuelve (V9). Un texto de UI que afirma un comportamiento del backend es una invariante y se prueba (`ActionResultModal.test`) |
| B3 | 2026-09-18 | V10 y el modal de revocar afirmaban una ventana de ~1 h con el token vivo. Nadie la había medido; al medirla contra el backend real no existe (401 inmediato) | V10 corregida con la medición y su origen. Una afirmación de seguridad en un texto de UI se verifica contra el sistema real antes de escribirse |
| B4 | 2026-09-20 | V19 predecía que el segundo factor se resolvería «agregando un header a las tres llamadas de ver contraseña y nada más cambia». Al llegar HU18 el backend gateó también revocar, sugerir y guardar (seis llamadas), y hicieron falta el enrolamiento, un campo de código en tres modales y un modal nuevo | V19 corregida (V23-V28). Una invariante que PREDICE un cambio futuro es una afirmación y caduca: no se escribe como regla. Hoy el código es un parámetro obligatorio de la firma, y el compilador marca a quien lo olvide |
| B5 | 2026-09-20 | Un test que afirmaba que «código inválido NO ofrece configurar el factor» no pasaba `onEnroll`, así que el botón no se renderizaba nunca y la aserción de ausencia era vacía: la mutación que lo mostraba siempre se escapó | Un test de ausencia tiene que montar la condición que haría posible la presencia. Se corrigió y se volvió a mutar. Misma familia que `_Leccion-check-tautologico-infla-la-evidencia` |

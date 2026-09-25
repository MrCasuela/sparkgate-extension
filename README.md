# SparkGate Extension

Extensión de Chrome para generar y evaluar contraseñas con IA.
Proyecto académico — Universidad Andrés Bello, Chile.

## Stack

| Componente | Tecnología |
|---|---|
| Chrome API | Manifest V3 |
| UI | React 18 + TypeScript |
| Build | Vite 5 (multi-entry: popup + dashboard, sin CRXJS) |
| Estilos | Tailwind CSS 3 (modo oscuro) |
| Tests | Vitest 3 + React Testing Library |
| Lint | ESLint 10 (flat config) |
| CI | GitHub Actions (typecheck + lint + test + build) |
| Backend | FastAPI + Supabase + Ollama ([repositorio separado](../sparkgate-api)) |

## Requisitos

- Node.js 18+
- pnpm (o npm)
- Backend `sparkgate-api` corriendo en `localhost:8000`

## Instalación

```bash
pnpm install
```

## Desarrollo

```bash
pnpm dev
```

Build output en `dist/`. Para cargar en Chrome:

1. Abrir `chrome://extensions`
2. Activar modo desarrollador
3. "Cargar descomprimida" → seleccionar `dist/`

## Build producción

```bash
pnpm build
```

Genera `dist/` listo para Chrome Web Store.

## Endpoints del backend consumidos

Todos los body son JSON. Solicitudes autenticadas usan `Authorization: Bearer`
(JWT en `chrome.storage.local`); ante 401 el cliente limpia la sesión.

| Método | Ruta | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | JSON |
| POST | `/api/v1/auth/login` | — | JSON |
| POST | `/api/v1/auth/logout` | JWT Bearer | — |
| POST | `/api/v1/passwords/evaluate` | JWT | JSON |
| POST | `/api/v1/passwords/generate` | JWT | JSON |
| GET | `/api/v1/health` | — | — |
| GET | `/api/v1/dashboard/members` | JWT empresa | — |
| POST | `/api/v1/dashboard/members` | JWT empresa | JSON |
| GET | `/api/v1/dashboard/audit-log` | JWT empresa | — |
| POST | `/api/v1/dashboard/credentials/{id}/revoke` | JWT empresa + **TOTP** | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/suggest` | JWT empresa + **TOTP** | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/restore` | JWT empresa | — |
| GET | `/api/v1/dashboard/members/{id}/vault` | JWT empresa | — |
| POST | `/api/v1/dashboard/members/{mid}/vault/{iid}/reveal` | JWT empresa + **TOTP** | — |
| PUT | `/api/v1/dashboard/credentials/{id}/secret` | JWT empresa + **TOTP** | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/secret/reveal` | JWT empresa + **TOTP** | — |
| GET | `/api/v1/me/credentials` | JWT | — |
| POST | `/api/v1/me/credentials/{id}/reveal` | JWT + **TOTP** | — |
| GET | `/api/v1/me/mfa` | JWT | — |
| POST | `/api/v1/me/mfa/enroll` | JWT | — |
| POST | `/api/v1/me/mfa/confirm` | JWT + código | — |
| DELETE | `/api/v1/me/mfa` | JWT + código | — |

### Segundo factor (HU18)

Ver o rotar una contraseña que **no es tuya** pide un código TOTP de 6 dígitos (el mismo que muestra
Google Authenticator o Authy), enviado en el header `X-SparkGate-TOTP`. Son las seis filas marcadas
**TOTP**; incluye al trabajador que retira la credencial que su empresa le asignó, porque ese secreto
es de la organización.

- **Configurarlo:** botón «Segundo factor» en el panel de administración, o pestaña «Seguridad» de la
  bóveda. Se escanea un QR (dibujado en la extensión a partir del `otpauth://` que devuelve el
  backend) y se confirma con el primer código. El secreto se muestra una sola vez y no se guarda.
- **Si el backend rechaza el código** (`403` con un `code`), el modal lo dice sin cerrarse:
  `totp_no_enrolado` ofrece configurar el factor; `totp_invalido`, `totp_reutilizado` y
  `totp_bloqueado` piden de nuevo o esperar. Cada código sirve **una sola vez**.
- **Auditoría:** los intentos rechazados quedan en el registro del panel con su motivo, y el trabajador
  ve el ciclo de vida de su propio factor en «Accesos».
- Contrato verificado contra el backend real: `docs/evidencia/hu18-contrato-real.txt`
  (`src/test/contract.real.test.ts`, apagado por defecto; ver el comentario del archivo).

## Superficies de UI

```
Popup (index.html, 360×500px)
├── AuthScreen (login / registro)
└── Navigator
    ├── Generador (AlphanumericTab | MemorableTab)
    ├── Detector (entropía + AI + HIBP)
    └── Botón "Panel de administración" → abre dashboard.html en pestaña
        (solo visible en cuentas de empresa)

Dashboard (dashboard.html, pestaña completa — solo cuentas de empresa)
├── Lista de miembros y credenciales (interna/externa, estado)
├── Botón «Segundo factor» (configurar / desactivar el propio)
└── Audit log + export CSV (con el motivo de los intentos rechazados)
```

## Especificación

`SPEC.md` contiene la especificación formal del proyecto (tasks, invariantes).
Ver `AGENTS.md` para guía del agente OpenCode.

## Arquitectura

Diagramas de capas, componentes, flujos y modelo de datos en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Matriz de pruebas en
[`docs/PRUEBAS.md`](docs/PRUEBAS.md).

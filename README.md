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
| POST | `/api/v1/dashboard/credentials/{id}/revoke` | JWT empresa | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/suggest` | JWT empresa | JSON |
| POST | `/api/v1/dashboard/credentials/{id}/restore` | JWT empresa | — |
| GET | `/api/v1/dashboard/members/{id}/vault` | JWT empresa | — |
| POST | `/api/v1/dashboard/members/{mid}/vault/{iid}/reveal` | JWT empresa | — |

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
└── Audit log + export CSV
```

## Especificación

`SPEC.md` contiene la especificación formal del proyecto (tasks, invariantes).
Ver `AGENTS.md` para guía del agente OpenCode.

## Arquitectura

Diagramas de capas, componentes, flujos y modelo de datos en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Matriz de pruebas en
[`docs/PRUEBAS.md`](docs/PRUEBAS.md).

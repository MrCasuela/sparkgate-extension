# SparkGate Extension

Extensión de Chrome para generar y evaluar contraseñas con IA.
Proyecto académico — Universidad Andrés Bello, Chile.

## Stack

| Componente | Tecnología |
|---|---|
| Chrome API | Manifest V3 |
| UI | React 18 + TypeScript |
| Build | Vite 5 + CRXJS v2 |
| Estilos | Tailwind CSS 3 (modo oscuro) |
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

| Método | Ruta | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | form |
| POST | `/api/v1/auth/login` | — | form |
| POST | `/api/v1/auth/logout` | — | form |
| POST | `/api/v1/passwords/evaluate` | JWT | JSON |
| POST | `/api/v1/passwords/generate` | JWT | JSON |
| GET | `/api/v1/health` | — | — |

## Componentes principales

```
Popup
├── AuthScreen (login / registro)
├── Navigator
│   ├── GeneratorScreen
│   │   ├── AlphanumericTab (slider 12-64, charset toggles)
│   │   └── MemorableTab (frase IA)
│   └── DetectorScreen (evaluación: entropía + IA + HIBP)
```

## Especificación

`SPEC.md` contiene la especificación formal del proyecto (tasks, invariantes). Ver `AGENTS.md` para guía del agente OpenCode.

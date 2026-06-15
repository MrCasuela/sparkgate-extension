# Handoff — SparkGate Extension

## Goal
Tener extensión SparkGate funcional en Chrome evaluando/generando contraseñas contra backend sparkgate-api.

## Current status
- SPEC.md completa con §T tasks (T1-T9 todos x)
- AGENTS.md + README.md creados
- Scaffold: Vite 5 + React 18 + TW3 + TS (sin CRXJS)
- Auth: login/register con form-urlencoded, JWT en chrome.storage.local
- Screens: AuthScreen, GeneratorScreen (Alphanumeric+Memorable), DetectorScreen
- Components: PasswordDisplay, EntropyGauge, SuggestionList, LoadingSpinner, ErrorAlert
- Build: `pnpm build && cp manifest.json dist/` → exit 0
- Backend corre en localhost:8000 (health ok)
- `.env` con VITE_API_URL configurable

## What still needs to happen
- Confirmar que extensión carga sin errores en Chrome (usuario probando ahora)
- Probar flujo completo: register → login → generate → evaluate
- Si hay error de carga, debuggear desde Consola del popup

## Important context
- Proyecto académico UNAB Chile. Textos en español.
- Backend separado en ../sparkgate-api (FastAPI + Supabase + Ollama)
- CORS backend ya permite chrome-extension://*
- Sin CRXJS — reemplazado por Vite plano por bug de MIME type
- Sin emojis en UI (reemplazados por texto/iconos CSS)

## Decisions already made
- CRXJS eliminado → Vite plano + cp manifest post-build (MIME type bug)
- .env para VITE_API_URL (dev localhost:8000, prod Railway)
- host_permissions incluye localhost + *.railway.app
- Plan badge = mock visual "Gratuito", Upgrade disabled
- Sin SSO (backlog)
- TW3 con tailwind.config.ts + dark: class
- Slider generate 12-64 (backend valida)

## What to avoid
- No editar backend (repo separado)
- No reintroducir CRXJS (causa MIME type application/octet-stream)

## Open questions or blockers
- Usuario reportó pantalla en blanco con 3 errores (inline script CSP, MIME type de CRXJS). Se fixearon: inline script eliminado, CRXJS reemplazado, crossorigin removido. Pendiente confirmación del usuario si ya funciona.

## Next best step
- Esperar confirmación del usuario sobre si la extensión carga correctamente tras los fixes.
- Si carga ok, probar flujo register → login → generate → evaluate.

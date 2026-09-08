# Pruebas y Evidencia — SparkGate Extension

> Documento vivo de pruebas del frontend (extensión Chrome). Matriz de
> trazabilidad con las historias de usuario (HU) del backlog que corresponden
> a este repo, y estado honesto de lo que falta. Ver también
> [`../../sparkgate-api/docs/PRUEBAS.md`](../../sparkgate-api/docs/PRUEBAS.md)
> para las HU de backend.

Fecha de última ejecución: 2026-09-07.

## 1. Resumen ejecutivo

Antes de esta pasada **no existía ningún test, framework de testing, linter ni
CI/CD** en este repo. Se armó desde cero:

| Métrica | Resultado |
|---|---|
| Framework de test | Vitest 3 + React Testing Library (nuevo) |
| Suite automatizada | **7 passed, 0 failed** (2 archivos) |
| Cobertura de sentencias (global) | **30.68%** — solo 2 de ~20 componentes tienen test dedicado |
| Linter | ESLint 10 (flat config), nuevo — 0 errores sobre el código actual |
| Typecheck | `tsc --noEmit` — 0 errores (se corrigió un bug preexistente, ver §5) |
| CI | GitHub Actions (`ci-cd.yml`): typecheck + lint + test + build en push/PR |

Cobertura baja es esperable: recién se sientan las bases. Prioridad debería
ser ampliar tests de `hooks/`, `api/`, y las pantallas (`GeneratorScreen`,
`DetectorScreen`) antes de perseguir un % alto.

## 2. Cómo correr

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # eslint .
pnpm run test        # vitest run
pnpm run test:coverage
pnpm run build       # vite build + copia manifest.json
```

## 3. Matriz de trazabilidad HU ↔ pruebas

Backlog: HU08, HU13, HU14, HU15 corresponden a este repo (el resto vive en
`sparkgate-api`).

| HU | Historia | Prueba | Resultado | Estado |
|----|----------|--------|-----------|--------|
| HU08 | Copiar contraseña generada con un clic | `PasswordDisplay.test.tsx` (5 tests: renderiza, copia al portapapeles, revierte label, muestra entropía, no rompe sin Clipboard API) | ✅ | Cubierta |
| HU13 | Instalar extensión desde Chrome Web Store con un clic | — | — | **No aplica test automatizado** — es una acción del usuario en la Web Store, fuera del código de este repo. Validación es manual/aceptación (ver plantilla de acta). |
| HU14 | Detectar campos de contraseña automáticamente | — | ❌ | **No implementada.** `manifest.json` no declara `content_scripts` ni `host_permissions` amplios (`<all_urls>`) — la extensión es popup-only, no inyecta en páginas de terceros. No hay código que testear todavía. |
| HU15 | Interfaz simple y clara para usuario no técnico | `App.test.tsx` (2 tests: pantalla única sin colgarse en loading, un solo botón de submit visible) | ✅ | Cubierta como **contrato de estructura** (una pantalla, una acción primaria) — no valida percepción real de usuario, eso requiere UX testing tipo PT09 en el backend. |

Resumen:

| Universo | Cantidad |
|---|---|
| HU de este repo | 4 |
| Cubiertas con test | 2 (HU08, HU15) |
| No aplica test automatizado | 1 (HU13 — acción externa) |
| No implementada | 1 (HU14 — sin content script) |

## 4. Aceptación (pendiente)

Igual que en el backend: no existen actas de aceptación firmadas. Plantilla
disponible en `docs/ACTA_ACEPTACION_TEMPLATE.md`.

## 5. Problemas encontrados y resueltos en esta pasada

- **`import.meta.env` sin tipos** en `src/api/client.ts` — faltaba
  `src/vite-env.d.ts` (`/// <reference types="vite/client" />`), un archivo
  estándar del template Vite que nunca se generó/commiteó. `tsc --noEmit`
  fallaba hasta agregarlo.
- **`manifest.json` apuntaba a `railway.app`** en `host_permissions` — el
  backend se movió a Vercel (ver `sparkgate-api`). Corregido a `*.vercel.app`;
  si no se actualizaba, el `fetch` a producción se hubiera bloqueado por falta
  de permiso de host declarado.
- **`eslint-plugin-react-hooks@7` "recommended" incluye reglas nuevas
  (`set-state-in-effect`)** que marcan como error el patrón
  fetch-on-mount de `useAuth.ts` (común y válido, no un bug). Se optó por
  reglas hand-picked (`rules-of-hooks` + `exhaustive-deps`) en vez del bundle
  completo, para no bloquear CI por un false positive de estilo.
- El proyecto usa **pnpm** (`pnpm-lock.yaml`), no npm — un primer intento con
  `npm install` corrompió la resolución de symlinks de pnpm en
  `node_modules` (arborist crash). Sin cambios persistidos: se limpió y se
  usó `pnpm add` correctamente.

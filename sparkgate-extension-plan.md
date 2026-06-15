# SparkGate Extension — Plan de Arquitectura Frontend

> Basado en el Informe Portafolio Hito 3, mockups de UI y backend existente (`sparkgate-api`).
>
> Repositorio separado: `sparkgate-extension` (Chrome Extension MV3 + React).

---

## Stack

| Componente | Tecnología | Versión |
|---|---|---|
| Lenguaje | TypeScript | 5.x |
| UI Framework | React | 18.x |
| Build | Vite + CRXJS | 5.x / 2.x |
| Estilos | Tailwind CSS + modo oscuro | 4.x |
| Chrome API | Manifest V3 | — |

---

## Estructura de directorios

```
sparkgate-extension/
├── manifest.json                   # MV3: host_permissions, action, icons
├── vite.config.ts                  # CRXJS plugin
├── tailwind.config.ts              # dark mode: class
├── tsconfig.json
├── package.json
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── popup/
    │   ├── index.html              # Popup entry HTML (~320×500px)
    │   ├── main.tsx                # ReactDOM.createRoot
    │   └── App.tsx                 # Navigator: Auth | Generator | Detector
    ├── components/
    │   ├── AuthScreen.tsx           # Login + Register tabs + Plan badge
    │   ├── GeneratorScreen.tsx      # Contenedor con tabs internas
    │   │   ├── AlphanumericTab.tsx  # Slider 8-48, toggles charset
    │   │   └── MemorableTab.tsx     # Palabras español + separador + número
    │   ├── DetectorScreen.tsx       # Input → POST evaluate → resultados
    │   ├── EvaluateResult.tsx       # Score bar + feedback + sugerencias
    │   ├── PasswordDisplay.tsx      # Campo + botón copiar
    │   ├── EntropyGauge.tsx         # Barra progreso umbral 60 bits
    │   ├── SuggestionList.tsx       # Lista sugerencias AI
    │   ├── LoadingSpinner.tsx
    │   └── ErrorAlert.tsx
    ├── api/
    │   ├── client.ts               # fetch wrapper + interceptor Bearer token
    │   ├── auth.ts                  # register(), login(), logout()
    │   └── passwords.ts             # evaluate(), generate()
    ├── hooks/
    │   ├── useAuth.ts               # login/logout/register + storage sync
    │   └── usePassword.ts           # evaluate + generate state machine
    ├── types/
    │   ├── auth.ts                  # LoginResponse, RegisterResponse
    │   ├── passwords.ts             # EvaluateRequest/Response, GenerateRequest/Response
    │   └── common.ts                # ErrorResponse, HealthResponse
    ├── utils/
    │   └── storage.ts               # chrome.storage.local wrapper (JWT, user)
    └── styles/
        └── index.css                # Tailwind directives + variables CSS
```

---

## Pantallas (4, del mockup)

### 1. AuthScreen

| Elemento | Descripción |
|---|---|
| Login | Email + password → `POST /api/v1/auth/login` → guarda JWT |
| Register | Email + password → `POST /api/v1/auth/register` → mensaje éxito |
| Plan badge | Muestra plan actual (Gratuito / Premium) + botón Upgrade |
| SSO | Logos Google, Apple (mockup visual, opcional funcional) |
| Dark mode toggle | Switch en header |

### 2. GeneratorScreen — AlphanumericTab

| Elemento | Descripción |
|---|---|
| Slider | Longitud 8–48 (default 16) |
| Toggles | Mayúsculas, minúsculas, dígitos, símbolos |
| Botón Generar | `POST /api/v1/passwords/generate {mode:"random"}` |
| Resultado | Password display + H bits + botón copiar |
| Ejemplo mockup | `K7m$xQ9!vL2&pN4z — H=104.87 bits` |

### 3. GeneratorScreen — MemorableTab

| Elemento | Descripción |
|---|---|
| Botón Generar | `POST /api/v1/passwords/generate {mode:"ai"}` |
| Resultado | Password display + H bits + explicación + botón copiar |
| Ejemplo mockup | `CaballoAzul#72 — H=85.3 bits` |

### 4. DetectorScreen

| Elemento | Descripción |
|---|---|
| Input | Campo texto para pegar contraseña existente |
| Botón Evaluar | `POST /api/v1/passwords/evaluate` |
| Resultados | 3 cards verticales: |

Card 1 — Entropía:
- Valor numérico H bits
- Barra verde/rojo según umbral ≥ 60 bits
- Label: "Segura" / "Débil"

Card 2 — Análisis IA:
- Score (0–100)
- Feedback en español (texto)
- Sugerencias (lista)

Card 3 — HIBP:
- "No comprometida" (verde) / "Apareció en X filtraciones" (rojo)
- Count si > 0

---

## API Client

```typescript
// client.ts — fetch wrapper
// - Lee JWT de chrome.storage.local
// - Agrega header Authorization: Bearer <token>
// - Si 401 → limpia storage, redirige a AuthScreen
// - Base URL configurable (producción: Railway, dev: localhost:8000)

// auth.ts
register(email, password): Promise<{message, user_id}>
login(email, password): Promise<{access_token, user_id}>
logout(): Promise<void>

// passwords.ts
evaluate(password, context?): Promise<EvaluateResponse>
generate(params: {length, mode, context?, complexity_level?}): Promise<GenerateResponse>
```

### Tipos (1:1 con Pydantic backend)

```typescript
// types/passwords.ts
interface EvaluateRequest { password: string; context?: string }
interface EvaluateResponse {
  is_compromised: boolean; pwned_count: number;
  entropy_bits: number; entropy_threshold_met: boolean;
  ai_score: number; ai_feedback: string; ai_suggestions: string[];
}
interface GenerateRequest {
  length: number; mode: "ai" | "random";
  context?: string; complexity_level?: string;
}
interface GenerateResponse {
  generated_password: string; explanation: string; entropy_bits: number;
}
```

---

## Flujo de navegación

```
Popup abre
  └─ check chrome.storage.local → JWT existe?
       ├─ NO  → AuthScreen
       │         ├─ Login ok → guarda JWT + user → Navigator
       │         └─ Register ok → mensaje → vuelve Login
       └─ SÍ  → Navigator
                  ├─ Tab "Generar"
                  │   ├─ Alphanumeric (default)
                  │   └─ Memorable (toggle)
                  ├─ Tab "Detectar"
                  └─ Logout → limpia storage → AuthScreen
```

---

## Diseño Visual (del mockup)

| Token | Valor |
|---|---|
| `--color-primary` | `#1e3a5f` (azul oscuro) |
| `--color-positive` | `#22c55e` (verde) |
| `--color-alert` | `#ef4444` (rojo) |
| `--color-bg` | `#f8fafc` (claro) / `#0f172a` (oscuro) |
| `--color-text` | `#1e293b` (claro) / `#f1f5f9` (oscuro) |
| Popup width | 360px |
| Popup height | 500px (sin scroll ideal) |

Dark mode: toggle en header, clase `.dark` en `<html>`, Tailwind `dark:` prefix.

---

## Backend Dependencies

| Endpoint | Método | Auth |
|---|---|---|
| `/api/v1/health` | GET | No |
| `/api/v1/auth/register` | POST | No |
| `/api/v1/auth/login` | POST | No |
| `/api/v1/passwords/evaluate` | POST | JWT |
| `/api/v1/passwords/generate` | POST | JWT |

Backend URL por defecto: `http://localhost:8000` (dev) → Railway URL (prod).
Configurable en `chrome.storage.sync` o archivo de config.

---

## Implementación (orden sugerido)

| Paso | Archivos | Depende de |
|---|---|---|
| 1. Scaffold | Vite + CRXJS + Tailwind + manifest.json | — |
| 2. Types + API client | `types/*`, `api/*` | — |
| 3. AuthScreen | `AuthScreen.tsx`, `hooks/useAuth.ts`, `utils/storage.ts` | Paso 2 |
| 4. Navigator + Layout | `App.tsx`, tabs | Paso 3 |
| 5. GeneratorScreen | `GeneratorScreen.tsx`, `AlphanumericTab.tsx`, `MemorableTab.tsx` | Paso 4 |
| 6. DetectorScreen | `DetectorScreen.tsx`, `EvaluateResult.tsx`, `EntropyGauge.tsx` | Paso 4 |
| 7. Dark mode | Tailwind config, toggle, styles | Paso 1 |
| 8. Polish | Copiar, loading, errores, diseño mockup | Pasos 3–6 |

---

## Dev workflow

```bash
# 1. Crear proyecto
npm create vite@latest sparkgate-extension -- --template react-ts
cd sparkgate-extension
npm install -D @crxjs/vite-plugin tailwindcss @tailwindcss/vite

# 2. Configurar vite.config.ts con crx plugin y manifest

# 3. Dev
npm run dev     # CRXJS hot-reload → chrome://extensions load unpacked

# 4. Build
npm run build   # dist/ → zip para Chrome Web Store
```

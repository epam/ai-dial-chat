# AI DIAL Chat (Next Generation) — Architecture

> Living document. Updated as decisions are finalized.

---

## Overview

AI DIAL Chat (Next Generation) is a ground-up rewrite of [ai-dial-chat](https://github.com/epam/ai-dial-chat), built from scratch with a focus on **modularity**, **customizability**, and **developer experience**.

Core principle: the chat application is assembled from a set of **independently publishable UI libraries** under the `@epam` namespace. Each library is style-agnostic by default and exposes a theming contract via CSS custom properties. The top-level chat app is one possible assembly — teams can compose their own from the same building blocks.

---

## Goals

| Goal                 | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Composable**       | Chat is built from discrete, reusable `@epam/*` packages                                      |
| **Styleable**        | Every package accepts colors, fonts, and border-radius via a three-tier CSS variable contract |
| **Theme-compatible** | DIAL Theme system supported — same JSON format as legacy chat                                 |
| **Auth-agnostic**    | Authentication lives in the app layer only, never inside libraries                            |

---

## Monorepo & Tooling

| Tool               | Role                                                           |
| ------------------ | -------------------------------------------------------------- |
| **Nx 22**          | Monorepo orchestration, task pipeline, caching, affected graph |
| **npm workspaces** | Package management                                             |
| **React 19**       | UI framework for all libraries and the frontend app            |
| **NestJS 11**      | Backend API server (`apps/chat-api`)                           |
| **TypeScript 5.9** | Strict mode, `noUnusedLocals`, `noUnusedParameters`            |
| **Vite 8**         | Frontend bundler                                               |
| **Vitest 4**       | Test runner (frontend + backend unit tests)                    |
| **ESLint 9**       | Flat config (`eslint.config.mjs`) + Prettier 3                 |

```
root/
├── apps/
│   ├── chat/                  # React SPA — frontend chat application (port 4207)
│   └── chat-api/              # NestJS — backend API server (port 5000)
├── libs/
│   ├── chat-shared/           # @epam/ai-dial-chat-shared
│   ├── conversation-input/    # @epam/ai-dial-conversation-input
│   └── conversation-messages/ # @epam/ai-dial-conversation-messages
├── openspec/
│   ├── config.yaml            # Tech stack, commands, architecture rules for AI agents
│   └── lib-styling-guide.md   # CSS variable / SCSS module conventions for libs/*
├── nx.json
└── package.json
```

## Architecture Layers

```
┌────────────────────────────────────────────────────────────────┐
│               apps/chat  (React SPA)                           │
│   routing · auth context · ThemeProvider · i18n · state       │
├──────────────────┬─────────────────────────────────────────────┤
│ @epam/            │ @epam/                                      │
│ conversation-     │ conversation-                               │
│ input             │ messages                                    │
│ (composer,        │ (message feed,                              │
│  attachments)     │  streaming, actions)                        │
├──────────────────┴─────────────────────────────────────────────┤
│                 @epam/ai-dial-chat-shared                               │
│         shared types · shared utils · shared hooks             │
└────────────────────────────────────────────────────────────────┘
                              │ REST / SSE
┌────────────────────────────────────────────────────────────────┐
│               apps/chat-api  (NestJS 11)                       │
│   OIDC auth · session/CSRF · DIAL API proxy · SSE · config     │
└────────────────────────────────────────────────────────────────┘
```

---

## Libraries

### `@epam/ai-dial-chat-shared` (`libs/chat-shared`)

Shared foundation consumed by all libraries **and** apps. Published to npm.

Responsibilities:

- Common TypeScript types and interfaces (`Message`, `Conversation`, `ConversationMetadata`, `UserProfile`, `Theme`, `DialModel`, etc.)
- `mergeClasses` utility (wraps `classnames` + `tailwind-merge`)

Does **not** contain any UI components or business logic.

---

### `@epam/ai-dial-conversation-input` (`libs/conversation-input`)

The message composer — user input area. Published to npm.

Responsibilities:

- Textarea with auto-resize
- Send button
- Attachment picker
- Mentions / slash commands

Props API:

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';

<ConversationInput
  onSend={(text, attachments) => sendMessage(text, attachments)}
  colors={{ background: '#1e1e1e', welcomeText: '#fff' }}
  typography={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
/>;
```

Does **not**:

- Make API calls directly
- Manage conversation state
- Handle auth

---

### `@epam/ai-dial-conversation-messages` (`libs/conversation-messages`)

The message feed. Published to npm.

Responsibilities:

- Render message list (user / assistant / system)
- Markdown + code highlighting in assistant messages
- Streaming message rendering (receives streamed chunks via props)
- Message actions (copy, regenerate, edit)
- Attachments rendering

Does **not** own streaming state — `apps/chat` orchestrates SSE and passes chunks down.

---

## apps/chat — Frontend

React SPA. Entry: `apps/chat/src/main.tsx`.

### Folder structure

```
apps/chat/src/
├── main.tsx               # BrowserRouter + UserProvider + ThemeProvider
├── app/
│   └── app.tsx            # Root routing component, lazy-loads all routes
├── components/            # PascalCase folders, tests/ subfolder inside
│   ├── CatalogView/
│   ├── ConversationView/
│   ├── Header/
│   ├── Navigation/
│   ├── RequireAuth/
│   └── RouteFallback/
├── context/               # React Context providers + consumer hooks
│   ├── auth/
│   │   └── UserContext.tsx
│   └── ThemeContext.tsx    # Reference pattern for all contexts
├── hooks/                 # Custom hooks, one per file with JSDoc
│   ├── auth/
│   │   └── useAuthRedirect.ts
│   └── favicon/
│       └── useFavicon.ts  # Reference pattern for all hooks
├── pages/
│   ├── auth/Login/
│   ├── Conversation/
│   └── ConversationRoute/
├── server-api/            # Typed fetch helpers + endpoint constants
│   ├── base.ts
│   ├── chat-stream.api.ts
│   ├── conversations.api.ts
│   ├── deployments.ts
│   └── models.ts
├── constants/
│   ├── navigation.ts
│   ├── routes.ts
│   └── translation-keys.ts
└── i18n/                  # i18next config + locale JSON files
```

### State management

> ❓ Open — decision pending. Currently implemented with React Context; may be replaced or augmented.

Current implementation uses **React Context** with no external state library.

| Context                | State owned                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserContext`          | Auth status (`loading \| authenticated \| unauthenticated`), `UserProfile`, `refresh()`, `reset()`                                                                                                                                                                                                                                                   |
| `ThemeContext`         | Active theme ID, theme list, `setTheme()`, logo URL, loading flag                                                                                                                                                                                                                                                                                    |
| `ClientChannelContext` | DIAL Core client-channel id, pending `toolset/signin` **and** `external-service/signin` events, `reportEvent()`, `ensureConnected()` — mounted inside `RequireAuth` alongside `GenerationProvider` so it survives conversation navigation; see [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services) |

Context pattern (reference: `ThemeContext.tsx`):

- `createContext<T | undefined>(undefined)`
- `useMemo` on context value to prevent consumer re-renders
- Guard consumer hook throws a clear error when used outside the provider

### API layer

All HTTP calls go through typed helpers in `server-api/base.ts`:

```typescript
get<TResponse>(url, options?)
post<TResponse>(url, body?, options?)
put<TResponse>(url, body?, options?)
del<TResponse>(url, options?)
```

Behaviour applied automatically:

- `credentials: 'include'` on every request
- `X-CSRF-Token` header on all state-changing methods (POST / PUT / DELETE)
- 401 responses → notify `onUnauthorized` listeners → throw `UnauthorizedError`

`ApiEndpoints` enum centralises all URL constants:

| Key              | URL                      |
| ---------------- | ------------------------ |
| `THEMES`         | `/api/themes`            |
| `THEME_ICON`     | `/api/themes/icon`       |
| `CONVERSATIONS`  | `/api/v1/conversations`  |
| `DEPLOYMENTS`    | `/api/deployments`       |
| `MODELS`         | `/api/v1/models`         |
| `AUTH_ME`        | `/api/v1/auth/me`        |
| `AUTH_PROVIDERS` | `/api/v1/auth/providers` |
| `AUTH_LOGOUT`    | `/api/v1/auth/logout`    |
| `CLIENT_CHANNEL` | `/api/v1/client-channel` |
| `EXTERNAL_SERVICES` | `/api/v1/external-services` |

### SSE streaming

`chat-stream.api.ts` handles streaming completions:

- Uses `ReadableStream.getReader()` + line-by-line SSE parsing (`data: {json}`)
- Handles `[DONE]` termination marker
- Supports `AbortSignal` for cancellation

### Internationalisation

`react-i18next` + `i18next-browser-languagedetector`. All user-visible strings must go through `useTranslation()`. Key format: `{domain}.{element}`. Keys live in `apps/chat/src/i18n/locales/en.json`.

---

## apps/chat-api — Backend

NestJS 11 server. Entry: `apps/chat-api/src/main.ts`.

Configured at startup:

- `helmet` — security headers (CSP, HSTS, etc.)
- `ValidationPipe` — whitelist + `forbidNonWhitelisted` + `transform`
- URI versioning — business endpoints at `/api/v{N}/{resource}`
- CORS with `credentials: true`
- Swagger at `/api/docs` (non-production)
- Static React SPA serving from `apps/chat/dist` for non-`/api/*` routes
- Global prefix: `api`

NestJS conventions (domain structure, thin controllers, Swagger decorators, Logger, ConfigService, DTO validation) are defined in `apps/chat-api/AGENTS.md` — read it before implementing anything in `apps/chat-api/**`.

### Domain structure

```
apps/chat-api/src/
├── main.ts
├── app/                   # Root module
├── auth/                  # OIDC flow, session guard, CSRF guard
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── csrf/
│   ├── session/
│   ├── providers/
│   ├── keys/
│   ├── refresh/
│   ├── bucket/
│   ├── cookies/
│   ├── dto/
│   └── utils/
├── conversations/         # Conversation CRUD + completions
├── chat/                  # Direct DIAL Core proxy
├── client-channel/        # DIAL Core client-channel proxy (subscribe/report/unsubscribe SSE relay)
├── external-services/     # Application external-service metadata + signin/signout proxy
├── deployments/           # Available deployments listing
├── models/                # Available models listing
├── themes/                # Theme config + icon serving
├── health/                # Health check
├── config/                # class-validator env schema
└── common/                # Shared decorators, interceptors
```

One folder per domain. **No `modules/` wrapper** — `{domain}.module.ts` sits directly in `src/{domain}/`.

### API surface

#### Auth (`/api/v1/auth`)

| Method | Path                              | Description                    |
| ------ | --------------------------------- | ------------------------------ |
| `GET`  | `/api/v1/auth/me`                 | Current user profile (public)  |
| `GET`  | `/api/v1/auth/providers`          | List configured auth providers |
| `POST` | `/api/v1/auth/login/{providerId}` | Initiate OIDC flow             |
| `POST` | `/api/v1/auth/callback`           | OIDC callback handler          |
| `POST` | `/api/v1/auth/refresh`            | Refresh access token           |
| `POST` | `/api/v1/auth/logout`             | Clear session cookie           |

#### Conversations (`/api/v1/conversations`)

| Method   | Path                                   | Description                   | Rate limit |
| -------- | -------------------------------------- | ----------------------------- | ---------- |
| `POST`   | `/api/v1/conversations`                | Create conversation           | 20/min     |
| `GET`    | `/api/v1/conversations?path=`          | Get conversation by path      | —          |
| `GET`    | `/api/v1/conversations/metadata?path=` | Get metadata + permissions    | —          |
| `PUT`    | `/api/v1/conversations?path=`          | Save / overwrite conversation | —          |
| `POST`   | `/api/v1/conversations/completions`    | SSE chat completion stream    | 10/min     |
| `DELETE` | `/api/v1/conversations?path=`          | Delete conversation           | —          |

#### Models & Deployments

| Method | Path                                       | Description                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------- |
| `GET`  | `/api/v1/models`                           | List available models (cached)                           |
| `GET`  | `/api/deployments`                         | List available deployments                               |
| `GET`  | `/api/v1/deployments/{deployment}/details` | Full per-entity detail for one deployment by id (cached) |

#### Client Channel (`/api/v1/client-channel`)

DIAL Core RPC proxy used to deliver mid-completion `toolset/signin` and `external-service/signin` interrupts. See [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services).

| Method | Path                                 | Description                                         |
| ------ | ------------------------------------ | --------------------------------------------------- |
| `POST` | `/api/v1/client-channel/subscribe`   | Open the SSE relay, get/resume a channel id         |
| `POST` | `/api/v1/client-channel/report`      | Report `{ id, result }` back to a blocked tool call |
| `POST` | `/api/v1/client-channel/unsubscribe` | Close the channel                                   |

#### External Services (`/api/v1/external-services`)

BFF proxy for an application's external-service credentials, driving the `external-service/signin` interrupt above. See [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services).

| Method | Path                                                    | Description                                        |
| ------ | -------------------------------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/external-services/{appId}/{serviceId}`         | Get display metadata + auth type (not cached)      |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signin`  | Submit API-key/OAuth credentials                   |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signout` | Revoke credentials (Core 404 = idempotent success) |

#### Infrastructure

| Method | Path                         | Description              |
| ------ | ---------------------------- | ------------------------ |
| `GET`  | `/api/themes`                | Theme configuration JSON |
| `GET`  | `/api/themes/icon/{themeId}` | Theme icon image         |
| `GET`  | `/api/health`                | Health check             |

---

## Authentication

Cookie-based OIDC. `apps/chat-api` owns all auth logic — libraries have zero knowledge of auth.

### Flow

```
Browser                apps/chat-api                OIDC Provider
  │                         │                            │
  │  POST /auth/login        │                            │
  │─────────────────────────▶│                            │
  │                         │──── authorization_endpoint ▶│
  │◀────────────────────────│        redirect_uri         │
  │  (redirect to provider) │                            │
  │─────────────────────────────────────────────────────▶│
  │◀─────────────────────────────────────────────────────│ (code)
  │  POST /auth/callback     │                            │
  │─────────────────────────▶│                            │
  │                         │◀──── token exchange ───────│
  │◀────────────────────────│ Set-Cookie: session=<enc>  │
```

### Session

Encrypted session cookie (`HttpOnly`, `Secure`, `SameSite`). Payload:

```typescript
interface SessionPayload {
  sid: string; // session ID
  sub: string; // user subject
  providerId: string;
  claims: Record<string, unknown>;
  at: string; // access token
  csrf: string; // CSRF token
  bucket: string; // user storage bucket
  rt_exp: number; // refresh token expiry (unix ms)
  at_exp: number; // access token expiry (unix ms)
}
```

`SessionGuard` (applied globally):

1. Decrypts session cookie
2. If `at_exp < now + 60s` → call `RefreshService.refresh()`
3. Sets `req.user` from session payload
4. Routes decorated with `@Public()` bypass guard

### CSRF protection

`CsrfGuard` (applied globally after `SessionGuard`):

- Skips `GET`, `HEAD`, `OPTIONS` (safe methods)
- Skips `@Public()` routes
- Validates `Origin` / `Referer` header against configured `CORS_ORIGIN`
- Validates `X-CSRF-Token` header matches `req.user.csrf`

Frontend bootstraps the CSRF token from the `x-csrf-token` response header on `GET /api/v1/auth/me` and stores it in memory. The typed `post`/`put`/`del` helpers inject it automatically.

---

## Styling

### Libraries — Tailwind CSS + SCSS Modules

Each library uses **Tailwind utility classes** for all layout and spacing. **SCSS Modules** are used only for CSS custom property declarations, never for layout.

Three-tier fallback pattern (defined in `openspec/lib-styling-guide.md`):

```scss
// libs/conversation-input/src/components/ConversationInput/ConversationInput.module.scss
.welcome {
  color: var(--ci-welcome-color, var(--text-primary, #161b2d));
  font-size: var(--ci-welcome-font-size, 24px);
}
```

Tiers:

1. `--ci-welcome-color` — set by parent app via `colors` prop → `style={{ '--ci-welcome-color': value }}`
2. `--text-primary` — global DIAL Theme token injected by `ThemeProvider`
3. `#161B2D` — hardcoded hex fallback (dark theme defaults)

CSS variable naming: `--{lib-prefix}-{property}` (e.g. `--ci-*` for conversation-input, `--cm-*` for conversation-messages).

### Apps — Tailwind CSS only

`apps/chat` uses plain **Tailwind utility classes**. No SCSS Modules. All colour references use `bg-layer-*`, `text-primary`, `controls-bg-accent-primary`, etc. — mapped to CSS variables in `tailwind.config.js`.

---

## Theming

Themes are defined in [ai-dial-chat-themes](https://github.com/epam/ai-dial-chat-themes). Each theme is a JSON object with named colour tokens. `ThemeProvider` in `apps/chat` loads the active theme via `GET /api/themes` at startup and injects tokens as CSS custom properties on `:root`.

### Theme JSON structure

```json
{
  "themes": [
    {
      "displayName": "Dark",
      "id": "dark",
      "app-logo": "",
      "colors": { ... },
      "topicColors": { ... },
      "authColors": { ... }
    }
  ]
}
```

### Colour token groups

| Group             | Examples                                                                  | Purpose                        |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `bg-layer-*`      | `bg-layer-0` … `bg-layer-4`                                               | Background depth levels        |
| `bg-accent-*`     | `bg-accent-primary`, `bg-accent-secondary`                                | Brand accent fills             |
| `bg-*`            | `bg-error`, `bg-warning`, `bg-info`, `bg-success`                         | Semantic state backgrounds     |
| `text-*`          | `text-primary`, `text-secondary`, `text-error`, `text-accent`             | Text colours                   |
| `stroke-*`        | `stroke-primary`, `stroke-hover`, `stroke-focus`, `stroke-accent-primary` | Borders and outlines           |
| `controls-bg-*`   | `controls-bg-accent-primary`, `controls-bg-error`, `controls-bg-disable`  | Interactive element fills      |
| `controls-text-*` | `controls-text-permanent`, `controls-text-neutral`                        | Interactive element text       |
| `topicColors`     | `bg-topic-*`, `stroke-topic-*`                                            | Application / model topic tags |
| `authColors`      | `bg-auth-layer-0`, `bg-auth-layer-1`                                      | Auth screen backgrounds        |

### Token flow

```
theme.json (from /api/themes)
    │
    ▼
ThemeProvider (apps/chat)
    │  injects tokens as CSS variables on :root
    ▼
--bg-layer-0, --text-primary, --control-accent, ...
    │
    ├──▶ Tailwind config → bg-[var(--bg-layer-0)], text-[var(--text-primary)], ...
    │
    └──▶ SCSS Modules in libs → var(--text-primary, #161B2D)
```

---

## Module boundary rules

Enforced by `@nx/enforce-module-boundaries` in `eslint.config.mjs`:

| Consumer                           | May import from                        |
| ---------------------------------- | -------------------------------------- |
| `apps/*`                           | `libs/*`                               |
| `type:ui` libs                     | `chat-shared` only                     |
| `type:shared` libs (`chat-shared`) | nothing                                |
| `apps/*`                           | may **not** import from other `apps/*` |

---

## Key external dependencies

| Package                                 | Role                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| `@epam/ai-dial-typescript-sdk`          | Server-side DIAL Core client — preferred in `apps/chat-api`        |
| `@epam/ai-dial-ui-kit`                  | Design system base components — use before creating new primitives |
| `@tabler/icons-react`                   | Icon set — all icons; no inline SVGs                               |
| `react-i18next` / `i18next`             | Internationalisation                                               |
| `class-validator` + `class-transformer` | NestJS DTO validation                                              |
| `@nestjs/swagger`                       | OpenAPI documentation                                              |
| `@nestjs/throttler`                     | Rate limiting                                                      |
| `@nestjs/cache-manager`                 | In-memory cache                                                    |
| `helmet`                                | Security headers                                                   |
| `jose` + `openid-client`                | OIDC / JWT handling in auth module                                 |

---

## Decision Log

| #   | Decision                                                                    | Status      |
| --- | --------------------------------------------------------------------------- | ----------- |
| 1   | Package prefix: `@epam/*` (short form, no `ai-dial-` in package name)       | ✅ Accepted |
| 2   | Monorepo tooling: **Nx 22**                                                 | ✅ Accepted |
| 3   | Package manager: **npm workspaces**                                         | ✅ Accepted |
| 4   | UI framework: **React 19** (SPA)                                            | ✅ Accepted |
| 5   | Backend framework: **NestJS 11** (`apps/chat-api`)                          | ✅ Accepted |
| 6   | Libs styling: **Tailwind CSS + SCSS Modules** (three-tier CSS var fallback) | ✅ Accepted |
| 7   | Apps styling: **Tailwind CSS** only                                         | ✅ Accepted |
| 8   | Theming: DIAL Theme JSON → CSS variables on `:root`                         | ✅ Accepted |
| 9   | `ThemeProvider` lives in `apps/chat`                                        | ✅ Accepted |
| 10  | Auth: cookie-based OIDC, handled by NestJS                                  | ✅ Accepted |
| 11  | Frontend ↔ Backend: REST + SSE                                              | ✅ Accepted |
| 12  | Lib publishing: **npm** (`@epam` scope)                                     | ✅ Accepted |
| 13  | State management in `apps/chat`                                             | ❓ Open     |
| 14  | i18n: **react-i18next** with `i18next-browser-languagedetector`             | ✅ Accepted |
| 15  | CSRF: per-session token, validated via `X-CSRF-Token` header + origin check | ✅ Accepted |

---

## Related

- [Legacy AI DIAL Chat](https://github.com/epam/ai-dial-chat)
- [AI DIAL Chat Themes](https://github.com/epam/ai-dial-chat-themes)
- [DIAL API documentation](https://github.com/epam/ai-dial)
- [openspec/config.yaml](../openspec/config.yaml) — tech stack, commands, AI agent rules
- [openspec/lib-styling-guide.md](../openspec/lib-styling-guide.md) — CSS variable / SCSS module conventions

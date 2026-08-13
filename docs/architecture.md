# AI DIAL Chat (Next Generation) — Architecture

> Living document. Update it in the same change that alters the structure it
> describes — a new lib, app, backend domain, context, or endpoint group.

---

## Overview

AI DIAL Chat (Next Generation) is a ground-up rewrite of [ai-dial-chat](https://github.com/epam/ai-dial-chat), built from scratch with a focus on **modularity**, **customizability**, and **developer experience**.

Core principle: the chat application is assembled from a set of **independently consumable UI libraries** under the `@epam` namespace. Each library is style-agnostic by default and exposes a theming contract via CSS custom properties. The top-level chat app is one possible assembly — teams can compose their own from the same building blocks, or embed the whole application through the overlay.

---

## Goals

| Goal                 | Description                                                                            |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Composable**       | Chat is built from discrete, reusable `@epam/*` packages                               |
| **Styleable**        | Every package accepts colors and typography via a three-tier CSS variable contract     |
| **Theme-compatible** | DIAL Theme system supported — same service and JSON shape as the legacy chat           |
| **Auth-agnostic**    | Authentication lives in the app layer only, never inside libraries                     |
| **Embeddable**       | The whole application can be hosted in a third-party page through the overlay protocol |

---

## Monorepo & Tooling

| Tool               | Role                                                           |
| ------------------ | -------------------------------------------------------------- |
| **Nx 22**          | Monorepo orchestration, task pipeline, caching, affected graph |
| **npm workspaces** | Package management                                             |
| **React 19**       | UI framework for all libraries and the frontend app            |
| **NestJS 11**      | Backend API server (`apps/chat-api`)                           |
| **TypeScript 6.0** | Strict mode, `noUnusedLocals`, `noUnusedParameters`            |
| **Vite 8**         | Frontend bundler                                               |
| **Vitest 4**       | Test runner (frontend + backend unit tests)                    |
| **ESLint 9**       | Flat config (`eslint.config.mjs`) + Prettier 3                 |

```
root/
├── apps/
│   ├── chat/                  # React SPA — frontend chat application (port 4207)
│   ├── chat-api/              # NestJS — backend API server (port 5000)
│   └── chat-overlay-sandbox/  # Static host page for exercising the overlay (port 4300)
├── libs/                      # 20 @epam/* libraries — see Libraries below
├── docs/                      # Architecture, requirements, auth, theming, overlay migration
├── openspec/
│   ├── config.yaml            # Tech stack, commands, architecture rules for AI agents
│   ├── lib-styling-guide.md   # CSS variable / SCSS module conventions for libs/*
│   ├── specs/                 # Capability specs
│   └── changes/               # In-flight and archived change proposals
├── nx.json
└── package.json
```

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  host page (optional)  ──  @epam/ai-dial-chat-overlay            │
│                            iframe + postMessage control          │
├──────────────────────────────────────────────────────────────────┤
│               apps/chat  (React SPA)                             │
│   routing · auth context · ThemeProvider · i18n · state          │
├──────────────────────────────────────────────────────────────────┤
│   feature libs — catalog · conversation-input · conversation-    │
│   messages · conversation-panel · sidebar · share · publish-     │
│   panel · scheduled-tasks · prompt-editor · quotations · …       │
├──────────────────────────────────────────────────────────────────┤
│                 @epam/ai-dial-chat-shared                        │
│         shared types · shared utils · shared UI primitives       │
└──────────────────────────────────────────────────────────────────┘
                              │ REST / SSE
┌──────────────────────────────────────────────────────────────────┐
│               apps/chat-api  (NestJS 11)                         │
│   OIDC auth · session/CSRF · DIAL Core proxy · SSE · config      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Libraries

All libraries live in `libs/*`, resolve through `tsconfig.base.json` paths plus the Nx project graph, and are consumed by `apps/chat` as workspace packages. They are **not published to npm today** — every `package.json` under `libs/` is marked `private: true`. Publishing remains the intent for the UI libraries; treat any "installable package" wording as a goal, not current state.

| Package                                  | Path                       | Purpose                                                                      |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `@epam/ai-dial-chat-shared`              | `chat-shared`              | Shared domain models, utilities, and UI primitives consumed by every lib     |
| `@epam/ai-dial-chat-api-client`          | `chat-api-client`          | Generated OpenAPI client for the chat API (see the exception below)          |
| `@epam/ai-dial-chat-overlay`             | `chat-overlay`             | Embeddable `ChatOverlay` / `ChatOverlayManager` and the postMessage protocol |
| `@epam/ai-dial-catalog`                  | `catalog`                  | Catalog for browsing models, applications, tools, prompts, and skills        |
| `@epam/ai-dial-conversation-input`       | `conversation-input`       | Message composer — model selection, attachments, voice input, edit mode      |
| `@epam/ai-dial-conversation-messages`    | `conversation-messages`    | Message bubbles with actions and source citations                            |
| `@epam/ai-dial-conversation-panel`       | `conversation-panel`       | Virtualized conversation-history sidebar with grouping, tabs, and search     |
| `@epam/ai-dial-conversation-stages`      | `conversation-stages`      | Agent processing stages shown during response streaming                      |
| `@epam/ai-dial-sidebar`                  | `sidebar`                  | Resizable sidebar shell — header, search, empty state                        |
| `@epam/ai-dial-source-panel`             | `source-panel`             | Conversation sources — uploaded files and generated citations                |
| `@epam/ai-dial-quotations`               | `quotations`               | Citation and annotation components, hooks, and utilities                     |
| `@epam/ai-dial-attachment-canvas`        | `attachment-canvas`        | Viewer for attachment content — images, PDFs, JSON, markdown, plain text     |
| `@epam/ai-dial-attachment-input`         | `attachment-input`         | File input with upload validation, drag-and-drop, progress                   |
| `@epam/ai-dial-starter-buttons`          | `starter-buttons`          | Starter prompts that overflow into a dropdown when space runs out            |
| `@epam/ai-dial-share`                    | `share`                    | Share popover UI and share-link types                                        |
| `@epam/ai-dial-publish-panel`            | `publish-panel`            | Publish-to-folder UI and state flow                                          |
| `@epam/ai-dial-prompt-editor`            | `prompt-editor`            | Host-agnostic prompt authoring form with an inline folder picker             |
| `@epam/ai-dial-builder-form`             | `builder-form`             | Presentational builder form for composing and editing DIAL entities          |
| `@epam/ai-dial-deployment-creation-form` | `deployment-creation-form` | Form for creating and editing a deployment                                   |
| `@epam/ai-dial-scheduled-tasks`          | `scheduled-tasks`          | Scheduled Tasks page shell — header, toolbar, empty state                    |

`libs/ai-dial-kit/` is a leftover build-output directory from a removed library — no `package.json`, no sources, no importers. Do not add to it.

### Library isolation

Libraries must stay free of host and external-system knowledge: no REST paths, generated clients, app contexts, auth/session/cookies, environment variables, feature flags, routing, analytics, storage keys, or third-party SDK setup. Applications adapt those concerns and pass data, resolved values, and behaviour into libs through props, typed callbacks, or narrow interfaces.

`@epam/ai-dial-chat-api-client` is the single exception: it is generated from the backend's OpenAPI document and exists to carry endpoint paths and DTOs. Do not hand-edit it, and do not import it from other libraries — apps consume it through `apps/chat/src/server-api`.

The styling contract every UI lib follows — CSS variable naming, what belongs in `.module.scss` versus Tailwind, the `styles={{ colors, typography }}` prop shape, and the checks that catch inert styles — is in [`openspec/lib-styling-guide.md`](../openspec/lib-styling-guide.md). `libs/conversation-input` is the reference implementation.

---

## apps/chat — Frontend

React SPA. Entry: `apps/chat/src/main.tsx`.

### Folder structure

```
apps/chat/src/
├── main.tsx               # BrowserRouter + the provider stack
├── app/app.tsx            # Root routing component, lazy-loads all routes
├── components/            # ~39 PascalCase folders, each with a tests/ subfolder
├── context/               # React Context providers + consumer hooks
│   ├── auth/              # UserContext
│   ├── overlay/           # OverlayContext — embedded-mode protocol handling
│   └── *.tsx              # AppConfig, Theme, UiFeatures, Conversations, …
├── hooks/                 # Custom hooks, grouped by domain folder
├── pages/                 # Route-level screens
├── server-api/            # Typed fetch helpers + endpoint constants, one file per domain
├── models/  types/  utils/  constants/
└── i18n/                  # i18next config + locale JSON files
```

Routes under `pages/`: `Conversation`, `ConversationRoute`, `ConversationSharedInvitation`, `SharedInvitation`, `AppsEditor`, `ToolsetEditor`, `ToolsetAuthCallback`, `PromptEditor`, `DialFileManagerPage`, `ScheduledTasksPage`, `ScheduledTasksRouteGate`, `ScheduledTaskCreatePage`, `ScheduledTaskEditPage`, `ScheduledTaskDetailPage`, `NotFound`, and `auth/`.

### State management

> ❓ Open — decision pending. Currently implemented with React Context; may be replaced or augmented.

Current implementation uses **React Context** with no external state library. The provider stack is assembled in `main.tsx`; a few providers are mounted deeper so their lifetime matches a subtree.

| Context                       | State owned                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserContext`                 | Auth status (`loading \| authenticated \| unauthenticated`), `UserProfile`, `refresh()`, `reset()`                                                                                                                                                                                                                                                                                                                    |
| `ThemeContext`                | Active and selected theme id, theme list, `setTheme()`, logo and favicon URLs, loading flag                                                                                                                                                                                                                                                                                                                           |
| `AppConfigContext`            | Client configuration from `GET /api/v1/client-config` — overlay mode, announcements, feature defaults                                                                                                                                                                                                                                                                                                                 |
| `UiFeaturesContext`           | Effective UI-feature set: server baseline, defaults, and the overlay host's replacement set                                                                                                                                                                                                                                                                                                                           |
| `OverlayContext`              | Embedded-mode handshake, request routing to page-level bridges, event emission to the host                                                                                                                                                                                                                                                                                                                            |
| `ConversationsContext`        | Conversation list, selection, and mutations                                                                                                                                                                                                                                                                                                                                                                           |
| `GenerationContext`           | In-flight generation state for the active conversation                                                                                                                                                                                                                                                                                                                                                                |
| `DeploymentsContext`          | Available deployments and the selected one                                                                                                                                                                                                                                                                                                                                                                            |
| `PromptsContext`              | Prompt list and mutations                                                                                                                                                                                                                                                                                                                                                                                             |
| `SkillsContext`               | Skill list and mutations                                                                                                                                                                                                                                                                                                                                                                                              |
| `ConversationPanelContext`    | Conversation sidebar open/collapsed state                                                                                                                                                                                                                                                                                                                                                                             |
| `SourcesSidebarContext`       | Sources panel visibility and active source                                                                                                                                                                                                                                                                                                                                                                            |
| `SheetNavigationContext`      | Mobile bottom-sheet navigation stack                                                                                                                                                                                                                                                                                                                                                                                  |
| `FavoriteApplicationsContext` | Favorited catalog entities                                                                                                                                                                                                                                                                                                                                                                                            |
| `ActiveScheduledTaskContext`  | Scheduled task currently being viewed or edited                                                                                                                                                                                                                                                                                                                                                                       |
| `UserConfigContext`           | Per-user preferences persisted through `/api/v1/user-config`                                                                                                                                                                                                                                                                                                                                                          |
| `NotificationContext`         | Toast notifications                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ClientChannelContext`        | DIAL Core client-channel id, pending `toolset/signin` and `external-service/signin` events, `reportEvent()`, `ensureConnected()` — mounted inside `RequireAuth` alongside `GenerationProvider` so it survives conversation navigation; see [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services) |

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
- Any other non-ok response → `ApiRequestError`, carrying the original `Response` so `getApiErrorDetails` can resolve a message and trace id

`server-api/` holds one module per backend domain (`conversations.api.ts`, `skills.api.ts`, `files.api.ts`, …). The `ApiEndpoints` enum in `base.ts` centralises the URL constants used by the hand-written helpers; domains covered by the generated client go through `api-client.ts` instead.

| Key                 | URL                         |
| ------------------- | --------------------------- |
| `THEMES`            | `/api/themes`               |
| `THEME_ICON`        | `/api/themes/icon`          |
| `CHAT_COMPLETIONS`  | `/api/v1/chat/completions`  |
| `CONVERSATIONS`     | `/api/v1/conversations`     |
| `MODELS`            | `/api/v1/models`            |
| `AUTH_ME`           | `/api/v1/auth/me`           |
| `AUTH_LOGOUT`       | `/api/v1/auth/logout`       |
| `TRANSCRIPTION`     | `/api/v1/transcription`     |
| `CLIENT_CHANNEL`    | `/api/v1/client-channel`    |
| `EXTERNAL_SERVICES` | `/api/v1/external-services` |

### SSE streaming

`chat-stream.api.ts` handles streaming completions:

- Uses `ReadableStream.getReader()` + line-by-line SSE parsing (`data: {json}`)
- Handles `[DONE]` termination marker
- Supports `AbortSignal` for cancellation

### Internationalisation

`react-i18next` + `i18next-browser-languagedetector`. All user-visible strings go through `useTranslation()`, and every key is declared in `apps/chat/src/constants/translation-keys.ts` rather than passed as a string literal. Locale files live in `apps/chat/src/i18n/locales/`. The i18n config also drives `document.documentElement.dir`, so RTL locales flip the layout — libs rely on CSS logical properties and never read the language themselves.

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
- OpenTelemetry SDK bootstrap (`telemetry/otel-sdk.ts`, imported first, before `reflect-metadata`)
  — off by default (`OTEL_SDK_DISABLED=true`); when enabled, adds a `traceparent` response header
  on traced routes and an optional dedicated Prometheus scrape listener (default `:9464/metrics`,
  independent of the main application port) — see `apps/chat-api/README.md`'s Observability
  section

NestJS conventions (domain structure, thin controllers, Swagger decorators, Logger, ConfigService, DTO validation) are defined in `apps/chat-api/AGENTS.md` — read it before implementing anything in `apps/chat-api/**`.

### Domain structure

One folder per domain. **No `modules/` wrapper** — `{domain}.module.ts` sits directly in `src/{domain}/`.

```
apps/chat-api/src/
├── main.ts
├── app/                    # Root module (+ unversioned /api/apps controller)
├── app-config/             # Client configuration + config registry (/api/v1/client-config)
├── auth/                   # OIDC flow, session guard, CSRF guard
│   ├── csrf/  session/  providers/  keys/  refresh/  bucket/  cookies/  dto/  utils/
├── conversations/          # Conversation CRUD, completions, publish
│   └── generation/         # chat-completions and responses adapters
├── chat/                   # Direct DIAL Core proxy
├── applications/           # Application CRUD
├── application-schemas/    # Application schema metadata
├── skills/  toolsets/  prompts/          # Catalog entity domains
├── files/  assets/                       # File storage and static assets
├── share/  publish/                      # Sharing and publication flows
├── scheduled-tasks/  scheduled-task-unread/
├── client-channel/         # DIAL Core client-channel proxy (SSE relay)
├── external-services/      # Application external-service metadata + signin/signout proxy
├── offline-credentials/    # Long-lived credentials for background runs
├── deployments/  models/   # Deployment and model listings
├── transcription/          # Speech-to-text proxy for voice input
├── rate/                   # Message like/dislike
├── user-config/            # Per-user preferences
├── themes/                 # Theme config + icon serving
├── health/                 # Health check
├── telemetry/              # OpenTelemetry bootstrap, logger bridge, metrics
├── dial/                   # DIAL Core client wiring
├── config/                 # class-validator env schema
├── constants/  common/     # Shared decorators, interceptors, constants
└── openapi/                # Response DTOs and OpenAPI document generation
```

### API surface

Business controllers are versioned; three infrastructure controllers are deliberately not.

| Base path                           | Domain                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| `/api/v1/auth`                      | OIDC login, callback, refresh, logout, profile, providers |
| `/api/v1/conversations`             | Conversation CRUD, completions, publish                   |
| `/api/v1/chat`                      | Direct DIAL Core completion proxy                         |
| `/api/v1/models`                    | Model listing                                             |
| `/api/v1/deployments`               | Deployment listing and per-deployment details             |
| `/api/v1/applications`              | Application CRUD                                          |
| `/api/v1/application-schemas`       | Application schema metadata                               |
| `/api/v1/skills`                    | Skill CRUD                                                |
| `/api/v1/toolsets`                  | Toolset CRUD and auth flows                               |
| `/api/v1/prompts`                   | Prompt CRUD                                               |
| `/api/v1/files`                     | File upload, listing, download                            |
| `/api/v1/share`                     | Share links and recipients                                |
| `/api/v1/publish` `/api/v1/catalog` | Publication rules and published-entity access             |
| `/api/v1/scheduled-tasks`           | Scheduled task CRUD and runs                              |
| `/api/v1/client-channel`            | Client-channel SSE relay                                  |
| `/api/v1/external-services`         | External-service metadata and credentials                 |
| `/api/v1/offline-credentials`       | Long-lived credentials for background runs                |
| `/api/v1/transcription`             | Speech-to-text                                            |
| `/api/v1/rate`                      | Message rating                                            |
| `/api/v1/user-config`               | Per-user preferences                                      |
| `/api/v1/client-config`             | Client configuration document                             |
| `/api/apps`                         | App metadata — unversioned                                |
| `/api/themes`                       | Theme configuration and icons — unversioned               |
| `/api/health`                       | Health check — unversioned                                |

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

`POST /api/v1/conversations/completions` routes to one of two upstream generation APIs per request — `ConversationService.streamCompletion` resolves `features.responsesApi` off `DeploymentsService.getDeploymentDetails` (under the caller's own token, before opening the upstream stream) and dispatches to `chat-completions.adapter.ts` or `responses.adapter.ts` (`apps/chat-api/src/conversations/generation/`) accordingly. Both adapters normalize their upstream SSE events into the same `chat.completion.chunk` shape, so the wire contract to the browser, `apply-chunk.server.ts`, and the persistence lifecycle are unchanged regardless of which API served the request. Deployments that don't declare `responses_api: true` keep using Chat Completions exactly as before.

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
| ------ | ------------------------------------------------------- | -------------------------------------------------- |
| `GET`  | `/api/v1/external-services/{appId}/{serviceId}`         | Get display metadata + auth type (not cached)      |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signin`  | Submit API-key/OAuth credentials                   |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signout` | Revoke credentials (Core 404 = idempotent success) |

#### Infrastructure

| Method | Path                         | Description                        |
| ------ | ---------------------------- | ---------------------------------- |
| `GET`  | `/api/themes`                | Theme configuration JSON           |
| `GET`  | `/api/themes/icon?iconName=` | Theme image asset (validated name) |
| `GET`  | `/api/health`                | Health check                       |

---

## Overlay — embedding the application

The whole application can run inside a host page's iframe, controlled over a `postMessage` protocol.

| Piece                        | Where                                     | Role                                                                         |
| ---------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `@epam/ai-dial-chat-overlay` | `libs/chat-overlay`                       | Host-side `ChatOverlay` / `ChatOverlayManager` and the shared protocol types |
| `OverlayContext`             | `apps/chat/src/context/overlay`           | Embedded side: handshake, request routing, event emission                    |
| `UiFeaturesContext`          | `apps/chat/src/context/UiFeaturesContext` | Applies the host's `enabledFeatures` over the server baseline                |
| `apps/chat-overlay-sandbox`  | `apps/chat-overlay-sandbox`               | Static host page with one case per integration scenario                      |

Overlay mode is enabled per deployment with `OVERLAY_ENABLED` plus an exact-origin `ALLOWED_IFRAME_ORIGINS` allowlist; the same allowlist gates incoming messages, and after the handshake only the origin that established the session may issue requests. Protocol details, the handshake sequence, error codes, and the `OverlayFeature` flag set are documented in the [Chat Overlay Migration Guide](chat-overlay-migration-guide.md).

Libraries know nothing about the overlay. The protocol lives in `libs/chat-overlay` as pure types plus a DOM host client; everything that touches app state is wired through `OverlayContext` bridges registered by the page components.

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

Full detail — encrypted cookie format, transparent refresh, BFF flow, `SessionGuard` behaviour — lives in [`docs/auth/`](./auth/).

---

## Styling

### Libraries — Tailwind CSS + SCSS Modules

Each library uses **Tailwind utility classes** for layout and spacing. **SCSS Modules** carry only CSS custom property declarations, never layout.

Three-tier fallback pattern (defined in `openspec/lib-styling-guide.md`):

```scss
// libs/conversation-input/src/components/ConversationInput/ConversationInput.module.scss
.welcome {
  color: var(--ci-welcome-color, var(--text-primary, #161b2d));
}
```

Tiers:

1. `--ci-welcome-color` — set per instance from the `styles={{ colors, typography }}` prop via `buildCssVars`
2. `--text-primary` — application theme token injected by `ThemeProvider`
3. `#161B2D` — hardcoded hex fallback, matching the built-in **light** palette

CSS variable naming: `--{lib-prefix}-{property}` (e.g. `--ci-*` for conversation-input, `--cm-*` for conversation-messages).

Typography is never hardcoded in a lib: components accept an `<element>ClassName` prop defaulting to a `dial-*-text` class from `@epam/ai-dial-ui-kit`.

### Apps — Tailwind CSS first

`apps/chat` uses Tailwind utility classes, referencing theme tokens through the semantic names in `tailwind.config.js` (`bg-layer-base`, `text-primary`, `bg-control-accent`, …). A handful of components additionally use an SCSS module where a value cannot be expressed as a utility — currently `Header`, `DeploymentSelectorPanel`, `MobileNavBottomSheet`, `UsageLimitsControl`, and `NotFound`. Prefer Tailwind; reach for a module only when there is no class for the value.

Both apps and libs use logical direction utilities (`ms-*`, `pe-*`, `text-start`, `border-s-*`) so RTL locales flip automatically.

---

## Theming

Themes are served by a standalone themes host ([ai-dial-chat-themes](https://github.com/epam/ai-dial-chat-themes)) and configured with `THEMES_CONFIG_URL`. `chat-api` fetches and caches `config.json`, exposing it at `GET /api/themes`; `ThemeProvider` in `apps/chat` applies each entry of the active theme's `colors` map as a CSS custom property on `<html>`, so `bg-layer-base` becomes `--bg-layer-base` and every Tailwind token and lib fallback chain resolves against it.

```
config.json (themes host)
    │  GET /api/themes  (chat-api, cached 5 min)
    ▼
ThemeProvider (apps/chat)
    │  sets --<token> on document.documentElement
    ▼
    ├──▶ tailwind.config.js → bg-layer-base, text-primary, bg-control-accent, …
    └──▶ SCSS modules in libs → var(--ci-x, var(--text-primary, #161B2D))
```

The configuration format, the full list of tokens the application reads, logo and favicon fields, the light/dark/system picker, and the legacy → new token mapping are documented in [Theme Customization](theme-customization.md). Note that the token set differs from the legacy chat's, so a legacy `config.json` applies almost nothing.

---

## Module boundary rules

Import direction is a convention today, not a lint constraint: `@nx/enforce-module-boundaries` is enabled in `eslint.config.mjs` but configured with a single wildcard constraint (`sourceTag: '*'` → `onlyDependOnLibsWithTags: ['*']`), so no dependency is currently rejected. Tagging projects and tightening the constraints is open work.

The intended direction, enforced in review:

| Consumer      | May import from                       |
| ------------- | ------------------------------------- |
| `apps/*`      | any `libs/*`                          |
| Feature libs  | `chat-shared` only                    |
| `chat-shared` | nothing in the workspace              |
| Any lib       | not `chat-api-client` — apps adapt it |
| `apps/*`      | not another `apps/*`                  |

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

| #   | Decision                                                                     | Status                                       |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Package prefix: `@epam/*` (short form, no `ai-dial-` in package name)        | ✅ Accepted                                  |
| 2   | Monorepo tooling: **Nx 22**                                                  | ✅ Accepted                                  |
| 3   | Package manager: **npm workspaces**                                          | ✅ Accepted                                  |
| 4   | UI framework: **React 19** (SPA)                                             | ✅ Accepted                                  |
| 5   | Backend framework: **NestJS 11** (`apps/chat-api`)                           | ✅ Accepted                                  |
| 6   | Libs styling: **Tailwind CSS + SCSS Modules** (three-tier CSS var fallback)  | ✅ Accepted                                  |
| 7   | Apps styling: **Tailwind CSS** first, SCSS module only where no utility fits | ✅ Accepted                                  |
| 8   | Theming: DIAL Theme JSON → CSS variables on `document.documentElement`       | ✅ Accepted                                  |
| 9   | `ThemeProvider` lives in `apps/chat`                                         | ✅ Accepted                                  |
| 10  | Auth: cookie-based OIDC, handled by NestJS                                   | ✅ Accepted                                  |
| 11  | Frontend ↔ Backend: REST + SSE                                               | ✅ Accepted                                  |
| 12  | Lib publishing to npm (`@epam` scope)                                        | ❓ Open — every lib is `private: true` today |
| 13  | State management in `apps/chat`                                              | ❓ Open                                      |
| 14  | i18n: **react-i18next** with `i18next-browser-languagedetector`              | ✅ Accepted                                  |
| 15  | CSRF: per-session token, validated via `X-CSRF-Token` header + origin check  | ✅ Accepted                                  |
| 16  | Embedding: iframe + `postMessage` via `@epam/ai-dial-chat-overlay`           | ✅ Accepted                                  |
| 17  | Module boundaries enforced by lint tags                                      | ❓ Open — wildcard constraint today          |

---

## Related

- [Legacy Chat Migration Guide](legacy-chat-migration-guide.md) — moving a deployment from the legacy DIAL Chat to 1.0
- [Chat Overlay Migration Guide](chat-overlay-migration-guide.md) — embedding and migrating from the legacy overlay
- [Theme Customization](theme-customization.md) — theme configuration, tokens, and legacy theme migration
- [Technical Requirements](technical-requirements.md)
- [Responses API Integration](responses-api-integration.md)
- [Environment Variables Migration Guide](environment-variables-migration-guide.md)
- [Auth subsystem](./auth/)
- [Legacy AI DIAL Chat](https://github.com/epam/ai-dial-chat)
- [AI DIAL Chat Themes](https://github.com/epam/ai-dial-chat-themes)
- [DIAL API documentation](https://github.com/epam/ai-dial)
- [openspec/config.yaml](../openspec/config.yaml) — tech stack, commands, AI agent rules
- [openspec/lib-styling-guide.md](../openspec/lib-styling-guide.md) — CSS variable / SCSS module conventions

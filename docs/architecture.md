# AI DIAL Chat (Next Generation) — Architecture

> Living document. Update it in the same change that alters the structure it
> describes — a new lib, app, backend domain, context, or endpoint group.

---

## Overview

AI DIAL Chat (Next Generation) is a ground-up rewrite of [ai-dial-chat](https://github.com/epam/ai-dial-chat), built from scratch with a focus on **modularity**, **customizability**, and **developer experience**.

Core principle: the chat application is assembled from a set of **independently consumable UI libraries** under the `@epam` namespace. Each library is style-agnostic by default and exposes a theming contract via CSS custom properties. The top-level chat app is one possible assembly — teams can compose their own from the same building blocks, or embed the whole application through the overlay.

---

## Goals

| Goal                 | Description                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composable**       | Chat is built from discrete, reusable `@epam/*` packages                                                                                            |
| **Styleable**        | Every package accepts colors and typography via a three-tier CSS variable contract, and exposes stable `dial-*` class names for host-side overrides |
| **Theme-compatible** | DIAL Theme system supported — same service and JSON shape as the legacy chat                                                                        |
| **Auth-agnostic**    | Authentication lives in the app layer only, never inside libraries                                                                                  |
| **Embeddable**       | The whole application can be hosted in a third-party page through the overlay protocol                                                              |

---

## Monorepo & Tooling

| Tool               | Role                                                           |
| ------------------ | -------------------------------------------------------------- |
| **Nx 23**          | Monorepo orchestration, task pipeline, caching, affected graph |
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
│   ├── chat-overlay-sandbox/  # Static host page for exercising the overlay (port 4300)
│   └── mcp-app-sandbox/       # Separate-origin MCP Apps sandbox proxy (port 3100)
├── libs/                      # 28 @epam/* libraries — see Libraries below
├── docs/                      # Architecture, requirements, auth, theming, overlay migration
├── openspec/
│   ├── config.yaml            # Tech stack, commands, architecture rules for AI agents
│   ├── lib-styling-guide.md   # CSS variable / SCSS module conventions for libs/*
│   ├── specs/                 # Capability specs
│   └── changes/               # In-flight and archived change proposals
├── nx.json
└── package.json
```

The MCP Apps sandbox runs on an origin distinct from the chat host and has its
own embedding allowlist. The BFF publishes its URL and host identity through
client config; see [MCP Apps configuration](../apps/chat-api/README.md#mcp-apps-configuration)
and the [sandbox deployment guide](../apps/mcp-app-sandbox/README.md).

### Typechecking and verification

Every project with a `typecheck` target (32 as of this writing, out of 33
projects total) runs `tsc --build --emitDeclarationOnly` and is checked by the
same command whether the target is inferred by `@nx/vite` or `@nx/js/typescript`.
`nx.json`'s `targetDefaults.typecheck` gives every one of those targets the
same `inputs` (production and test sources, the shared `tsconfig.base.json`,
and a dependency's regenerated declarations) and the same `outputs`
(`{projectRoot}/out-tsc/**`), so a cached result is invalidated by a change to
either production or test code and a cache hit restores the declarations a
dependent project's typecheck needs.

Each project's declaration output (`tsconfig.app.json` / `tsconfig.lib.json`
`outDir`) is `{projectRoot}/out-tsc/{app,lib}` — deliberately never the same
directory a bundler `build` target writes to (`dist`), because a Vite build
runs with `emptyOutDir: true` and would otherwise delete the declarations a
sibling project's typecheck depends on. `libs/chat-api-client` is the one
exception: it has no separate bundler build, so its own `tsc --build` **is**
its publishable `dist` output, and it keeps `outDir: "dist"` with a
project-level `typecheck.outputs` override in its own `package.json` instead
of the workspace default.

- Full workspace: `npm run typecheck:full:quiet` → `nx run-many -t typecheck --all`.
- Affected only: `npm run typecheck:affected` → `nx affected --target=typecheck --base=origin/development`.
- Combined with lint and tests: `npm run verify:changed` / `npm run verify:full`.
- CI: the `typecheck` job in `.github/workflows/pr.yml` runs
  `nx run-many -t typecheck --all` on every pull request, because the pinned
  reusable workflow this repository delegates most PR checks to
  (`epam/ai-dial-ci/.github/workflows/node_pr.yml@4.11.0`) runs `npm run
format`, `npm run lint --fix` and `npm run test` only — none of those
  typechecks. **Open:** making that check a required status check is a
  branch-protection setting administered outside this repository; the job's
  existence does not by itself enforce it (see the Decision Log).

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

| Package                               | Path                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@epam/ai-dial-chat-shared`           | `chat-shared`           | Shared domain models, utilities, UI primitives, and the file-manager surface (`DialFileManagerShell`, `FileManagerController`, upload-batch and validation types, `useGridEditingScroll`) consumed by every lib                                                                                                                                                                                                                                                                    |
| `@epam/ai-dial-chat-hooks`            | `chat-hooks`            | Headless React hooks for reusable chat-interface behavior; includes `useCatalogItemDetails`, catalog derivation helpers, `resolveCatalogPrimaryAction`, `useSkillFilePreview`, `useSkillArchiveImport`, `useFileAttachmentPicker`, the shared OAuth authorization-code popup flow (`src/oauth/`), and the `./mcp-apps` entry point (`createMcpAppsApiClient`, `useMcpAppTools`, `useMcpAppHostAdapter`, `useOpenMcpAppCanvas`) wrapping `ToolsetsApi` for `@epam/ai-dial-mcp-apps` |
| `@epam/ai-dial-chat-api-client`       | `chat-api-client`       | Generated OpenAPI client for the chat API (see the exception below)                                                                                                                                                                                                                                                                                                                                                                                                                |
| `@epam/ai-dial-chat-overlay`          | `chat-overlay`          | Embeddable `ChatOverlay` / `ChatOverlayManager` and the postMessage protocol                                                                                                                                                                                                                                                                                                                                                                                                       |
| `@epam/ai-dial-catalog`               | `catalog`               | Catalog for browsing models, applications, tools, prompts, and skills                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@epam/ai-dial-conversation-input`    | `conversation-input`    | Message composer — model selection, attachments, voice input, edit mode                                                                                                                                                                                                                                                                                                                                                                                                            |
| `@epam/ai-dial-conversation-messages` | `conversation-messages` | Message bubbles with actions and source citations                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@epam/ai-dial-conversation-panel`    | `conversation-panel`    | Virtualized conversation-history sidebar with grouping, tabs, and search                                                                                                                                                                                                                                                                                                                                                                                                           |
| `@epam/ai-dial-conversation-stages`   | `conversation-stages`   | Agent processing stages shown during response streaming                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `@epam/ai-dial-sidebar`               | `sidebar`               | Resizable sidebar shell — header, search, empty state                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@epam/ai-dial-source-panel`          | `source-panel`          | Conversation sources — uploaded files and generated citations                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `@epam/ai-dial-quotations`            | `quotations`            | Citation and annotation components, hooks, and utilities                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `@epam/ai-dial-toolset-editor`        | `toolset-editor`        | Host-agnostic toolset editor — composed `ToolsetEditor`, shared `GeneralForm`, validation and form utils, injected auth/persist callbacks; first lib peer on `chat-hooks` (root barrel)                                                                                                                                                                                                                                                                                            |
| `@epam/ai-dial-mcp-apps`              | `mcp-apps`              | Host-agnostic MCP Apps building blocks — message/tool-call matching, the response cache, and the inline preview hook/component, shared with `apps/chat`'s full-width MCP App canvas                                                                                                                                                                                                                                                                                                |
| `@epam/ai-dial-attachment-canvas`     | `attachment-canvas`     | Viewer for attachments — images, PDFs, DOCX/XLSX/PPTX, CSV spreadsheets, JSON, markdown, text                                                                                                                                                                                                                                                                                                                                                                                      |
| `@epam/ai-dial-attachment-input`      | `attachment-input`      | File input with upload validation, drag-and-drop, progress                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `@epam/ai-dial-starter-buttons`       | `starter-buttons`       | Starter prompts that overflow into a dropdown when space runs out                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@epam/ai-dial-share`                 | `share`                 | Share popover UI and share-link types                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@epam/ai-dial-publish-panel`         | `publish-panel`         | Publish-to-folder UI and state flow                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `@epam/ai-dial-prompt-editor`         | `prompt-editor`         | Host-agnostic prompt authoring form with an inline folder picker                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `@epam/ai-dial-prompts`               | `prompts`               | Favorite-prompts panel, the prompt-parameters popup, and the `usePromptSelectorOverlay` workflow for the composer                                                                                                                                                                                                                                                                                                                                                                  |
| `@epam/ai-dial-skills`                | `skills`                | Skill selection for the composer — favorites overlay, slash-command menu, browse-modal shell, the selected/history skill chips, and the `SkillArchiveUploadDialog` presentation for skill-archive import                                                                                                                                                                                                                                                                           |
| `@epam/ai-dial-skill-editor`          | `skill-editor`          | Skill authoring form with a file tree and conflict handling                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `@epam/ai-dial-builder-form`          | `builder-form`          | Presentational builder form shells, editor layouts and shared deployment field sets for composing and editing DIAL entities                                                                                                                                                                                                                                                                                                                                                        |
| `@epam/ai-dial-scheduled-tasks`       | `scheduled-tasks`       | Scheduled Tasks page shell — header, toolbar, empty state                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@epam/ai-dial-usage-dashboard`       | `usage-dashboard`       | Aggregate calendar-period (UTC day/week/month) cost-limit cards and the per-model limits table for the Settings Usage tab, including each period's host-formatted reset time                                                                                                                                                                                                                                                                                                       |

Conversation-history reuse is split across three acyclic layers. `chat-shared` owns the canonical `FilterTab`, the transfer-job contracts (job, status, subject, determinate progress, and the `ConversationTransferErrorCode` taxonomy), and conversation-name utilities. `chat-hooks` owns headless resource-state and conversation-panel controller hooks, with host-specific routing, labels, feature policy, and configured clients injected by `apps/chat`. `conversation-panel` owns the virtualized panel plus the labels-driven `ImportExportQueue` — with its per-row UI kit `Spinner` and `getTransferFileIcon` mapping — and the `RenameConversationPopup` presentation component, and consumes `FilterTab` and the transfer-job contracts from `chat-shared` directly rather than re-exporting them.

### Library isolation

Libraries must stay free of host and external-system knowledge: no REST paths, generated clients, app contexts, auth/session/cookies, environment variables, feature flags, routing, analytics, storage keys, or third-party SDK setup. Applications adapt those concerns and pass data, resolved values, and behaviour into libs through props, typed callbacks, or narrow interfaces.

`@epam/ai-dial-chat-api-client` is the generated-client exception: it is generated from the backend's OpenAPI document and exists to carry endpoint paths and DTOs. Do not hand-edit it; applications normally consume it through `apps/chat/src/server-api`.

`libs/chat-hooks` has a narrower exception: hooks may depend on the generated client's types and operation signatures and accept an already-configured client instance. The library must not construct or configure that client or acquire any other host-owned integration knowledge.

Application credentials follow this boundary: `libs/catalog` owns the reusable
forms and shares credentials rows/status cards with toolsets; `libs/chat-hooks`
owns metadata loading through supplied, configured API clients. The Chat adapter
maps DTOs and localized labels into the form contract and owns OAuth/offline login,
personal signout, feature gating and the Quick Apps iframe bridge. See the
[authentication flow](auth/auth-bff-encrypted-cookie.md#proactive-application-credential-forms).

`@epam/ai-dial-toolset-editor` is the first other lib that depends on `chat-hooks`: it peers on it for the host-agnostic OAuth helpers (`src/oauth/` — callback path is a parameter, no routes or i18n) and imports the root barrel only, never a subpath. This does not extend to other libs; a new lib needing those helpers should raise it in review rather than assume the exception generalizes.

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

Routes under `pages/`: `Conversation`, `ConversationRoute`, `ConversationSharedInvitation`, `SharedInvitation`, `AppsEditor`, `ToolsetEditor`, `ToolsetAuthCallback`, `PromptEditor`, `DialFileManagerPage`, `ScheduledTasksPage`, `ScheduledTaskCreatePage`, `ScheduledTaskEditPage`, `ScheduledTaskDetailPage`, `SettingsPage`, `NotFound`, and `auth/`.

`SettingsPage` is always available — it is behind no feature flag. It renders a
vertical tab rail via `@epam/ai-dial-settings-panel`, with the tab list declared
in `hooks/useSettingsTabConfig.tsx` — adding a tab is one `SettingsTabs` enum
member plus one entry there. Two tabs ship, in rail order: `PreferencesTab` then `UsageTab`.
`Preferences` is the tab selected on arrival, so `GET /api/v1/user/usage` is not requested until
the user opens `Usage`. The day, week, and month figures are **calendar** windows anchored to UTC
boundaries, and DIAL Core reports each one's exclusive end as an optional `resetsAt` instant.
`UsageTab` formats those at the application edge (`utils/usage-reset-time.ts` — the only place
`Date`/`Intl` touch a reset time) and passes preformatted strings into
`@epam/ai-dial-usage-dashboard`, which never sees a raw timestamp, a locale, or a timezone. The tab
also arms a timer for the earliest displayed boundary and re-fetches when it elapses, so post-reset
figures always come from a fresh DIAL Core response — nothing is ever zeroed locally.
`PreferencesTab` hosts the language, keyboard-shortcut and "Default agent for new chats"
preferences. A theme row is implemented but **commented out**, parked for an
upcoming theming feature — which is why `useThemeOptions` and the
`settings.theme*` i18n keys exist with no live caller. The "Default agent for
new chats" row renders only while `DEFAULT_DEPLOYMENT_PINNED` is on, since the
pin is what gives its "Default agent" option something to refer to; in a default
deployment (flag off) only the keyboard-shortcut row is visible. All three of
the row's choices — a named agent, "Default agent", "Last used agent" — outrank
the pin in `resolveInitialSelection`; only an **unstored** preference still
yields to it, which is why the row shows "Default agent" until the user picks
something. The language row renders
only once more than one locale is registered, which is not the case in a default
build.

The desktop `UserMenu` keeps a locale submenu (same gating, same
`useLanguage().changeLanguage`, so the two language surfaces cannot disagree) but
offers no theme, keyboard-shortcut or "Default agent for new chats" submenu. The mobile
`NavigationSheet` keeps the keyboard-shortcut group, because it has no Settings
entry point of its own.

The frontend uses automatic chunk splitting. Catalog Grid imports the UI Kit's
`/grid` entry; Markdown editor loaders use `/editors`. File-manager UI has a
dedicated `@epam/ai-dial-chat-shared/file-manager` entry consumed inside lazy
features, while headless file contracts stay on the shared root. Conversation
publishing also loads on demand. `chat-shared`'s markdown/KaTeX/syntax-highlighter
stack is isolated behind a dedicated `@epam/ai-dial-chat-shared/markdown` entry
(root keeps re-exporting it for backward compatibility); `chat-hooks`'s
content-type-correction helpers are isolated behind `@epam/ai-dial-chat-hooks/source-content`
(also re-exported from `./file-manager`), and its two optional-peer-bearing feature sets
behind `@epam/ai-dial-chat-hooks/conversation-overlay` (the overlay protocol mapper) and
`@epam/ai-dial-chat-hooks/file-manager-canvas` (the attachment-canvas content resolvers), so
`./conversation` and `./file-manager` resolve neither `@epam/ai-dial-chat-overlay` nor
`@epam/ai-dial-attachment-canvas`/`@epam/ai-dial-quotations`; `catalog`'s headless item-mapping enums
and pure functions are isolated behind `@epam/ai-dial-catalog/mapping`, separate
from the publish-panel-attached UI on catalog's root. The shared, catalog and
publishing packages declare CSS/SCSS side effects; `chat-hooks` declares its
compiled JavaScript side-effect-free except for a single audited
`package.json#sideEffects` array naming the `./oauth`/`./file-manager-canvas`
facades and the stable preserved modules that retain module-scope `EventTarget`/`LRUCache`
singletons — so unused feature UI can still be removed from root-barrel
consumers. See the
[frontend feature-loading overview](../apps/chat/README.md#feature-loading).

### State management

> ❓ Open — decision pending. Currently implemented with React Context; may be replaced or augmented.

Current implementation uses **React Context** with no external state library. The provider stack is assembled in `main.tsx`; a few providers are mounted deeper so their lifetime matches a subtree.

| Context                       | State owned                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserContext`                 | Auth status (`loading \| authenticated \| unauthenticated`), `UserProfile`, `refresh()`, `reset()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ThemeContext`                | Active and selected theme id, theme list, `setTheme()`, logo and favicon URLs, loading flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `AppConfigContext`            | Client configuration from `GET /api/v1/client-config` — overlay mode, announcements, feature defaults                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `UiFeaturesContext`           | Effective UI-feature set: server baseline, defaults, and the overlay host's replacement set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `IsolatedModelViewContext`    | TODO: remove in next release. Temporary `?isolated-model-id` embed mode — resolves the deployment and forces a fixed UI-feature set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `OverlayContext`              | Embedded-mode handshake, request routing to page-level bridges, event emission to the host                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ConversationsContext`        | Conversation list, selection, and mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GenerationContext`           | In-flight generation state for the active conversation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DeploymentsContext`          | Available deployments and the selected one. A new chat's deployment resolves in `resolveInitialSelection`, in this order: an explicit in-session pick → the user's "Default agent for new chats" preference when it names a catalog deployment → the operator default when that preference is `default-agent` (regardless of the `defaultDeploymentPinned` flag) → the operator default when pinned → the persisted `selectedDeploymentId` → the first catalog item                                                                                                                                                  |
| `PromptsContext`              | Prompt list and mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `SkillsContext`               | Skill list and mutations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ConversationPanelContext`    | Conversation sidebar open/collapsed state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `SourcesSidebarContext`       | Sources panel visibility and active source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `SheetNavigationContext`      | Mobile bottom-sheet navigation stack                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `FavoriteApplicationsContext` | Favorited catalog entities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ActiveScheduledTaskContext`  | Scheduled task currently being viewed or edited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `UserConfigContext`           | Per-user preferences persisted through `/api/v1/user-config`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `NotificationContext`         | Toast notifications                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ClientChannelContext`        | DIAL Core client-channel id, pending `toolset/signin` and `external-service/signin` events, `reportEvent()`, `ensureConnected()` — mounted inside `RequireAuth` alongside `GenerationProvider` so it survives conversation navigation. The subscription is demand-driven: it opens only when a completion request calls `ensureConnected()`/`waitForChannel()`, never merely from mounting or returning to a streaming-capable route; see [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services) |

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

Citation normalization preserves the inline marker's `target.selector` separately
from the PDF location in `body.selector` through stream assembly and persistence;
see [PDF citation metadata](../apps/chat-api/README.md#pdf-citation-metadata).

`chat-stream.api.ts` handles streaming completions:

- Uses `ReadableStream.getReader()` + line-by-line SSE parsing (`data: {json}`)
- Handles `[DONE]` termination marker
- Supports `AbortSignal` for cancellation
- Ignores comment lines (those starting with `:`), as every SSE reader in the repo must

Every `chat-api` SSE response (`conversations/completions`, `conversations/watch`, `client-channel/subscribe`) is opened through `startSseResponse` (`apps/chat-api/src/common/utils/sse.ts`), which sets the event-stream headers, flushes them, and immediately writes a `: init` comment. Firefox does not hand a streamed response to the `fetch()` caller until the first body byte arrives, and these endpoints flush headers long before their first real event exists — without the comment, Firefox leaves the request pending, so the client-channel id never resolves and `useConversationStream` blocks on `waitForChannel` before it even sends the completion request — this is now the ordinary cold-start path for the first completion after mount or after an idle disconnect, not an edge case, since the subscription is opened by that same completion rather than in advance.

### Internationalisation

`react-i18next` + `i18next-browser-languagedetector`. All user-visible strings go through `useTranslation()`, and every key is declared in `apps/chat/src/constants/translation-keys.ts` rather than passed as a string literal. Locale files live in `apps/chat/src/i18n/locales/`. The i18n config also drives `document.documentElement.dir`, so RTL locales flip the layout — libs rely on CSS logical properties and never read the language themselves.

---

## apps/chat-api — Backend

NestJS 11 server. Entry: `apps/chat-api/src/main.ts`.

Configured at startup:

- `helmet` — security headers (CSP, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`,
  etc.). Generic responses do not allow WebAssembly. App-owned frontend middleware gives chat HTML
  a fresh style nonce and its required WebAssembly permission, while the PDF worker receives a
  separate worker policy. `CSP_MODE` controls report-only rollout versus strict
  enforcement. Report-only mode accepts legacy HTML without the nonce marker with
  a startup warning; enforcement requires a nonce-aware build. See
  [CSP configuration](../apps/chat-api/README.md#content-security-policy).
- `ValidationPipe` — whitelist + `forbidNonWhitelisted` + `transform`
- URI versioning — business endpoints at `/api/v{N}/{resource}`
- CORS with `credentials: true`, except the default-prefix MCP App resource and
  tool-call routes, which receive no CORS permission headers. See
  [CORS configuration](../apps/chat-api/README.md#cors-configuration).
- Swagger at `/api/docs` (non-production)
- Static assets from `apps/chat/dist` and nonce-bearing React SPA HTML for
  non-`/api/*` routes (`app/static-assets.ts`). HTML templates are cached in memory;
  HTML responses use `no-store` with a fresh nonce, while asset caching is unchanged.
- Global prefix: `api`
- Global in-memory cache: an explicit Keyv memory adapter with a 100-entry LRU limit and periodic expiration cleanup; see [backend caching behavior](../apps/chat-api/README.md#performance).
- OpenTelemetry SDK bootstrap (`telemetry/otel-sdk.ts`, imported first, before `reflect-metadata`)
  — off by default (`OTEL_SDK_DISABLED=true`); when enabled, adds a `traceparent` response header
  on traced routes and an optional dedicated Prometheus scrape listener (default `:9464/metrics`,
  independent of the main application port). Metrics cover HTTP transport outcomes, Nest handler
  observations, generation relays, auth/session decisions (login starts, callback and refresh
  exchanges, authorization outcomes, logout), and process-local memory/SSE/registry gauges.
  HTTP lifecycle
  observation uses a raw server request listener; it does not guarantee timing before all
  synchronous Express work. See [Observability](observability.md) for signal boundaries,
  configuration, and Grafana dashboard examples.

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
| `/api/v1/skills`                    | Skill CRUD and metadata lookup                            |
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

| Method | Path                                 | Description                                                             |
| ------ | ------------------------------------ | ----------------------------------------------------------------------- |
| `GET`  | `/api/v1/auth/providers`             | List configured auth providers (public)                                 |
| `GET`  | `/api/v1/auth/login/{providerId}`    | Start the OIDC flow — 302 to the provider (public)                      |
| `GET`  | `/api/v1/auth/callback/{providerId}` | OIDC callback — this is the redirect URI registered in the IdP (public) |
| `POST` | `/api/v1/auth/logout`                | Clear the session cookie, then RP-initiated logout (public)             |
| `GET`  | `/api/v1/auth/me`                    | Current user profile; also returns the `X-CSRF-Token` header            |

There is no refresh endpoint: `CookieSessionStrategy` renews an expired access
token through `RefreshService` while authenticating the incoming request, so the
browser never triggers a refresh explicitly. The redirect URI a deployment must
register with each identity provider is
`{AUTH_CALLBACK_BASE_URL}/api/v1/auth/callback/{providerId}` — the `/api/v1`
prefix is fixed in `auth.controller.ts`, not derived from `API_PREFIX`.

#### Conversations (`/api/v1/conversations`)

No endpoint in this domain carries a per-route rate limit — repo-wide rate limiting was removed from `apps/chat-api`.

`GET /api/v1/conversations/list` returns the complete history when both `limit` and `nextToken` are omitted. The BFF follows personal and public bucket cursors independently in batches of 1000, adds shared conversations once, and sorts the combined list by latest activity before bounded display-name enrichment. The conversation panel uses this full-history mode. An explicit `limit` or `nextToken` requests one page per bucket and returns a compound continuation cursor; with only `nextToken`, the page size is 100. A failed personal page fails the request rather than returning a truncated history; public and shared sources remain best-effort.

| Method   | Path                                       | Description                                                                             |
| -------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/conversations`                    | Create conversation                                                                     |
| `GET`    | `/api/v1/conversations?path=`              | Get conversation by path                                                                |
| `GET`    | `/api/v1/conversations/metadata?path=`     | Get metadata + permissions                                                              |
| `PUT`    | `/api/v1/conversations?path=`              | Save / overwrite conversation                                                           |
| `POST`   | `/api/v1/conversations/completions`        | SSE chat completion stream — backend owns persistence for the full generation lifecycle |
| `POST`   | `/api/v1/conversations/completions/stop`   | Stop an active generation by `generationId`                                             |
| `POST`   | `/api/v1/conversations/completions/attach` | Attach to an active generation's live replay (SSE)                                      |
| `POST`   | `/api/v1/conversations/watch`              | Subscribe to conversation resource-update events (SSE)                                  |
| `DELETE` | `/api/v1/conversations?path=`              | Delete conversation                                                                     |

`POST /api/v1/conversations/completions` routes to one of two upstream generation APIs per request — `ConversationStreamingService.streamCompletion` resolves `features.responsesApi` off `DeploymentsService.getDeploymentDetails` (under the caller's own token, before opening the upstream stream) and dispatches to an inline Chat Completions relay or `responses.adapter.ts` (`apps/chat-api/src/conversations/generation/`) accordingly. Both normalize their upstream SSE events into the same `chat.completion.chunk` shape, so `apply-chunk.server.ts` and the persistence lifecycle below are unchanged regardless of which API served the request. Deployments that don't declare `responses_api: true` keep using Chat Completions exactly as before.

For Chat Completions requests, the streaming service maps each
`custom_content.skills[].url` through `encodeDialResourcePath` before sending
the upstream payload. Encoding preserves path separators while escaping path
segments; this mapping does not mutate the stored conversation. The Responses
adapter receives its own request inputs and is a separate mapping boundary.

**The backend, not the frontend, owns conversation persistence** across a completion's full lifecycle. `ConversationGenerationService` keeps an in-memory registry keyed by **principal**+conversation path — an opaque owner key that `resolvePrincipalKey` (`apps/chat-api/src/auth/session/principal-key.ts`) derives from server-verified identity only: the session `sid` under cookie auth, the verified `providerId`+`sub` pair under header (bearer) auth, in disjoint `c:`/`h:` namespaces. All three completion endpoints work under either authentication mode: `streamCompletion` saves the start state (user message + empty assistant placeholder) before opening the upstream stream, assembles the assistant message chunk-by-chunk as it relays the response, and attempts to save the final/partial state on completion, stop, or error regardless of whether the originating HTTP request is still connected. Save failures are logged; stream completion does not prove durable persistence. `ConversationController.streamCompletion` tracks client disconnection for response cleanup while continuing to consume the generation, so closing the tab does not stop upstream work. `POST .../completions/stop` aborts an active generation.

Because generation survives a closed tab, reopening the conversation needs a way to see its progress: `POST /api/v1/conversations/watch` proxies DIAL Core's generic resource-update events (also used to detect LLM-title-rename completion) so the frontend can poll for the terminal save. `POST .../completions/attach` — resolved from the same registry, looked up by conversation path rather than `generationId` (a freshly-opened tab has no `generationId` to send) — opens an SSE stream that immediately snapshots the assistant message as assembled so far, then delivers every subsequent chunk live, then a terminal event (`done`/`error`/`stopped`) when registered before terminal notification, so a resumed conversation populates progressively instead of showing only a typing indicator until it finishes. It responds `404` when no active generation exists for that path under the caller's principal — including one that already finished, and including one another principal is running — in which case the frontend falls back to the `watch`-based terminal check.

**Generation lifecycle and admission.** The registry is process-local, keyed by principal and conversation path. A process-issued lease identifies each operation independently of its client-supplied `generationId`. Any retained entry blocks another start on that process with `409` before asynchronous preflight. There is no cross-pod coordination or storage-side write fencing. Lifecycle states are `active`, `cancel_requested`, `finalizing`, `settling`, and `released`; a successful generation normally skips cancellation and settling. Stop, maximum duration, and a stale sweep request cancellation rather than evicting the key. The sweep runs on registration with a threshold of `max(30 min, MAX_GENERATION_DURATION_MS) + 1 min`. Only `user_stop` is mapped to the user-stop marker; stale, maximum-duration, and shutdown cancellation are separate causes.

The worker enters `finalizing` immediately before its single terminal-save attempt. If `GENERATION_FINALIZE_TIMEOUT_MS` expires first, existing attachment listeners are notified and removed and timers cleared, but the `settling` entry retains its key, assembled snapshot, pending write, and runtime-gauge contribution until the save resolves or rejects. The timeout does not cancel the write, settle its worker, or bound preflight. Shutdown releases local ownership without proving persistence. A late attachment can still join a retained entry after terminal notification and is not covered by the expired timer. See [the observability guide](observability.md#process-memory-and-outstanding-work) for state semantics, cleanup limits, and operational checks, and [the registry specification](../openspec/specs/generation-registry/spec.md) for the ownership contract.

#### Models & Deployments

| Method | Path                                       | Description                                                                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/models`                           | List available models (cached)                                                                           |
| `GET`  | `/api/deployments`                         | List available deployments                                                                               |
| `GET`  | `/api/v1/deployments/{deployment}/details` | Full per-entity detail for one deployment by id (cached)                                                 |
| `GET`  | `/api/v1/deployments/{deployment}/limits`  | Rate-limit and calendar-period usage stats for one deployment                                            |
| `GET`  | `/api/v1/user/limits`                      | Rate-limit and calendar-period usage stats for every visible deployment, plus global cost-budget figures |
| `GET`  | `/api/v1/user/usage`                       | Same shape as `/api/v1/user/limits`, restricted to deployments used in the current UTC day/week/month    |

#### Client Channel (`/api/v1/client-channel`)

DIAL Core RPC proxy used to deliver mid-completion `toolset/signin` and `external-service/signin` interrupts. See [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services).

| Method | Path                                 | Description                                         |
| ------ | ------------------------------------ | --------------------------------------------------- |
| `POST` | `/api/v1/client-channel/subscribe`   | Open the SSE relay, get/resume a channel id         |
| `POST` | `/api/v1/client-channel/report`      | Report `{ id, result }` back to a blocked tool call |
| `POST` | `/api/v1/client-channel/unsubscribe` | Close the channel                                   |

`unsubscribe` forwards DIAL Core's HTTP status unchanged with an empty body, including `404` when the channel is already absent and any upstream error status. A transport failure without a Core response returns `503`. The frontend's generated client rejects non-2xx responses; provider cleanup handles that rejection without reopening the channel.

#### External Services (`/api/v1/external-services`)

BFF proxy for an application's external-service credentials, driving the `external-service/signin` interrupt above. Catalog details and the Quick Apps host dialog also expose proactive forms through `ApplicationCredentials`, using a fresh list from `GET /api/v1/external-services/{appId}`. DIAL-native services use the shared offline-credentials OAuth flow, with separate administrator consent reported by `appLevelAuthStatus`. The offline-credentials endpoints accept either `scheduledTasksEnabled` or `liveChatInteraction` capability. See [`docs/auth/auth-bff-encrypted-cookie.md` §5.5](./auth/auth-bff-encrypted-cookie.md#55-interactive-sign-in-during-a-completion-toolsets-and-application-external-services).

| Method | Path                                                    | Description                                                       |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/api/v1/external-services/{appId}`                     | List public service metadata and credential statuses (not cached) |
| `GET`  | `/api/v1/external-services/{appId}/{serviceId}`         | Get display metadata + auth type (not cached)                     |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signin`  | Submit API-key/OAuth credentials                                  |
| `POST` | `/api/v1/external-services/{appId}/{serviceId}/signout` | Revoke credentials (Core 404 = idempotent success)                |

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

Overlay mode is enabled per deployment with `OVERLAY_ENABLED` plus an `ALLOWED_IFRAME_ORIGINS` allowlist of exact origins and/or single-leading-wildcard-label origin patterns (`https://*.example.com`); the same allowlist gates incoming messages, and after the handshake only the origin that established the session may issue requests. Protocol details, the handshake sequence, error codes, and the `OverlayFeature` flag set are documented in the [Chat Overlay Migration Guide](chat-overlay-migration-guide.md).

Libraries know nothing about the overlay. The protocol lives in `libs/chat-overlay` as pure types plus a DOM host client; everything that touches app state is wired through `OverlayContext` bridges registered by the page components.

---

## Authentication

Cookie-based OIDC. `apps/chat-api` owns all auth logic — libraries have zero knowledge of auth.

### Flow

```
Browser                apps/chat-api                OIDC Provider
  │                         │                            │
  │  GET /auth/login/:id     │                            │
  │─────────────────────────▶│                            │
  │                         │──── authorization_endpoint ▶│
  │◀────────────────────────│        redirect_uri         │
  │  (redirect to provider) │                            │
  │─────────────────────────────────────────────────────▶│
  │◀─────────────────────────────────────────────────────│ (code)
  │  GET /auth/callback/:id  │                            │
  │─────────────────────────▶│                            │
  │                         │◀──── token exchange ───────│
  │                         │◀── optional UserInfo ─────▶│
  │◀────────────────────────│ Set-Cookie: session=<enc>  │
```

For Keycloak, a missing ID-token `job_title` can be read from UserInfo after
checking the subject. The [auth design](auth/auth-bff-encrypted-cookie.md#51-login-flow-authorization-code--pkce)
describes claim capture and failure handling; other providers keep their
existing ID-token path.

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

#### Public class names — the host-addressable tier

Because CSS-module locals are hashed and Tailwind utilities move with the layout, a host embedding these libs had nothing stable to target. Selected elements therefore additionally carry a **public class** that exists purely as a styling hook and carries no declarations of its own: `dial-{lib-prefix}-{element}[-{state}]`, where the prefix is the lib's directory name (`dial-catalog-card`, `dial-scheduled-tasks-card`, `dial-settings-panel-tab`) — except for the five libs issue #8707 named by hand, which keep the short prefixes it proposed (`dial-sb-aside`, `dial-cp-search`, `dial-cm-user-bubble`, `dial-ci-action-row`, `dial-ai-attachment-tile`) and are a closed list. Each lib defines its names in `src/constants/public-class-names.ts` and exports the record (`SIDEBAR_CLASS`, `CONVERSATION_INPUT_CLASS`, …) so hosts import rather than hardcode them. ARIA attributes are explicitly **not** styling hooks. Introduced for [#8707](https://github.com/epam/ai-dial-chat/issues/8707).

The complete rules — naming grammar and guard-test requirements — are in [`openspec/lib-styling-guide.md`](../openspec/lib-styling-guide.md).

### Apps — Tailwind CSS first

`apps/chat` uses Tailwind utility classes, referencing theme tokens through the semantic names in `tailwind.config.js` (`bg-layer-base`, `text-primary`, `bg-control-accent`, …). A handful of components additionally use an SCSS module where a value cannot be expressed as a utility — currently `Header`, `DeploymentSelectorPanel`, `MobileNavBottomSheet`, `UsageLimitsControl`, and `NotFound`. Prefer Tailwind; reach for a module only when there is no class for the value.

Both apps and libs use logical direction utilities (`ms-*`, `pe-*`, `text-start`, `border-s-*`) so RTL locales flip automatically.

### Third-party stylesheets — named cascade layer

A vendor stylesheet a library pulls in for a lazily loaded engine is loaded
inside a **named cascade layer**, never unlayered. `libs/attachment-canvas`'s
`PdfContent` is the case that forced this: it imports
`components/PdfContent/pdf-vendor.css`, which pulls both PDF vendor sheets in
with `@import … layer(pdf-vendor)`.

The reason is ordering. A lazily loaded stylesheet is injected **after** the
app's own, and `@epam/ai-dial-react-pdf-highlighter`'s published sheet is a full
Tailwind build — Preflight plus base utilities (`.hidden`, `.flex`, `.px-4`)
that `apps/chat` also owns. A media-query variant carries no extra specificity,
so an unlayered `.hidden { display: none }` arriving late beats the app's
`@media (min-width:1280px) { .desktop\:block { display: block } }` and collapses
layout the app owns, for the rest of the session. Unlayered author styles
outrank every layered rule regardless of document order, so the layer restores
app precedence while the vendor's own non-competing rules still apply.

The layer does not change the lazy boundary: the wrapper is still imported from
the lazily loaded module, so nothing is requested until a PDF opens.
`libs/attachment-canvas/tests/package-boundary/pdf-vendor-style-containment.spec.ts`
asserts both halves against the emitted CSS — the whole vendor payload inside
one `@layer pdf-vendor`, and none of it in the package's base stylesheet.
Nothing in `lint`, `typecheck`, or a jsdom test evaluates the cascade, so that
build assertion is the only automated guard.

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

| Consumer      | May import from                                                    |
| ------------- | ------------------------------------------------------------------ |
| `apps/*`      | any `libs/*`                                                       |
| Feature libs  | `chat-shared` only                                                 |
| `chat-shared` | nothing in the workspace                                           |
| Any lib       | not `chat-api-client`; `chat-hooks` has the narrow exception above |
| `apps/*`      | not another `apps/*`                                               |

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

| #   | Decision                                                                                                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Package prefix: `@epam/*` (short form, no `ai-dial-` in package name)                                                                | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | Monorepo tooling: **Nx 23**                                                                                                          | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | Package manager: **npm workspaces**                                                                                                  | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | UI framework: **React 19** (SPA)                                                                                                     | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5   | Backend framework: **NestJS 11** (`apps/chat-api`)                                                                                   | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | Libs styling: **Tailwind CSS + SCSS Modules** (three-tier CSS var fallback)                                                          | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Apps styling: **Tailwind CSS** first, SCSS module only where no utility fits                                                         | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | Theming: DIAL Theme JSON → CSS variables on `document.documentElement`                                                               | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | `ThemeProvider` lives in `apps/chat`                                                                                                 | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 10  | Auth: cookie-based OIDC, handled by NestJS                                                                                           | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11  | Frontend ↔ Backend: REST + SSE                                                                                                       | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 12  | Lib publishing to npm (`@epam` scope)                                                                                                | ❓ Open — every lib is `private: true` today                                                                                                                                                                                                                                                                                                                                                                                   |
| 13  | State management in `apps/chat`                                                                                                      | ❓ Open                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 14  | i18n: **react-i18next** with `i18next-browser-languagedetector`                                                                      | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 15  | CSRF: per-session token, validated via `X-CSRF-Token` header + origin check                                                          | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 16  | Embedding: iframe + `postMessage` via `@epam/ai-dial-chat-overlay`                                                                   | ✅ Accepted                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 17  | Module boundaries enforced by lint tags                                                                                              | ❓ Open — wildcard constraint today                                                                                                                                                                                                                                                                                                                                                                                            |
| 18  | User preferences persist in `localStorage`, not the server user-config file                                                          | ✅ Accepted — theme, language, keyboard shortcut and "Default agent for new chats" are all per-browser; they do not follow the user across devices                                                                                                                                                                                                                                                                             |
| 19  | `DEFAULT_DEPLOYMENT_PINNED` both **offers** the "Default agent for new chats" control and is **outranked** by it                     | ✅ Accepted — the row renders only while an agent is pinned (the pin is what makes its "Default agent" option mean anything), and every choice stored through it then beats the pin, "Last used agent" included. The pin still beats the _implicit_ last-used selection — an unstored preference — which is what its description refers to. Both halves live in `resolveInitialSelection` + `PreferencesTab`'s visibility rule |
| 20  | Host styling hooks: stable public `dial-{lib-prefix}-{element}` classes, emitted unconditionally and carrying no declarations        | ✅ Accepted — hashed CSS-module locals, DOM order and ARIA attributes were the only handles a host had, and all three change without notice ([#8707](https://github.com/epam/ai-dial-chat/issues/8707)). Rejected a `styles.classNames` prop API: `styles` already means theming tokens, and portalled or deeply nested elements are unreachable by a prop                                                                     |
| 21  | Repository-owned `typecheck` PR job (`.github/workflows/pr.yml`) covers what the pinned `epam/ai-dial-ci` reusable workflow does not | ❓ Open — the job runs on every PR; marking it a _required_ status check is branch-protection configuration administered outside this repository, not something this job can set itself                                                                                                                                                                                                                                        |

---

## Related

- [Legacy Chat Migration Guide](legacy-chat-migration-guide.md) — moving a deployment from the legacy DIAL Chat to 1.0
- [Chat Overlay Migration Guide](chat-overlay-migration-guide.md) — embedding and migrating from the legacy overlay
- [Theme Customization](theme-customization.md) — theme configuration, tokens, and legacy theme migration
- [Technical Requirements](technical-requirements.md)
- [Responses API Integration](responses-api-integration.md)
- [Observability](observability.md) — telemetry configuration, metric contracts, and Grafana dashboard examples
- [Host Install Matrix](host-install-matrix.md) — what an embedding host installs per set of libs
- [Chat API environment variables](../apps/chat-api/README.md#environment-variables) — the full variable reference
- [Auth subsystem](./auth/)
- [Legacy AI DIAL Chat](https://github.com/epam/ai-dial-chat)
- [AI DIAL Chat Themes](https://github.com/epam/ai-dial-chat-themes)
- [DIAL API documentation](https://github.com/epam/ai-dial)
- [openspec/config.yaml](../openspec/config.yaml) — tech stack, commands, AI agent rules
- [openspec/lib-styling-guide.md](../openspec/lib-styling-guide.md) — CSS variable / SCSS module conventions

## Context

`apps/chat` is a React 19 + Vite SPA with a NestJS 11 BFF (`apps/chat-api`) that owns session cookies and CSP headers. State is React Context + hooks: `ConversationsContext` owns the conversation list, `DeploymentsContext` owns model/toolset selection, `GenerationContext` is a ref-backed registry of in-flight generations keyed by conversation path, and the actively-displayed conversation's messages/streaming/handlers live **locally inside the `ConversationPage` route component** (`apps/chat/src/pages/Conversation/Conversation.tsx:56-99`) via `useState`, `useConversationStream`, and `useConversationHandlers` — there is no context that exposes "the current conversation" to a sibling outside the route tree today.

`main.tsx` (`apps/chat/src/main.tsx:35-76`) nests providers in a fixed order: `NotificationProvider` → `UserProvider` → `ThemeProvider` → `AppConfigProvider` → `SourcesSidebarProvider` → `AttachmentCanvasProvider` → `Routes` → (`/login` | `RequireAuth` → `GenerationProvider` → `UserConfigProvider` → `DeploymentsProvider` → `ConversationsProvider` → `App`). `RequireAuth` (`apps/chat/src/components/RequireAuth/RequireAuth.tsx:23-25`) renders `null` while unauthenticated — there is currently no path that shows anything (including a loader) before an authenticated session exists.

`apps/chat-api/src/main.ts:36-60` configures Helmet with a `frameSrc` CSP directive built from `ALLOWED_IFRAME_ORIGINS` (`apps/chat-api/src/config/csp.ts:1-3`), but sets no `frame-ancestors` directive and does not disable Helmet's `frameguard` middleware, so Helmet's default `X-Frame-Options: SAMEORIGIN` header is sent on every response — that header alone blocks this app from being embedded on **any** cross-origin host today, independent of CSP. `GET /api/v1/client-config` (`openspec/specs/client-config-endpoint/spec.md:3-21`) and `AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx:20-31`) are the existing runtime-config pattern this design extends rather than introducing build-time env flags.

There is no existing `@epam/ai-dial-shared`-equivalent package in this repo. `libs/chat-shared` is the only "pure types, no logic" lib (`AGENTS.md` / tech context: "shared TypeScript interfaces and types only (no logic)"); `libs/conversation-input` is the reference publishable-lib pattern (Vite lib-mode build, `tools/publish-lib.mjs`, peer deps for anything the consuming app must provide).

## Goals / Non-Goals

**Goals:**
- Ship a host-agnostic, dependency-light `libs/chat-overlay` package (`@epam/ai-dial-chat-overlay`) implementing `ChatOverlay` and `ChatOverlayManager` over `postMessage`, buildable/publishable the same way `libs/conversation-input` is.
- Define a `@DIAL_OVERLAY` protocol (handshake, request/response matching with timeout, events) shared between the library and the app via pure types in `libs/chat-shared`.
- Add an overlay runtime mode to `apps/chat` that a host page can only reach for an allowlisted origin, gated by runtime config, and that bridges the existing `ConversationsContext` / `DeploymentsContext` / `GenerationContext` / `ConversationPage`-local state to the protocol without moving that state into a heavier global store.
- Ship v1 with a **chat-only** method surface: `ready`, `destroy`, `subscribe`, `setOverlayOptions`, `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`, plus `READY` / `READY_TO_INTERACT` / `SELECTED_CONVERSATION_LOADED` / `CONVERSATIONS_UPDATED` / generation-lifecycle events.
- Tighten origin handling relative to a naive same-origin iframe: the library only reads messages whose `event.source` is its own iframe's `contentWindow` and only posts to `new URL(domain).origin`; the app only answers the `hostDomain` supplied during the handshake and validates it against a server-configured allowlist before storing it.
- Add `apps/chat-overlay-sandbox` (Nx app, React + Vite) so the library is exercised against the real built package, not mocks.

**Non-Goals (this change):**
- Conversation-list mutation methods (`createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`, `selectConversation`, `getConversations`, `getSelectedConversations`), playback conversations, import/export, and custom message buttons. These need either new backend endpoints/route adaptation or a UI-section feature-toggle system this app does not currently have, and are deferred to a follow-up change.
- A client-settable `enabledFeatures` UI-section allowlist (`header`, `footer`, `conversations-section`, …). This app's feature-flag system (`useFeatureFlag`, `apps/chat/src/context/AppConfigContext.tsx:113-117`) is a server-resolved boolean map, not a client-settable list of UI sections — reproducing that concept is a separate, larger change and is explicitly flagged as scope creep if attempted here.
- Sign-in-in-iframe / sign-in-in-new-window automation. `apps/chat`'s auth is a session-cookie/BFF/OIDC flow, architecturally different from a client-driven auto-sign-in handshake. v1 assumes an already-authenticated host session or accepts the plain login-redirect UX inside the iframe; the Risks section documents what a future auto-sign-in design must account for.
- Any change to `libs/chat-api-client` generated code, to auth/session cookie handling, or to global provider ordering beyond one new overlay-mode-gated provider pair.

## Decisions

### 1. Protocol types live in `libs/chat-shared`, not inside `libs/chat-overlay`

`libs/chat-shared/src/types/overlay/overlay-protocol.ts` gets the namespace constant, `OverlayRequestType`/`OverlayEventType` enums, and the `ChatOverlayOptions`/message envelope interfaces — zero logic, consistent with chat-shared's existing "types and interfaces only" convention. Both `libs/chat-overlay` (peer-depends on `@epam/ai-dial-chat-shared`, matching `libs/conversation-input`'s pattern) and `apps/chat`'s overlay context import from there.

**Alternatives considered:**
- *Define the protocol inside `libs/chat-overlay` and have `apps/chat` import it from there.* Rejected — it would make the app depend on the same published DOM-manipulation package it is the counterpart of, coupling an internal implementation detail (the app's message handler) to an external consumer-facing package's versioning/publish cadence for no benefit; `chat-shared` already exists as the app↔lib pure-type boundary.
- *Duplicate the enums/interfaces in both places.* Rejected — guarantees drift the first time a request/event is added.

Runtime-value implication: `OverlayRequestType`/`OverlayEventType` must be plain TS `enum`s, not `const enum`, because Vite/esbuild transpile files in isolation and cannot inline a `const enum` imported from another package. This makes `@epam/ai-dial-chat-shared` a genuine (already-existing) runtime peer dependency of `@epam/ai-dial-chat-overlay`, not just a type import.

### 2. `libs/chat-overlay` build follows the `libs/conversation-input` Vite-lib pattern

New `project.json`/`vite.config.mts` use Vite library mode (`build.lib`, `formats: ['es']`, `vite-plugin-dts`) with `@epam/ai-dial-chat-shared` external + peer-dependency, and the `tools/publish-lib.mjs` `publish` target (`node tools/publish-lib.mjs chat-overlay ...`). No React/JSX in this lib — it is vanilla DOM/TS, so no `@vitejs/plugin-react` is needed, unlike `conversation-input`.

**Alternatives considered:** a Rollup-based build (`@nx/rollup:rollup`) instead of Vite library mode. Rejected — every other publishable lib in this repo already uses Vite lib mode, and introducing a second build toolchain for one package adds maintenance surface for no functional gain.

### 3. Overlay eligibility is runtime-config-gated, not a Vite build-time env flag

`GET /api/v1/client-config` gains two new `visibility='client'` keys (final names/shape to be pinned in `specs/chat-overlay-security-config/spec.md`): an overlay-enabled boolean and, if needed for client-side UX (e.g. showing a "this origin is not permitted" state), the fact that the current host origin is allowlisted. `AppConfigContext.config` is extended to carry them. The **authoritative** allowlist check still happens server-side (CSP `frame-ancestors` + a dedicated origin check on the handshake message, not just CSP), so the client-side flag is a UX signal, not the security boundary.

**Alternatives considered:**
- *A Vite build-time env var toggling overlay mode at bundle time.* Rejected — this app builds once and is configured per-environment at runtime (see `client-config-endpoint`/`app-config-context`); a build-time flag would force a separate build artifact per deployment that wants overlay mode, breaking the existing "one build, many environments" story.
- *Route or query-param gating alone (e.g. `/?overlay=1`).* Rejected as the sole mechanism — a query flag is trivially set by any visitor and proves nothing about the embedding origin; it may still be layered on top (see Decision 6) as a cheap early signal, but must never substitute for server-validated origin checks.

### 4. Active-conversation bridging uses a registration adapter, not a lifted global context

A new `apps/chat/src/context/overlay/OverlayContext.tsx` owns: overlay-mode detection, the `postMessage` listener, handshake state machine, `hostDomain` storage, and `subscribe`/event-emission plumbing. It does **not** own conversation messages/streaming state. Instead it exposes `registerActiveConversationBridge(bridge: ActiveConversationBridge | null)`, where `ActiveConversationBridge` is a small interface (`getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`) backed by the values `ConversationPage` already has locally. `ConversationPage` calls this registration from a `useEffect` (register on mount/dependency change, unregister on unmount/cleanup — see `apps/chat/src/hooks/useFavicon.ts` cleanup pattern), so the bridge always reflects whichever conversation is actually being displayed, with no duplicate fetch/subscription path.

When no conversation is mounted (e.g. between navigations, or before the first conversation loads), overlay requests targeting the active conversation queue behind the existing per-request timeout (Decision 5) and reject on timeout — mirroring the semantics of "no requests are answered until ready", just narrowed to "no active-conversation requests are answered until a conversation is mounted".

**Alternatives considered:**
- *Lift `ConversationPage`'s conversation/messages/streaming state into a new top-level context.* Rejected — that state is already carefully coupled to `useConversationStream`/`useConversationHandlers`/`GenerationContext` (in-flight generation tracking, resume-on-refresh, path-based staleness guards); lifting it is a large, high-risk refactor of working code for a use case (overlay) that only needs read/send access to whatever is currently displayed.
- *Have the overlay bridge call `server-api/conversations.api.ts` directly, independent of `ConversationPage`.* Rejected — this would create a second, unsynchronized read/write path onto the same conversation (double network calls, and a real risk of the overlay's view and the visibly rendered page diverging mid-stream).

`setSystemPrompt`/`setTemperature` are implemented via the same `saveConversation` call `ConversationPage`'s own handlers already use (`apps/chat/src/hooks/conversation/useConversationHandlers.ts` imports `saveConversation`; the generated `ConversationResponseDto` has persisted `temperature`/message-level `systemPrompt` fields per `libs/chat-api-client/openapi.json`), not a per-request completion-time override — there is no such override field on `SendCompletionDto` today. This mutates the conversation and relies on the existing send path to pick it up, the same way `ConversationPage`'s own handlers already persist edits, so it needs no new backend surface.

### 5. Protocol implementation uses a simple request/response/event shape, hardens origin handling

Message shapes stay `{ type: '@DIAL_OVERLAY/<REQUEST>', requestId, payload }` (request), `{ type: '@DIAL_OVERLAY/<REQUEST>/RESPONSE', requestId, payload }` (response), `{ type: '@DIAL_OVERLAY/<EVENT>', payload }` (event, no `requestId`) — this shape is simple, already well-understood by any team that has integrated an overlay-style widget before, and gives a clean discriminator (`requestId` present ⇒ request/response, absent ⇒ event) for the single `message` listener on each side.

Two internal (unexported) helper classes in `libs/chat-overlay/src/lib/internal/`: a `Task`-equivalent (a promise with external `resolve`/`reject`, used for the "iframe interaction ready" gate) and a `DeferredRequest`-equivalent (generates a request id, races the response promise against a per-request timeout, matches `type + '/RESPONSE'` + `requestId`). These are implementation details of `ChatOverlay`, not public API — the public surface is the class methods, not the transport primitives.

Origin handling changes from a naive embed:
- **Library → iframe**: the constructor posts only to `new URL(options.domain).origin`, and the `message` handler discards any event whose `event.source !== this.iframe.contentWindow` before inspecting `event.data` at all.
- **App → host**: the app never broadcasts to `'*'`. During the pre-handshake phase (before `SET_OVERLAY_OPTIONS` supplies a `hostDomain`) the app has no host origin to target yet; `INIT_READY` and `READY` are therefore sent through `window.parent.postMessage(msg, '*')` **only as the two bootstrap events that precede any host identity being known**, contain no payload beyond a bare event type, and are answered by nothing sensitive — every response/event from `SET_OVERLAY_OPTIONS` onward targets the stored, allowlist-validated `hostDomain` exactly, never `'*'`. The app additionally validates any inbound message's `event.origin` against the server-provided allowlist before accepting a `SET_OVERLAY_OPTIONS` request as the source of truth for `hostDomain` — an origin outside the allowlist gets no response at all (not even an error), so it cannot probe for the allowlist's shape.

**Alternatives considered:** accept `hostDomain` from the handshake payload with no server-side allowlist check (matching a permissive embed model). Rejected — the payload is caller-supplied by definition; without a server-validated allowlist, any page could claim any `hostDomain` and receive responses meant for a different, trusted host.

### 6. Overlay-mode routing stays inside the existing SPA shell; no separate route tree

`main.tsx` gains one additional condition: when `AppConfigContext` reports overlay-eligible **and** the current `window.self !== window.top` (there is an ambient frame) **and** the origin check has not yet failed, `OverlayProvider` wraps the existing provider tree at the same point `RequireAuth` currently sits, replacing `RequireAuth`'s "render nothing while unauthenticated" behavior with an overlay-appropriate loading state (see Risks). The existing route table (`apps/chat/src/app/app.tsx`) and `ConversationPage` are reused as-is; overlay mode does not introduce parallel pages, only a provider and a small set of conditional behaviors (loader visibility, message listener, options application).

**Alternatives considered:** a dedicated `/overlay` route with a stripped-down layout. Rejected for v1 — it would duplicate `ChatLayout`/`ConversationPage` wiring and immediately reintroduce the "two divergent conversation views" risk Decision 4 avoids; the existing root route already renders a single conversation, which is what overlay mode needs.

## Risks / Trade-offs

- **[Risk] Helmet's default `X-Frame-Options: SAMEORIGIN` silently blocks all embedding regardless of CSP changes.** → Mitigation: `chat-overlay-security-config` explicitly disables Helmet's `frameguard` (or sets it to a no-op) and relies solely on CSP `frame-ancestors`, which every modern browser respects over the legacy header; the change must add a regression test asserting the header is absent (or non-blocking) when at least one origin is allowlisted, and that CSP `frame-ancestors` defaults to `'none'`-equivalent (empty allowlist) otherwise.
- **[Risk] `RequireAuth` currently renders `null` for unauthenticated users, which inside an iframe is an unexplained blank frame.** → Mitigation: overlay mode must show the library's loader (already visible, since the library's loader covers the iframe until an app-side "hide" event) and, if a login redirect is required, let the normal same-origin login page load without a special auto-sign-in that this change explicitly defers (Non-Goals) — the loader-hide-event honors this by defaulting to hide on the app's `READY` event only, which fires after auth resolves either way.
- **[Risk] Bootstrap events (`INIT_READY`, `READY`) necessarily post before any `hostDomain` is known, using `'*'`.** → Mitigation: those two events carry no data beyond their type; the design forbids adding a payload to either without first establishing a validated origin. Every other event/response is targeted.
- **[Risk] `setSystemPrompt`/`setTemperature` round-trip through `saveConversation`, so their effect is only visible on the *next* send, not applied retroactively to in-flight generation.** → Mitigation: document this explicitly in the library's README and TSDoc; the sandbox includes a case that sends a message immediately after each to make the timing visible during manual verification.
- **[Risk] A host embedding a version-mismatched `@epam/ai-dial-chat-overlay` against an app that changed its protocol enum values.** → Mitigation: both request/response and event messages are versionless string constants sourced from the same `libs/chat-shared` package version pinned in the app's own build; the library must ignore (not throw on) unknown response/event types so a newer app talking to an older library degrades gracefully rather than crashing the host page.
- **[Trade-off] Conversation-list and playback methods are deferred**, so `ChatOverlayManager`'s conversation-switching UX is limited to whatever `overlayConversationId` was set at construction/`setOverlayOptions` time; a host cannot yet list or switch conversations from the widget itself in v1. Explicitly called out in Non-Goals and the sandbox's case list (those cases are not built in this change).

## Migration Plan

1. Land `libs/chat-shared` protocol types and `libs/chat-overlay` (library + tests) with no app wiring yet — buildable/publishable in isolation, verified via `nx build`/`nx test` for the new project, no behavior change to `apps/chat` or `apps/chat-api`.
2. Land the backend CSP/env/client-config additions behind an **empty-by-default allowlist** (`ALLOWED_IFRAME_ORIGINS`-equivalent stays `[]` unless explicitly configured), so existing deployments see no behavior change until an operator opts in.
3. Land the app-side overlay mode gated by the same allowlist/flag — dark until an operator sets the new env/config, verified against `apps/chat-overlay-sandbox` in this repo before any real deployment enables it.
4. Roll out to one real host origin at a time by adding it to the allowlist; rollback is removing that origin from the allowlist (or unsetting the overlay-enabled flag), which reverts CSP/`X-Frame-Options` and the app-side mode detection to today's default-deny behavior with no code revert required.

## Open Questions

- Exact key names for the two new `client-config` fields (e.g. `config.overlayEnabled` / `config.allowedOverlayOrigins` vs. reusing `ALLOWED_IFRAME_ORIGINS` verbatim as a client-visible list) — pinned in `specs/chat-overlay-security-config/spec.md`.
- Whether `ChatOverlayManager`'s default toggle/close/fullscreen button chrome should ship with visible text labels in addition to `aria-label`; default to icon + `aria-label` + visually-hidden text per this repo's AAA target, confirmed in tasks/apply.
- Whether the sandbox's env var should be named `VITE_CHAT_OVERLAY_HOST` (Vite convention: only `VITE_`-prefixed vars are exposed to client code) — treated as decided (yes) unless apply-time discovery finds an existing non-`VITE_`-prefixed convention for sandbox-style apps in this repo.

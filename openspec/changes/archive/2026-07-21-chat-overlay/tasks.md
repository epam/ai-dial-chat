## 1. Protocol type placement (libs/chat-shared)

- [x] 1.1 Create `libs/chat-shared/src/types/overlay/overlay-protocol.ts` with the `@DIAL_OVERLAY` namespace constant, `OverlayRequestType` enum (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`, `SET_OVERLAY_OPTIONS`), and `OverlayEventType` enum (`INIT_READY`, `READY`, `READY_TO_INTERACT`, `SELECTED_CONVERSATION_LOADED`, `GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`, `CONVERSATIONS_UPDATED`) — plain `enum`, not `const enum` (see design.md Decision 1). JSDoc every exported member per `.claude/rules/libs.md`.
- [x] 1.2 Add `ChatOverlayOptions`, `OverlayMessageRequest<T>`/`OverlayMessageResponse<T>`/`OverlayMessageEvent<T>` envelope types, and one response-payload interface per v1 request (`GetMessagesResponse`, `SendMessageResponse`, `SetSystemPromptResponse`, `SetTemperatureResponse`, `SetOverlayOptionsResponse`) to the same `overlay/` folder. No functions with logic beyond type guards (`chat-overlay-protocol` requirement: pure types only).
- [x] 1.3 **Library-isolation guard:** confirm this module imports nothing from `apps/*`, `libs/chat-overlay`, `libs/chat-api-client`, or any app-owned integration detail — it must compile with zero non-relative imports beyond other `libs/chat-shared/src/types/**` files.
- [x] 1.4 Export the new types from `libs/chat-shared/src/index.ts`.
- [x] 1.5 Add unit tests for any type guards under `libs/chat-shared/src/types/overlay/tests/`.
- [x] 1.6 Verify: `npm exec nx build @epam/ai-dial-chat-shared && npm exec nx test @epam/ai-dial-chat-shared && npm exec nx lint @epam/ai-dial-chat-shared`.

## 2. Publishable libs/chat-overlay scaffold

- [x] 2.1 Invoke the `nx-generate` skill before scaffolding, then generate a new publishable TypeScript library at `libs/chat-overlay` (confirm the exact Nx project name via `npm exec nx show projects` conventions — sibling publishable libs use their scoped package name, e.g. `@epam/ai-dial-chat-overlay`).
- [x] 2.2 Configure `libs/chat-overlay/package.json`: `name: "@epam/ai-dial-chat-overlay"`, `license: "Apache-2.0"`, one-sentence `description`, `peerDependencies: { "@epam/ai-dial-chat-shared": "*" }`, `nx.tags: ["publishable"]`, `publish` target running `node tools/publish-lib.mjs @epam/ai-dial-chat-overlay --version={args.ver} --dry={args.dry} --tag={args.tag} --development={args.development}`.
- [x] 2.3 Configure `libs/chat-overlay/vite.config.mts` in library mode (`formats: ['es']`, `vite-plugin-dts`), externalizing `@epam/ai-dial-chat-shared` — no `@vitejs/plugin-react` (no JSX in this lib).
- [x] 2.4 Add the `@epam/ai-dial-chat-overlay/*` path alias to `tsconfig.base.json`.
- [x] 2.5 Write `libs/chat-overlay/README.md` per `.claude/rules/libs.md` (H1 package name, overview, installation snippet, peer deps, one usage example per exported class).
- [x] 2.6 **Library-isolation guard:** confirm no import from `apps/*`, `apps/chat/src/server-api`, `@epam/chat-api-client`, backend DTOs, app contexts, auth/session/cookies, env, routes, storage, analytics, or third-party SDK setup appears anywhere under `libs/chat-overlay/src`.
- [x] 2.7 Verify: `npm exec nx build @epam/ai-dial-chat-overlay && npm exec nx lint @epam/ai-dial-chat-overlay`.

## 3. Internal transport primitives and ChatOverlay core

- [x] 3.1 Implement internal (unexported) `Task`-equivalent and `DeferredRequest`-equivalent helper classes under `libs/chat-overlay/src/lib/internal/` (readiness gate; per-request id generation, timeout race, response matching).
- [x] 3.2 Implement `setStyles`-equivalent DOM helper under `libs/chat-overlay/src/lib/internal/dom-styles.ts`.
- [x] 3.3 Implement `ChatOverlay` constructor: resolve `root`, create iframe (`src`, `name`, `aria-label`, `sandbox` tokens, `allow` permissions string gated on voice-input feature), create and mount the loader, register the `message` listener.
- [x] 3.4 Implement the `message` handler: discard events whose `event.source` is not the iframe's `contentWindow`; handle `INIT_READY`/`READY`/`READY_TO_INTERACT` per the handshake; match responses to pending requests by `type + '/RESPONSE'` and `requestId`; route unmatched, no-`requestId` messages to `subscribe`d event callbacks.
- [x] 3.5 Implement `ready()`, `destroy()` (listener removal, DOM removal, pending-request rejection, idempotent), `allowFullscreen()`, `openFullscreen()`, `subscribe()`.
- [x] 3.6 Implement `send()` (waits for readiness unless explicitly bypassed for `setOverlayOptions`), posting only to `new URL(options.domain).origin`.
- [x] 3.7 Implement the v1 method surface: `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`, `setOverlayOptions`. Do **not** implement `getConversations`/`getSelectedConversations`/`selectConversation`/`createConversation`/`createLocalConversation`/`deleteConversation`/`renameConversation`/`createPlaybackConversation`/`stopSelectedPlaybackConversation`/`exportConversation`/`importConversation`.
- [x] 3.8 Loader visibility: honor `loaderStyles`/`loaderClass`/`loaderInnerHTML`/`loaderHideEvent` (default hide-on-`READY`).
- [x] 3.9 Unit tests (`libs/chat-overlay/src/lib/tests/ChatOverlay.spec.ts`) covering every `chat-overlay-library` and `chat-overlay-protocol` scenario: missing-selector error, accessible iframe name, microphone opt-in, loader hide timing, request/response resolution, timeout rejection, unmatched-response no-op, subscribe/unsubscribe (including duplicate-event delivery), origin filtering (wrong `event.source`), origin targeting (`postMessage` target origin), destroy cleanup and idempotency, handshake ordering (`ready()` does not resolve before `READY_TO_INTERACT`).
- [x] 3.10 Verify: `npm exec nx test @epam/ai-dial-chat-overlay && npm exec nx lint @epam/ai-dial-chat-overlay`.

## 4. ChatOverlayManager

- [x] 4.1 Implement `ChatOverlayManager.createOverlay` (container, toggle/close/(optional) fullscreen buttons, positioning per `OverlayPosition`, default width/height/zIndex), forwarding every v1 method keyed by `overlayId`.
- [x] 4.2 Implement `showOverlay`/`hideOverlay`/`removeOverlay`/`openFullscreen`/`subscribe`/`destroy`, `resize`/`orientationchange` recomputation via an `AbortController`-scoped listener, and the mobile-viewport full-screen layout switch.
- [x] 4.3 Accessibility: real `<button>` elements with non-empty English-default `aria-label`s for toggle/close/fullscreen, native keyboard focus order, `:focus-visible` at least as visible as `:hover`.
- [x] 4.4 Unit tests covering unknown-`overlayId` errors, `removeOverlay` DOM/listener cleanup, `destroy()` tearing down all overlays and global listeners, and button accessible-name/focusability assertions.
- [x] 4.5 Update `libs/chat-overlay/src/index.ts` to export exactly `ChatOverlay`, `ChatOverlayManager`, `ChatOverlayManagerOptions`, and the re-exported protocol types — no internal helper classes exported.
- [x] 4.6 Verify: `npm exec nx test @epam/ai-dial-chat-overlay && npm exec nx build @epam/ai-dial-chat-overlay`.

## 5. Backend CSP / env / client-config additions

- [x] 5.1 Add `buildFrameAncestorsDirective` to `apps/chat-api/src/config/csp.ts` (`["'none'"]` when empty, else the allowlist) with unit tests.
- [x] 5.2 Add `OVERLAY_ENABLED` (boolean, default `false`) to `apps/chat-api/src/config/environment.config.ts`'s `EnvironmentVariables`; reuse existing `ALLOWED_IFRAME_ORIGINS`.
- [x] 5.3 Wire `frameAncestors` into the Helmet CSP config in `apps/chat-api/src/main.ts`, and set `frameguard: false` only when `ALLOWED_IFRAME_ORIGINS` is non-empty (default `frameguard` behavior preserved when empty).
- [x] 5.4 Add `overlayEnabled`/`overlayAllowedOrigins` fields to `ClientConfigResponseDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) with `@ApiProperty`, and populate them in the resolving service from `OVERLAY_ENABLED`/`ALLOWED_IFRAME_ORIGINS`.
- [x] 5.5 Update `apps/chat-api/.env.template` documenting `OVERLAY_ENABLED` next to `ALLOWED_IFRAME_ORIGINS`, including the one-line rollback note (design.md Migration Plan).
- [x] 5.6 Backend tests: CSP header assertions (empty vs. non-empty allowlist, `X-Frame-Options` presence/absence), `client-config` response assertions for both new fields, env-validation tests for `OVERLAY_ENABLED`.
- [x] 5.7 **OpenAPI regeneration required** (endpoint response contract changed): run `npm run openapi`, `npm run openapi:check`, then build/lint `chat-api-client`, and confirm the generated `ClientConfigResponse` type includes both new fields.
- [x] 5.8 Verify: `npm exec nx test @epam/chat-api && npm exec nx lint @epam/chat-api && npm exec nx build @epam/chat-api`.

## 6. Frontend client-config / AppConfigContext wiring

- [x] 6.1 Extend `AppConfigContext`'s `AppConfigState.config` with `overlayEnabled`/`overlayAllowedOrigins`, defaulted safely in `loading`/`error` states, populated from `getClientConfig()`'s response in the `ready` state.
- [x] 6.2 Add/extend tests in `apps/chat/src/context/tests/AppConfigContext.spec.tsx` (or equivalent) covering the three scenarios in `specs/app-config-context/spec.md`.
- [x] 6.3 Verify: `npm exec nx test @epam/chat && npm exec nx lint @epam/chat`.

## 7. App overlay mode and handshake

- [x] 7.1 Create `apps/chat/src/context/overlay/OverlayContext.tsx`: `createContext<OverlayState | undefined>(undefined)`, `useMemo`-wrapped value, `useOverlay` guard hook, per `ThemeContext` pattern.
- [x] 7.2 Implement overlay-mode detection (config `overlayEnabled` + `window.self !== window.top`) and mount `OverlayProvider` only when eligible, wired into `apps/chat/src/main.tsx` at the position `RequireAuth` currently occupies (design.md Decision 6), without altering non-overlay provider order.
- [x] 7.3 Implement the `message` listener and handshake state machine: emit `INIT_READY` (once), emit `READY` (once) after the existing auth/model-load signal used today, receive/apply `SET_OVERLAY_OPTIONS` and respond `SET_OVERLAY_OPTIONS/RESPONSE`, emit `READY_TO_INTERACT` (once) after first conversation load. Validate inbound `event.origin` against `overlayAllowedOrigins` before accepting `hostDomain`.
- [x] 7.4 Apply `SET_OVERLAY_OPTIONS` fields: `theme` → `ThemeContext` setter; `modelId` → `DeploymentsContext.restoreSelectedItemId` (not `setSelectedItemId`); `overlayConversationId` → navigate to that conversation route.
- [x] 7.5 Implement `registerActiveConversationBridge`/unregister plumbing on `OverlayContext`, and call it from `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) via an effect keyed to its local conversation reference, cleaning up on unmount.
- [x] 7.6 Implement request handling for `GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT` (mutate + `saveConversation`, per design.md Decision 4), `SET_TEMPERATURE` (mutate + `saveConversation`) against the registered bridge — pending (not error) while no bridge is registered, until the request's own timeout.
- [x] 7.7 Replace `RequireAuth`'s "render nothing" behavior with the library-loader-only presentation, scoped to overlay-eligible mode only (non-overlay `RequireAuth` behavior unchanged).
- [x] 7.8 Tests: `OverlayContext`/`OverlayProvider` unit tests for handshake sequencing, origin validation, options application, bridge registration/unregistration/timeout-pending behavior, and non-overlay-mode no-op (no listener attached, `useOverlay` still throws outside the provider).
- [x] 7.9 Verify: `npm exec nx test @epam/chat && npm exec nx lint @epam/chat`.

## 8. End-to-end method wiring: ready → getMessages → sendMessage

- [x] 8.1 Wire the full path for the minimal slice: library `ready()` resolves after the real handshake against a running `apps/chat` dev instance in overlay mode; `getMessages()` returns the active conversation's messages; `sendMessage()` triggers the existing send/stream path and the resulting assistant message is retrievable via a subsequent `getMessages()`.
- [x] 8.2 Confirm `GPT_START_GENERATING`/`GPT_END_GENERATING` fire around that `sendMessage`-triggered generation.
- [x] 8.3 Add an integration-style test (Vitest + jsdom, mocked `postMessage` transport) exercising this slice end-to-end without a real network dependency, covering `specs/chat-overlay-app-mode/spec.md`'s generation-lifecycle-ordering scenario.

## 9. Remaining v1 method/event parity

- [x] 9.1 Wire `setInputContent`, `setSystemPrompt`, `setTemperature` end-to-end (bridge → existing conversation mutation/`saveConversation` path) with tests per their spec scenarios.
- [x] 9.2 Wire `SELECTED_CONVERSATION_LOADED` (on every `ConversationPage` load, including the initial `overlayConversationId` load and subsequent navigations) and `CONVERSATIONS_UPDATED` (on `ConversationsContext` list changes) event emission, scoped to overlay mode only.
- [x] 9.3 Wire `STOP_GENERATING` distinctly from `GPT_END_GENERATING` on user-initiated stop.
- [x] 9.4 Handle the `overlayConversationId`-not-accessible fallback (empty state + `READY_TO_INTERACT` still emitted) and the unknown-`modelId` fallback (`SET_OVERLAY_OPTIONS/RESPONSE` still sent).
- [x] 9.5 Verify: `npm exec nx test @epam/chat && npm exec nx lint @epam/chat`.

## 10. Sandbox app

- [x] 10.1 Invoke the `nx-generate` skill before scaffolding, then generate `apps/chat-overlay-sandbox` as a React + Vite Nx application (confirm exact project name via `npm exec nx show projects` conventions once generated).
- [x] 10.2 Add `VITE_CHAT_OVERLAY_HOST` env documentation (`.env.development`/`.env.example`) and a fail-fast check when it is unset.
- [x] 10.3 Add a direct-`ChatOverlay` case wrapper covering: `ready → getMessages → sendMessage`, `setOverlayOptions` (theme/model update after load), `setInputContent`, `setSystemPrompt`, `setTemperature`, a `loaderHideEvent` override, and subscriptions to `GPT_START_GENERATING`/`GPT_END_GENERATING`/`STOP_GENERATING`/`SELECTED_CONVERSATION_LOADED`/`CONVERSATIONS_UPDATED`.
- [x] 10.4 Add a `ChatOverlayManager` case wrapper covering: `position` placement, `showOverlay`/`hideOverlay`, `removeOverlay`, and fullscreen open/allow.
- [x] 10.5 Add a case index/landing page listing only the v1-scoped cases (no conversation create/rename/delete/select/playback/import-export/custom-message-button cases).
- [x] 10.6 Add Vitest component tests per case wrapper asserting constructed options via a mocked `ChatOverlay`/`ChatOverlayManager` (no real iframe/network), per `specs/chat-overlay-sandbox/spec.md`.
- [x] 10.7 **Library-isolation guard:** confirm the sandbox imports `@epam/ai-dial-chat-overlay` from the package name, not a relative path into `libs/chat-overlay/src`.
- [x] 10.8 Verify: `npm exec nx build chat-overlay-sandbox && npm exec nx test chat-overlay-sandbox && npm exec nx lint chat-overlay-sandbox` (substitute the confirmed project name from 10.1).

## 11. Documentation

- [x] 11.1 Finalize `libs/chat-overlay/README.md` with the real v1 public API (options, methods, events) and a note on deferred methods.
- [x] 11.2 Use the `dial-docs` skill to check whether an authoritative doc under `docs/` already describes CSP/embedding or auth; update that doc in the same commit if the CSP `frame-ancestors`/`X-Frame-Options` behavior changes what it documents.
- [x] 11.3 Confirm `apps/chat-api/.env.template` and `libs/chat-overlay/README.md` cross-reference each other (deployment prerequisites: `OVERLAY_ENABLED`, `ALLOWED_IFRAME_ORIGINS`, package installation, sandbox usage).

## 12. Final verification

- [x] 12.1 Run `npm exec nx affected --target=build --base=origin/development-1.0`.
- [x] 12.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0`.
- [x] 12.3 Run `npm exec nx affected --target=test --base=origin/development-1.0`.
- [x] 12.4 Confirm `npm run openapi:check` passes (no drift from the `client-config` DTO change).
- [x] 12.5 Confirm no `libs/chat-overlay` or `libs/chat-shared` source file imports anything from `apps/*` (library-isolation final check across both touched libs).

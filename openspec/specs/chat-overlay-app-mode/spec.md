## ADDED Requirements

### Requirement: OverlayContext is the sole owner of overlay-mode state

`apps/chat/src/context/overlay/OverlayContext.tsx` SHALL own: whether overlay mode is active, the `window` `message` listener, the handshake state machine, the stored `hostDomain`, and the active-conversation bridge registry. It SHALL follow the `ThemeContext` pattern (`createContext<T | undefined>(undefined)`, `useMemo`-wrapped value, a `useOverlay` hook that throws when used outside the provider) and SHALL be mounted in `apps/chat/src/main.tsx` only when overlay mode is detected (Requirement below) — it MUST NOT mount its `message` listener when overlay mode is inactive.

**Feature flag:** Not gated by `ENABLED_FEATURES`; gated by the dedicated overlay runtime-config flag from `chat-overlay-security-config`.

#### Scenario: Provider is absent from the tree outside overlay mode

- **WHEN** the app runs in its normal (non-embedded) mode
- **THEN** no `message` event listener registered by `OverlayContext` is attached to `window`

#### Scenario: useOverlay throws outside the provider

- **WHEN** `useOverlay()` is called from a component not wrapped in `OverlayProvider`
- **THEN** it throws an `Error` with a descriptive message

### Requirement: Overlay mode is detected from runtime config, framing, and origin — not a build-time flag

The app SHALL treat overlay mode as eligible only when all of: (a) `AppConfigContext.config` reports the overlay-enabled flag from `chat-overlay-security-config` as true, (b) `window.self !== window.top` (the app is actually framed), and (c) no origin check performed so far has failed. None of these alone is sufficient. `RequireAuth`'s current "render nothing while unauthenticated" behavior SHALL be replaced, in overlay-eligible mode only, with the library-visible loader staying up (no app-rendered content) until the handshake's `READY` event, matching non-overlay behavior of showing nothing meaningful until auth resolves — this is a presentation change scoped to overlay mode only, non-overlay behavior is unchanged.

#### Scenario: Not framed, config enabled → normal mode

- **WHEN** overlay-enabled config is true but `window.self === window.top`
- **THEN** the app runs in normal (non-overlay) mode

#### Scenario: Framed, config disabled → normal mode (embedding still blocked by CSP)

- **WHEN** the app is framed but the overlay-enabled config flag is false
- **THEN** the app does not enter overlay mode (and CSP `frame-ancestors` from `chat-overlay-security-config` denies the embed regardless)

#### Scenario: Framed, config enabled → overlay mode

- **WHEN** the app is framed and overlay-enabled config is true
- **THEN** the app enters overlay mode and mounts `OverlayProvider`

### Requirement: Active-conversation bridge registration

`OverlayContext` SHALL expose `registerActiveConversationBridge(bridge: ActiveConversationBridge | null)` where `ActiveConversationBridge` provides `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature` backed by whichever conversation `ConversationPage` currently has mounted. `ConversationPage` SHALL call this registration in overlay mode from an effect that re-registers on every change to its local conversation reference and unregisters on unmount. An overlay request for one of these methods received while no bridge is registered SHALL remain pending until either a bridge registers (and answers it) or the request's own timeout elapses (`chat-overlay-protocol`) — the app SHALL NOT respond with an error immediately just because no conversation is mounted yet.

Trusted-host and expiry rules: an active-conversation request SHALL be accepted only after a valid `SET_OVERLAY_OPTIONS` has established the trusted host origin. If the request is queued while no bridge is registered, the app SHALL drop it when the request's `expiresAt` deadline passes (`chat-overlay-protocol`; default app-side cap `10000` ms when absent).

#### Scenario: Active request before host validation is ignored

- **WHEN** `SEND_MESSAGE` is received before any valid `SET_OVERLAY_OPTIONS`
- **THEN** no active conversation method is invoked
- **AND** no response is posted for that request

#### Scenario: Request answered once a conversation mounts

- **WHEN** `GET_MESSAGES` is received before any `ConversationPage` instance has registered a bridge, and a bridge registers 200ms later
- **THEN** the request is answered using that bridge once it registers, within the request's timeout

#### Scenario: Queued request expires before a conversation mounts

- **WHEN** `GET_MESSAGES` is received from the trusted host while no bridge is registered
- **AND** the request's `expiresAt` time passes before any bridge registers
- **THEN** the request is dropped
- **AND** registering a bridge later does not invoke `getMessages` for that expired request

#### Scenario: Bridge re-registers on conversation change

- **WHEN** the user navigates from one conversation to another while overlay mode is active
- **THEN** `registerActiveConversationBridge` is called again with a bridge backed by the newly displayed conversation, and a subsequent `sendMessage` request is answered using the new conversation, not the previous one

#### Scenario: Unregister on unmount leaves no stale bridge

- **WHEN** `ConversationPage` unmounts (e.g. navigating to `/catalog`)
- **THEN** `registerActiveConversationBridge(null)` is called, and a subsequent active-conversation request stays pending rather than resolving against a stale conversation

### Requirement: SET_OVERLAY_OPTIONS applies to existing contexts

On receiving `SET_OVERLAY_OPTIONS`, the app SHALL: set `hostDomain` from the payload (validated per `chat-overlay-protocol`); if `theme` is present, apply it via the existing `ThemeContext` setter; if `modelId` is present, apply it via `DeploymentsContext`'s `restoreSelectedItemId` (not `setSelectedItemId`, so the overlay-driven choice does not overwrite the end-user's persisted `UserConfig` preference); if `overlayConversationId` is present, navigate to that conversation using the existing route/`ConversationPage` loading path. The app SHALL respond `SET_OVERLAY_OPTIONS/RESPONSE` only after these have been applied (or determined inapplicable, e.g. an unknown `modelId`).

#### Scenario: modelId does not overwrite the user's persisted preference

- **WHEN** `SET_OVERLAY_OPTIONS` includes `modelId: 'gpt-4o'` for a user whose own `UserConfig` selection is a different model
- **THEN** the displayed selection changes to `gpt-4o` for this session
- **AND** the user's persisted `UserConfig` selected-deployment value is unchanged

#### Scenario: overlayConversationId navigates to that conversation

- **WHEN** `SET_OVERLAY_OPTIONS` includes `overlayConversationId: 'abc'`
- **THEN** the app navigates to and loads the conversation with id `'abc'`, and once loaded emits `SELECTED_CONVERSATION_LOADED`

#### Scenario: Unknown modelId does not crash the handshake

- **WHEN** `SET_OVERLAY_OPTIONS` includes a `modelId` that does not match any available deployment
- **THEN** the app still responds `SET_OVERLAY_OPTIONS/RESPONSE` and falls back to its normal default-deployment resolution

### Requirement: Chat and generation events are emitted from existing hooks

The app SHALL emit, only in overlay mode: `GPT_START_GENERATING` when `useConversationStream`'s `startStream` begins a generation for the active conversation; `GPT_END_GENERATING` on that generation's `onComplete`; `STOP_GENERATING` when the user (or host, via a future method) stops an active generation; `SELECTED_CONVERSATION_LOADED` whenever `ConversationPage` finishes loading a conversation (including the initial `overlayConversationId` load and any subsequent navigation); `CONVERSATIONS_UPDATED` whenever `ConversationsContext`'s conversation list changes. Emission SHALL be additive — none of these hooks change behavior for non-overlay mode.

#### Scenario: Generation lifecycle events fire in order

- **WHEN** the active conversation's stream starts and later completes
- **THEN** `GPT_START_GENERATING` fires before `GPT_END_GENERATING`, and no `GPT_END_GENERATING` fires without a preceding `GPT_START_GENERATING` for the same generation

#### Scenario: Stop emits STOP_GENERATING, not GPT_END_GENERATING

- **WHEN** the user stops an in-flight generation
- **THEN** `STOP_GENERATING` fires
- **AND** `GPT_END_GENERATING` does not also fire for that same generation

#### Scenario: Non-overlay mode is unaffected

- **WHEN** the app is not in overlay mode and a generation starts/completes
- **THEN** no `@DIAL_OVERLAY` message is posted anywhere

### Requirement: Loading, empty, and error states in overlay mode

While the handshake has not yet reached `READY`, the app SHALL render nothing of its own (the library's loader, layered on top in the host page, is the only visible loading indicator — avoids a double loading-indicator flash). If overlay-mode initialization fails (e.g. auth required but the host has no session and no redirect completes within a bounded time), the app SHALL render its existing authentication/error UI unchanged — overlay mode does not introduce a bespoke error screen. If `overlayConversationId` does not resolve to an existing/accessible conversation, the app SHALL fall back to its normal "no conversation selected" empty state and still emit `READY_TO_INTERACT` (a host waiting on a specific, inaccessible id gets a working, empty overlay rather than one stuck pre-interactive forever).

#### Scenario: No duplicate loading UI

- **WHEN** the handshake is in progress
- **THEN** the app renders no visible loading spinner of its own (relying on the library's loader)

#### Scenario: Invalid overlayConversationId still reaches READY_TO_INTERACT

- **WHEN** `overlayConversationId` references a conversation the current user cannot access
- **THEN** the app shows its normal empty-conversation state and still emits `READY_TO_INTERACT`

### Requirement: Accessibility and RTL of overlay-mode UI

Overlay mode SHALL NOT change the embedded app's accessibility or RTL behavior — it continues to inherit `dir` from `<html>` and existing i18n/AAA-contrast treatment unchanged, per this repo's baseline. The library's own chrome (loader, `ChatOverlayManager` buttons) lives outside the embedded document and is covered by `chat-overlay-library`'s accessibility requirements, not this capability.

**RTL impact:** None — overlay mode reuses the app's existing `dir`-inheriting layout with no new physical-direction styling.

#### Scenario: Embedded app still respects RTL locales

- **WHEN** the app runs in overlay mode with an RTL-active locale
- **THEN** `<html dir="rtl">` is set exactly as it would be outside overlay mode, and no overlay-mode-specific code overrides it

### Requirement: Memoization of the overlay context value

`OverlayContext`'s provided value SHALL be wrapped in `useMemo`, and `registerActiveConversationBridge`, request handlers, and event emitters exposed through it SHALL be wrapped in `useCallback` with stable dependencies, so mounting/unmounting unrelated consumers does not re-render the whole overlay provider subtree.

#### Scenario: Unrelated state changes do not recreate the context value

- **WHEN** a component elsewhere in the tree re-renders without any overlay-relevant state changing
- **THEN** `OverlayContext`'s provided value reference is unchanged

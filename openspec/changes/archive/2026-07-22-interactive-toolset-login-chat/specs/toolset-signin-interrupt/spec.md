## ADDED Requirements

### Requirement: `ClientChannelProvider` owns subscription lifecycle and pending events

A `ClientChannelProvider` (React Context, `apps/chat/src/context/ClientChannelContext.tsx`, consumer hook `useClientChannel`) SHALL be mounted once inside `RequireAuth` in `apps/chat/src/main.tsx`, at the same level as `GenerationProvider`, so it survives conversation route navigation. Its context value SHALL be wrapped in `useMemo`. It SHALL own: the current channel id (or none), connection status, and a `Map<eventId, PendingSigninEvent>` of pending `toolset/signin` events parsed from the SSE stream. The consumer hook SHALL throw if used outside the provider, matching the `ThemeContext` reference pattern.

#### Scenario: Provider survives conversation navigation
- **WHEN** the user navigates from one conversation to another while a channel subscription is active
- **THEN** the subscription and any pending signin events remain intact, unaffected by the route change

#### Scenario: Consumer used outside provider
- **WHEN** `useClientChannel` is called from a component not wrapped by `ClientChannelProvider`
- **THEN** it throws a clear error identifying the missing provider

### Requirement: SSE event parsing tolerates fragmented network chunks

The client-channel SSE reader SHALL buffer partial reads and only parse complete `data: <json>\n\n` frames, exactly as `chat-stream.api.ts`'s existing `parseSSELine` buffering does for completions. It SHALL NOT assume one JSON event arrives within a single `reader.read()` result.

#### Scenario: One event split across two network chunks
- **WHEN** a single `toolset/signin` SSE frame arrives split across two `reader.read()` results
- **THEN** the parser buffers the fragments and emits exactly one parsed event once the frame is complete

#### Scenario: Two events arrive in one network chunk
- **WHEN** two complete SSE frames arrive together in a single `reader.read()` result
- **THEN** the parser emits both events, in order, without dropping or merging them

### Requirement: Reconnect with bounded retries

On stream error or close, the provider SHALL retry subscribing with capped exponential backoff (1s, 2s, 4s, 8s, 16s — 5 attempts), sending the previous channel id (if any) on each retry attempt. After 5 failed attempts it SHALL stop retrying automatically and resume only when a new completion is issued or the tab regains visibility. Pending events already known to the dialog SHALL NOT be cleared merely because the connection dropped.

#### Scenario: Transient disconnect recovers
- **WHEN** the SSE connection drops and reconnects successfully within the retry window
- **THEN** the channel id is resumed (or a fresh one issued) and pending events remain visible in the dialog throughout

#### Scenario: Retries exhausted
- **WHEN** 5 consecutive reconnect attempts fail
- **THEN** the provider stops retrying and marks connection status as disconnected until the next completion or visibility change triggers a fresh attempt

### Requirement: Global non-dismissible toolset sign-in dialog

When one or more `toolset/signin` events are pending and the `liveChatInteraction` flag is enabled, a global `ToolsetSigninDialog` (`apps/chat/src/components/ToolsetSigninDialog/ToolsetSigninDialog.tsx`) SHALL render, mounted at the authenticated-application level (visible regardless of which route/conversation is active). The dialog SHALL NOT be dismissible by clicking outside, pressing Escape, or any action other than resolving every listed event (login or decline). It SHALL list every pending event as a row showing the toolset's name/version (or a fallback derived from the toolset id while metadata is loading) and per-row `Log in` / `Decline` actions, plus a single `Decline all` action. Only the row currently being processed SHALL be disabled; other rows remain actionable.

i18n keys: `toolsetSignin.dialogTitle`, `toolsetSignin.rowLogin`, `toolsetSignin.rowDecline`, `toolsetSignin.declineAll`, `toolsetSignin.fallbackName`, `toolsetSignin.apiKeyPlaceholder`, `toolsetSignin.errorRetry`.

RTL: dialog and row layout use logical Tailwind utilities (`ps-*`/`pe-*`/`text-start`, etc.) and no directional icons beyond a symmetric close-suppression (no close icon at all, since the dialog is non-dismissible); fully mirrors under `dir="rtl"` with no icon-flip needed since it uses no directional icons.

Accessibility: dialog root uses `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at the title; focus is trapped/moved to the first actionable control on open and restored appropriately; each row's processing state is exposed via `aria-busy` on the row and a shared `aria-live="polite"` status region announces per-action outcomes (e.g. "Login succeeded for <toolset>", "Declined <toolset>"); background content is not `aria-hidden` while still focusable — the app SHALL use `inert` on the rest of the application while the dialog is open, per the repo's a11y rules for focus-trap-safe hiding.

#### Scenario: Dialog appears on first pending event
- **WHEN** the first `toolset/signin` event is received while the feature flag is enabled
- **THEN** the global dialog renders listing that event with `Log in` and `Decline` actions

#### Scenario: Dialog cannot be dismissed without resolving events
- **WHEN** the user presses Escape or clicks outside the dialog while events remain pending
- **THEN** the dialog remains open and no event is resolved

#### Scenario: Metadata not yet loaded shows a fallback name
- **WHEN** a pending event references a toolset whose metadata has not finished loading
- **THEN** the row shows a fallback label derived from the toolset id instead of blocking rendering

#### Scenario: Only the active row is disabled during processing
- **WHEN** the user clicks `Log in` on one row while two other rows are pending
- **THEN** only the clicked row's actions become disabled/`aria-busy`; the other rows remain clickable

### Requirement: Shared `useToolsetLogin` controller with stale-credential override

An app-level `useToolsetLogin` hook (`apps/chat/src/hooks/toolsets/useToolsetLogin.ts`) SHALL encapsulate the API key and OAuth login orchestration currently inline in `CatalogView.tsx`, and SHALL be used by both `CatalogView` and `ToolsetSigninDialog`. It SHALL accept a `forceStale?: boolean` option; when `true`, it SHALL call `logoutToolset` for the target credentials level before calling `loginToolset`/initiating OAuth, regardless of the locally cached status — because a `toolset/signin` event is proof the Core-side credentials are invalid even when the local cache still reports `SIGNED_IN`. `ToolsetSigninDialog` SHALL always pass `forceStale: true`. After a successful login, the hook SHALL call `refetchToolsets()` to refresh authoritative state.

Credentials level selection for a signin-triggered login SHALL follow the existing rule: public toolset → `USER` level; private toolset → `GLOBAL` level. The dialog SHALL NOT offer an organization-credential-management choice (no admin "Manage credentials" affordance), even for admin users.

#### Scenario: Locally signed-in credentials are treated as stale
- **WHEN** a `toolset/signin` event arrives for a toolset whose local cached status is `SIGNED_IN` at the relevant level
- **THEN** the login action still logs out that level first before submitting new credentials, rather than skipping login because the UI believed it was already signed in

#### Scenario: API key login for a signin event
- **WHEN** the user submits an API key for a pending event's toolset
- **THEN** the hook validates the input is non-empty (trimmed), calls `loginToolset`, refetches toolsets, and only then reports `success` for that event's id

#### Scenario: API key login fails
- **WHEN** the API key login call fails
- **THEN** the event remains pending, a recoverable inline error is shown on that row, and no `report` is sent to the client channel

#### Scenario: Private toolset uses GLOBAL level
- **WHEN** the pending event's toolset is private
- **THEN** the login action targets `GLOBAL` credentials, not `USER`

### Requirement: OAuth login from the signin dialog reuses the existing popup/callback mechanism

The dialog's `Log in` action for an OAuth-configured toolset SHALL reuse `initiateOAuthLogin`, `getToolsetOAuthChannelName`, `waitForToolsetOAuthResult`, and the existing `ToolsetEditorCallback` route unchanged: synchronous popup open (with popup-blocked detection surfaced as a row-level error), `state`-based validation, popup-owned `sessionStorage`, `popup.opener = null` severed before external navigation, and `BroadcastChannel`-delivered results. On a `Cancelled` result (popup closed without a message), the hook SHALL re-verify the real toolset status via `getToolset` before deciding whether to report success or leave the event pending, exactly as `CatalogView.handleLogin` does today for the same race.

#### Scenario: OAuth login succeeds
- **WHEN** the popup reports a `Success` result on its `BroadcastChannel`
- **THEN** the hook refetches toolsets and reports `{ id: eventId, result: 'success' }` on the client channel

#### Scenario: Popup blocked
- **WHEN** the browser blocks the synchronous popup open
- **THEN** the row shows a recoverable "popup blocked" error and the event remains pending

#### Scenario: Popup closed without a result
- **WHEN** the user closes the popup before any message is posted
- **THEN** the hook calls `getToolset` to verify the real status; if still not signed in, the event remains pending and no report is sent

### Requirement: Decline and decline-all reporting

A single `Decline` action SHALL report `{ id: eventId, result: 'denied' }` via `POST /api/v1/client-channel/report` and SHALL remove that event from the pending map only after the report call succeeds; on failure, the event remains pending with a recoverable row-level error. `Decline all` SHALL issue a report call for every currently pending event; each event SHALL be removed independently as its own report succeeds, so a partial failure (some succeed, some fail) leaves only the failed ones visible and retryable.

#### Scenario: Single decline succeeds
- **WHEN** the user clicks `Decline` on one row and the report call succeeds
- **THEN** that event is removed from the dialog; other pending events are unaffected

#### Scenario: Single decline fails
- **WHEN** the report call for a decline fails
- **THEN** the event remains listed with a retryable error, and the dialog is not dismissed

#### Scenario: Decline all with partial failure
- **WHEN** `Decline all` is clicked with three pending events and the report call fails for exactly one of them
- **THEN** the two successfully-reported events are removed and the one that failed remains visible with a retryable error

### Requirement: Multiple and duplicate events are handled per event id

Pending events SHALL be keyed by their protocol `id`, never by `toolsetId` alone. Multiple concurrent pending events for different toolsets SHALL all be listed simultaneously. Multiple concurrent pending events for the *same* toolset SHALL also all be listed as separate rows. A duplicate delivery of an event with an `id` already present in the pending map SHALL be deduplicated (no duplicate row added, no duplicate report sent for an already-resolved id).

When a login for one event succeeds, the client SHALL report `success` individually for every other still-pending event that targets the same `toolsetId` **and** the same resolved credentials level, rather than resolving only the first match and leaving the rest pending indefinitely.

#### Scenario: Two events for the same toolset
- **WHEN** two `toolset/signin` events for the same `toolsetId` arrive with different event ids
- **THEN** both are listed as separate rows

#### Scenario: Duplicate event id delivered twice
- **WHEN** an event with an `id` already in the pending map is received again (e.g. after a reconnect replay)
- **THEN** no duplicate row is added and no duplicate report is later sent for that id

#### Scenario: One login resolves sibling events for the same toolset and level
- **WHEN** the user successfully logs in for one of two pending events that share the same `toolsetId` and resolved credentials level
- **THEN** the client also reports `success` for the sibling event's id, and both rows are removed

#### Scenario: Event for a background conversation
- **WHEN** a `toolset/signin` event arrives while its originating conversation is not the currently displayed one
- **THEN** the event is still listed in the global dialog (not scoped to the currently visible conversation) since the dialog is tab-wide, not per-conversation

### Requirement: Mobile and desktop layout parity

`ToolsetSigninDialog` SHALL render usably on both mobile and desktop breakpoints using the project's named Tailwind breakpoints (`mobile`, `desktop`) and, where JS branching is required, `useBreakpoint`/`useIsMobile` — never raw `window.innerWidth` checks. On mobile it SHALL use a full-width/bottom-sheet-style layout consistent with other global mobile dialogs in the app; on desktop a centered modal.

#### Scenario: Mobile viewport
- **WHEN** the dialog renders at a mobile breakpoint
- **THEN** it uses the mobile dialog layout and all actions remain reachable without horizontal scrolling

### Requirement: Memoization of dialog state derivations

Derived values passed to `ToolsetSigninDialog` rows (e.g. resolved toolset display name/version, per-row disabled state) SHALL be memoized with `useMemo`/`useCallback` where computed from the pending-events map and toolset list, to avoid re-rendering every row on every unrelated context update.

#### Scenario: Unrelated context update does not re-render all rows
- **WHEN** an unrelated piece of `DeploymentsContext` state changes while the dialog is open
- **THEN** rows whose underlying event/toolset data did not change do not re-render

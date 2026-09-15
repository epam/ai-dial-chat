## MODIFIED Requirements

### Requirement: Global non-dismissible toolset sign-in dialog

When one or more `toolset/signin` events are pending and the `liveChatInteraction` flag is enabled, a global `SigninInterruptDialog` (`apps/chat/src/components/SigninInterruptDialog/SigninInterruptDialog.tsx`) SHALL render, mounted at the authenticated-application level (visible regardless of which route/conversation is active). The dialog SHALL NOT be dismissible by clicking outside, pressing Escape, or any action other than resolving every listed event (login or decline). It SHALL list every pending event as a row showing the toolset's name/version (or a fallback derived from the toolset id while metadata is loading) and per-row `Log in` / `Decline` actions, plus a single `Decline all` action. Only the row currently being processed SHALL be disabled; other rows remain actionable.

"Not dismissible" constrains the client-channel lifecycle, not only the dialog's own event handlers: the dialog renders `ClientChannelProvider`'s pending-event map, so any teardown that clears that map dismisses the dialog on the user's behalf. While the dialog lists at least one unresolved event, the subscription SHALL therefore be pinned open — the idle-disconnect timer SHALL NOT fire and leaving a streaming-capable route SHALL NOT tear the channel down (see the `client-channel-protocol` requirements for the flag gate and the idle disconnect). The pin is also what keeps the event resolvable at all, since a `report` is addressed to the channel id Core is blocked on. The two teardowns that end the mechanism rather than idling it — the `liveChatInteraction` flag flipping off, and the provider unmounting on logout or app teardown — remain unconditional and do clear the pending events.

i18n keys: every member of `ToolsetSigninI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (`toolsetSignin.dialogTitle`, `toolsetSignin.dialogDescription`, `toolsetSignin.rowDecline`, `toolsetSignin.declineAll`, `toolsetSignin.apiKeyLabel`, `toolsetSignin.apiKeyPlaceholder`, `toolsetSignin.errorLoginFailed`, `toolsetSignin.errorPopupBlocked`, `toolsetSignin.errorDeclineFailed`, `toolsetSignin.errorRetry`, `toolsetSignin.statusLoginSuccess`, `toolsetSignin.statusDeclineSuccess`, `toolsetSignin.noCredentialsRequired`, `toolsetSignin.offlineUsageConsent`, `toolsetSignin.offlineUsageConsentHint`).

RTL: dialog and row layout use logical Tailwind utilities (`ps-*`/`pe-*`/`text-start`, etc.) and no directional icons beyond a symmetric close-suppression (no close icon at all, since the dialog is non-dismissible); fully mirrors under `dir="rtl"` with no icon-flip needed since it uses no directional icons.

Accessibility: dialog root uses `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at the title; focus is trapped/moved to the first actionable control on open and restored appropriately; each row's processing state is exposed via `aria-busy` on the row and a shared `aria-live="polite"` status region announces per-action outcomes (e.g. "Login succeeded for <toolset>", "Declined <toolset>"); background content is not `aria-hidden` while still focusable — the app SHALL use `inert` on the rest of the application while the dialog is open, per the repo's a11y rules for focus-trap-safe hiding.

#### Scenario: Dialog appears on first pending event
- **WHEN** the first `toolset/signin` event is received while the feature flag is enabled
- **THEN** the global dialog renders listing that event with `Log in` and `Decline` actions

#### Scenario: Dialog cannot be dismissed without resolving events
- **WHEN** the user presses Escape or clicks outside the dialog while events remain pending
- **THEN** the dialog remains open and no event is resolved

#### Scenario: The dialog outlives the generation that produced its event
- **WHEN** the completion that carried the `toolset/signin` event ends or errors out while the event is still unresolved, so nothing is generating any more
- **THEN** the dialog stays open with the event listed and resolvable — the idle-disconnect grace period does not elapse into a teardown that would clear it

#### Scenario: The dialog survives a route change
- **WHEN** the application navigates away from the streaming-capable route while the dialog still lists an unresolved event
- **THEN** the dialog stays open, its rows stay actionable, and a subsequent login or decline reports successfully on the same channel

#### Scenario: Metadata not yet loaded shows a fallback name
- **WHEN** a pending event references a toolset whose metadata has not finished loading
- **THEN** the row shows a fallback label derived from the toolset id instead of blocking rendering

#### Scenario: Only the active row is disabled during processing
- **WHEN** the user clicks `Log in` on one row while two other rows are pending
- **THEN** only the clicked row's actions become disabled/`aria-busy`; the other rows remain clickable

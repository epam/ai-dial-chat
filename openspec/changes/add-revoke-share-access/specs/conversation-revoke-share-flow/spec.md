## ADDED Requirements

### Requirement: Row action menu exposes Revoke access only for owned conversations

`ConversationPanelView.getActions` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) SHALL append a "Revoke access" action to a row's action menu when, and only when, both hold:

- the row is **not** readonly — the underlying `ConversationListItemDto` has `isReadonly`, `sharedWithMe`, and `publishedWithMe` all falsy, the same `isReadonlyItem` condition that already gates the owner-side Rename / Share / Delete actions in that file; **and**
- `isConversationsSharingEnabled` is true — the same `useUiFeature` gate the Share action already rides. With conversation sharing disabled a user cannot grant access at all, so offering to revoke it would be incoherent; revoke appears exactly where Share does; **and**
- the row's recipient count, resolved **when that row's action menu opens**, is a positive number — an action that could only be a no-op is noise.

The count SHALL come from `useShareRecipientsCount` (`apps/chat/src/hooks/useShareRecipientsCount/useShareRecipientsCount.ts`), which calls `GET /api/v1/share/recipients` per conversation id and caches the result until invalidated. `handleActionMenuOpen` — already wired to the panel's `onActionMenuOpen` for publish focus return — SHALL start the lookup, and only for a row that could offer the action (sharing enabled, row not readonly). Resolution states map to the action as follows:

- **in flight** — the action is withheld, so a count never appears and then contradicts itself,
- **`0`** — the action stays hidden,
- **positive number** — the action is shown, labelled `t(ButtonsI18nKeys.RevokeAccessWithCount, { count })` (English `Revoke access ({{count}})`),
- **failed lookup** — the action is shown with the plain `t(ButtonsI18nKeys.RevokeAccess)`, so a transient upstream failure never removes the owner's only way to revoke.

A successful revoke SHALL call `invalidateRecipientsCount(id)`, so reopening the menu asks again instead of replaying the pre-revoke count.

For owned rows the action menu SHALL therefore contain Pin, Rename, Duplicate, Export, Share, Publish, Revoke access, Delete — adding Revoke access immediately before Delete and leaving every existing action unchanged. Readonly rows (shared-with-me or published-with-me) keep their existing sets exactly as they are today.

State owned by this requirement: `pendingRevokeId: string | null`, `isRevoking: boolean`, and `revokeError: string | null` in `ConversationPanelView` — a new triple parallel to the existing `pendingUnshareId` / `isUnsharing` / `unshareError` set, deliberately not shared with either the unshare or the owner-delete flow.

#### Scenario: Owned row menu includes Revoke access

- **GIVEN** a conversation with `isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes Revoke access, positioned immediately before Delete, alongside the existing owner-side actions

#### Scenario: Shared-with-me row menu does not include Revoke access

- **GIVEN** a conversation with `sharedWithMe: true`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes Pin, Duplicate, Export, Remove from My List — and no Revoke access

#### Scenario: Published-with-me row menu does not include Revoke access

- **GIVEN** a conversation with `publishedWithMe: true`, `sharedWithMe: false`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes only Pin, Duplicate, Export

#### Scenario: Revoke access is hidden when conversation sharing is disabled

- **GIVEN** `isConversationsSharingEnabled` is false
- **WHEN** an owned row's action menu is opened
- **THEN** neither Share nor Revoke access is rendered

#### Scenario: Count is requested on menu open, not on list render

- **GIVEN** an owned conversation in the panel
- **WHEN** the panel renders
- **THEN** `GET /api/v1/share/recipients` has not been called and no Revoke access action is rendered; opening the row's menu calls it once for that conversation id, and reopening does not call it again

#### Scenario: Conversation nobody holds access to does not expose the action

- **GIVEN** an owned conversation whose recipient count resolves `0`
- **WHEN** the row's action menu is opened
- **THEN** no Revoke access action is rendered

#### Scenario: Known recipient count is shown in the label

- **GIVEN** an owned conversation whose recipient count resolves `2`
- **WHEN** the row's action menu is opened
- **THEN** the action's label is rendered from `buttons.revokeAccessWithCount`

#### Scenario: Failed lookup keeps the action reachable

- **GIVEN** an owned conversation whose recipient-count lookup rejects
- **WHEN** the row's action menu is opened
- **THEN** the action is rendered with the plain `buttons.revokeAccess` label

#### Scenario: Readonly rows cost no lookup

- **GIVEN** a shared-with-me or published-with-me conversation
- **WHEN** the row's action menu is opened
- **THEN** `GET /api/v1/share/recipients` is not called

### Requirement: Revoke access action label and icon

The revoke `DropdownItem` SHALL use `label={t(ButtonsI18nKeys.RevokeAccess)}` (English value "Revoke access") — the same shared key the catalog surface uses, per `.claude/rules/all-ts.md` §"Avoid duplicate translation values" — and `icon={<IconUserOff size={DIAL_ICON_SIZE.SM} className="text-secondary" />}`, matching the icon sizing and color treatment of the sibling actions in that menu. `IconUserOff` is direction-neutral and SHALL NOT be mirrored with `rtl:scale-x-[-1]`.

Clicking the action SHALL only call `setPendingRevokeId(contextId)` — it SHALL NOT call the revoke API directly.

#### Scenario: Clicking Revoke access opens confirmation without calling the API

- **WHEN** a user clicks Revoke access on an owned row
- **THEN** `pendingRevokeId` is set to that row's conversation id and no network call to the revoke endpoint is made yet

### Requirement: Confirmation popup before revoking access

`ConversationPanelView` SHALL render a `ConfirmationPopup` bound to `pendingRevokeId`, structurally parallel to the existing unshare popup in the same file:

- `open={!!pendingRevokeId}`
- `header={t(ConversationPanelI18nKeys.RevokeConfirmTitle)}` (English default "Revoke access?")
- `description` interpolates the conversation's title via `t(ConversationPanelI18nKeys.RevokeConfirmMessage, { name: pendingRevokeTitle })` (English default: `Revoke shared access to "{{name}}"? Anyone you shared it with will lose access. Your conversation is not deleted.`), followed by an inline error line (`role="alert"`) when `revokeError` is set, mirroring the existing popups' error rendering
- `confirmLabel={t(ButtonsI18nKeys.RevokeAccess)}`
- `cancelLabel={t(ButtonsI18nKeys.Cancel)}`
- `variant={ConfirmationPopupVariant.Danger}` — other people irreversibly lose access
- `isLoading={isRevoking}`
- `onConfirm={handleConfirmRevoke}`, `onCancel`/`onClose={handleCloseRevokeDialog}`

`pendingRevokeTitle` SHALL be derived with `useMemo` from `items` and `pendingRevokeId`, falling back to the conversation id then the empty string, exactly as `pendingUnshareTitle` does.

`handleCloseRevokeDialog` SHALL no-op while `isRevoking` is `true` (matching `handleCloseUnshareDialog`'s guard), otherwise clear `pendingRevokeId` and `revokeError`.

#### Scenario: Confirm calls revoke exactly once and disables the dialog while pending

- **WHEN** a user clicks the confirm button in the open revoke popup
- **THEN** the revoke API is called exactly once, `isRevoking` becomes `true` for the duration of the call, and a second rapid click does not invoke the call again

#### Scenario: Cancel, close, or Escape makes no API call

- **WHEN** a user clicks Cancel, clicks the backdrop, or presses Escape while the revoke popup is open and not submitting
- **THEN** the popup closes, `pendingRevokeId` is cleared, and the revoke API is never called

#### Scenario: Cancel is a no-op while a revoke is in flight

- **WHEN** a user attempts to close the popup while `isRevoking` is `true`
- **THEN** the popup remains open and no state changes

### Requirement: Successful revoke keeps the conversation and notifies

`handleConfirmRevoke` SHALL:

1. Call `revokeSharedAccess(pendingRevokeId)` (the wrapper added in `apps/chat/src/server-api/share.api.ts` by the `share-revoke-access` capability).
2. On success, call `refreshConversations()` from `ConversationsContext` so any share-derived indicator re-resolves. If this refresh rejects, the revoke is still treated as successful — no error is surfaced and no retry is invited.
3. Show a success notification: `title={t(ConversationPanelI18nKeys.RevokeSuccessTitle)}` ("Access revoked"), `message={t(ConversationPanelI18nKeys.RevokeSuccess, { name: pendingRevokeTitle })}` (`Shared access to "{{name}}" was revoked.`).
4. Close the popup (`setPendingRevokeId(null)`, clear `revokeError`, `isRevoking = false`).

It SHALL NOT navigate away and SHALL NOT remove the conversation from the panel, even when the revoked conversation is the currently open one — the owner keeps their own conversation. This is the behavioural difference from `handleConfirmUnshare`, which navigates to `ROUTES.Root` for an active discarded conversation.

#### Scenario: Successful revoke of the active conversation stays put

- **WHEN** `handleConfirmRevoke` succeeds for the conversation currently open
- **THEN** a success notification is shown, the popup closes, no navigation occurs, and the conversation remains in the panel and on screen

#### Scenario: Refresh failure after a successful revoke does not undo the success outcome

- **WHEN** the revoke API call succeeds but the following `refreshConversations()` call rejects
- **THEN** the popup still closes, the success notification is still shown, and no error notification appears

### Requirement: Failed revoke keeps the popup open and shows an error

If `revokeSharedAccess` rejects (e.g. the BFF responds 403/404/429/502/503), `handleConfirmRevoke` SHALL:

- Set `revokeError` to `t(ConversationPanelI18nKeys.RevokeError, { name: pendingRevokeTitle })` (`Failed to revoke access to "{{name}}". Please try again.`) and keep the popup open, with the error rendered inline via `role="alert"` — mirroring `handleConfirmUnshare`'s inline-error pattern rather than a separate error notification.
- NOT call `refreshConversations()`.
- Leave the conversation and its sharing state untouched.

#### Scenario: Failed revoke shows an inline error

- **WHEN** the revoke API call rejects
- **THEN** the popup stays open with an inline `role="alert"` error, `refreshConversations()` is not called, and no navigation occurs

### Requirement: i18n keys for the conversation revoke flow

New keys SHALL be added to `ConversationPanelI18nKeys` (`apps/chat/src/constants/translation-keys.ts`) and `apps/chat/src/i18n/locales/en.json` under a `conversationPanel.revoke.*` namespace, matching the existing `conversationPanel.unshare.*` nesting:

| Enum member | Key | English value |
|---|---|---|
| `RevokeConfirmTitle` | `conversationPanel.revoke.revokeConfirmTitle` | `Revoke access?` |
| `RevokeConfirmMessage` | `conversationPanel.revoke.revokeConfirmMessage` | `Revoke shared access to "{{name}}"? Anyone you shared it with will lose access. Your conversation is not deleted.` |
| `RevokeSuccessTitle` | `conversationPanel.revoke.revokeSuccessTitle` | `Access revoked` |
| `RevokeSuccess` | `conversationPanel.revoke.revokeSuccess` | `Shared access to "{{name}}" was revoked.` |
| `RevokeError` | `conversationPanel.revoke.revokeError` | `Failed to revoke access to "{{name}}". Please try again.` |

The action and confirm-button label reuse the shared `ButtonsI18nKeys.RevokeAccess` (`buttons.revokeAccess`) declared by the `share-revoke-access` capability, and the cancel label reuses the existing `ButtonsI18nKeys.Cancel`. No `RevokeErrorTitle` key is introduced — the failure path uses only the inline message.

#### Scenario: New keys resolve via i18n

- **WHEN** `en.json` is loaded
- **THEN** every `conversationPanel.revoke.*` key resolves to its English value above

### Requirement: `libs/conversation-panel` requires no changes

`getActions` is already a host-supplied callback prop on the `ConversationPanel` component from `@epam/ai-dial-conversation-panel`; the lib renders whatever `DropdownItem[]` the host returns and has no knowledge of ownership, sharing, or revocation. This capability SHALL introduce no changes to `libs/conversation-panel` — all gating logic and API calls MUST live in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`.

#### Scenario: Lib renders whatever the host returns

- **WHEN** `getActions` returns a `DropdownItem[]` that includes the Revoke access action for an owned row
- **THEN** `ConversationPanel` renders it identically to any other action item, with no lib-side branching

### Requirement: RTL and accessibility for the conversation revoke flow

The Revoke access menu item and its confirmation popup SHALL use only logical Tailwind/CSS properties, consistent with the rest of the row's action menu; no physical-direction classes are introduced. The interpolated conversation title uses i18next `{{name}}` substitution, not concatenation, so mixed-direction titles render under the browser's bidi algorithm.

The flow SHALL be fully keyboard-operable — Tab to the menu item, Enter/Space to activate, Tab to the popup's confirm/cancel buttons, Enter/Space/Escape to complete or cancel — using the accessible dialog semantics `ConfirmationPopup` already provides for the sibling delete and unshare popups. Inline error text uses `role="alert"` so it is announced without moving focus.

#### Scenario: Full flow is keyboard-operable

- **WHEN** a keyboard-only user tabs to Revoke access on an owned row, activates it with Enter, tabs to the popup's confirm button, and activates it
- **THEN** the same revoke behaviour occurs as with a mouse click, with no loss of keyboard focus at any step

#### Scenario: RTL layout does not change the menu item's logical position

- **WHEN** `dir="rtl"` is set on the document and the row's action menu is opened
- **THEN** Revoke access renders in the same logical position as the other menu items and `IconUserOff` is not mirrored

### Requirement: Tests — `ConversationPanelView` revoke flow

`apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` SHALL include a `describe('ConversationPanelView — revoke access', ...)` block covering:

- Owned row menu includes Revoke access; shared-with-me and published-with-me rows do not; existing actions on all three row kinds are unaffected.
- Clicking Revoke access opens the confirmation popup without calling the revoke API.
- Confirm calls `revokeSharedAccess` exactly once; the popup's controls are disabled while pending; a second rapid confirm click does not double-call it.
- A successful confirm calls `refreshConversations()`, shows the success notification, closes the popup, and does **not** navigate — including when the revoked conversation is the active one.
- A `refreshConversations()` rejection after a successful revoke still shows the success notification and shows no error.
- A rejected revoke shows the inline error, keeps the popup open, and does not call `refreshConversations()`.
- Cancel and Escape close the popup with no revoke call, and are no-ops while a call is in flight.

Tests SHALL query by role, label, and text — no implementation-specific selectors and no `data-testid`.

#### Scenario: Test suite covers the full success and failure matrix

- **WHEN** the `ConversationPanelView` suite is run
- **THEN** every scenario listed above passes, matching the structure of the existing `— unshare (Remove from My List)` describe block in the same file

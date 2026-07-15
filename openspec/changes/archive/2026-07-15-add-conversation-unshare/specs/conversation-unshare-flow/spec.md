## ADDED Requirements

### Requirement: Row action menu exposes Delete only for shared-with-me conversations

`ConversationPanelView.getActions` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) SHALL append a Delete action to a row's action menu when, and only when, the underlying `ConversationListItemDto` has `sharedWithMe === true`. This action SHALL NOT be shown for:
- owned conversations (`sharedWithMe: false`), which keep their existing Rename/Share/Delete actions unchanged;
- `publishedWithMe === true` conversations that are not also `sharedWithMe === true` — organization-published conversations are not share-link grants and DIAL Core's discard call does not apply to them.

For `sharedWithMe === true` rows, the action menu SHALL contain exactly Pin, Duplicate, Export, Delete — replacing the existing readonly-row set (Pin, Duplicate, Export with no Delete) by adding Delete, and continuing to omit Rename/Share/the owner-side Delete for these rows (unchanged from the existing `isReadonlyItem` gating).

State owned by this requirement: a new `pendingUnshareId: string | null` piece of local state in `ConversationPanelView`, mirroring the existing `pendingDeleteId` state used by the owner-side delete flow.

#### Scenario: Shared-with-me row menu includes Delete

- **GIVEN** a conversation with `sharedWithMe: true`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes Pin, Duplicate, Export, and Delete

#### Scenario: Owned row menu does not include the unshare Delete

- **GIVEN** a conversation with `sharedWithMe: false`, `publishedWithMe: false`, `isReadonly: false`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes the existing owner-side actions (Pin, Rename, Duplicate, Export, Share, Publish, Delete) and clicking that Delete triggers the existing owner-delete confirmation, not the unshare confirmation

#### Scenario: Published-with-me (not shared-with-me) row menu does not include Delete

- **GIVEN** a conversation with `publishedWithMe: true`, `sharedWithMe: false`
- **WHEN** the panel row's action menu is opened
- **THEN** the menu includes only Pin, Duplicate, Export — no Delete action

### Requirement: Delete action label and icon

The unshare Delete `DropdownItem` SHALL use `label={t(ButtonsI18nKeys.Delete)}` (English value "Delete") and `icon={<IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />}`, matching the label and icon already used by the owner-side Delete action in the same file. Per the repo's i18n dedup convention (`.claude/rules/all-ts.md` §"Avoid duplicate translation values"), this generic action label reuses the existing `ButtonsI18nKeys.Delete` key rather than introducing a feature-scoped duplicate with the same English text. `IconTrashX` is direction-neutral and requires no `rtl:scale-x-[-1]` mirroring.

Clicking the action SHALL only call `setPendingUnshareId(contextId)` — it SHALL NOT call the discard API directly.

#### Scenario: Clicking Delete opens confirmation without calling the API

- **WHEN** a user clicks the Delete action on a shared-with-me row
- **THEN** `pendingUnshareId` is set to that row's conversation id and no network call to the discard endpoint is made yet

### Requirement: Confirmation popup before discarding access

`ConversationPanelView` SHALL render a `DialConfirmationPopup` (from `@epam/ai-dial-ui-kit`) bound to `pendingUnshareId`, structurally parallel to the existing owner-side delete `DialConfirmationPopup` in the same file (its own `isUnsharing`/`unshareError` local state, not shared with the owner-delete triplet):

- `open={!!pendingUnshareId}`
- `header={t(ConversationPanelI18nKeys.UnshareConfirmTitle)}` (English default "Delete conversation?")
- `description` interpolates the conversation's title via `t(ConversationPanelI18nKeys.UnshareConfirmMessage, { name: pendingUnshareTitle })` (English default: `Delete "{{name}}" from your conversations? You'll need a new invitation to access it again.`), followed by an inline error line (`role="alert"`) when `unshareError` is set, mirroring the existing delete popup's error rendering
- `confirmLabel={t(ButtonsI18nKeys.Delete)}` ("Delete") — same shared key as the menu action's label, per the i18n dedup convention
- `cancelLabel={t(ButtonsI18nKeys.Cancel)}`
- `variant={ConfirmationPopupVariant.Danger}`
- `isLoading={isUnsharing}`
- `onConfirm={handleConfirmUnshare}`, `onCancel`/`onClose={handleCloseUnshareDialog}`

`handleCloseUnshareDialog` SHALL no-op while `isUnsharing` is `true` (matching `handleCloseDeleteDialog`'s existing guard), otherwise clear `pendingUnshareId` and `unshareError`.

#### Scenario: Confirm calls discard exactly once and disables the dialog while pending

- **WHEN** a user clicks the confirm button in the open unshare popup
- **THEN** the discard API is called exactly once, `isUnsharing` becomes `true` for the duration of the call (confirm/cancel controls disabled per `DialConfirmationPopup`'s `isLoading` behavior), and a second rapid click does not invoke the discard call again

#### Scenario: Cancel, close, or Escape makes no API call

- **WHEN** a user clicks Cancel, clicks the backdrop, or presses Escape while the unshare popup is open and not currently submitting
- **THEN** the popup closes, `pendingUnshareId` is cleared, and the discard API is never called

#### Scenario: Cancel is a no-op while a discard is in flight

- **WHEN** a user attempts to close the popup while `isUnsharing` is `true`
- **THEN** the popup remains open and no state changes

### Requirement: Successful discard refreshes the list, notifies, and navigates away from an active discarded conversation

`handleConfirmUnshare` SHALL:
1. Call `discardSharedCatalogItem(pendingUnshareId)` (existing wrapper from `apps/chat/src/server-api/share.api.ts`, unchanged signature).
2. On success, call `refreshConversations()` from `ConversationsContext`; if this refresh call rejects, the discard is still treated as successful (see next requirement) — no mutation error is surfaced and no retry is invited.
3. Show a success notification: `title={t(ConversationPanelI18nKeys.UnshareSuccessTitle)}` ("Deleted"), `message={t(ConversationPanelI18nKeys.UnshareSuccess, { name: pendingUnshareTitle })}` (`"{{name}}" was deleted from your conversations.`).
4. Close the popup (`setPendingUnshareId(null)`, clear `unshareError`, `isUnsharing = false`).
5. If the discarded conversation id matches `panelActiveConversationId` (via the existing `conversationIdsMatch` helper, same comparison already used by `handleConfirmDelete`), call `navigate(ROUTES.Root)`.

#### Scenario: Successful discard of a non-active conversation removes it from the panel and notifies

- **WHEN** `handleConfirmUnshare` succeeds for a shared-with-me conversation that is not the currently open one
- **THEN** `refreshConversations()` is called, the conversation no longer appears in the panel once the refreshed list is applied, a success notification is shown, and no navigation occurs

#### Scenario: Successful discard of the active conversation navigates to root

- **WHEN** `handleConfirmUnshare` succeeds and the discarded conversation's id matches `panelActiveConversationId`
- **THEN** the app navigates to `ROUTES.Root` after the success notification is shown

### Requirement: Refresh failure after a successful discard does not undo the success outcome

If `discardSharedCatalogItem` resolves successfully but the subsequent `refreshConversations()` call rejects, `handleConfirmUnshare` SHALL still: show the success notification, close the popup, and navigate away if the discarded conversation was active. It SHALL NOT show an error notification or leave the popup open inviting a retry of an already-completed discard. This mirrors the equivalent `catalog-unshare` requirement for `CatalogView.handleUnshare`.

#### Scenario: Refresh failure does not surface as a mutation error

- **WHEN** the discard API call succeeds but the following `refreshConversations()` call rejects
- **THEN** the popup still closes, the success notification is still shown, and no error notification appears

### Requirement: Failed discard keeps the item and shows an error

If `discardSharedCatalogItem` itself rejects (e.g. the BFF responds 403/404/429/502/503), `handleConfirmUnshare` SHALL:
- Set `unshareError` to `t(ConversationPanelI18nKeys.UnshareError, { name: pendingUnshareTitle })` (`Failed to delete "{{name}}". Please try again.`) and keep the popup open, with the error rendered inline via `role="alert"` — mirroring the existing single-conversation owner-delete flow's `handleConfirmDelete` pattern in this file (inline popup error, no separate error-title notification).
- NOT call `refreshConversations()`.
- NOT navigate away.
- Leave the conversation in the panel's list.

#### Scenario: Failed discard preserves the conversation and shows an error

- **WHEN** the discard API call rejects
- **THEN** the conversation remains visible in the panel, `refreshConversations()` is not called, no navigation occurs, and an inline error is shown in the still-open popup

### Requirement: i18n keys for the unshare flow

New keys SHALL be added to `ConversationPanelI18nKeys` (`apps/chat/src/constants/translation-keys.ts`) and `apps/chat/src/i18n/locales/en.json` under a `conversationPanel.unshare.*` namespace, matching the existing `conversationPanel.delete.*` nesting convention in this file:

| Enum member | Key | English value |
|---|---|---|
| `UnshareConfirmTitle` | `conversationPanel.unshare.unshareConfirmTitle` | `"Delete conversation?"` |
| `UnshareConfirmMessage` | `conversationPanel.unshare.unshareConfirmMessage` | `Delete "{{name}}" from your conversations? You'll need a new invitation to access it again.` |
| `UnshareSuccessTitle` | `conversationPanel.unshare.unshareSuccessTitle` | `"Deleted"` |
| `UnshareSuccess` | `conversationPanel.unshare.unshareSuccess` | `"{{name}}" was deleted from your conversations.` |
| `UnshareError` | `conversationPanel.unshare.unshareError` | `Failed to delete "{{name}}". Please try again.` |

The menu action's and confirm button's "Delete" label reuses the existing `ButtonsI18nKeys.Delete` (`buttons.delete`) rather than a new feature-scoped key, and the Cancel label reuses the existing `ButtonsI18nKeys.Cancel` (`buttons.cancel`) — both per the repo's i18n key-dedup convention (`.claude/rules/all-ts.md`). No `UnshareErrorTitle`/`UnshareLabel` keys are introduced: the failure path uses only the inline `UnshareError` message (no separate notification title), matching `handleConfirmDelete`'s existing pattern in this file. No other locale files exist in this repository today (`apps/chat/src/i18n/locales/` currently contains only `en.json`), so no additional locale files require updates as part of this change.

#### Scenario: New keys resolve via i18n

- **WHEN** `en.json` is loaded
- **THEN** `conversationPanel.unshare.unshareLabel` resolves to `"Delete"` and the remaining new keys resolve to their English values listed above

### Requirement: `libs/conversation-panel` requires no changes

`getActions` is already a host-supplied callback prop on the `ConversationPanel` component from `@epam/ai-dial-conversation-panel` (`libs/conversation-panel`); the lib renders whatever `DropdownItem[]` the host returns and has no knowledge of `sharedWithMe`, discard, or unshare semantics. This capability SHALL introduce no changes to `libs/conversation-panel` — all gating logic and API calls MUST live in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`.

#### Scenario: Lib renders whatever the host returns, unaware of unshare semantics

- **WHEN** `getActions` returns a `DropdownItem[]` that includes the new Delete/unshare action for a shared-with-me row
- **THEN** `ConversationPanel` renders it identically to any other action item, with no lib-side branching on `sharedWithMe`

### Requirement: RTL and accessibility

The unshare Delete menu item and its confirmation popup SHALL use only logical Tailwind/CSS properties, consistent with the rest of `ConversationRow`'s action menu (`placement="bottom-end"`, no physical-direction classes introduced). `IconTrashX` is symmetric and MUST NOT be flipped with `rtl:scale-x-[-1]`. The interpolated conversation title in the confirmation message uses i18next placeholder substitution (`{{name}}`), not string concatenation, so bidi rendering of mixed-direction titles is handled by the browser's Unicode bidi algorithm.

The confirmation popup is reachable and fully operable via keyboard (Tab to the Delete menu item, Enter/Space to activate, Tab to the popup's confirm/cancel buttons, Enter/Space/Escape to complete or cancel), using the same accessible dialog semantics `DialConfirmationPopup` already provides for the owner-side delete popup in this file. Any inline error text rendered inside the popup uses `role="alert"` so it is announced to assistive technology without requiring focus to move.

#### Scenario: Full flow is keyboard-operable

- **WHEN** a keyboard-only user tabs to the Delete action on a shared-with-me row, activates it with Enter, tabs to the popup's confirm button, and activates it
- **THEN** the same discard behavior occurs as with a mouse click, with no loss of keyboard focus at any step

#### Scenario: RTL layout does not change the menu item's logical position

- **WHEN** `dir="rtl"` is set on the document and the row's action menu is opened
- **THEN** the Delete action renders in the same logical position as the other menu items, and `IconTrashX` is not mirrored

### Requirement: Tests — `ConversationPanelView` unshare flow

`apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` SHALL include a `describe('ConversationPanelView — unshare (shared-with-me delete)', ...)` block covering:
- Shared-with-me row menu includes Delete; owned row does not gain the unshare Delete (its existing owner-delete action is unaffected); published-with-me-only row does not include Delete.
- Clicking Delete opens the confirmation popup without calling the discard API.
- Confirm calls `discardSharedCatalogItem` exactly once; the popup's controls are disabled while the call is pending; a second rapid confirm click does not double-call it.
- Successful confirm calls `refreshConversations()`, shows the success notification, and navigates to `ROUTES.Root` only when the discarded conversation was the active one (a second scenario asserts no navigation for a non-active conversation).
- A `refreshConversations()` rejection after a successful discard still shows the success notification and does not show an error notification.
- A rejected discard call shows the inline error, keeps the popup open, does not call `refreshConversations()`, and does not navigate.
- Cancel and Escape close the popup with no discard call in both the idle and (attempted-while-pending) states.

#### Scenario: Test suite covers the full success and failure matrix

- **WHEN** the test suite in `ConversationPanelView.spec.tsx` is run
- **THEN** all scenarios listed above pass, matching the structure already used by the existing `— delete-all header action` and `— share`/`— publish` describe blocks in the same file

# Spec: conversation-panel-header-menu

## Requirements

---

### Requirement: `ConversationPanelProps` exposes a `headerActions` slot for app-defined header controls

`ConversationPanelProps` in `libs/conversation-panel/src/models/ConversationPanel.ts` SHALL include:

```ts
headerActions?: ReactNode;
```

`ConversationPanel` in `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx` SHALL pass `headerActions` to `SidebarPanel.rightActions`.

The library SHALL NOT import API clients, server-api wrappers, app contexts, routing utilities, i18n hooks, authentication, environment variables, or feature flags. The `headerActions` value is opaque to the library.

#### Scenario: headerActions renders in the panel header

- **GIVEN** `<ConversationPanel headerActions={<button>X</button>} ... />` is rendered
- **WHEN** the panel is open
- **THEN** the button is visible in the header bar of the panel

#### Scenario: headerActions omitted — panel renders without error

- **GIVEN** `<ConversationPanel ... />` is rendered without the `headerActions` prop
- **WHEN** the panel is open
- **THEN** the panel renders normally with no error and no empty slot visible

#### Scenario: architecture guard — library does not import host integration details

- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** no import of `@epam/chat-api-client`, `apps/chat/src/server-api`, `ConversationsContext`, `ROUTES`, `useNavigate`, `useTranslation`, or `process.env` is present in any lib source file

---

### Requirement: `ConversationsContext` exposes `deleteAllConversations(): Promise<ConversationDeletionResultDto>`

`ConversationsContextType` in `apps/chat/src/context/ConversationsContext.tsx` SHALL add:

```ts
deleteAllConversations: () => Promise<ConversationDeletionResultDto>;
```

`ConversationDeletionResultDto` is imported from `'@epam/chat-api-client'`.

The implementation SHALL:
1. Call `deleteAllConversations` from `apps/chat/src/server-api/conversations.api.ts`.
2. When `result.deleted > 0 || result.alreadyAbsent > 0 || result.failed.length === 0` (any item deleted/absent, or complete success): call `refreshConversations()` to re-fetch from the server. This preserves shared and published conversations that were not deleted.
3. When `result.failed.length > 0 && result.deleted === 0 && result.alreadyAbsent === 0` (total failure): leave local state unchanged.
4. Return `result` in all cases.
5. If the API call throws: propagate the error without modifying local state.

#### Scenario: complete success re-fetches the list (preserving shared/public)

- **GIVEN** the context has 5 conversations in state (some shared or published)
- **WHEN** `deleteAllConversations()` is called and the API returns `{ requested: 5, deleted: 5, alreadyAbsent: 0, failed: [] }`
- **THEN** `refreshConversations()` is called and the list reflects remaining shared/published conversations (if any)

#### Scenario: empty bucket succeeds and re-fetches

- **GIVEN** the context has 0 conversations in state
- **WHEN** `deleteAllConversations()` is called and the API returns `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }`
- **THEN** `refreshConversations()` is called and the list remains empty

#### Scenario: partial failure triggers a server re-fetch

- **GIVEN** the context has 5 conversations
- **WHEN** `deleteAllConversations()` is called and the API returns `{ requested: 5, deleted: 3, alreadyAbsent: 0, failed: [{ id: '...', code: 'UPSTREAM_ERROR' }, { id: '...', code: 'UPSTREAM_ERROR' }] }`
- **THEN** `refreshConversations()` is called and the context list is updated to reflect the 2 remaining conversations

#### Scenario: total failure leaves local state unchanged

- **GIVEN** the context has 3 conversations
- **WHEN** `deleteAllConversations()` is called and the API returns `{ requested: 3, deleted: 0, alreadyAbsent: 0, failed: [<3 items>] }`
- **THEN** the context `conversations` array is unchanged and `refreshConversations()` is NOT called

#### Scenario: API throw propagates without modifying state

- **GIVEN** the context has 3 conversations
- **WHEN** `deleteAllConversations()` is called and the server-api call throws a network error
- **THEN** the error is re-thrown, `conversations` remains unchanged, and `setConversations` is NOT called

---

### Requirement: Conversation panel header renders an overflow trigger and "Delete all conversations" dropdown item

`ConversationPanelView` in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` SHALL:

1. Render a `DialIconButton` with `IconDotsVertical` and `aria-label={t(ConversationPanelI18nKeys.PanelActionsLabel)}` as the overflow trigger.
2. Wrap the trigger in `DialDropdown` with `placement="bottom-end"` and a single item `{ key: 'delete-all', danger: true }`.
3. Pass this node as `headerActions` to `ConversationPanel`.
4. Clicking the "Delete all conversations" item opens the confirmation popup; it does NOT call the API directly.

The `DialDropdown` is extensible — future menu items can be added to the items array without architectural changes.

#### Scenario: overflow trigger is visible and accessible

- **WHEN** `ConversationPanelView` is rendered
- **THEN** a button with accessible name matching `ConversationPanelI18nKeys.PanelActionsLabel` is present in the panel header

#### Scenario: dropdown contains exactly one item

- **WHEN** the overflow trigger is activated
- **THEN** the dropdown shows exactly one item: "Delete all conversations"

#### Scenario: clicking "Delete all conversations" opens the confirmation popup

- **WHEN** the "Delete all conversations" item is clicked
- **THEN** the `DialConfirmationPopup` becomes visible
- **AND** the API is NOT called

#### Scenario: cancelling the popup closes it without deleting

- **WHEN** the confirmation popup is open and the Cancel button or close button is clicked
- **THEN** the popup closes
- **AND** `deleteAllConversations` is NOT called
- **AND** the conversation list is unchanged

---

### Requirement: Confirmation popup prevents accidental deletion and shows loading state

The `DialConfirmationPopup` SHALL:
- Use `variant={ConfirmationPopupVariant.Danger}`.
- Display `header={t(ConversationPanelI18nKeys.DeleteAllConfirmTitle)}` and `description` containing the localized warning text.
- Display `confirmLabel={t(ConversationPanelI18nKeys.DeleteAllConfirmButton)}` and `cancelLabel={t(ButtonsI18nKeys.Cancel)}`.
- Set `isLoading={isDeletingAll}` and `disableConfirmButton={isDeletingAll}` during an in-flight request.
- Prevent the popup from being closed while `isDeletingAll` is true (cancel/close handlers return early when `isDeletingAll`).

#### Scenario: confirm button is disabled while deletion is in progress

- **WHEN** the confirm button is clicked and the API call has not yet resolved
- **THEN** the confirm button is disabled
- **AND** clicking confirm again does not issue a second API call

#### Scenario: closing the popup while deletion is in progress has no effect

- **WHEN** the API call is in flight (`isDeletingAll` is true)
- **WHEN** the cancel button or the popup close button is clicked
- **THEN** the popup remains open and `deleteAllConversations` is not called a second time

---

### Requirement: Successful deletion clears the panel and navigates to root when a conversation was open

After the API returns with `failed.length === 0`:
- The popup is closed.
- If `activeConversationId` is non-null, the app navigates to `ROUTES.ROOT`.
- No error notification is shown.

The same applies to the already-empty-bucket case (`requested: 0, deleted: 0, alreadyAbsent: 0, failed: []`).

Navigation MUST be triggered by checking `activeConversationId` directly — NOT by searching the `conversations` list for the active conversation and checking its `sharedWithMe` or `publishedWithMe` flags. The `conversations` list may reflect a post-refresh (empty) state at the point the check runs, causing a stale-closure false-negative. An ownership check is also semantically unnecessary: delete-all only deletes owned conversations, so shared/published ones remain accessible via re-navigation from root.

#### Scenario: navigation to root when active conversation is open

- **GIVEN** `activeConversationId` is set to a valid conversation ID
- **WHEN** the delete-all API call succeeds with `failed.length === 0`
- **THEN** `navigate(ROUTES.ROOT)` is called

#### Scenario: no navigation when no active conversation

- **GIVEN** `activeConversationId` is undefined
- **WHEN** the delete-all API call succeeds with `failed.length === 0`
- **THEN** `navigate` is NOT called

#### Scenario: navigation occurs even when conversations list is empty at check time

- **GIVEN** `activeConversationId` is set
- **AND** the `conversations` state is empty (post-refresh) at the time the delete-all callback runs
- **WHEN** the delete-all API call succeeds
- **THEN** `navigate(ROUTES.ROOT)` is still called

---

### Requirement: Partial failure closes the popup, shows a notification, and navigates to root

After the API returns with `failed.length > 0 && (deleted > 0 || alreadyAbsent > 0)`:
- The popup is closed.
- A `DialNotification` with `variant={NotificationVariant.Error}` is shown with text from `ConversationPanelI18nKeys.DeleteAllPartialError`.
- If `activeConversationId` is non-null, the app navigates to `ROUTES.ROOT`.
- The notification is closable and dismisses when its close button is clicked.

#### Scenario: partial failure shows a dismissable error notification

- **WHEN** the API returns `{ deleted: 2, failed: [{ code: 'UPSTREAM_ERROR' }] }`
- **THEN** the popup is closed
- **AND** a `DialNotification` with the partial-error message is displayed
- **AND** clicking the notification's close button dismisses it

---

### Requirement: Total failure keeps the popup open with an inline error

After the API returns with `failed.length > 0 && deleted === 0 && alreadyAbsent === 0`:
- The popup remains open.
- An inline error message from `ConversationPanelI18nKeys.DeleteAllError` is shown inside the popup description.
- No navigation occurs.
- No `DialNotification` is shown.
- The conversation list is unchanged.

After the API call throws (network error or server error before per-item results):
- The same inline-error behavior applies.

#### Scenario: total failure keeps the popup open

- **WHEN** the API returns `{ deleted: 0, alreadyAbsent: 0, failed: [<3 items with UPSTREAM_ERROR>] }`
- **THEN** the popup remains open
- **AND** an inline error message is visible inside the popup
- **AND** the conversation list is unchanged

#### Scenario: thrown API error shows inline error

- **WHEN** the API call throws a network error
- **THEN** the popup remains open with the inline error message
- **AND** `isDeletingAll` is reset to false so the confirm button is enabled again

---

### Requirement: i18n — all user-visible strings use translation keys

All new user-visible strings are accessed via `t()` with keys from `ConversationPanelI18nKeys`. Hardcoded English strings SHALL NOT appear in JSX or `aria-label` values in `apps/`. The `en.json` locale file provides the English defaults.

New keys:

| Key | English value |
|---|---|
| `conversationPanel.panelActionsLabel` | `"Conversation panel actions"` |
| `conversationPanel.deleteAllChatsLabel` | `"Delete all conversations"` |
| `conversationPanel.deleteAllConfirmTitle` | `"Delete All Conversations?"` |
| `conversationPanel.deleteAllConfirmDescription` | `"All conversations will be permanently deleted. This action cannot be undone."` |
| `conversationPanel.deleteAllConfirmButton` | `"Delete all"` |
| `conversationPanel.deleteAllError` | `"Failed to delete all conversations. Please try again."` |
| `conversationPanel.deleteAllPartialError` | `"Some conversations could not be deleted. The list has been refreshed."` |

#### Scenario: translation keys are present in en.json

- **WHEN** `en.json` is loaded
- **THEN** all 7 keys listed above resolve to their English values

#### Scenario: no hardcoded English in apps/ JSX

- **WHEN** `ConversationPanelView.tsx` is reviewed
- **THEN** all user-visible strings and `aria-label` values reference keys from `ConversationPanelI18nKeys` or `ButtonsI18nKeys`; no English string literals appear in JSX

---

### Requirement: RTL — dropdown placement and notification use logical positioning

- `DialDropdown` uses `placement="bottom-end"` so the menu opens at the logical end of the trigger (left in RTL, right in LTR).
- The `DialNotification` for partial error uses `start-4` (not `left-4`) in its `className`.

#### Scenario: dropdown placement is logically correct in RTL

- **WHEN** `dir="rtl"` is set on the document
- **WHEN** the overflow trigger is activated
- **THEN** the dropdown opens to the logical end of the trigger (appears on the left side)

---

### Requirement: Accessibility — keyboard, focus, and ARIA

- The overflow trigger is a native `<button>` (via `DialIconButton`) and is keyboard-focusable and activatable with Enter/Space.
- `DialDropdown` handles arrow-key navigation among items and Escape to close.
- After the dropdown closes (Escape or item selection), focus returns to the trigger.
- `DialConfirmationPopup` is a modal dialog: focus is trapped while open and restored to the trigger (or to an appropriate element) on close.
- `disableConfirmButton={isDeletingAll}` provides an accessible disabled state; the button has `disabled` attribute during in-flight requests.
- The trigger `aria-label` is translated (never hardcoded English).

#### Scenario: trigger has a translated accessible label

- **WHEN** `ConversationPanelView` renders
- **THEN** the `DialIconButton` has `aria-label` equal to `t(ConversationPanelI18nKeys.PanelActionsLabel)`

#### Scenario: keyboard navigation opens the dropdown

- **GIVEN** focus is on the overflow trigger
- **WHEN** Enter or Space is pressed
- **THEN** the dropdown opens and focus moves to the first item

---

### Requirement: Tests — `ConversationPanel` library

Tests in `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx` SHALL cover `headerActions`:

- Renders the `headerActions` node in the header when provided.
- Does not render a header slot when `headerActions` is omitted.

#### Scenario: headerActions renders provided content

- **WHEN** `<ConversationPanel headerActions={<button>Test</button>} ... />` is rendered
- **THEN** `screen.getByRole('button', { name: 'Test' })` is present

---

### Requirement: Tests — `ConversationsContext`

Tests for `deleteAllConversations` SHALL be added in a new or updated spec file co-located with the context (or in `apps/chat/src/context/tests/`). They SHALL cover:

- Complete success: `refreshConversations()` called; returned DTO has `failed.length === 0`.
- Empty bucket: same as complete success (`refreshConversations()` called).
- Partial failure: `refreshConversations` called; returned DTO has `failed.length > 0 && deleted > 0`.
- Total failure: neither `setConversations` nor `refreshConversations` is called; DTO has `deleted === 0`.
- API throw: error is propagated; state is unchanged.

---

### Requirement: Tests — `ConversationPanelView`

Tests in `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` SHALL cover:

- Overflow trigger renders with the accessible label from `PanelActionsLabel`.
- Opening the dropdown shows exactly one item.
- Clicking the item opens the confirmation popup; API is not called.
- Cancelling the popup calls neither the API nor `navigate`.
- Confirming: complete success — popup closes, `navigate(ROUTES.ROOT)` called when `activeConversationId` is set.
- Confirming: complete success with no active conversation — `navigate` not called.
- Confirming: complete success when the conversations list is empty at callback time — `navigate(ROUTES.ROOT)` is still called (guards against stale-closure regression).
- Confirming: total failure — popup stays open with inline error; list unchanged.
- Confirming: partial failure — popup closes, notification appears, `navigate` called.
- Confirming: thrown error — popup stays open with inline error.
- In-flight state: confirm button disabled after first click; second click does not issue a second call.
- Notification close button dismisses the partial-error notification.
- `isDeletingAll` resets to false after the request resolves (success or failure).
- Single delete: navigates to root when the deleted conversation is the active one.
- Single delete: does not navigate when the deleted conversation is not the active one.

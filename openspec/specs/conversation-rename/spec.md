# Spec: conversation-rename

## Requirements

### Requirement: RenameConversationPopup component renders a DialPopup with a text input and Save/Cancel actions

A `RenameConversationPopup` component SHALL be created at `apps/chat/src/components/RenameConversationPopup/RenameConversationPopup.tsx`. Its props interface `RenameConversationPopupProps` SHALL include:

```ts
interface RenameConversationPopupProps {
  open: boolean;
  currentTitle: string;
  isSaving: boolean;
  error: string | null;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}
```

The component renders a `DialPopup` with:
- `header` set to the i18n key `conversationHistory.renameTitle` ("Rename Chat")
- A single `<input>` (plain text, no label) initialised to `currentTitle`, controlled via local state
- A footer with two `DialButton`s: Cancel (`fill="none"`) and Save (`fill="solid"`, `color="primary"`)
- Save is disabled when the trimmed input value is empty, equals the trimmed `currentTitle`, or `isSaving` is true
- The input enforces a maximum of 255 characters via the native `maxLength` attribute (backend validates 255 UTF-8 bytes)
- An inline error message rendered below the input when `error` is non-null (role="alert")
- `onClose` wired to `onCancel`

When the popup opens (transitions from `open=false` to `open=true`), the input is reset to `currentTitle` and focus is placed on the input.

i18n keys:
- `conversationHistory.renameTitle` — "Rename Chat"
- `conversationHistory.renameInputPlaceholder` — "Chat name"
- `conversationHistory.renameError` — "Failed to rename. Please try again."
- `actions.save` — "Save"

#### Scenario: Popup renders with current title pre-filled

- **WHEN** the component renders with `open=true` and `currentTitle="My Chat"`
- **THEN** the text input value is "My Chat"

#### Scenario: Save button is disabled when value is unchanged

- **WHEN** the input value equals the trimmed `currentTitle`
- **THEN** the Save button has `disabled` attribute

#### Scenario: Save button is disabled when value is empty

- **WHEN** the input value is whitespace-only
- **THEN** the Save button has `disabled` attribute

#### Scenario: Save button is disabled while saving

- **WHEN** `isSaving` is true
- **THEN** the Save button has `disabled` attribute

#### Scenario: Input enforces 255 character maximum

- **WHEN** the component renders
- **THEN** the text input has `maxLength=255` (backend enforces 255 UTF-8 bytes)

#### Scenario: onSave is called with trimmed value on Save click

- **WHEN** the user types "  New Title  " and clicks Save
- **THEN** `onSave` is called with `"New Title"` (trimmed)

#### Scenario: onCancel is called on Cancel click

- **WHEN** the user clicks Cancel
- **THEN** `onCancel` is called

#### Scenario: Error message is shown when error prop is non-null

- **WHEN** `error` is `"Failed to rename. Please try again."`
- **THEN** an element with role="alert" containing that text is visible

---

### Requirement: Rename action appears in the conversation panel action menu

`ConversationPanelView` SHALL include a "Rename" action in the `DropdownItem[]` returned by `getActions`, inserted between Pin and Delete. The item uses icon `IconPencil` from `@tabler/icons-react`, label from i18n key `conversationHistory.renameLabel` ("Rename"), and `onClick` sets local state `pendingRenameItem` to `{ id: contextId, title: panelItem.title }`.

i18n keys:
- `conversationHistory.renameLabel` — "Rename"

#### Scenario: Rename action is present in the actions menu

- **WHEN** `getActions` is called for a conversation item
- **THEN** the returned array contains an item with key `"rename"`

#### Scenario: Clicking rename sets pending rename state

- **WHEN** the user clicks the Rename action for a conversation
- **THEN** `RenameConversationPopup` opens with `currentTitle` matching that conversation's title

---

### Requirement: ConversationsContext exposes renameConversation with optimistic update

`ConversationsContext` SHALL expose a `renameConversation(id: string, newTitle: string): Promise<void>` operation. Implementation:

1. Optimistically update the matching item's `title` in local state.
2. Call `PATCH /api/v1/conversations` via the server-api wrapper.
3. On success, update the item's `id` in local state to the `newPath` returned by the API.
4. On failure, revert the optimistic title update and re-throw the error.

State ownership: `ConversationsContext` — no new context state needed beyond the function exposed on the interface.

#### Scenario: Optimistic update applies immediately

- **WHEN** `renameConversation("conv-id", "New Name")` is called
- **THEN** the conversations list reflects `title: "New Name"` before the API resolves

#### Scenario: Revert on API failure

- **WHEN** the API call rejects
- **THEN** the conversations list reverts to the original title

#### Scenario: id is updated on API success

- **WHEN** the API returns `{ newPath: "conversations/bucket/model__New Name__uuid" }`
- **THEN** the item's `id` in the list is updated to match the returned path

---

### Requirement: RenameConversationPopup has unit tests

Unit tests SHALL be written at `apps/chat/src/components/RenameConversationPopup/tests/RenameConversationPopup.spec.tsx` using Vitest and @testing-library/react. Tests MUST cover the scenarios defined in the RenameConversationPopup component requirement above.

#### Scenario: Test suite covers all popup scenarios

- **WHEN** the unit test suite runs
- **THEN** it covers: pre-fill, Save disabled (unchanged), Save disabled (empty), Save disabled (saving), trimmed onSave, onCancel, error display

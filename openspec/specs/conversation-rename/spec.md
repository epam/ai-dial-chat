# Spec: conversation-rename

## Purpose

The rename popup for conversations, its entry in the action menu, and the optimistic context update behind it.

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
- A footer with two `Button`s: Cancel (`fill="none"`) and Save (`fill="solid"`, `color="primary"`)
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

#### Scenario: Trailing dot is stripped before save

- **WHEN** the user types "My Chat..." and clicks Save
- **THEN** `onSave` is called with `"My Chat"` (trailing dots removed after trimming)

#### Scenario: Dot at start or inside name is preserved

- **WHEN** the user types ".hidden" or "v1.2.chat"
- **THEN** the value is accepted as-is and `onSave` receives the value unchanged

#### Scenario: onCancel is called on Cancel click

- **WHEN** the user clicks Cancel
- **THEN** `onCancel` is called

#### Scenario: Error message is shown when error prop is non-null

- **WHEN** `error` is `"Failed to rename. Please try again."`
- **THEN** an element with role="alert" containing that text is visible

---

### Requirement: Rename action appears in the conversation panel action menu

`ConversationPanelView` SHALL include a "Rename" action in the `DropdownItem[]` returned by `getActions`, inserted between Pin and Delete. The item uses icon `IconPencil` from `@tabler/icons-react`, label from i18n key `conversationHistory.renameLabel` ("Rename"), and `onClick` sets local state `pendingRenameItem` to `{ id: contextId, title: panelItem.title }`.

On confirming a rename, `ConversationPanelView` SHALL call the context `renameConversation` and SHALL NOT navigate to a new route afterwards, because the conversation id (and therefore its route) is unchanged by the rename.

i18n keys:
- `conversationHistory.renameLabel` — "Rename"

#### Scenario: Rename action is present in the actions menu

- **WHEN** `getActions` is called for a conversation item
- **THEN** the returned array contains an item with key `"rename"`

#### Scenario: Clicking rename sets pending rename state

- **WHEN** the user clicks the Rename action for a conversation
- **THEN** `RenameConversationPopup` opens with `currentTitle` matching that conversation's title

#### Scenario: Confirming rename does not navigate

- **WHEN** the active conversation is renamed successfully
- **THEN** no navigation to a new conversation route occurs
- **AND** the current route continues to resolve to the same conversation

---

### Requirement: ConversationsContext exposes renameConversation with optimistic update

`ConversationsContext` SHALL expose a `renameConversation(id: string, newTitle: string): Promise<void>` operation. Implementation:

1. Optimistically update the matching item's `title` in local state.
2. Call `PATCH /api/v1/conversations?path=<path>` via the server-api wrapper, where `<path>` is derived from `id` (unchanged by the rename).
3. On success, reconcile the matching item's `title` with the `name` returned by the API (the server-sanitised display name). The item's `id` MUST NOT change.
4. On failure, revert the optimistic title update and re-throw the error.

Background: rename updates only the stored `name` at the existing storage path; the conversation `id` (the storage path) is immutable across renames. Because the id does not change, the pinned-conversation list requires no migration on rename.

State ownership: `ConversationsContext` — no new context state needed beyond the function exposed on the interface.

#### Scenario: Optimistic update applies immediately

- **WHEN** `renameConversation("conv-id", "New Name")` is called
- **THEN** the conversations list reflects `title: "New Name"` before the API resolves

#### Scenario: Revert on API failure

- **WHEN** the API call rejects
- **THEN** the conversations list reverts to the original title

#### Scenario: id is unchanged on API success

- **WHEN** the API returns `{ name: "New Name" }`
- **THEN** the item's `id` in the list is unchanged
- **AND** the item's `title` reflects the returned `name`

#### Scenario: Pinned state is preserved after rename without pin migration

- **WHEN** a pinned conversation is renamed successfully
- **THEN** no pin update (unpin-old / pin-new) API call is made
- **AND** the conversation remains pinned after page refresh because its id is unchanged

---

### Requirement: RenameConversationPopup has unit tests

Unit tests SHALL be written at `apps/chat/src/components/RenameConversationPopup/tests/RenameConversationPopup.spec.tsx` using Vitest and @testing-library/react. Tests MUST cover the scenarios defined in the RenameConversationPopup component requirement above.

#### Scenario: Test suite covers all popup scenarios

- **WHEN** the unit test suite runs
- **THEN** it covers: pre-fill, Save disabled (unchanged), Save disabled (empty), Save disabled (saving), trimmed onSave, onCancel, error display

---

### Requirement: Conversation name input filters prohibited characters and strips trailing dots

The conversation name input SHALL enforce the following naming conventions at the point of input, with no error message shown — invalid content is silently excluded:

- The following characters are **prohibited** and must be stripped as the user types: tab (`\t`), `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&`.
- Trailing dots (`.`) are **automatically removed** from the value before it is passed to `onSave`. Dots at the start of or inside the name are preserved.

Implementation:
- `sanitizeConversationName(name: string): string` in `apps/chat/src/utils/string-utils.ts` strips all prohibited characters using `PROHIBITED_CONVERSATION_NAME_CHARS_RE`.
- `stripTrailingDots(name: string): string` in the same file strips one or more trailing dots.
- The `onChange` handler of the input calls `sanitizeConversationName` so prohibited characters never appear in the field.
- Before calling `onSave`, the value is trimmed and then passed through `stripTrailingDots`.

#### Scenario: Prohibited characters are stripped while typing

- **WHEN** the user types any of `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&` or a tab
- **THEN** those characters are not reflected in the input value

#### Scenario: Other special symbols are allowed

- **WHEN** the user types characters such as `!`, `@`, `#`, `$`, `^`, `*`, `(`, `)`, `-`, `_`, `+`, `[`, `]`, `|`, `~`, `'`
- **THEN** those characters appear in the input and are passed to `onSave` unchanged

#### Scenario: Trailing dots are removed before save

- **WHEN** the input value is `"My Chat..."` and Save is clicked
- **THEN** `onSave` receives `"My Chat"`

#### Scenario: Dot at the start is preserved

- **WHEN** the input value is `".hidden"`
- **THEN** `onSave` receives `".hidden"`

#### Scenario: Dot inside the name is preserved

- **WHEN** the input value is `"v1.2.release"`
- **THEN** `onSave` receives `"v1.2.release"`

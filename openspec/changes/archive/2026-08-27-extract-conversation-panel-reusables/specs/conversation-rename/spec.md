## MODIFIED Requirements

### Requirement: RenameConversationPopup is a controlled component owned by `libs/conversation-panel`

A `RenameConversationPopup` component SHALL be exported from `@epam/ai-dial-conversation-panel` (see
`conversation-panel-rename-popup-ui` for its full component-level contract). Its props interface
`RenameConversationPopupProps` SHALL include:

```ts
interface RenameConversationPopupProps {
  isOpen: boolean;
  currentTitle: string;
  isSaving: boolean;
  error: string | null;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
  onGenerateWithAi: () => Promise<string>;
  labels: RenameConversationPopupLabels;
}
```

The component renders a popup with:
- A header sourced from `labels.popupTitle`
- A single text input, initialised to `currentTitle`, controlled via local state, with an
  AI-generation trigger (`onGenerateWithAi`) alongside it
- A footer with Cancel and Save actions (Save uses the primary button variant)
- Save is disabled when the trimmed, trailing-dot-stripped input value is empty, equals the trimmed
  `currentTitle`, or exceeds the 255-UTF-8-byte limit. While `isSaving` is `true`, the footer actions
  are replaced by a loading indicator.
- An inline error message (`role="alert"`) shown per the precedence rules in
  `conversation-panel-rename-popup-ui`
- `onClose` wired to `onCancel`

When the popup opens (transitions from `isOpen=false` to `isOpen=true`), the input is reset to
`currentTitle`, any prior AI-generation error is cleared, and focus is placed on the input.

`apps/chat` SHALL supply `labels` via `useTranslation`, using the
`conversationPanel.rename.*` and `buttons.*` keys, and SHALL wire `onGenerateWithAi` to its own AI-title-generation operation
(`generateConversationTitle` from `ConversationsContext`) and `onSave`/`onCancel` to its own
rename-dialog state (see the `useAsyncConfirmDialog`-based rename flow in
`chat-hooks-conversation-panel-controller`). The component itself SHALL NOT import `react-i18next`,
an application Context, or a `server-api`/generated-client module.

#### Scenario: Popup renders with current title pre-filled

- **WHEN** the component renders with `isOpen=true` and `currentTitle="My Chat"`
- **THEN** the text input value is "My Chat"

#### Scenario: Save button is disabled when value is unchanged

- **WHEN** the input value equals the trimmed `currentTitle`
- **THEN** the Save button has `disabled` attribute

#### Scenario: Save button is disabled when value is empty

- **WHEN** the input value is whitespace-only
- **THEN** the Save button has `disabled` attribute

#### Scenario: Footer actions are unavailable while saving

- **WHEN** `isSaving` is true
- **THEN** the footer actions are replaced by a loading indicator

#### Scenario: Input enforces the 255-byte maximum

- **WHEN** the trimmed, trailing-dot-stripped value's UTF-8 byte length exceeds 255
- **THEN** the Save button has `disabled` attribute and a validation message is shown

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

#### Scenario: Error message is shown when the error prop is non-null

- **WHEN** `error` is a non-null string and no higher-precedence error applies
- **THEN** an element with `role="alert"` containing that text is visible

#### Scenario: Architecture guard — component has no app dependency

- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** `RenameConversationPopup`'s source file contains no `react-i18next`, application-Context, or
  generated-client import

---

### Requirement: Rename action appears in the conversation panel action menu

`ConversationPanelView` SHALL include a "Rename" action in the `DropdownItem[]` returned by `getActions`, inserted between Pin and Delete. The item uses icon `IconPencil` from `@tabler/icons-react`, label from i18n key `conversationHistory.renameLabel` ("Rename"), and `onClick` opens the rename dialog for that conversation via the app's rename dialog state (backed by `useAsyncConfirmDialog` from `chat-hooks-conversation-panel-controller`), setting `pending` to `{ id: contextId, title: panelItem.title }`.

On confirming a rename, `ConversationPanelView` SHALL call the context `renameConversation` and SHALL NOT navigate to a new route afterwards, because the conversation id (and therefore its route) is unchanged by the rename.

i18n keys:
- `conversationHistory.renameLabel` — "Rename"

#### Scenario: Rename action is present in the actions menu

- **WHEN** `getActions` is called for a conversation item
- **THEN** the returned array contains an item with key `"rename"`

#### Scenario: Clicking rename sets pending rename state

- **WHEN** the user clicks the Rename action for a conversation
- **THEN** `RenameConversationPopup` (from `@epam/ai-dial-conversation-panel`) opens with `currentTitle` matching that conversation's title

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

### Requirement: RenameConversationPopup component tests live in `libs/conversation-panel`

Component-level unit tests SHALL be written under `libs/conversation-panel`'s test conventions using Vitest and @testing-library/react, covering the scenarios defined in `conversation-panel-rename-popup-ui`. `apps/chat/src/components/RenameConversationPopup/tests/RenameConversationPopup.spec.tsx` SHALL be replaced by a thin wiring test that renders the real component connected to the app's real save/AI-generation operations and a real `useTranslation`-backed labels object.

#### Scenario: App wiring test covers connection to real operations

- **WHEN** the app-level wiring test runs
- **THEN** it verifies the component is rendered with the app's real `onSave`/`onCancel`/`onGenerateWithAi` callbacks and a translated `labels` object, asserting at least one translated string renders

---

### Requirement: Conversation name validation and sanitization utilities live in `chat-shared`

The conversation name input SHALL enforce the following naming conventions at the point of input, with no error message shown for character stripping — invalid content is silently excluded:

- The following characters are **prohibited** and must be stripped as the user types: tab (`\t`), `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&`.
- Trailing dots (`.`) are **automatically removed** from the value before it is passed to `onSave`. Dots at the start of or inside the name are preserved.

Implementation:
- `sanitizeConversationName(name: string): string` and `stripTrailingDots(name: string): string` SHALL be exported from `@epam/ai-dial-chat-shared`'s string utilities (consolidated alongside `getUtf8ByteLength`, which already lived there). `@epam/ai-dial-chat-hooks` SHALL re-export the same names for compatibility rather than declaring a second implementation.
- The `RenameConversationPopup` component's `onChange` handler calls `sanitizeConversationName` so prohibited characters never appear in the field.
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

#### Scenario: `chat-hooks` re-exports rather than redeclares the utilities

- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `sanitizeConversationName`, `stripTrailingDots`, and `getUtf8ByteLength` resolve via a
  re-export from `@epam/ai-dial-chat-shared`, with no duplicate implementation in `chat-hooks`

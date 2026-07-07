## MODIFIED Requirements

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

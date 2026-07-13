## MODIFIED Requirements

### Requirement: Panel rows expose per-item actions (pin, rename, delete, share)

`ConversationPanel` SHALL accept `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` and `actionsLabel?: string` (English default: `"More actions"`). When `getActions` returns a non-empty array for a row, an ellipsis trigger button is rendered on that row; activating it opens a dropdown built from the returned `DropdownItem[]`. When `getActions` is omitted or returns an empty array, no trigger is rendered.

Row-level actions (pin/unpin, rename, duplicate, delete, share) are wired in `ConversationPanelView` where `ConversationsContext` supplies the mutation methods.

For owned, non-readonly conversations (`isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`), `getActions` SHALL include a `share` action (in addition to `pin`/`unpin`, `rename`, `duplicate`, `delete`) that opens `ShareConversationPopoverContainer` for the conversation. Readonly conversations (readonly, shared-with-me, or published-with-me) continue to receive only `pin`/`unpin` and `duplicate` — no `share` action is added for them.

#### Scenario: Row actions trigger renders when getActions returns items

- **WHEN** `getActions` returns a non-empty array for a row
- **THEN** an actions trigger button is visible on that row

#### Scenario: No trigger when getActions returns empty array

- **WHEN** `getActions` returns `[]` for a row
- **THEN** no actions trigger button is rendered for that row

#### Scenario: Owned conversation's action menu includes Share

- **GIVEN** a conversation row where `isReadonly`, `sharedWithMe`, and `publishedWithMe` are all `false`
- **WHEN** the row's actions trigger is activated
- **THEN** the dropdown includes a "Share" item alongside pin, rename, duplicate, and delete

#### Scenario: Readonly conversation's action menu excludes Share

- **GIVEN** a conversation row where `sharedWithMe` is `true`
- **WHEN** the row's actions trigger is activated
- **THEN** the dropdown includes only pin/unpin and duplicate; no "Share" item is present

#### Scenario: Selecting Share opens the share popover

- **GIVEN** an owned conversation row's action dropdown is open
- **WHEN** the "Share" item is clicked
- **THEN** `ShareConversationPopoverContainer` is rendered for that conversation

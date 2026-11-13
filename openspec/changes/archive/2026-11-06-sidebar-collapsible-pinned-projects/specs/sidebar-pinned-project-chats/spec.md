# Spec Delta

## ADDED Requirements

### Requirement: The app owns, persists and prunes the collapsed state of pinned projects

`usePinnedProjectsPanel` (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`) SHALL own the collapse state of the pinned projects and pass each group's `isExpanded` and the tree's `onToggleProject` to the list (see the `conversation-history-panel` capability). `libs/chat-hooks` and `libs/conversation-panel` store nothing.

**What is stored.** The ids of the projects the user collapsed are stored as a JSON string array in `localStorage` under the new `StorageKey.CollapsedPinnedProjects` (`apps/chat/src/types/storage-key.ts`), through the app's `useLocalStorage` hook. A project with no entry is expanded, so a newly pinned project is expanded and needs no write. Storage that cannot be read or written SHALL fall back to in-memory state without an error. Only a click on the chevron writes it.

**Temporary expansion.** A project SHALL also show expanded, without any write to storage, when the app revealed it:

- when the open chat changes to a chat of a collapsed project (the project id comes from the `ProjectChat` route), the project is revealed once, so the highlighted chat is visible. The reveal holds one project: opening a chat of another project replaces it, and leaving the chat routes keeps it until the page reloads. The user can collapse it again afterwards, and the reveal does not repeat until the open chat changes;
- a search that matches a chat of the project, which the list derives itself.

**Toggling.** `onToggleProject(id)` flips what the user sees. Collapsing an expanded project (stored or revealed) adds the id to the stored ids and ends its reveal. Expanding a collapsed project removes the id from the stored ids. Toggling neither navigates nor changes the active chat.

**Pruning.** The app SHALL remove from the stored ids every id that is not in `pinnedProjectIds`, and write only when at least one id was removed. The pass runs only while `projectsEnabled` is on and the user config has finished loading, because `pinnedProjectIds` is empty before that and an early pass would erase every stored id. It compares with the pins, not with the projects that loaded, so a project whose read failed keeps its state.

**Memoisation:** the adapter's `pinnedProjects` keeps its identity until a row, an `isExpanded` value, the active project or a callback changes, and its callbacks are `useCallback`s. **Gating:** `FeatureKey.ProjectsEnabled` only, as for the tree. **RTL, telemetry, cache, backend:** none beyond the list's; no BFF or OpenAPI change.

#### Scenario: A collapse survives a reload

- **GIVEN** P is expanded
- **WHEN** the user collapses P and reloads the page
- **THEN** `collapsedPinnedProjects` holds P's id and P renders collapsed

#### Scenario: An untouched project is expanded

- **WHEN** the user pins P and nothing is stored for it
- **THEN** P renders expanded and nothing is written

#### Scenario: Opening a chat of a collapsed project

- **GIVEN** P is collapsed and the user opens a chat of P from the Chats list of its page
- **THEN** P renders expanded with the chat highlighted, and the stored ids are unchanged

#### Scenario: Collapsing the project of the open chat

- **GIVEN** P was revealed for the open chat
- **WHEN** the user activates P's chevron
- **THEN** P collapses, its id is stored, and it stays collapsed until the open chat changes

#### Scenario: A stale id is pruned

- **GIVEN** the stored ids are `[P, Q]` and only P is pinned
- **WHEN** the user config has loaded
- **THEN** the stored ids become `[P]`

#### Scenario: Nothing is pruned before the user config loads

- **GIVEN** the stored ids are `[P]` and the user config is still loading
- **THEN** the stored ids stay `[P]`

#### Scenario: Unavailable storage

- **WHEN** reading or writing `localStorage` throws and the user collapses P
- **THEN** P collapses for the page session and no error is shown

## MODIFIED Requirements

### Requirement: Pinned project strings flow through react-i18next

`apps/chat` SHALL add four keys to `apps/chat/src/i18n/locales/en.json`, the only locale file, plus the matching `ConversationPanelI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`:

| Key | Enum member | English |
| --- | --- | --- |
| `conversationPanel.seeAll` | `ConversationPanelI18nKeys.SeeAll` | `See all` |
| `conversationPanel.seeAllProjectChats` | `ConversationPanelI18nKeys.SeeAllProjectChats` | `See all chats in {{name}}` |
| `conversationPanel.expandProject` | `ConversationPanelI18nKeys.ExpandProject` | `Expand project` |
| `conversationPanel.collapseProject` | `ConversationPanelI18nKeys.CollapseProject` | `Collapse project` |

The adapter passes them as the list's `seeAllLabel`, `seeAllAriaLabel`, `expandProjectLabel` and `collapseProjectLabel`. Menu items reuse `ButtonsI18nKeys.Unpin`, `Edit`, `Publish`, `Share` and `Delete`. The ⋮ trigger reuses the existing `actionsLabel` (`ButtonsI18nKeys.MoreActions`). The unread dot reuses the panel's existing unread label. No other string is added.

#### Scenario: Translated See all

- **WHEN** the UI language is not English
- **THEN** the See all row shows `t(ConversationPanelI18nKeys.SeeAll)`, and its accessible name is `t(ConversationPanelI18nKeys.SeeAllProjectChats, { name })`

#### Scenario: Translated chevron label

- **WHEN** the UI language is not English
- **THEN** the chevron's accessible name is `t(ConversationPanelI18nKeys.CollapseProject)` while its project is expanded, and `t(ConversationPanelI18nKeys.ExpandProject)` while collapsed

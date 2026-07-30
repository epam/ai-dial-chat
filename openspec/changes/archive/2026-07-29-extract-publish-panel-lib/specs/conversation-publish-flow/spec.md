## MODIFIED Requirements

### Requirement: Panel body renders a title-only resource summary instead of the catalog version pill

The scrollable body SHALL render the shared `PublishPanel` component (exported from `@epam/ai-dial-publish-panel`, not `@epam/ai-dial-catalog`) providing the destination folder picker with search, inline folder creation, no-access/submit-error callouts, and publish history list, configured with a `PublishResourceSummary` built from the conversation's title (no icon, no version) rather than a `CatalogItem`. The summary row SHALL show the conversation's title and SHALL NOT render a version pill or any `{name}__{version}`-style identifier, since conversations have no version.

Destination folder picker, search, and inline folder creation SHALL behave identically to the catalog publish flow (folder tree via `PublishFoldersTree`, bucket root selectable as `[]`, lazy-loaded children, optimistic create with rollback on failure), reusing `usePublishFolders` (the renamed, shared `useCatalogPublishFolders`).

#### Scenario: Summary row shows the conversation title with no version
- **WHEN** the publish panel opens for a conversation titled "Q3 planning notes"
- **THEN** the summary row displays "Q3 planning notes" and no version pill

#### Scenario: Folder selection and search behave as in catalog publish
- **WHEN** the user searches for a folder name and selects a matching folder
- **THEN** `selectedFolderPath` updates exactly as it would for a catalog entity publish flow

Inline folder creation SHALL also validate the new folder name identically to the catalog publish flow (see `catalog-publish-flow`'s "Inline folder creation validates the name client-side" requirement — empty name, `..`/forbidden characters, or a duplicate sibling name are all rejected client-side before `onCreatePublishFolder` is called). `PublishConversationPanelContainer` SHALL supply the validation error strings (`ConversationPublishI18nKeys.EmptyFolderNameError`, `InvalidFolderNameError`, `DuplicateFolderNameError`) via `PublishPanelTexts.createFolderEmptyNameError`/`createFolderInvalidNameError`/`createFolderDuplicateNameError`.

#### Scenario: User enters a path-traversal folder name in the conversation publish panel
- **WHEN** the user types `../EscapeFolder` into the inline create row and confirms
- **THEN** an inline validation error is shown and no publish request is sent with an invalid `folderPath`

## ADDED Requirements

### Requirement: Publish UI is imported from the shared publish-panel library, not the catalog library
`PublishConversationPanelContainer` SHALL import `StandalonePublishPanel`, `usePublishFlow`, and all `Publish*` types from `@epam/ai-dial-publish-panel`. It SHALL NOT import any symbol from `@epam/ai-dial-catalog`, since conversation publish has no relationship to catalog browsing or catalog domain models.

#### Scenario: Container imports only from the publish-panel library
- **WHEN** `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` is inspected
- **THEN** all publish-UI imports come from `@epam/ai-dial-publish-panel` and none come from `@epam/ai-dial-catalog`

# catalog-publish-flow Specification

## Purpose

Publishing a catalog entity: folder-tree destination picking, inline folder creation, access rules, and submission against real backend data.

## Requirements

### Requirement: Folder selection uses the ui-kit folder tree
The catalog publish panel SHALL present the destination-folder picker using ui-kit's `DialFoldersTree` component (`showFiles={false}`, no context menu) rendered inside the shared `PublishFoldersTree` wrapper (exported from `@epam/ai-dial-publish-panel`), instead of the bespoke `PublishFolderPicker` tree. Selection SHALL remain single-folder: selecting a new folder replaces the prior selection.

State ownership: `@epam/ai-dial-publish-panel`'s `usePublishFlow` hook (relocated from `libs/catalog/src/utils/use-publish-flow.ts`, now published as part of the shared publish-panel library) owns `selectedFolderPath`; the app-level hook `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` owns the folder-tree data (`items`, `expandedPaths`, `loadingPaths`, `loadedPaths`) and is memoised with `useMemo`/`useCallback` so `PublishPanel` does not re-render on every host render.

RTL/direction impact: the tree and search input SHALL use CSS logical properties only; `DialFoldersTree` renders its own RTL-correct chevrons and indentation internally, so no app- or lib-level directional icon mirroring is added for this requirement.

#### Scenario: User selects a destination folder
- **WHEN** the user clicks a folder node in the publish folder tree
- **THEN** that folder's path becomes `selectedFolderPath`, the tree highlights it as selected, and any previously selected folder is deselected

#### Scenario: Expanding a folder loads its children lazily
- **WHEN** the user expands a folder node that has not yet been loaded
- **THEN** `useCatalogPublishFolders` adds the folder's path to `loadingPaths`, fetches its children, and on success adds the path to `loadedPaths` and merges the children into `items`

### Requirement: The bucket root is a selectable publish destination, represented as a tree node
`selectedFolderPath: string[] | undefined` SHALL use `undefined` to mean nothing is selected and `[]` to mean the bucket root itself (e.g. the Organization/public root) is selected as the destination — `[]` is a distinct, valid selection, not a "deselected" state. Matching the file manager's own folder-tree pattern (`useDialFileManager.ts`'s root `DialFile` node), `PublishFoldersTree` SHALL represent the bucket root as a real top-level tree node (`rootLabel` prop, default `'Organization'`) wrapping the rest of the tree as its children, selectable and expandable the same way as any folder — not as a control rendered outside the tree.

The root node SHALL always render expanded so its children remain visible without an extra interaction.

#### Scenario: User selects the bucket root as the destination
- **WHEN** the user clicks the root node in the folder tree
- **THEN** `selectedFolderPath` becomes `[]`, the tree highlights the root node as selected, and any previously selected folder is deselected

#### Scenario: User deselects the bucket root
- **WHEN** the user clicks the already-selected root node again
- **THEN** `selectedFolderPath` becomes `undefined` and the root node shows as not selected

### Requirement: Search filters the folder tree client-side
The publish panel SHALL keep the existing host-owned `SearchInput` above the folder tree. Typing a query SHALL filter the currently loaded folder tree by folder name (case-insensitive, matching folder name substrings) before the filtered tree is converted to `DialFile[]` and passed to `DialFoldersTree`.

Filtering SHALL be suspended for as long as the inline create-folder row is open, and resume when creation is confirmed or cancelled. `DialFoldersTree` renders that row underneath its parent node, so a query that filters the parent out (in particular a query matching nothing at all, which renders the empty state instead of the tree) would otherwise hide the editor the user just opened.

i18n keys: `CatalogI18nKeys.PublishFolderSearchPlaceholder`, `CatalogI18nKeys.PublishFolderEmptyState`.

#### Scenario: Search query matches no folders
- **WHEN** the user types a query that matches no loaded folder name
- **THEN** the tree renders the `DialFoldersTree` empty state using `CatalogI18nKeys.PublishFolderEmptyState`

#### Scenario: User creates a folder from a search that matched nothing
- **GIVEN** the search query matches no folder, so the empty state is shown
- **WHEN** the user clicks "Create new folder"
- **THEN** the tree (with the root node) renders again with the inline create row open under the selected parent — or under the root when nothing is selected — pre-filled with the unmatched query as the new folder's name, falling back to the default name when the query is not a valid folder name

#### Scenario: User cancels folder creation started from a search that matched nothing
- **WHEN** the user cancels the inline create row
- **THEN** the filter resumes and the no-results empty state is shown again

### Requirement: Folders are displayed in name order
`PublishFoldersTree` SHALL order folders by name at every level of the tree before converting them to `DialFile[]`, using a case-insensitive, digit-aware comparison (`localeCompare` with `sensitivity: 'base'` and `numeric: true`), so `"Report 2"` precedes `"Report 10"`. Ordering is a display concern owned by the tree: hosts MAY pass `items` in any order (backend listing order, lazily merged children, locally created folders appended at the end) and the rendered order SHALL be the same either way.

#### Scenario: Backend returns folders in an arbitrary order
- **WHEN** the host passes folder nodes in listing order
- **THEN** the tree renders them alphabetically at every level

#### Scenario: A newly created folder keeps its place in the order
- **WHEN** the user confirms a new folder name
- **THEN** the folder is rendered in its name-ordered position among its siblings, not appended to the end of the list

### Requirement: Inline folder creation via the ui-kit tree
Creating a new folder SHALL use `DialFoldersTree`'s built-in inline create-folder row (`onCreateFolderSave`, `onCreateFolderCancel`, `createdFolderPath`) instead of the bespoke picker's custom create row. `PublishFoldersTree` SHALL pass the target parent folder path through `createdFolderPath` and SHALL NOT insert a synthetic new-folder node into `items`; `DialFoldersTree` owns the temporary editable row beneath that parent. On save, the app-level `onCreatePublishFolder` callback SHALL be invoked with the parent path and new folder name; the new folder SHALL be merged into the in-memory tree and auto-selected immediately.

`onCreatePublishFolder` (`apps/chat/src/hooks/publish/usePublishFolders.ts`) SHALL NOT call the backend folder-creation endpoint. The folder exists only in the client-side tree until the user actually submits Publish, at which point the real publish request writes to the nested `folderPath`; DIAL Core storage creates any missing path segments implicitly, the same way writing a file to a new prefix does. This avoids leaving an orphaned empty folder on the backend when the user picks a new-folder name and then cancels or navigates away without publishing — unlike `useDialFileManager`'s "New folder" action (File Manager), which does create a real, immediately-persisted folder resource, since that flow's whole purpose is managing folders as first-class content.

#### Scenario: User creates a new folder under the selected parent
- **WHEN** the user confirms a new folder name in the inline create row
- **THEN** `onCreatePublishFolder(parentPath, name)` is called, no backend request is sent, the new folder appears in the tree immediately, and it becomes the selected folder

#### Scenario: User cancels publish after creating a folder locally
- **GIVEN** the user created a new folder in the destination picker and selected it
- **WHEN** the user cancels the Publish panel instead of submitting
- **THEN** no folder was ever created on the backend — nothing to roll back or clean up

### Requirement: Destinations already published to stay available in the tree
Publishing creates a DIAL Core publication *request*, so a destination folder picked during publish is not a listable resource in the Organization/public files bucket the tree is built from (and never becomes one, since approved publications land in the resource type's own public namespace). `usePublishFolders` SHALL therefore expose `rememberPublishFolder(folderPath: string[])`, persisting each used destination's path key to `localStorage` under `StorageKey.PublishDestinationFolders` (most recent first, deduplicated, capped at 50 entries; the bucket root — an empty path — is not stored), and SHALL merge every remembered path into `folderItems` via `mergeFolderPaths`, creating any missing ancestor node and never duplicating a folder the public bucket already lists. Both publish hosts (`PublishConversationPanelContainer` and `CatalogView`) SHALL call it from their `onPublishSuccess` handler, so only destinations of a publish that actually succeeded are remembered.

#### Scenario: User publishes a second item to a folder created during the first publish
- **GIVEN** the user created a folder in the publish panel and published an item to it
- **WHEN** the user opens the publish panel again for another item
- **THEN** that folder is still listed in the destination tree and can be selected

#### Scenario: Publish fails
- **WHEN** `onPublish` rejects
- **THEN** the destination is not remembered

### Requirement: Per-row "Add sibling" / "Add child" folder creation
In addition to the trailing "Create new folder" button, `PublishFoldersTree` SHALL expose a per-row context menu (`DialFoldersTree`'s `getContextMenuItems` prop) with two actions: "Add child" (creates the new folder inside the clicked folder) and "Add sibling" (creates the new folder as a sibling of the clicked folder, one level up). This mirrors the file manager's own "Add sibling"/"Add child" folder-creation actions (`useFolderCreation`'s `startTreeSiblingFolderCreation`/`startTreeChildFolderCreation` internal to `@epam/ai-dial-ui-kit`'s `FileManager`, not exported from the package) — reimplemented against the tree's public context-menu API rather than importing the internal hook. "Add sibling" SHALL be omitted for the root node, which has no parent to create a sibling under. Both actions resolve a unique default name and validate exactly like the trailing button (see the two requirements above) — there is no separate code path.

#### Scenario: User adds a child folder via the context menu
- **WHEN** the user opens the context menu on a folder row and selects "Add child"
- **THEN** the inline create-folder row appears nested inside that folder, pre-filled with a unique default name

#### Scenario: User adds a sibling folder via the context menu
- **WHEN** the user opens the context menu on a non-root folder row and selects "Add sibling"
- **THEN** the inline create-folder row appears at the same level as that folder (under its parent), pre-filled with a unique default name

#### Scenario: Root node has no "Add sibling" action
- **WHEN** the user opens the context menu on the bucket root node
- **THEN** only "Add child" is offered — "Add sibling" is not, since the root has no parent

### Requirement: Inline folder creation validates the name client-side
Before invoking `onCreatePublishFolder`, `PublishFoldersTree` SHALL validate the confirmed name via `validateFolderName` (exported from `@epam/ai-dial-publish-panel`, relocated from `libs/catalog/src/utils/publish-folder-tree.ts`) and reject: an empty (post-trim) name, a name containing `..` or any of the forbidden characters `/ \ : ; , = { } &  "`, and a name duplicating a sibling folder (case-insensitive). This mirrors the backend's `IsValidFilePath` path-traversal rule so an invalid destination is rejected in the UI instead of only failing the network request. The same validator SHALL be wired as `DialFoldersTree`'s `onRenameValidate` prop, which the ui-kit also invokes for the create-folder row, so the input shows an inline error and blocks Save while invalid.

#### Scenario: User enters a path-traversal or forbidden-character folder name
- **WHEN** the user types `../EscapeFolder` (or any name containing `..` or a forbidden character) into the inline create row and confirms
- **THEN** an inline validation error is shown, `onCreatePublishFolder` is NOT called, and no folder is added to the tree

#### Scenario: User enters an empty folder name
- **WHEN** the user confirms an empty or whitespace-only name in the inline create row
- **THEN** an inline validation error is shown and `onCreatePublishFolder` is NOT called

### Requirement: Publish visibility is scoped to editable entities
The catalog Header's Publish action SHALL only be shown (`isPublishVisible`) when the current catalog item is user-owned/editable, in addition to the existing entity-type gate (Model, Toolset, Application). This is a client-side UI gate only; it does not replace server-side write-access enforcement.

#### Scenario: Non-editable entity does not show Publish
- **WHEN** the current catalog item is not user-owned/editable
- **THEN** the Header does not render the Publish action regardless of entity type

#### Scenario: Editable Model/Toolset/Application shows Publish
- **WHEN** the current catalog item is user-owned/editable and its type is Model, Toolset, or Application
- **THEN** the Header renders the Publish action

### Requirement: The submit button label never embeds the destination name
`PublishFooter`'s submit button SHALL read a fixed label (`'Publish'`, or `'Update version {version}'` when replacing an existing version) regardless of which folder or the root is selected. The destination name SHALL NOT be interpolated into the button label, since folder/entity names of arbitrary length would overflow the button.

#### Scenario: A long destination folder name is selected
- **WHEN** the user selects a destination folder or the root with an arbitrarily long name
- **THEN** the submit button still reads `'Publish'` (or the update-version label), unaffected by the destination name's length

### Requirement: Publish submission and history use real backend data
`CatalogView` SHALL call the real `onPublish`, `getPublishHistory`, and `hasPublishWriteAccess` implementations backed by `apps/chat/src/server-api` wrappers instead of mock data (`MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the mock `handlePublish`), which SHALL be deleted once parity is confirmed.

Loading/empty/error states: while history is loading, `PublishHistoryList` SHALL show a loading state; on fetch failure it SHALL show an inline error state distinct from the empty-history state.

Submit success: `CatalogView`'s `onPublishSuccess` SHALL raise its notification through `useOperationNotification` (see `entity-operation-notifications`) with the item's resolved `NotifiableEntity` and `EntityOperation.PublishRequested`, passing the entity name and the selected destination folder. The copy SHALL state that a publish request was submitted and appears once an admin approves it — the endpoint creates an admin-pending DIAL Core publication, exactly as the conversation publish flow already reports. The previous `CatalogI18nKeys.PublishSuccess*` pair (`"Published"` / `"\"{{name}}\" published to {{folder}}"`) SHALL be deleted, since it claimed an outcome the backend does not deliver.

Submit failure: `CatalogView` SHALL supply an `onPublishError` handler, threaded down as `CatalogProps.onPublishError` → `DetailsPanelProps.onPublishError` → `usePublishFlow` the same way `onPublishSuccess` already is, so a rejected publish produces an error notification in addition to the inline submit-error callout ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)). It SHALL reuse the same shared `usePublishErrorNotification` hook and shared `publish.*` i18n namespace as the conversation publish flow (see `conversation-publish-flow`), including the offline branch that swaps in `publish.networkErrorMessage` and omits `requestId`. `CatalogView` SHALL also pass the translated `publishLabels.submitError` (`publish.submitErrorCallout`), so the callout no longer renders the publish-panel library's hardcoded English default.

Accessibility: the publish history list SHALL expose `role="list"`/`role="listitem"` semantics (or equivalent list semantics already implemented) so screen readers announce entry count; the submit-error callout SHALL use `role="alert"`.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires, a success notification titled `"<Entity> publish requested"` is shown through `useOperationNotification`, its body names the entity and destination folder and states an admin must approve it, and the publish history list refreshes to include the new entry

#### Scenario: Publish notification names the entity kind
- **WHEN** a toolset is published and, separately, a prompt is published
- **THEN** the first notification reads `"Toolset publish requested"` and the second `"Prompt publish requested"`, resolved from the item's `CatalogEntityType`

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: Publish fails and the panel reports it outside the panel too
- **WHEN** the user submits a publish request and it rejects (backend error or lost connection)
- **THEN** the publish sub-view stays open with the submit-error callout, `onPublishError` receives the rejection reason, and an error notification is shown

#### Scenario: Publish history fails to load
- **WHEN** `getPublishHistory` rejects
- **THEN** `PublishHistoryList` renders an inline error state instead of an empty-history message

### Requirement: Catalog entity summary is supplied to the shared publish panel via a render-slot
`DetailsPanel` SHALL supply its entity-specific publish summary (the `EntityHeader` block plus version tag, for Applications/Toolsets/Models) to the shared `PublishPanel` (from `@epam/ai-dial-publish-panel`) via the `renderSummary?: () => ReactNode` prop, rather than passing a `CatalogItem` directly. `DetailsPanel` SHALL remain the only place in `libs/catalog` that maps a `CatalogItem` to its publish-summary rendering; `PublishPanel` itself SHALL have no knowledge of `CatalogItem` or `EntityHeader`. This is a structural/ownership change only — the rendered output (entity name, icon, version tag) SHALL be visually identical to before the move.

#### Scenario: Catalog publish sub-view still shows the entity header and version tag
- **WHEN** the user opens the publish sub-view for a versioned catalog entity (Application, Toolset, or Model)
- **THEN** the same `EntityHeader` + version-tag summary renders as before, now supplied through `DetailsPanel`'s `renderSummary` callback instead of an `item` prop

#### Scenario: PublishPanel has no compile-time dependency on CatalogItem
- **WHEN** `libs/catalog/src/components/Details/DetailsPanel.tsx` is inspected
- **THEN** it imports `PublishPanel` from `@epam/ai-dial-publish-panel` and passes `renderSummary`, and no `item: CatalogItem` prop is passed to `PublishPanel`

### Requirement: Catalog publish flow wires the shared access-rules editor and includes rules in the publish request

`DetailsPanel`'s existing `usePublishFlow` instance SHALL supply `rules`/`setRules` to its inline `PublishPanel` render (`DetailsPanel.tsx:329-366`) via the new `rules`/`onRulesChange` props, threaded down from `CatalogProps` the same way `publishFolderItems`/`publishLabels` already are — `CatalogProps` gains `ruleSourceOptions?: string[]` (host-supplied, defaulting to `[]` when absent) and `CatalogView` supplies it from `useAppConfig().config.publicationFilterSources`. `CatalogView.handlePublish` (`CatalogView.tsx:503-515`) SHALL accept the `rules` argument now supplied by `usePublishFlow.handleSubmit`'s extended `onPublish` signature and forward it to `publishCatalogEntity`, which SHALL include it in the request body sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`).

#### Scenario: Rules entered in the details panel reach the publish call
- **GIVEN** the user has added one rule (`source: 'title'`, `function: 'EQUAL'`, `targets: ['Internal Tools']`) and selected a destination folder for an application
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `rules` array contains exactly that one rule

#### Scenario: No rules added sends an empty array
- **GIVEN** the user has not added any rules
- **WHEN** the user clicks Publish for a toolset
- **THEN** `publishCatalogEntity` is called with `rules: []`, identical to today's behavior

#### Scenario: Same rules section appears for applications and toolsets
- **WHEN** the Publish sub-view opens inside `DetailsPanel` for an Application and, separately, for a Toolset
- **THEN** the same access-rules section renders identically in both cases, since `PublishPanel` has no entity-type-specific branching for this section

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

`DetailsPanel`'s `usePublishFlow` instance SHALL be supplied an `onFetchExistingRules` option — a thin call to the same `apps/chat/src/server-api/publish-rules.api.ts`'s `getPublishRules(folderPath)` used by the conversation flow — passed down through `CatalogProps` from `CatalogView` (or supplied directly by `DetailsPanel` if threading through `Catalog` is unnecessary; decided at implementation time, matching however `onCreatePublishFolder` is currently threaded). For applications and toolsets, choosing a destination folder replaces the rules editor's contents with that folder's already-configured rules (or empties it, if none).

#### Scenario: Selecting a folder with prior rules pre-fills the editor for an application
- **GIVEN** the user opens the Publish sub-view for an application and selects a destination folder that already has a configured rule
- **WHEN** the lookup resolves
- **THEN** the rules editor shows that existing rule as a chip, without the user having entered it

#### Scenario: A rules-lookup failure does not block the catalog publish flow
- **GIVEN** the user selects a destination folder for a toolset and the rules lookup fails
- **THEN** folder selection, manual rule entry, and the Publish submit action all remain fully usable; only the pre-fill did not occur

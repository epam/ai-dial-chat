## ADDED Requirements

### Requirement: Folder selection uses the ui-kit folder tree
The catalog publish panel SHALL present the destination-folder picker using ui-kit's `DialFoldersTree` component (`showFiles={false}`, no context menu) rendered inside `libs/catalog`'s `PublishFoldersTree` wrapper, instead of the bespoke `PublishFolderPicker` tree. Selection SHALL remain single-folder: selecting a new folder replaces the prior selection.

State ownership: `libs/catalog/src/utils/use-publish-flow.ts` (`usePublishFlow`) owns `selectedFolderPath`; the new app-level hook `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` owns the folder-tree data (`items`, `expandedPaths`, `loadingPaths`, `loadedPaths`) and is memoised with `useMemo`/`useCallback` so `PublishPanel` does not re-render on every host render.

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

i18n keys: `CatalogI18nKeys.PublishFolderSearchPlaceholder`, `CatalogI18nKeys.PublishFolderEmptyState`.

#### Scenario: Search query matches no folders
- **WHEN** the user types a query that matches no loaded folder name
- **THEN** the tree renders the `DialFoldersTree` empty state using `CatalogI18nKeys.PublishFolderEmptyState`

### Requirement: Inline folder creation via the ui-kit tree
Creating a new folder SHALL use `DialFoldersTree`'s built-in inline create-folder row (`onCreateFolderSave`, `onCreateFolderCancel`, `createdFolderPath`) instead of the bespoke picker's custom create row. On save, the app-level `onCreatePublishFolder` callback SHALL be invoked with the parent path and new folder name; on success the newly created folder SHALL be optimistically merged into the tree and auto-selected, matching current `usePublishFlow` optimistic-create behavior.

#### Scenario: User creates a new folder under the selected parent
- **WHEN** the user confirms a new folder name in the inline create row
- **THEN** `onCreatePublishFolder(parentPath, name)` is called, the new folder appears in the tree immediately (optimistic), and it becomes the selected folder once creation succeeds

#### Scenario: Folder creation fails
- **WHEN** `onCreatePublishFolder` rejects
- **THEN** the optimistically added folder is removed from the tree and the existing submit-error callout mechanism (`derivePublishState`) surfaces the failure

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

Accessibility: the publish history list SHALL expose `role="list"`/`role="listitem"` semantics (or equivalent list semantics already implemented) so screen readers announce entry count; the submit-error callout SHALL use `role="alert"`.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires, a success notification is shown via `CatalogI18nKeys.PublishSuccess*`, and the publish history list refreshes to include the new entry

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: Publish history fails to load
- **WHEN** `getPublishHistory` rejects
- **THEN** `PublishHistoryList` renders an inline error state instead of an empty-history message

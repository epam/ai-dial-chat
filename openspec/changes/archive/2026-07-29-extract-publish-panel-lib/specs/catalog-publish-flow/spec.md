## MODIFIED Requirements

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

### Requirement: Inline folder creation validates the name client-side
Before invoking `onCreatePublishFolder`, `PublishFoldersTree` SHALL validate the confirmed name via `validateFolderName` (exported from `@epam/ai-dial-publish-panel`, relocated from `libs/catalog/src/utils/publish-folder-tree.ts`) and reject: an empty (post-trim) name, a name containing `..` or any of the forbidden characters `/ \ : ; , = { } &  "`, and a name duplicating a sibling folder (case-insensitive). This mirrors the backend's `IsValidFilePath` path-traversal rule so an invalid destination is rejected in the UI instead of only failing the network request. The same validator SHALL be wired as `DialFoldersTree`'s `onRenameValidate` prop, which the ui-kit also invokes for the create-folder row, so the input shows an inline error and blocks Save while invalid.

#### Scenario: User enters a path-traversal or forbidden-character folder name
- **WHEN** the user types `../EscapeFolder` (or any name containing `..` or a forbidden character) into the inline create row and confirms
- **THEN** an inline validation error is shown, `onCreatePublishFolder` is NOT called, and no folder is added to the tree

#### Scenario: User enters an empty folder name
- **WHEN** the user confirms an empty or whitespace-only name in the inline create row
- **THEN** an inline validation error is shown and `onCreatePublishFolder` is NOT called

## ADDED Requirements

### Requirement: Catalog entity summary is supplied to the shared publish panel via a render-slot
`DetailsPanel` SHALL supply its entity-specific publish summary (the `EntityHeader` block plus version tag, for Applications/Toolsets/Models) to the shared `PublishPanel` (from `@epam/ai-dial-publish-panel`) via the `renderSummary?: () => ReactNode` prop, rather than passing a `CatalogItem` directly. `DetailsPanel` SHALL remain the only place in `libs/catalog` that maps a `CatalogItem` to its publish-summary rendering; `PublishPanel` itself SHALL have no knowledge of `CatalogItem` or `EntityHeader`. This is a structural/ownership change only — the rendered output (entity name, icon, version tag) SHALL be visually identical to before the move.

#### Scenario: Catalog publish sub-view still shows the entity header and version tag
- **WHEN** the user opens the publish sub-view for a versioned catalog entity (Application, Toolset, or Model)
- **THEN** the same `EntityHeader` + version-tag summary renders as before, now supplied through `DetailsPanel`'s `renderSummary` callback instead of an `item` prop

#### Scenario: PublishPanel has no compile-time dependency on CatalogItem
- **WHEN** `libs/catalog/src/components/Details/DetailsPanel.tsx` is inspected
- **THEN** it imports `PublishPanel` from `@epam/ai-dial-publish-panel` and passes `renderSummary`, and no `item: CatalogItem` prop is passed to `PublishPanel`

## ADDED Requirements

### Requirement: Save-to-folder panel components are exported
`@epam/ai-dial-publish-panel` (`libs/publish-panel/src/index.ts`) SHALL export:

- `SaveToFolderPanel` (body) and `StandaloneSaveToFolderPanel` (`SideDrawer` shell with a pinned Cancel/Save footer);
- the models `SaveToFolderPanelProps`, `SaveToFolderPanelLabels`, `SaveToFolderPanelColors`, `FolderDestination` (`{ rootKey: string; path: string[] }`) and `FolderDestinationRoot` (`{ key: string; label: string; items: PublishFolderNode[]; canCreateFolders?: boolean }`);
- the string enum `SaveVersionMode` (`Keep = 'keep'`, `New = 'new'`).

The components SHALL take every user-visible string from `labels`, with English defaults. Every color SHALL come from `colors`, applied as `var(--publish-panel-x, fallback)` in their `.module.scss`. Typography comes from `*ClassName` props whose defaults are kit `dial-*-text` classes.

The components SHALL know no resource ids, REST paths, i18n, routing or storage. The host supplies:

- the summary `resource`, `roots`, the committed `destination` and `onDestinationChange`;
- `onCreateFolder(rootKey, parentPath, name)`;
- optional version props: `versionMode`, `onVersionModeChange`, `currentVersion`, `newVersion`, `onNewVersionChange`, `newVersionError`;
- `isSubmitting`, `isSubmitDisabled`, `onSubmit` and `onClose`.

The version section renders only when `version` (`SaveToFolderVersionProps`) is provided. `StandaloneSaveToFolderPanel` owns the view state (`SaveToFolderView`: `Main`, `ChangeFolder`) and the pending Change-view destination, and renders the per-view header (the kit `SideDrawer`'s `onBack` in the Change view) and footer (Save, or Select). `SaveToFolderPanel` is the controlled body: it takes `view`, `pendingDestination`, `onPendingDestinationChange` and `onChangeFolderClick`.

The main view shows the committed destination as the kit `FolderName` (the path joined with " / ", `destinationClassName` defaulting to `dial-small-semi-text`, color `destinationText`) followed by a small ghost Change button. When `accessRules` (`SaveToFolderAccessRulesProps`) is passed and the pending destination belongs to a root with `hasAccessRules`, `PublishAccessRules` renders below the tree in the Change view; the shell reports the pending destination through `onPendingDestinationChange`, including the reset to `destination` on entering and leaving that view, so the host can load that folder's rules.

#### Scenario: Unversioned host
- **WHEN** a host renders `SaveToFolderPanel` without `versionMode`
- **THEN** no Version section is rendered

#### Scenario: Change view commits on Select only
- **WHEN** the user selects a folder in the Change view
- **THEN** `onDestinationChange` is not called until Select is pressed, and is never called when Back or Cancel is pressed

#### Scenario: No history or dependencies
- **WHEN** `SaveToFolderPanel` renders
- **THEN** it renders no publish history and no dependencies list

### Requirement: PublishFoldersTree supports multiple roots
`PublishFoldersTree` SHALL accept optional `roots?: FolderDestinationRoot[]`, `destination?: FolderDestination` and `onDestinationChange?: (destination: FolderDestination | undefined) => void`. When `roots` is given:

- the tree renders one always-expanded top-level node per root, in order;
- each root node and every folder under it is selectable;
- search filters all roots, and inline creation targets the root the parent belongs to, using the same validation as the single-root mode;
- arrow-key navigation moves across root boundaries;
- a root with `canCreateFolders: false` offers no create actions.

When `roots` is absent, `items` / `rootLabel` / `selectedPath` / `onSelectedPathChange` SHALL behave exactly as before.

#### Scenario: Selecting a folder under the second root
- **WHEN** the tree has roots `personal` and `organization` and the user clicks `organization › EPAM › Delivery`
- **THEN** `onDestinationChange` receives `{ rootKey: 'organization', path: ['EPAM', 'Delivery'] }`

#### Scenario: Single-root callers are unchanged
- **WHEN** the Catalog Publish panel renders `PublishFoldersTree` with `items` and `rootLabel` only
- **THEN** it renders and selects exactly as before this change

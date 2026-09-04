# file-manager-tree-state Specification

## Purpose

Ownership of `expandedPaths` and `loadedPaths` in `useDialFileManager`, and the tree header i18n it passes down.
## Requirements
### Requirement: useDialFileManager owns expandedPaths and loadedPaths

`useDialFileManager` SHALL expose `expandedPaths: Set<string>` and `loadedPaths: Set<string>` as controlled tree state passed to `DialFileManager`. `useDialFileListing` SHALL own `expandedPaths` state and SHALL derive `loadedPaths` from the shared per-folder listing cache for the union of outer-tree expanded paths and destination-popup-observed paths.

`useDialFileManager` SHALL expose `onExpandedPathsChange(paths: Set<string>) => void`. When this callback is called with a new set of paths:
1. For each path whose API path is absent from the listing cache, the hook SHALL fetch the children using the active tab's listing function unless the same API path is already loading or its last expansion failed without a subsequent collapse.
2. Fetched children SHALL be stored in the per-folder `Map` cache, including an empty array for a successful empty listing.
3. A candidate path SHALL be present in `loadedPaths` exactly when its API path is present in the cache.
4. `expandedPaths` SHALL be updated to match the new `Set`.

Destination-popup-observed paths SHALL preserve the exact `DialFile.path` representation supplied by File Manager, including the trailing slash on non-root folders. When the active tab changes, the cache, `expandedPaths`, and destination-popup candidate/loading paths SHALL reset, causing derived `loadedPaths` to become empty.

State ownership: `useDialFileListing` owns `expandedPaths`, destination-popup candidate/loading paths, and the listing cache; `loadedPaths` is a `useMemo` derivation. Feature flag: none. RTL: none — the existing File Manager tree renders the directional disclosure icon. Memoisation: `onExpandedPathsChange` SHALL use `useCallback`, and `loadedPaths` SHALL use `useMemo`. Accessibility: no new controls or roles; the disclosure icon SHALL reflect whether a loaded folder has valid children. Observability: none. Cache: the existing per-tab, per-folder cache has no TTL and is invalidated by existing mutation invalidation or a tab switch.

#### Scenario: Expanding an unloaded folder fetches children

- **WHEN** the user expands a folder whose API path is absent from the listing cache
- **THEN** the hook fetches the folder's children from the injected `DialFilesApi`
- **AND** adds the children to the per-folder cache
- **AND** includes the exact path in `loadedPaths`
- **AND** the folder appears expanded in the tree

#### Scenario: Expanding an already-loaded folder uses cache

- **WHEN** the user expands a folder whose API path is already present in the listing cache
- **THEN** no new listing request is made
- **AND** children from the cache are displayed immediately

#### Scenario: Collapsing a folder does not evict cache

- **WHEN** the user collapses a previously expanded folder
- **THEN** the path is removed from `expandedPaths` but its listing remains in the cache
- **AND** re-expanding includes the path in `loadedPaths` and displays cached children without a new request

#### Scenario: Destination popup exposes a successfully loaded empty folder

- **WHEN** the destination popup successfully lists a non-root folder as `items: []`
- **THEN** the folder's exact trailing-slash path is present in `loadedPaths`
- **AND** File Manager renders the folder without a visible disclosure caret

#### Scenario: Tab switch resets tree state

- **WHEN** the user switches to a different tab
- **THEN** `expandedPaths`, destination-popup candidate/loading paths, and the listing cache are reset
- **AND** derived `loadedPaths` is empty and the tree on the new tab starts fully collapsed

### Requirement: DialFileManagerShell passes tree header i18n via treeOptions

`DialFileManagerShell` SHALL pass `treeOptions` to `DialFileManager` with a localized header title per active tab, resolved by the host and supplied through `labels.treeHeaderByTab`. Only My Files carries a header string of its own; the other tabs reuse the label already shown in the tab selector rather than duplicating a key.

i18n keys for tree headers:
- My Files: `dialFileManager.myFiles.treeHeader` (`"Folder tree"`)
- Shared: `dialFileManager.tab.shared` (`"Shared with Me"`)
- Organization: `basic.organization`
- Review: the empty string — that tab renders no tree panel

There are no `dialFileManager.shared.treeHeader` or `dialFileManager.organization.treeHeader` keys, and none SHALL be added: a second key holding the tab's own wording would drift from the selector it is meant to match.

**Where the header is visible.** `treeOptions.header` reaches the kit's `CollapsibleSidebar` as its `title`, and that component renders the title **only while the sidebar is collapsed**, as vertical text on the 48px rail. An expanded tree panel therefore shows no header text at all — by design, not by omission. This is a deliberate design-system decision: the expanded panel is already identified by the tree it contains and by the active tab above it, and a header row would cost content height on the narrowest layouts. The header exists to keep the collapsed rail identifiable.

A consequence worth stating, since it looks like a defect from the outside: asserting that the header string appears in the DOM of an expanded tree panel will always fail, and the region will instead repeat the active tab's name from the tab selector and the panel's surrounding chrome. Any check on the header must collapse the sidebar first.

Should the expanded panel ever need a visible header, that is a change to `CollapsibleSidebar` in `@epam/ai-dial-ui-kit` — the kit exposes no other slot above the tree — and not something the shell can arrange on its own.

RTL: `DialFileManager` ui-kit component handles tree layout direction; no host-level RTL handling required.
Memoisation: `treeOptions` object in `useMemo` keyed on active tab.

#### Scenario: Collapsed tree rail shows the tab-specific label

- **WHEN** the My Files tab is active and the tree sidebar is collapsed
- **THEN** the collapsed rail displays the value of `dialFileManager.myFiles.treeHeader`

#### Scenario: Collapsed rail label updates on tab switch

- **WHEN** the tree sidebar is collapsed and the user switches from My Files to Shared
- **THEN** the rail label updates to the value of `dialFileManager.tab.shared`

#### Scenario: Expanded tree panel renders no header text

- **WHEN** the tree sidebar is expanded on any tab
- **THEN** no header row renders above the tree, and the header string for that tab appears nowhere in the panel

### Requirement: DialFileManagerShell forwards destination-popup tree state

`DialFileManagerShell` SHALL pass `loadedPaths` and `folderPopupLoadingPaths` to `DialFileManager` as `treeOptions.loadedPaths` and `treeOptions.loadingPaths`, respectively. It SHALL compare the selected destination path to `folderPopupLoadingPaths` using the same exact `DialFile.path` representation.

State ownership remains in `useDialFileListing`; the shell SHALL act only as the app-level adapter to `@epam/ai-dial-react-file-manager`. Feature flag: none. i18n: no new keys. RTL: none. Memoisation: `treeOptions` SHALL be memoized with both sets as dependencies. Accessibility: no new interactive surface; forwarded state SHALL make existing loading and disclosure affordances accurate. Observability: none.

#### Scenario: Pending popup folder state reaches File Manager

- **WHEN** a destination folder's exact path is present in `folderPopupLoadingPaths`
- **THEN** `DialFileManagerShell` passes that set as `treeOptions.loadingPaths`
- **AND** treats the same selected path as loading for destination confirmation state

#### Scenario: Loaded popup folder state reaches File Manager

- **WHEN** a destination folder's exact path is present in `loadedPaths`
- **THEN** `DialFileManagerShell` passes that set as `treeOptions.loadedPaths`

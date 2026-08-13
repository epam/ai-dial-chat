# file-manager-tree-state Specification

## Purpose

Ownership of `expandedPaths` and `loadedPaths` in `useDialFileManager`, and the tree header i18n it passes down.

## ADDED Requirements

### Requirement: useDialFileManager owns expandedPaths and loadedPaths

`useDialFileManager` SHALL maintain `expandedPaths: Set<string>` and `loadedPaths: Set<string>` as hook state. These SHALL be passed to `DialFileManager` as controlled props.

`useDialFileManager` SHALL expose `onExpandedPathsChange(paths: string[]) => void`. When this callback is called with a new set of paths:
1. For each path in `paths` that is NOT in `loadedPaths`, the hook SHALL fetch the children of that path using the active tab's listing function.
2. Fetched children SHALL be stored in the per-folder `Map` cache (reusing the existing cache mechanism).
3. The path SHALL be added to `loadedPaths` once the fetch succeeds.
4. `expandedPaths` SHALL be updated to match the new `paths` array.

When the active tab changes, `expandedPaths` and `loadedPaths` SHALL be reset to empty sets (children are lazily re-fetched on next expand).

State ownership: `useDialFileManager` hook — `expandedPaths` and `loadedPaths` are `useState`.
Feature flag: none.
RTL: none — tree expand/collapse icons are handled by `DialFileManager` ui-kit component; no additional mirroring needed in the host.
Memoisation: `onExpandedPathsChange` in `useCallback`; `expandedPaths` and `loadedPaths` Sets passed through without transformation.

#### Scenario: Expanding an unloaded folder fetches children

- **WHEN** user expands a folder that is not in `loadedPaths`
- **THEN** the hook fetches the folder's children from the BFF
- **AND** adds the children to the per-folder cache
- **AND** adds the path to `loadedPaths`
- **AND** the folder appears expanded in the tree

#### Scenario: Expanding an already-loaded folder uses cache

- **WHEN** user expands a folder that is already in `loadedPaths`
- **THEN** no new BFF request is made
- **AND** children from the cache are displayed immediately

#### Scenario: Collapsing a folder does not evict cache

- **WHEN** user collapses a previously expanded folder
- **THEN** the path is removed from `expandedPaths` but remains in `loadedPaths`
- **AND** re-expanding shows cached children without a new BFF request

#### Scenario: Tab switch resets tree state

- **WHEN** user switches to a different tab
- **THEN** `expandedPaths` and `loadedPaths` are reset to empty sets
- **AND** the tree on the new tab starts fully collapsed

---

### Requirement: DialFileManagerShell passes tree header i18n via treeOptions

`DialFileManagerShell` SHALL pass `treeOptions` to `DialFileManager` with a localized header title per active tab using `dialFileManager.*` i18n keys. The tree header SHALL use the same tab-label keys already used for the tab selector to avoid key duplication.

i18n keys for tree headers:
- My Files: `dialFileManager.myFiles.treeHeader`
- Shared: `dialFileManager.shared.treeHeader`
- Organization: `dialFileManager.organization.treeHeader`

RTL: `DialFileManager` ui-kit component handles tree layout direction; no host-level RTL handling required.
Memoisation: `treeOptions` object in `useMemo` keyed on active tab.

#### Scenario: Tree header shows tab-specific label

- **WHEN** the My Files tab is active and the tree panel is visible
- **THEN** the tree header displays the value of `dialFileManager.myFiles.treeHeader`

#### Scenario: Tree header updates on tab switch

- **WHEN** user switches from My Files to Shared tab
- **THEN** the tree header updates to the value of `dialFileManager.shared.treeHeader`

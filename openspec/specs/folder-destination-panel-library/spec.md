# folder-destination-panel-library Specification

## Purpose

`libs/folder-destination-panel` (`@epam/ai-dial-folder-destination-panel`) owns the destination folder tree and the side panel that shows an item next to the hierarchy of folders it can go to, so features other than publishing can use them.

## Requirements

### Requirement: The folder tree and destination panel live in their own library

`libs/folder-destination-panel/src/index.ts` SHALL export `FolderDestinationTree`, `FolderDestinationPanel`, `FolderDestinationPanelBody`, the folder helpers (`sortFolderTree`, `filterFolderTree`, `toFolderPathKey`, `fromFolderPathKey`, `validateFolderName` and the rest listed in its README) and the `FolderNode`, `FolderDestination` and `FolderDestinationRoot` types. `libs/publish-panel` SHALL depend on it as a regular dependency and SHALL NOT own a copy of the tree. A library that is not about publishing SHALL import the tree and panel from this library, never from `libs/publish-panel`. The package is a regular dependency of `libs/publish-panel`, which re-exports its helpers, and an optional peer of `@epam/ai-dial-chat-hooks`, whose file-manager entry point uses its types; a host that imports it directly installs it once, because the publish-panel dependency is a workspace placeholder that publishing rewrites to the same release.

#### Scenario: Publish panel renders the shared tree

- **WHEN** `PublishPanel` renders its destination picker
- **THEN** it renders `FolderDestinationTree` from `@epam/ai-dial-folder-destination-panel`

### Requirement: The panel renders its own primary button from a host-supplied action

`FolderDestinationPanel` SHALL render the primary button of its main view from `action` (`label`, optional `busyLabel`, `onClick`, optional `isDisabled`). The button SHALL show `busyLabel` (defaulting to `label`) and be disabled while `isSubmitting` is true, and SHALL be disabled when `action.isDisabled` is true. The panel SHALL NOT decide what the destination means; the host runs the copy, move, save or publish in `action.onClick`.

#### Scenario: Action is disabled by the host

- **WHEN** the panel renders with `action.isDisabled` true
- **THEN** its primary button is disabled

### Requirement: Host content fits around the folder picker through slots

`FolderDestinationPanel` SHALL render `mainSections` in the main view below the destination, and SHALL call `renderFolderViewFooter` with the pending destination to render content below the tree in the folder view. The library SHALL NOT know what that content is; `libs/publish-panel` uses the slots for its version choice and access rules.

#### Scenario: Footer receives the pending destination

- **WHEN** the user picks a folder in the folder view and `renderFolderViewFooter` is provided
- **THEN** it is called with that pending destination and its result renders below the tree

---

### Requirement: The tree is a standalone destination picker

`FolderDestinationTree` SHALL render `DialFoldersTree` from `@epam/ai-dial-react-file-manager` (a peer of this library, which is why the picker depends on the file manager package) with folders only. It SHALL:

- order folders by name at every level (case-insensitive, digit-aware), whatever order the host passes `items` in;
- in single-root mode render the bucket root as a selectable top-level node labelled `rootLabel` (default `'Root'`), where the path `[]` is the root itself and `undefined` means nothing is selected; in multi-root mode (`roots`) render one top-level node per root and report selection as a `FolderDestination`;
- keep every root open unless `collapsibleRoots` is set; with it the user can collapse and expand each root, roots start expanded, a search expands them again (a toggle made while a search is active is not remembered), and a root's own key is never reported to the host as a folder;
- offer folder creation through a trailing button and a per-row context menu ("Add child", and "Add sibling" except on a root), only under roots whose `canCreateFolders` is not `false`;
- validate a new name with `validateFolderName` (non-empty, no `..` or forbidden characters, not a sibling's name, not its parent's name, case-insensitive), show the error inline and ignore the save that a press on the inline Cancel button raises;
- suspend filtering while the inline create row is open, and open the editor under a parent listed in `loadingPaths` only once that parent leaves it.

The publish wiring of these rules (`onCreatePublishFolder`, `PublishPanel` labels) is specified in [catalog-publish-flow](../catalog-publish-flow/spec.md); this requirement owns the tree itself.

#### Scenario: Roots can be collapsed

- **WHEN** `collapsibleRoots` is set and the user clicks the expand toggle of an open root
- **THEN** the root collapses, its key is not reported through `onExpandedPathsChange`, and clicking it again reopens it

#### Scenario: A new folder may not take its parent's name

- **WHEN** the user adds a folder under `reports` and types `reports`
- **THEN** the editor shows the same-as-parent error and does not save

---

### Requirement: The panel has a Steps layout and an Inline layout

`FolderDestinationPanel` SHALL take `layout`. `FolderDestinationLayout.Steps` (default) SHALL show a main view with the committed destination and a Change action, and a folder view with Back, search, the tree and a Cancel / Select footer; a folder picked in the folder view SHALL be pending until Select commits it through `onDestinationChange`, and `onPendingDestinationChange` SHALL report the pending folder, including the reset to the committed one on entering and leaving the view. `FolderDestinationLayout.Inline` SHALL show the item, the heading, the search and the tree in the one main view, with no Change, Back or Select; a pick SHALL be the destination and SHALL be reported through `onDestinationChange` only, and `onPendingDestinationChange` SHALL NOT be called. Clearing the selection in the Inline layout SHALL keep the previous destination. In the Inline layout only the tree SHALL scroll; the item summary, heading and search SHALL stay visible.

A host that needs to react to a pick therefore uses `onDestinationChange` in the Inline layout and `onPendingDestinationChange` in the Steps layout.

#### Scenario: Inline pick is the destination

- **WHEN** the panel is Inline and the user picks `Files / archive`
- **THEN** `onDestinationChange` receives that destination and `onPendingDestinationChange` is not called

#### Scenario: Steps pick waits for Select

- **WHEN** the panel is in Steps and the user picks a folder, then presses Back
- **THEN** `onDestinationChange` is not called and `onPendingDestinationChange` reports the committed destination again

---

### Requirement: The library carries no publish knowledge except one host flag

The library SHALL NOT know publishing, saving, copying or moving. Its root model SHALL carry `FolderDestinationRoot.hasAccessRules` only as a host flag that the library never reads, because `@epam/ai-dial-publish-panel` needs it round-tripped on the roots it passes in. Its stylesheet variables SHALL use the `--fdt-` (tree) and `--fdp-` (panel) prefixes, and no default label SHALL name a publishing concept.

#### Scenario: Default root label is neutral

- **WHEN** the single-root tree renders without `rootLabel`
- **THEN** the root node reads `Root`

---

### Requirement: The panel is the destination UI for the file manager's request callback

`@epam/ai-dial-react-file-manager` ships no Copy or Move destination UI; it calls the host's `onDestinationRequest` with a `DialDestinationRequest`. The host SHALL show `FolderDestinationPanel` in the `FolderDestinationLayout.Inline` layout for that request, driven by `useFileManagerDestination` from `@epam/ai-dial-chat-hooks` (`libs/chat-hooks/src/files/useFileManagerDestination/useFileManagerDestination.ts`), whose `onDestinationChange` commits a pick. The hook derives the opening destination and the expanded path from the items, so items that arrive after the request are honoured, and it preloads whichever folder is the destination, including the one the panel opens on. The host keys the panel by request so a new request never inherits the previous one's picks. The callback API exists in the file manager release that follows `0.4.1` (its changelog entry "Copy/Move destination UI is the host's"); the manifests still declare `^0.4.1` and SHALL be raised to that release when it is published.

#### Scenario: Copy uses the shared panel

- **WHEN** the user starts Copy in the file manager
- **THEN** the host renders `FolderDestinationPanel` and calls `request.confirm` with the chosen folder's virtual path

---

### Requirement: Publish does not yet use the shared panel

`@epam/ai-dial-publish-panel` SHALL build its Save flow (`StandaloneSaveToFolderPanel`) on `FolderDestinationPanel`. Its Publish flow (`PublishPanel` and `StandalonePublishPanel` in `libs/publish-panel/src/components/PublishPanel/`) still owns its own drawer and its main and change-folder views (`PublishPanelView`), and shares only `FolderDestinationTree`. The two panels therefore duplicate the layout; moving Publish onto `FolderDestinationPanel`, with its callout, author and access rules supplied as `mainSections`, is open work.

#### Scenario: Publish renders the shared tree only

- **WHEN** `PublishPanel` renders its change-folder view
- **THEN** it renders `FolderDestinationTree` inside its own drawer, not `FolderDestinationPanel`

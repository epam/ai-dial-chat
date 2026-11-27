## ADDED Requirements

### Requirement: The folder model and tree are derived from catalog items

`libs/catalog/src/types/catalog-folders.ts` SHALL define:

- the string enum `CatalogFolderRootKind` with the members `Personal` (`'personal'`), `Shared` (`'shared'`) and `Organization` (`'organization'`);
- `CatalogFolderRoot { kind: CatalogFolderRootKind; label: string }`;
- `CatalogFolderSelection { root?: CatalogFolderRootKind; path: string[] }`, where no `root` means All entities.

`@epam/ai-dial-catalog` SHALL export them from its root entry point.

`libs/catalog/src/utils/catalog-folders.ts` SHALL export these pure functions, which never read storage, routes, translations or feature flags.

`getCatalogItemFolderPath(item, roots)` returns `{ root, path }`:

- `root` is `Personal` when `item.isMyApp`, else `Shared` when `item.sharedWithMe`, else `Organization`.
- `path` is `item.folder.slice(1)` when `item.folder[0]` equals the label of that root in `roots`. Otherwise it is `item.folder`.

`buildCatalogFolderTree(items, roots)` returns one node per root, in the order of `roots`:

- Each node is `{ id, label, root, path, children }`.
- Every root renders, even with no items under it.
- Below each root, the folders are the distinct prefixes of the item paths, sorted with `localeCompare`.
- `id` joins the root kind and the `encodeURIComponent`-ed path segments with `/`.
- Items whose root is missing from `roots` add no node.

`filterByFolder(items, selection, roots)`:

- keeps every item when `selection.root` is undefined;
- otherwise keeps the items whose root equals `selection.root` and whose path starts with `selection.path`.

`isFolderSelectionValid(selection, tree)`:

- returns `true` for All entities;
- returns `true` for a selection that names an existing node;
- returns `false` otherwise.

Memoisation: every component that calls `buildCatalogFolderTree` SHALL wrap the call in `useMemo` keyed on the items and the roots.

#### Scenario: Subfolders nest under their root

- **WHEN** the items have the folders `['Organization', 'Design Assets']`, `['Organization', 'Design Assets', 'Icons']` and `['Organization', 'Clients']`, and no `isMyApp` or `sharedWithMe` flags
- **THEN** the Organization node has the children "Clients" and "Design Assets", and "Design Assets" has the child "Icons"

#### Scenario: Empty roots still render

- **WHEN** no item is personal
- **THEN** the tree still has a Personal node with no children

#### Scenario: A folder selection keeps its subfolders

- **WHEN** `filterByFolder` runs with `{ root: Organization, path: ['Design Assets'] }`
- **THEN** it keeps the items in "Design Assets" and in "Design Assets › Icons", and drops the items in "Clients", Personal and Shared

#### Scenario: A configured item without a root label goes under Organization at its own path

- **WHEN** an item that is neither mine nor shared has `folder: []`
- **THEN** `getCatalogItemFolderPath` returns `{ root: Organization, path: [] }`

### Requirement: Catalog and Toolbar accept controlled folder props

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain:

- `folderRoots?: CatalogFolderRoot[]`, which defaults to `DEFAULT_CATALOG_FOLDER_ROOTS`: Personal "Personal", Shared "Shared with me", Organization "Organization", from `libs/catalog/src/constants/catalog-folders.ts`;
- `folderSelection?: CatalogFolderSelection`;
- `onFolderSelectionChange?: (selection: CatalogFolderSelection) => void`.

`Catalog` SHALL use `folderSelection ?? internalSelection`, with the internal default `{ path: [] }`. On every pick it SHALL update its internal state and call `onFolderSelectionChange`.

`Catalog` SHALL filter in this order: sort, search, topics, folder (`filterByFolder`), then tab. `totalCount` is the count after the last step.

`ToolbarProps` (`libs/catalog/src/models/toolbar-props.ts`) SHALL carry `folderTree`, `folderSelection`, `onFolderSelectionChange` and `folderLabels`, and `Catalog` SHALL pass them to `Toolbar` and to `renderToolbar`.

`Catalog` SHALL NOT read browser storage.

#### Scenario: Uncontrolled Catalog starts at All entities

- **WHEN** `Catalog` renders without `folderSelection`
- **THEN** every item is listed and the heading reads "All entities"

#### Scenario: Picking a folder notifies the host

- **WHEN** the user picks Organization › Design Assets and `onFolderSelectionChange` is supplied
- **THEN** it is called with `{ root: 'organization', path: ['Design Assets'] }`, and only items in that folder or its subfolders are listed

### Requirement: The title row shows All entities, a Folders control and breadcrumbs

`TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) SHALL render `CatalogFolderHeader` (`libs/catalog/src/components/Toolbar/Rows/CatalogFolderHeader.tsx`) in its first row, followed by `FoldersButton` (`libs/catalog/src/components/FoldersButton/FoldersButton.tsx`).

When `browseHeaderRenderer` is supplied, it replaces `CatalogFolderHeader`. `FoldersButton` still follows it.

The heading:

- With All entities selected, `CatalogFolderHeader` renders `ItemHeader` with `title` and `totalCount`. The default `title` changes from 'Browse' to 'All entities'.
- With a folder selected, it renders the kit `Breadcrumbs`:
  - The items are All entities, the root label, then each `path` segment.
  - Every segment except the last is an `onClick` that selects that level. The All entities segment selects `{ path: [] }`.
  - The trail is named by `folderLabels.breadcrumb`, and `overflowAriaLabel` is `folderLabels.showHiddenSegments`.
  - `maxVisibleItems` is `3` below 768px (the kit minimum: root, ellipsis, current folder) and the kit default from 768px.
  - The count follows the trail, styled like the `ItemHeader` postfix.

`FoldersButton`:

- From 768px it renders the kit `Button` labelled `folderLabels.button`, with a trailing `IconChevronDown` that turns 180° while open. It sits inside a kit `Dropdown` with `DropdownOverlayRole.Dialog`, named by `folderLabels.tree`, with `matchReferenceWidth={false}` and `placement="bottom-start"`. The overlay is at most 700px tall and never taller than the available height, and `CatalogFolderTree` scrolls inside it.
- Below 768px (`useIsPhone`) it renders a round `GhostIconButton` with `IconChevronDown`, named by `folderLabels.button` and carrying `aria-haspopup="dialog"` and `aria-expanded`. The button opens a kit `BottomSheet` titled `folderLabels.button` that holds `CatalogFolderTree`.
- Picking a row SHALL apply the selection, close the popover or sheet, and return focus to the trigger. Escape, and a press outside the popover, close it without changing the selection.

This layout SHALL apply wherever `Catalog`'s built-in toolbar renders, including the selector-mode pickers in `apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`, `apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx` and `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`.

RTL impact:

- The title row is a flex row with logical gaps, so it mirrors under `dir="rtl"`.
- The `Breadcrumbs` separator is mirrored by the kit.
- The chevron on the Folders control points down and is not mirrored.

#### Scenario: The default heading reads All entities with a Folders button

- **WHEN** the Catalog renders at 1280px with 512 items and no folder selected
- **THEN** the heading reads "All entities" with the count 512, followed by a "Folders" button

#### Scenario: A selected folder shows a breadcrumb trail

- **WHEN** Organization › Design Assets is selected and 24 items match
- **THEN** a navigation named "Folder path" lists "All entities", "Organization" and "Design Assets", with "Design Assets" as `aria-current="page"` and the count 24 after it

#### Scenario: A breadcrumb segment navigates up

- **WHEN** the user activates "Organization" in the trail
- **THEN** the selection becomes `{ root: 'organization', path: [] }`

#### Scenario: The phone trail collapses its middle

- **WHEN** Organization › Clients › Design Assets is selected at a 375px viewport
- **THEN** the trail shows "All entities", an ellipsis button named "Show hidden path segments" and "Design Assets"

The kit draws at least three segments, so a trail of three segments (All entities › Organization › Design Assets) is shown in full.

#### Scenario: The phone opens a Folders sheet

- **WHEN** the user taps the round folders button at a 375px viewport
- **THEN** a bottom sheet titled "Folders" opens with the folder tree, and picking "Personal" closes it and lists only personal items

### Requirement: CatalogFolderTree is an accessible tree

`CatalogFolderTree` (`libs/catalog/src/components/CatalogFolderTree/CatalogFolderTree.tsx`) SHALL:

- render a `role="tree"` named by `folderLabels.tree`;
- make its first `treeitem` "All entities" (`aria-level="1"`), with the roots beneath it at level 2 and each subfolder one level deeper;
- give a row with children a pointer-only caret (keyboard users expand with the arrow keys) that toggles `aria-expanded` without selecting. The caret is `IconChevronDown` turned −90° when collapsed and +90° under RTL (`-rotate-90 rtl:rotate-90`), so it points toward the inline end in both directions. On the `mobile` layout the caret's hit area is at least 44×44px and each row is at least 44px tall;
- mark the selected row with `aria-selected="true"` and the `rowSelectedBackground` colour;
- use a single roving tab stop: ArrowDown and ArrowUp move between visible rows, ArrowRight expands a collapsed row or moves to its first child, ArrowLeft collapses an expanded row or moves to its parent, Home and End jump to the first and last row, and Enter and Space select;
- on mount, expand every ancestor of the current selection and focus the selected row;
- take its colours from `FolderTreeColors` (`rowHoverBackground`, `rowSelectedBackground`) as `var(--cat-folder-tree-*, fallback)` in `CatalogFolderTree.module.scss`, set with `buildCssVars`;
- take its row typography from a `rowClassName` prop that defaults to `'dial-small-text'`.

#### Scenario: Keyboard expands and selects a subfolder

- **WHEN** focus is on "Organization", collapsed, and the user presses ArrowRight, then ArrowDown, then Enter
- **THEN** Organization expands, focus moves to its first child, and that child becomes the selection

#### Scenario: Opening reveals the current selection

- **WHEN** the tree opens with Organization › Design Assets selected
- **THEN** Organization is expanded and "Design Assets" has focus and `aria-selected="true"`

### Requirement: CatalogPickerModal offers the same folder navigation

`CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`) and the `AddOnCatalogModal` that wraps it SHALL accept an optional `folderRoots`. They keep the folder selection in local state, starting at All entities.

The heading row SHALL render the `labels.catalog` heading, or the breadcrumb trail with `labels.catalog` as its first segment while a folder is selected, followed by `FoldersButton`.

`CatalogItemsQuery` (`libs/catalog/src/utils/catalog-filter.ts`) SHALL replace `isMyOnly` with `folder?: CatalogFolderSelection` and add `folderRoots?: CatalogFolderRoot[]`. `filterCatalogItemsByQuery` applies `filterByFolder` where it applied the "My" filter.

`CatalogPickerModalLabels` SHALL drop `from`, `my`, `clear` and `apply`, and gain `folders?: Partial<CatalogFolderLabels>`.

#### Scenario: A picker narrows to a folder

- **WHEN** the user opens Folders in an Add-toolset picker and picks Personal
- **THEN** only personal toolsets are listed and the heading row shows the trail "Toolsets catalog › Personal"

### Requirement: The folder texts are host-supplied with English defaults

`CatalogFolderLabels` (`libs/catalog/src/models/catalog-folders.ts`) SHALL carry `allEntities`, `button`, `tree`, `breadcrumb` and `showHiddenSegments`.

`DEFAULT_CATALOG_FOLDER_LABELS` SHALL supply "All entities", "Folders", "Folders", "Folder path" and "Show hidden path segments".

`CatalogTitles.folders?: Partial<CatalogFolderLabels>` SHALL override them field by field. A non-empty `CatalogTitles.browseTitle` also sets `allEntities`.

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL pass:

- the translation key `catalog.allEntities` ("All entities") as `browseTitle`;
- the translation keys `catalog.folders.button` ("Folders"), `catalog.folders.treeLabel` ("Folders"), `catalog.folders.breadcrumbLabel` ("Folder path") and `catalog.folders.showHiddenSegments` ("Show hidden path segments");
- `folderRoots` labelled with the existing translation keys `catalog.folder.personal`, `catalog.folder.shared` and `catalog.folder.public`, the same labels `buildDeploymentFolderLabels` gives the item folders.

`CatalogView` SHALL omit the Personal root while `OverlayFeature.CatalogHideMyApps` is on.

Feature flag: none. The folders control is always shown. `CatalogHideMyApps` only drops the Personal root.

#### Scenario: Hidden personal apps hide the Personal root

- **WHEN** `OverlayFeature.CatalogHideMyApps` is on
- **THEN** the folder tree lists only "Shared with me" and "Organization" under "All entities"

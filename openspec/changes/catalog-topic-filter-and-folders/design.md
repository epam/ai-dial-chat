## Context

The Catalog browse header lives in `libs/catalog`. Its pieces:

- `Toolbar` → `TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) renders the title, the search, the view toggle and sort, and either the desktop `Filter` (`libs/catalog/src/components/Filter/Filter.tsx`) or, below 768px, `BrowseSettingsSheet`.
- `Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) owns the filter pipeline: sort → search → topics → "My" → tab. Every value works both controlled and uncontrolled.
- `CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`) has its own header. It runs the same pipeline through `filterCatalogItemsByQuery` (`libs/catalog/src/utils/catalog-filter.ts`).
- `apps/chat/src/components/CatalogView/CatalogView.tsx` is the only `Catalog` host. It renders the page itself and, with `isSelectorMode`, three pickers: Change agent (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`), prompts (`apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx`) and skills (`apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`). Outside selector mode, sort, topics and "My" are persisted by `useCatalogSortFilterPreference` and reconciled by `useCatalogItems`.

Every `CatalogItem` already carries a translated folder path in `folder`. For example, `['Personal', 'drafts']`, `['Shared with me', …]` or `['Organization', 'Design Assets']`, as produced by `resolveDeploymentFolder` / `resolveToolsetFolder` / `resolvePromptFolder` / `resolveSkillFolder` in `libs/chat-hooks/src/catalog/`. The items also carry the flags `isMyApp` and `sharedWithMe`.

## Goals / Non-Goals

**Goals:**

- Implement the four Figma frames from issue #10031 on desktop, tablet and phone.
- Give the page and every picker one shared set of components.
- Keep the lib host-agnostic. The host decides which roots exist and how they are labelled, and whether the selection persists.

**Non-Goals:**

- Listing empty DIAL Core folders, or loading the tree lazily.
- Changing the folder mapping in `libs/chat-hooks`.
- Deep links, or folder state in the URL.

## Decisions

### D1. The folder model is lib types plus a host-supplied root list

New file `libs/catalog/src/types/catalog-folders.ts`:

```ts
export enum CatalogFolderRootKind {
  Personal = 'personal',
  Shared = 'shared',
  Organization = 'organization',
}

/** A top-level node under "All entities"; `label` is the host's translated text. */
export interface CatalogFolderRoot {
  kind: CatalogFolderRootKind;
  label: string;
}

/** `undefined` root = All entities. `path` = subfolders below the root, outermost first. */
export interface CatalogFolderSelection {
  root?: CatalogFolderRootKind;
  path: string[];
}
```

- **Root membership** comes from the item flags: `isMyApp` → Personal, else `sharedWithMe` → Shared, else Organization.
- **Subpath:** `folder.slice(1)` when `folder[0]` equals the label of the item's root. Otherwise it is the whole `folder`, which covers configured models with a raw or empty path.
- `getCatalogItemFolderPath(item, roots)` holds this logic in one place. An item whose root is not in `folderRoots` matches only All entities. This is how a hidden Personal root behaves while `CatalogHideMyApps` is on: the host has already removed those items.
- `folderRoots` defaults to all three kinds with the English labels "Personal", "Shared with me" and "Organization". Roots always render, even when empty. The user can then pick Personal and see the personal empty state, which replaces the old "My" behaviour.
- *Alternative rejected:* deriving the root from `folder[0]` alone. The label is translated and can differ between hosts, and the Personal empty state needs a stable kind.

### D2. The tree is derived by a pure, memoized helper

- `buildCatalogFolderTree(items, roots): CatalogFolderNode[]` returns `{ id, label, root, path, children }[]`. Children are sorted with `localeCompare`; roots keep the host's order.
- `id` is `root + '/' + path.join('/')` with each segment `encodeURIComponent`-ed, so a `/` inside a name cannot collide.
- Callers wrap it in `useMemo` on `[items, folderRoots]`. Hidden items (`isHidden`) count toward the tree, as they do for `getTopicOptions`.
- `filterByFolder(items, selection, roots)` keeps an item when its root matches and the selection's `path` is a prefix of the item's subpath. `{ path: [] }` with no root keeps every item.
- `isFolderSelectionValid(selection, tree)` lets the host reconcile a stale persisted folder.
- The tree is built from the whole `items` set, before search, topics and tab, so it does not shift while the user types or filters. The count shown next to the title or breadcrumb is the existing `totalCount`: the list after every filter.

### D3. Folder state follows the existing controlled/uncontrolled pattern

- `Catalog` reads `folderSelection ?? internalFolderSelection` and calls `onFolderSelectionChange` on every pick, the same way it handles `filterTopics`.
- In the pipeline, the folder filter takes the place of the "My" step: sort → search → topics → **folder** → tab.
- `CatalogPickerModal` keeps the folder in local state, as it does topics, and accepts an optional `folderRoots`.
- `CatalogItemsQuery` replaces `isMyOnly: boolean` with `folder?: CatalogFolderSelection` and gains `folderRoots?`.

### D4. The topic filter applies immediately and is icon-only

- `Filter` is rewritten:
  - The trigger is a kit `GhostIconButton` (`ElementSize.Large`, `IconFilter`). Its name is `triggerLabel` ("Filter by topic"). It carries `aria-haspopup="dialog"`, `aria-expanded`, and a decorative dot while topics are applied. The dot reuses the `--cat-browse-settings-dot` colour token through a new `FilterColors.activeDot` (`--cat-filter-active-dot`).
  - The overlay stays a kit `Dropdown` with `DropdownOverlayRole.Dialog`. Its header row holds the "Topics" heading (`dial-tiny-lead-semi-text`, uppercase via token) and a `LinkButton` "Clear all", enabled only while topics are applied.
  - Below the header, a `role="menu"` list holds `menuitemcheckbox` rows with roving focus, kept from today's code. Each click calls `onChange(toggleTopic(...))` straight away.
  - The pending state, the effect that syncs it, the footer and `getFilterButtonLabel` / `getFromLabel` are deleted.
  - The kit `Dropdown` already closes on an outside press and on Escape, returning focus to the trigger.
- The component is not split into a new one, because `Filter` has no other consumers outside the lib. The prop removals are listed as **BREAKING** in the README.
- *Alternative rejected:* keeping the buffered mode behind a prop. Nothing uses it, and it doubles the test matrix.

### D5. Applied-topic tags

- New `AppliedTopicTags` (`libs/catalog/src/components/AppliedTopicTags/AppliedTopicTags.tsx`) renders nothing while no topic is applied. Otherwise it renders a `role="group"` named by `appliedTagsLabel`.
- Inside, one kit `Tag` per applied topic, closable, with its remove button named `formatRemoveTagLabel(topic)`. The topics are sorted the same way as in the list.
- From `CLEAR_ALL_TAG_THRESHOLD = 3` tags up, a trailing kit `LinkButton` "Clear all" follows.
- Removing a tag moves focus to the next tag, or to the previous one, or to the filter trigger when none is left. Focus never falls to `body`.
- The tags render in `TitleRow` below the search row, on every breakpoint, and in `CatalogPickerModal` below its search row.

### D6. Folders control and breadcrumbs

New components:

- `CatalogFolderTree` (`libs/catalog/src/components/CatalogFolderTree/CatalogFolderTree.tsx`) follows the `ContentFileTree` pattern:
  - The root is `role="tree"` with nested `role="group"`. Every row is a `role="treeitem"` with `aria-level`, `aria-expanded` (folders with children only) and `aria-selected`.
  - The tree has one roving tab stop. Up/Down move between rows, Right expands or enters a folder, Left collapses or moves to the parent, Home/End jump to the ends, and Enter/Space select. A caret button toggles expansion without selecting.
  - "All entities" is the first row, at level 1, and the roots sit under it at level 2. This matches the design.
  - When the tree opens, the ancestors of the current selection are expanded and the selected row takes focus.
- `FoldersButton` (`libs/catalog/src/components/FoldersButton/FoldersButton.tsx`):
  - From 768px it renders a kit `Button` (accent text "Folders" plus a chevron that rotates while open) inside a `Dropdown` with `DropdownOverlayRole.Dialog`. The overlay has `max-h-[700px]` plus `calc(var(--fui-available-height) - 8px)` as in today's `Filter`, so the tree scrolls inside the overlay.
  - Below 768px (`useIsPhone`) it renders a round icon `GhostIconButton` (`IconChevronDown`, named by `labels.button`), which opens a kit `BottomSheet` titled `labels.button` with the same tree.
  - Picking a row calls `onChange` and closes the popover or sheet, and focus returns to the trigger.
- The title area becomes `CatalogFolderHeader` (`libs/catalog/src/components/Toolbar/Rows/CatalogFolderHeader.tsx`):
  - With no folder selected, it renders `ItemHeader` with the title "All entities" (`browseTitle`) and the count.
  - With a folder selected, it renders kit `Breadcrumbs`: All entities › root label › …path. Every segment before the last is an `onClick` back to that level. The trail is named by `labels.breadcrumb`, and `overflowAriaLabel` is `labels.showHiddenSegments`. `maxVisibleItems` is the kit default from 768px and `3` below, which gives the "All entiti… › … › Design Assets" of the phone frame once the trail has four or more segments. The kit never draws fewer than three, so a three-segment trail stays whole. The count sits after the trail.
  - `FoldersButton` follows in both cases. `browseHeaderRenderer` still replaces the heading, and the Folders button still renders after it.
- *Alternative rejected:* reusing the file-manager folder tree from `@epam/ai-dial-react-file-manager`. It would add a heavy dependency, and it carries create/rename affordances the catalog does not want.

### D7. Labels and theming

New `CatalogFolderLabels`, exported, with English defaults in `DEFAULT_CATALOG_FOLDER_LABELS` (`libs/catalog/src/constants/catalog-folders.ts`):

| Field | Default |
|---|---|
| `allEntities` | "All entities" |
| `button` | "Folders" |
| `tree` | "Folders" |
| `breadcrumb` | "Folder path" |
| `showHiddenSegments` | "Show hidden path segments" |

Root labels come from `folderRoots`.

Filter label changes:

- `CatalogTitles` gains `folders?: Partial<CatalogFolderLabels>`, `filterLabel` ("Filter by topic"), `filterClearAllLabel` ("Clear all"), `formatRemoveTopicLabel` (`` (t) => `Remove ${t}` ``) and `appliedTopicsLabel` ("Applied topics").
- `BrowseSettingsSheetLabels` drops `myApps`, `clear` and `apply`, and gains `clearAll`.

Colours:

- New `*Colors` fields: `FolderTreeColors.rowHoverBackground` / `rowSelectedBackground` (fallbacks `--bg-control-accent-alpha-hover` / `--bg-control-accent-alpha-active`) and `FoldersButtonColors.label` (`--text-accent`).
- Each is set with `buildCssVars` in a `.module.scss`. No colour is hard-coded in JSX.

### D8. Host wiring (`apps/chat`)

- **`useCatalogSortFilterPreference`:**
  - removes `isMyAppsActive` and `setIsMyAppsActive`;
  - adds `folderSelection` and `setFolderSelection`, backed by `useLocalStorage<unknown>(StorageKey.CatalogFolderSelection, null)`;
  - validates the stored value with a pure `parseCatalogFolderSelection` (`apps/chat/src/hooks/useCatalogSortFilterPreference/parse-catalog-folder-selection.ts`). It accepts a known root kind, or none, and a `string[]` `path`; anything else gives All entities. It sits in the app because it is a storage concern, not a DIAL Core one;
  - calls `localStorage.removeItem('catalogIsMyAppsActive')` once inside a guarded effect, so the dead key is cleaned up.
- **`useCatalogItems`** returns `reconciledFolderSelection`. It falls back to All entities when the persisted path no longer exists in `buildCatalogFolderTree(visibleCatalogItems, folderRoots)`, and is memoized.
- **`CatalogView`:**
  - builds `folderRoots` with `useMemo` from `buildDeploymentFolderLabels(t)` (Personal, Shared, Organization = `catalog.folder.public`), dropping Personal while `isCatalogHideMyAppsEnabled`;
  - passes `folderSelection` and `onFolderSelectionChange` only outside selector mode;
  - translates every new label;
  - sets `browseTitle` to `t(CatalogI18nKeys.AllEntities)`.
- `getCatalogMyAppsEmptyTitle` keeps its name and texts. Only its trigger moves to the lib (spec `catalog-personal-empty-state`).

## Risks / Trade-offs

- [Breaking lib API: removed props and label fields] → The lib version stays 0.0.1 per repo policy. The only host is in-repo. The README lists the replacements.
- [Users who had "My" on lose it after the upgrade] → It is one click to pick Personal. Accepted by the product decision to remove "My".
- [Folder labels that differ from `folder[0]` (configured items with raw paths)] → Membership by flags plus the whole-path fallback in `getCatalogItemFolderPath`, with unit tests for each mapping branch.
- [Large organizations make the tree long] → The popover is capped at 700px and the tree scrolls inside it. Rows are plain buttons, about 100 at most in practice. Virtualisation is a follow-up if needed.
- [Immediate apply re-filters on each click] → The pipeline is memoized per step already, and each toggle is one `Set` copy.
- [Breadcrumb plus Folders button can overflow on tablet] → `Breadcrumbs` truncates segments with tooltips. The button is `shrink-0`.

## Migration Plan

1. Land the lib changes and the host wiring in one PR, since the host is in-repo and the API break must stay atomic.
2. The old storage key is removed on first load. There is no data migration.
3. Rollback: revert the PR. The reverted build reads no `catalogIsMyAppsActive`, so "My" starts off, and the `catalogFolderSelection` key is ignored.

## Open Questions

- None blocking. Persistence, the tree source and the picker scope were confirmed with the user. If design later wants empty DIAL Core folders, D2's helper is the seam where host-supplied extra nodes could merge in.

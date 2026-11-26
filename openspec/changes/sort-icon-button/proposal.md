## Why

Every list page draws its sort control as a labelled ghost dropdown ("↑↓ Newest ▾", "Recently Updated ▾"). The label repeats what the list already shows, takes toolbar width the search field needs, and each lib builds the same trigger in its own way. The design for [issue #10032](https://github.com/epam/ai-dial-chat/issues/10032) replaces it with one icon button (`IconArrowsSort`) at the trailing end of the search row on Projects, Scheduled tasks, Catalog, the File manager and the "Change agent" window. On Catalog pages it also moves the Grid/List view switcher out of the title row to sit next to the search field.

## Problem

- Four hand-rolled `ButtonDropdown` sort triggers exist, and each names itself after the applied order:
  - `libs/projects/src/components/Projects/Projects.tsx:249`
  - `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx:362`
  - `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx:263`
  - `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx:417`

  Each copy carries the same `activeSortLabel` fallback and the same `sortItems` mapping.
- On Catalog (and in the "Change agent" window, `apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`, which renders the same `Catalog` toolbar), the view toggle and the sort sit in the title row, far from the search and filter they work with.
- The File manager's labelled "Sort" trigger comes from `DialFileManagerSortDropdown` in the sibling package `@epam/ai-dial-react-file-manager` (`FileManagerSortDropdown.tsx:151`). The chat passes no `sortOptions`, so the trigger and its menu always show the package's English defaults.

## Solution

- Add one shared `SortMenuButton` to `@epam/ai-dial-chat-shared`, which all three feature libs already peer. It is a kit `Dropdown` wrapped around a ghost `IconButton` with `IconArrowsSort` and a tooltip. Its accessible name is the static sort label ("Sort"), and its menu marks the applied option with the trailing check, as today. `DialFileManagerSortDropdown`'s `iconOnly` branch (`FileManagerSortDropdown.tsx:130`) already proves the `Dropdown` + `IconButton` pattern.
- Replace the four `ButtonDropdown` triggers with it.
- In the Catalog `TitleRow`, move the `SegmentedControl` and the sort button from row 1 into the search row. From 768px up the search row reads `search | view toggle | sort | filter`. Below 768px nothing changes: the browse-settings sheet still holds view, sort and filter.
- In `@epam/ai-dial-react-file-manager` (sibling repo, released as a package), draw the non-compact trigger as the same ghost icon button. The compact view keeps its tinted circle. Then bump the package here, and have `DialFileManagerShell` forward translated sort labels.
- Re-anchor the onboarding tour targets that today find a sort trigger by the applied option's name (`apps/chat/src/components/OnboardingHints/onboarding-targets.ts:397`, `:554`). They will find the trigger by the static sort label instead.

## What Changes

- New `SortMenuButton` component and its types in `libs/chat-shared` (export, README, JSDoc).
- `Projects`, `ScheduledTasks`, the catalog `TitleRow` and `CatalogPickerModal` render `SortMenuButton` in place of the labelled dropdown. No public prop is added or removed. Projects drops the redundant `role="group"` wrapper around its sort trigger, because the button now carries the same name.
- Catalog desktop/tablet layout: row 1 holds only the title (or `browseHeaderRenderer`). The view toggle and sort move into the search row, before `Filter`.
- **BREAKING (visual / accessible name only):** the sort trigger is named "Sort" and no longer shows the applied order. The applied order stays visible in the opened menu (`aria-checked`). Tests and onboarding anchors that matched the trigger by the option's name change.
- File manager: package release with an icon-only default trigger, a version bump in the root `package.json` and `libs/chat-shared/package.json`, and translated sort labels.

## Non-goals

- The catalog `Filter` trigger ("From ▾") stays a labelled button. The screenshot draws it as an icon, but the issue asks only for the sort and view controls. That would be a follow-up.
- No sorting logic, sort keys, option lists or persistence change (`catalog-sort-filter-persistence` is untouched).
- The phone layouts (the catalog browse-settings sheet, the Projects small size, the Scheduled tasks hide-on-search-focus) keep their current behaviour, apart from the trigger becoming an icon.

## Alternatives considered

- **Restyle each `ButtonDropdown` in place** (an icon-only `ButtonDropdown` with no label). Rejected: the kit's `Button` takes its accessible name from `label` and overrides `aria-label` (`TitleRow.tsx:175`), so an empty label leaves the button unnamed. It would also keep four copies.
- **A per-lib `SortIconButton`.** Rejected: it is the same 40 lines three times, and they would drift. `chat-shared` is already a peer of every consumer, so this adds no install cost.
- **Name the trigger "Sort: Newest".** Rejected: it needs a new formatter label in every lib and host, and the label-in-name rule then ties the tooltip to a changing string. The menu already exposes the selection.

## Capabilities

### New Capabilities

- `sort-menu-button`: the shared icon-only sort trigger in `@epam/ai-dial-chat-shared`. It covers the accessible name, tooltip, menu marking, sizes and theming.

### Modified Capabilities

- `projects-page-ui`: the toolbar's sort control is the icon-only `SortMenuButton`.
- `scheduled-tasks-page-ui`: the toolbar's sort control is the icon-only `SortMenuButton`. The `aria-expanded` and selected-option requirement still holds.
- `catalog-mobile-browse-settings`: from 768px the view toggle and the icon-only sort sit in the search row, not next to the Browse title.
- `catalog-add-on-picker`: the picker's sort control is the icon-only `SortMenuButton`.
- `chat-shared-file-manager-ui`: `DialFileManagerShell` forwards translated sort labels, and the File manager's sort trigger is icon-only.

## Impact

- **Libs:**
  - `libs/chat-shared`: new component and export.
  - `libs/projects`, `libs/scheduled-tasks`, `libs/catalog`: call sites and the TitleRow layout.
  - `libs/chat-shared/src/file-manager/DialFileManagerShell`: forwards the sort labels.

  None of them gains host knowledge. Strings arrive through the existing `sortLabel` / `labels.sort` props, and the file-manager labels arrive through a new optional shell labels field that the app fills with `t()`.
- **App:**
  - `apps/chat/src/components/OnboardingHints/onboarding-targets.ts` and its spec: re-anchor the sort targets.
  - `DialFileManagerPage`: pass the sort labels.
- **Sibling repo:** `c:\projects\ai-dial-react-file-manager`. A package release must land before the bump here.
- **i18n:** no new keys for the four lib call sites, which reuse `ButtonsI18nKeys.Sort`. The File manager needs keys for "Modified date", "Ascending" and "Descending" unless existing keys match. The apply step checks `en.json` first: "Name" and "Size" probably exist.
- **RTL:** `IconArrowsSort` is symmetric and is not mirrored. The new row order uses flex order and logical gaps only.
- **Docs:** the `libs/chat-shared` README (new export), the `libs/catalog` README if it describes the toolbar layout, and `docs/host-install-matrix.md` (regenerated after the file-manager bump).

## Acceptance criteria

- On Projects, Scheduled tasks, Catalog, the "Change agent" window, the add-on picker and the File manager (desktop), the sort control is a single icon button named "Sort" (localised) with a matching tooltip. Opening it shows the options with the applied one checked, and choosing one applies it exactly as today.
- On Catalog and in the "Change agent" window from 768px up, the view toggle sits directly after the search field and is followed by the sort button and the filter. The title row holds only the title.
- The onboarding tour still points at the Catalog and Scheduled tasks sort controls.
- `npm run verify:changed`, `npm run validate:docs` and `npm run validate:specs` pass.

## Rollback

The change is purely presentational. Reverting the commit restores the labelled triggers. The file-manager bump can be reverted on its own, because the package keeps the labelled trigger behind `iconOnly={false}` (design D5).

## Context

The labelled sort dropdown appears in five places. Four are in this repo, and each builds the same `activeSortLabel` + `sortItems` + `ButtonDropdown` trio:

- `libs/projects/src/components/Projects/Projects.tsx`: wrapped in a `role="group"` named "Sort"; Small/Standard sizes branched on `useIsMobile`.
- `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`:
  - takes a `sortIcon` override and the `sortButtonText` colour;
  - hides on search focus below 768px (`.sortControlHidden`);
  - has a `useLayoutEffect` that closes the open menu when its trigger is hidden.
- `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`: sits in row 1 after the `SegmentedControl` and a divider; below 768px it is replaced by `BrowseSettingsSheet`.
- `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`: in the heading row, with local sort state.

The fifth, the File manager, comes from `DialFileManagerSortDropdown` in the sibling repo `c:\projects\ai-dial-react-file-manager` (installed as `@epam/ai-dial-react-file-manager` 0.5.0). Its `iconOnly` branch already renders `<Dropdown items><IconButton aria-label=… /></Dropdown>`, but with an accent-tinted circle meant for the compact view.

The "Change agent" window (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) renders `CatalogView` and therefore the same `TitleRow`, so it needs no code of its own.

The onboarding tour finds two sort triggers by the applied option's name (`apps/chat/src/components/OnboardingHints/onboarding-targets.ts`, `CatalogSort` and `ScheduledTasksSort`), and the Projects one by its `role="group"` named `labels.sort`.

## Goals / Non-Goals

**Goals:**

- One icon-only sort trigger, shared by every list page and both catalog windows.
- On Catalog from 768px, put the view toggle and the sort in the search row.
- Keep the menus, sort keys, state ownership and persistence exactly as they are.

**Non-Goals:**

- Turning the catalog `Filter` trigger into an icon (see Open Questions).
- Changing phone layouts beyond the icon swap.

## Decisions

### D1. A shared `SortMenuButton` in `@epam/ai-dial-chat-shared`

`chat-shared` is already a peer of `projects`, `scheduled-tasks` and `catalog`, so adding the component costs no install. It goes in `libs/chat-shared/src/components/SortMenuButton/`, is exported from the root entry, and follows `CopyButton` in the same folder as the closest small kit-wrapping component.

- Alternative: three per-lib copies. Rejected because the copies would drift.
- Alternative: a kit contribution. Rejected for now: it is the right long-term home, but it would block this issue on a kit release. Note it as follow-up.

Its markup is `Dropdown` > `GhostIconButton` (`tooltipProps` with `label`). The kit ships no Neutral + Ghost button style; it logs a warning and falls back to primary solid, so the ghost wrapper is used and the glyph colour comes from the module class.

The menu stays a `Dropdown` with `MenuItemMark.Check`, even though the design rule says a value picker is a Select list. The kit `Select` has no custom-trigger slot, so an icon-only trigger is impossible with it, and every current sort control already uses this menu. The model is `DialFileManagerSortDropdown`'s `iconOnly` branch. The sizes are props (`size`, `iconSize`) so Projects keeps its Small/16px mobile trigger.

### D2. The accessible name is the static sort label

A kit `Button` with a string `label` ignores `aria-label`, which is why every lib named its trigger after the applied option. An `IconButton` has no visible label, so its `aria-label` is authoritative. It is the existing `sortLabel` / `labels.sort` string (`ButtonsI18nKeys.Sort`), and the tooltip repeats it.

- The applied order is still exposed: the opened menu marks it `aria-checked`.
- Alternative: "Sort: Newest". Rejected: every lib would need a new formatter label, and it adds no information the menu lacks.

### D3. Lib call sites keep their public props

No prop is added or removed in `projects`, `scheduled-tasks` or `catalog`. The existing fields are re-pointed as follows:

- `ProjectsColors.sortButtonText` and `ScheduledTasksColors.sortButtonText` now colour the glyph. They are passed as `SortMenuButton` `colors.icon`, and their JSDoc fallback changes from `--text-accent` to `--text-secondary`, because the design draws a neutral icon. The per-lib `.sortButton` rule is removed, so the CSS var is read once, inside `SortMenuButton.module.scss`. The lib maps its own `--pr-sort-text` / `--st-sort-text` value straight into `colors.icon`.
- `ScheduledTasksProps.sortIcon` keeps replacing the glyph. `null`, which used to mean "no icon beside the label", now falls back to the default glyph, because an icon-only trigger without a glyph would be empty. The JSDoc states this.
- `activeSortLabel` and the per-lib `sortItems` memo are deleted. `SortMenuButton` owns the marking.
- The Projects `role="group"` wrapper is removed. It only named a button that now names itself.

ScheduledTasks keeps `.sortControlHidden` and its close-on-hide `useLayoutEffect`. The effect needs the menu's open state, so `SortMenuButton` takes optional `open` / `onOpenChange` props and forwards them to the kit `Dropdown`. This is the only stateful seam.

### D4. Catalog `TitleRow` row order

Row 1 keeps only the header. The search row becomes `Search (flex-1)`, then `SegmentedControl` (still inside the `contents` intent wrapper), then `SortMenuButton`, then `Filter`. The divider element and `styles.divider` are removed if nothing else reads them.

The phone-crossing focus effect queries `desktopControlsRef` for `[role="radio"]`, so that ref moves to a wrapper around the view toggle in the search row. `BrowseSettingsSheet` is untouched.

The "Change agent" window inherits the new layout. `CatalogPickerModal` has no view toggle and only swaps its trigger.

### D5. File manager: package change first, then a host bump

The trigger lives in the sibling package, and memory records that file-manager UI fixes land there, so the change is made in `c:\projects\ai-dial-react-file-manager`:

- The non-compact branch of `DialFileManagerSortDropdown` renders the same `Dropdown` + ghost `IconButton` + tooltip as D1, without the tint class.
- The compact branch is unchanged.
- The labelled `ButtonDropdown` branch stays reachable through a new `appearance`-style prop (e.g. `triggerVariant: 'icon' | 'labelled'`, a string enum in that repo), which defaults to `icon`. Another host can then opt back in, and this repo's bump stays revertible.

After that release, bump `@epam/ai-dial-react-file-manager` in the root `package.json` and `libs/chat-shared/package.json` (one range), run `npm run docs:install-matrix`, and add `labels.sort` forwarding in `DialFileManagerShell` (spec `chat-shared-file-manager-ui`).

- Alternative: pass `iconOnly: true` plus override classes from the shell. Rejected: it fights the package's tint with `className` overrides on every host.

### D6. Onboarding anchors

- `CatalogSort` matches a control named `labels.sort` inside `catalogRegions` (falling back to `catalogBrowseSettings` on a phone, as now).
- `ScheduledTasksSort` uses `findControlNear(search, isOneOf(labels.sort))`.
- The Projects target changes from `firstNamed(…'[role="group"]', labels.sort)` to the button named `labels.sort` near the projects search.
- `catalogSortOptions` and `scheduledTasksSortOptions` become unused. They are removed from `OnboardingHintLabels` and from `OnboardingHints.tsx` (no translation keys are deleted, because the keys still feed the menus).

## Risks / Trade-offs

- [`tooltipProps` wraps the button in a `Tooltip`, and `Dropdown` may clone its direct child for the ref and `aria-expanded`] → Before writing the component, confirm with `getEntityDetails("component", "Dropdown")` / `"Tooltip"` that the trigger props reach the button. If they do not, place the `Tooltip` outside the `Dropdown`. The `SortMenuButton` test asserts `aria-expanded` on the element named "Sort".
- [The applied order is no longer visible at a glance] → This is the issue's intent. The menu shows it, and the list order makes it evident.
- [Visual change of the `sortButtonText` default colour, from accent to secondary] → Hosts that set it keep their colour. The JSDoc and READMEs are updated in the same change.
- [Tests that mock `ButtonDropdown` (`libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`) or query the trigger by option name (Projects, ScheduledTasks, Toolbar tablet specs, onboarding-targets spec)] → Update them to query `getByRole('button', { name: 'Sort' })`.
- [Cross-repo ordering] → The File manager slice (D5) is last, depends on a published package, and can ship as a separate PR without blocking the rest.

## Migration Plan

Merge the four in-repo surfaces and the onboarding re-anchoring first (one PR, a commit per slice). Release the file-manager package, then bump it and wire the labels. Rollback is a revert: no data, storage or API is touched.

## Open Questions

- The Catalog screenshot draws the Filter as an icon, but the issue text does not mention it. Is that in scope? This plan assumes it is not.
- Should the glyph be `--text-secondary` or `--text-primary`? The screenshots show a dark grey. This plan picks `--text-secondary` and lets the design review adjust the fallback.

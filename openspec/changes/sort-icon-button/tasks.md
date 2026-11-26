Slicing strategy: **risk-first, then vertical**.

1. Slice 1 proves the shared `SortMenuButton` (the `Dropdown` + tooltip-wrapped `IconButton` interaction is the main unknown, see design Risks).
2. Each later slice moves one surface onto it, end to end, with its tests and docs.
3. The File manager slice (6) depends on a sibling-repo release and can ship separately.

## 1. Shared `SortMenuButton` (risk-first)

- [x] 1.1 Confirm the current kit signatures of `Dropdown` (`open`/`onOpenChange`, trigger cloning, `listClassName`), `IconButton` (`tooltipProps` / `IconButtonTooltipProps`) and `ButtonVariant.Neutral`, using `getEntityDetails`. Decide whether the `Tooltip` goes inside the `Dropdown` trigger or outside it (design D1 and Risks).
- [x] 1.2 Create `libs/chat-shared/src/components/SortMenuButton/SortMenuButton.tsx`, the `SortMenuButton.module.scss` that reads `var(--smb-icon, var(--text-secondary, #57647a))` and has a shared hover/`:focus-visible` rule, and the `SortMenuButtonProps` / `SortMenuButtonColors` / `SortMenuButtonOption` interfaces in `libs/chat-shared/src/models/`. Requirements:
  - `useMemo` items with `MenuItemMark.Check`;
  - `buildCssVars`;
  - `aria-hidden` glyph with `DIAL_KIT_ICON_STROKE`;
  - render nothing for empty `options`;
  - JSDoc with defaults.
- [x] 1.3 Export the component and its types from `libs/chat-shared/src/index.ts`, and add a `SortMenuButton` subsection with a compiling example to `libs/chat-shared/README.md`.
- [x] 1.4 Architecture guard: `SortMenuButton` imports no i18n, app, router, storage or API client, and every string arrives through props.
- [x] 1.5 Write tests in `libs/chat-shared/src/components/SortMenuButton/tests/SortMenuButton.spec.tsx` against the real kit:
  - the trigger is named by `label` and has no visible text;
  - `aria-expanded` toggles;
  - the applied option is `aria-checked`, and an unknown value checks nothing;
  - picking calls `onChange` and returns focus;
  - an empty `options` renders nothing;
  - the `colors.icon` var is set;
  - there is no RTL mirroring class.

Verification: `npm run test:file -- libs/chat-shared/src/components/SortMenuButton/tests/SortMenuButton.spec.tsx`, then `npm run verify:changed`.

## 2. Projects (depends on 1)

- [x] 2.1 In `libs/projects/src/components/Projects/Projects.tsx`:
  - replace the `role="group"` + `ButtonDropdown` with `SortMenuButton`, using `label={labels.sortLabel}`, `size` Small/Standard and `iconSize` SM/MD on `useIsMobile`, and `colors.icon` from `colors?.sortButtonText`;
  - delete `activeSortLabel` and `sortItems`.

  Remove `.sortButton` and its now-unread var from `Projects.module.scss`, and update the `sortButtonText` JSDoc in `libs/projects/src/models/projects-props.ts` (fallback `--text-secondary`, colours the sort glyph).
- [x] 2.2 Update `libs/projects/src/components/Projects/tests/Projects.spec.tsx` and `Projects.mobile.spec.tsx`:
  - the trigger is `getByRole('button', { name: 'Sort' })` with no visible option text;
  - there is no `group` named Sort;
  - choosing Oldest still reorders the cards.
- [x] 2.3 Update `libs/projects/README.md` wherever it describes the sort trigger or `sortButtonText`.

Verification: `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx` and `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.mobile.spec.tsx`, then `npm run verify:changed`.

## 3. Scheduled tasks (depends on 1)

- [x] 3.1 In `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`:
  - render `SortMenuButton` inside the existing `sortControlRef` wrapper, with `label={labels.sortLabel}`, `icon={sortIcon ?? undefined}`, `colors.icon` from `colors?.sortButtonText`, and `open`/`onOpenChange` bound to `isSortMenuOpen` so the close-on-hide effect keeps working;
  - delete `activeSortLabel` and `sortItems`;
  - remove `.sortButton` from `ScheduledTasks.module.scss`.
- [x] 3.2 Update the `sortIcon` JSDoc (`null`/`undefined` draw the default glyph) and the `sortButtonText` JSDoc in `libs/scheduled-tasks/src/models/scheduled-tasks-props.ts`, and update `libs/scheduled-tasks/README.md` to match.
- [x] 3.3 Update `libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx`:
  - the trigger is named "Sort" with no option text;
  - it has `aria-expanded`;
  - the applied option is `aria-checked`;
  - `onSortChange` is called;
  - a phone search focus still hides the control and closes the menu.

Verification: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx`, then `npm run verify:changed`.

## 4. Catalog toolbar, "Change agent" window and add-on picker (depends on 1)

- [x] 4.1 In `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`:
  - row 1 keeps only the header;
  - the search row renders `Search`, then the `SegmentedControl` (inside the intent wrapper, with `desktopControlsRef` moved onto it), then `SortMenuButton` (`label={sortLabel}`, only for non-empty `sortOptions`), then `Filter`, all from 768px;
  - delete `activeSortLabel`, `sortItems` and the divider;
  - drop `styles.divider` from `Toolbar.module.scss` only if nothing else reads it;
  - update the component's summary JSDoc.
- [x] 4.2 In `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`, swap the `ButtonDropdown` for `SortMenuButton` (`label={labels.sort ?? 'Sort'}`, local `sortKey` state), delete `activeSortLabel` and `sortItems`, and update the `labels.sort` JSDoc.
- [x] 4.3 RTL check: the search-row order uses flex order and logical gaps only, with no physical `ml-*`/`mr-*`/`left-*` and no mirroring of `IconArrowsSort`. Add an RTL render assertion to the toolbar tablet spec.
- [x] 4.4 Update the tests:
  - `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx` and `Toolbar.tablet.spec.tsx`: DOM order is search, then the view `radiogroup`, then "Sort", then the filter; the title row has no radiogroup; the trigger is not named after the applied option;
  - `Toolbar.mobile.spec.tsx`: unchanged behaviour still passes;
  - `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`: replace the `ButtonDropdown` mock assumptions;
  - the `CatalogPickerModal` tests, if present under `libs/catalog/src/components/CatalogPickerModal/tests/`: the trigger is "Sort", and picking Name A-Z re-sorts.
- [x] 4.5 Update `libs/catalog/README.md` wherever it describes the toolbar layout or the sort trigger.

Verification: `npm run test:file -- libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx`, `npm run test:file -- libs/catalog/src/components/Toolbar/tests/Toolbar.tablet.spec.tsx`, `npm run test:file -- libs/catalog/src/components/Toolbar/tests/Toolbar.mobile.spec.tsx` and `npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`, then `npm run verify:changed`.

## 5. Onboarding anchors (depends on 2–4)

- [x] 5.1 In `apps/chat/src/components/OnboardingHints/onboarding-targets.ts`:
  - `CatalogSort` matches the control named `labels.sort` in `catalogRegions`, with the browse-settings fallback;
  - `ScheduledTasksSort` uses `findControlNear(search, isOneOf(labels.sort))`;
  - the Projects sort target finds the button named `labels.sort` near the projects search instead of the removed `role="group"`;
  - remove `catalogSortOptions` and `scheduledTasksSortOptions` from `OnboardingHintLabels` and from `apps/chat/src/components/OnboardingHints/OnboardingHints.tsx`.
- [x] 5.2 Update `apps/chat/src/components/OnboardingHints/tests/onboarding-targets.spec.tsx` fixtures to icon buttons named "Sort", and assert that each target resolves.

Verification: `npm run test:file -- apps/chat/src/components/OnboardingHints/tests/onboarding-targets.spec.tsx`, then `npm run verify:changed`.

## 6. File manager (sibling repo, then host; independent of 2–5)

- [x] 6.1 In `c:\projects\ai-dial-react-file-manager`, change `src/components/FileManager/components/FileManagerSortDropdown/FileManagerSortDropdown.tsx`:
  - the non-compact trigger becomes a ghost `IconButton` with `IconArrowsSort`, a tooltip and `aria-label={label}`;
  - the compact tinted branch is unchanged;
  - the labelled `ButtonDropdown` stays behind a string-enum trigger prop that defaults to the icon (design D5).

  Update `FileManagerSortDropdown.spec.tsx`, `__tests__/sort-menu.spec.tsx`, the stories and that repo's README/CHANGELOG, then release a new package version. This follows that repo's own workflow.
- [x] 6.2 Bump `@epam/ai-dial-react-file-manager` to the released version, with one range, in the root `package.json` and `libs/chat-shared/package.json`. Install, and run `npm run docs:install-matrix`.
- [x] 6.3 Add the optional `sort` field to `DialFileManagerShellLabels` in `libs/chat-shared/src/file-manager/labels.ts`, and forward it as memoised `sortOptions` in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`. Update the chat-shared README file-manager section.
- [x] 6.4 i18n: grep `apps/chat/src/i18n/locales/en.json` for exact "Name", "Size", "Modified date", "Ascending" and "Descending" values and reuse those keys. Add only the missing ones under `dialFileManager.sort.*`, with matching members in the `DialFileManagerI18nKeys` module under `apps/chat/src/constants/i18n-keys/`.
- [x] 6.5 Fill `labels.sort` with `t()` in `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` (`label: t(ButtonsI18nKeys.Sort)`).
- [x] 6.6 Tests:
  - `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx`: the shell passes `sortOptions` built from `labels.sort`, and passes none when the field is omitted;
  - the page test, if present: the sort button is named "Sort".

Verification: `npm run test:file -- apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx`, then `npm run verify:changed`.

## 7. Docs, specs and close-out

- [x] 7.1 Search `docs/` for the labelled sort trigger or the catalog title-row layout and update any match (e.g. `docs/architecture.md` only if it lists `chat-shared` components).
- [x] 7.2 Run `npm run validate:docs` and `npm run validate:specs`, and fix any drift.
- [ ] 7.3 Follow-up, out of scope: decide with design whether the catalog `Filter` trigger also becomes an icon, and whether `SortMenuButton` should move into `@epam/ai-dial-ui-kit`.
- [ ] 7.4 Run `npm run verify:full` once.

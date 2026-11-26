## MODIFIED Requirements

### Requirement: Sort defaults to Newest and offers Oldest and Name A–Z

The lib SHALL expose `ProjectsSortKey` (`Newest = 'newest'`, `Oldest = 'oldest'`, `NameAsc = 'name-asc'`) through the icon-only `SortMenuButton` from `@epam/ai-dial-chat-shared`:

- The trigger is an icon button with the `IconArrowsSort` glyph and no visible text.
- The trigger's accessible name and tooltip are `labels.sortLabel`, whichever option is applied.
- The trigger is not wrapped in a named `role="group"`.
- `labels.sortOptions` lists the options, and the applied option is marked with `MenuItemMark.Check`.

Sorting applies after filtering. Pinned projects (`isPinned: true`) come before unpinned ones in every order. Within each group:

- **Newest**: by `updatedAt`, descending.
- **Oldest**: by `updatedAt`, ascending.
- **Undated projects**: in both date orders, items without `updatedAt` come last. The order ignores `source`: a shared project with `updatedAt` (sent by a DIAL Core that includes epam/ai-dial-core#2210) sorts by date together with personal and organization ones, and only a shared project from an older Core, which has no date, goes last.
- **Name A–Z**: by `name`, using `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.
- **Ties**: in date orders, ties are broken by name with the same collator.

#### Scenario: Default order is Newest

- **WHEN** the page first renders unpinned projects updated at t=1, t=3 and t=2
- **THEN** the cards render in the order t=3, t=2, t=1, and the opened sort menu marks Newest as checked

#### Scenario: Sort trigger is icon-only

- **WHEN** the page renders with `labels.sortLabel` "Sort" and Newest applied
- **THEN** the toolbar has one button named "Sort" with no visible text, and no element is named "Newest" until the menu opens

#### Scenario: Oldest reverses the date order and keeps undated last

- **WHEN** the user selects Oldest for unpinned projects updated at t=2, undated, and t=1
- **THEN** the order is t=1, t=2, then the undated project

#### Scenario: Name A–Z orders by collator

- **WHEN** the user selects Name A–Z for unpinned `beta`, `Alpha` and `alpha 10`
- **THEN** the order is `Alpha`, `alpha 10`, `beta`

#### Scenario: Pinned projects sort first

- **WHEN** projects `a` (t=3), `b` (t=1, pinned) and `c` (t=2, pinned) are listed under Newest
- **THEN** the order is `c`, `b`, `a`

### Requirement: Projects page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The Projects lib and page SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The lib layout SHALL be mobile-first. Cards use one column with a 16px gap by default and, under the `desktop:` variant from `tools/tailwind/theme.css`, three columns with a 20px gap in a centred grid at most 1116px wide.
- Under `desktop:`, the header, the toolbar and the content area have 32px inline padding; the header has 16px block padding, the toolbar 16px above and 20px below, and the content area 24px above. On mobile, the toolbar has 16px padding on every side, the content area 16px inline padding and none above, and 80px below so the floating **New project** button never covers the last card.
- On mobile, the toolbar keeps the search and the sort button on one row with an 8px gap: the search at `ElementSize.Standard` and the sort button at `ElementSize.Small` with a 16px icon. Under `desktop:`, the gap is 12px, the search is `ElementSize.Large`, and the sort button is `ElementSize.Standard` with a 20px icon. The sort glyph's colour is `ProjectsColors.sortButtonText`, passed to `SortMenuButton` as `colors.icon` (fallback `--text-secondary`). The component branches with `useIsMobile` from `@epam/ai-dial-chat-shared`.
- No `sm:`/`md:`/`lg:`/`xl:` prefixes are used.
- Long names truncate to one line with a tooltip, and the folder path collapses or truncates inside the card, so the page never scrolls horizontally at a 320 px viewport.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `inset-s-*`/`inset-e-*`, `text-start`, `border-s-*`).
- The folder path's separators come from the kit `FolderPath`; the page adds no directional icon of its own (`IconArrowsSort` and `IconPlus` are symmetric).
- Direction is inherited from `<html dir>`. The lib does not read the language.

**Accessibility:**

- The title is the page's `<h1>`, styled `dial-h1-text` by default. On mobile it is visually hidden, because the design shows no title row there.
- The search is inside `role="search"`.
- Each card is an `<article>` named by its project, and its folder path is a `<nav>` named by `labels.folderPathLabel`.
- A visually hidden `<span role="status" aria-live="polite">` announces each of these states:
  - the result count (`projects.status.resultCount`);
  - the no-results label;
  - the empty-state label;
  - the error label;
  - the incomplete label, which takes precedence over the result count.
  It announces nothing while loading.
- Every Tabler outline icon passes `stroke={DIAL_KIT_ICON_STROKE}`. Decorative icons, including icons inside labelled controls, carry `aria-hidden`.
- The sort button, the pin toggles and the retry button are reachable and operable by keyboard. The sort button is named by `labels.sortLabel`.
- Text colors use theme tokens whose fallbacks meet a 7:1 contrast ratio.

**Memoisation:**

- The lib computes the filtered and sorted list in `useMemo`, keyed on `projects`, `searchQuery`, `sortKey` and `locale`.
- `ProjectsPage` memoises `labels` with `useMemo` and its handlers with `useCallback`.

#### Scenario: Status region announces result count

- **WHEN** a search leaves 2 of 5 projects visible
- **THEN** the `aria-live` status region text is the localized "2 projects"

#### Scenario: Status region announces no results

- **WHEN** a search matches no project
- **THEN** the status region text equals `labels.noResultsLabel`

#### Scenario: Narrow viewport has no horizontal scroll

- **WHEN** the page renders at a 320 px wide viewport with a 120-character project name
- **THEN** the document's `scrollWidth` does not exceed its `clientWidth`

#### Scenario: RTL mirrors the layout

- **WHEN** `<html dir="rtl">` is set
- **THEN** the toolbar and card content align to the inline start in RTL order, and no physical left/right class is present in the lib's source

#### Scenario: Mobile keeps the title for assistive tech only

- **WHEN** the page renders on mobile with a subtitle label
- **THEN** the `<h1>` is visually hidden, and the subtitle is not rendered

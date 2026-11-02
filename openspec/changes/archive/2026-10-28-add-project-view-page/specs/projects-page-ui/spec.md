## MODIFIED Requirements

### Requirement: @epam/ai-dial-projects is a host-agnostic presentational lib

A new lib `libs/projects`, published as `@epam/ai-dial-projects`, SHALL export:

- a `Projects` component, together with the `ProjectItem`, `ProjectsLabels`, `ProjectsProps` and `ProjectsStyles` types and the `ProjectSource` and `ProjectsSortKey` string enums;
- the `ProjectCreateForm` component and its types, enums and helpers, which are specified in `project-create-ui`;
- the `ProjectView` component and its types, which are specified in `project-view-ui`.

The manifest and README follow `.claude/rules/libs.md`. The lib SHALL NOT import:

- `@epam/ai-dial-chat-api-client`, or any REST path;
- feature flags, i18n, routing or app contexts.

Every host-owned decision arrives as a prop:

| Prop | Type |
| --- | --- |
| `projects` | `ProjectItem[]` |
| `isLoading` | optional `boolean`, default `false` |
| `hasError` | optional `boolean`, default `false` |
| `incompleteSources` | optional `ProjectSource[]`, default `[]` |
| `onRetry` | `() => void` |
| `onCreateProject` | optional `() => void`; when omitted, no New project button renders |
| `onOpenProject` | optional `(id: string) => void`; when omitted, cards are not interactive |
| `getProjectHref` | optional `(id: string) => string`; required whenever `onOpenProject` is supplied |
| `searchQuery` | `string` |
| `onSearchQueryChange` | `(query: string) => void` |
| `sortKey` | `ProjectsSortKey` |
| `onSortKeyChange` | `(key: ProjectsSortKey) => void` |
| `labels` | `ProjectsLabels` (adds optional `createProjectLabel`, required whenever `onCreateProject` is supplied, and `pinnedLabel`) |
| `locale` | optional `string` |
| `styles` | optional `ProjectsStyles`, applied via `buildCssVars` |

`ProjectItem` is `{ id: string; name: string; source: ProjectSource; parentPath?: string; updatedAt?: number; isPinned?: boolean }`.

- The app mapper copies `parentPath` from `ProjectDto.parentPath`, and sets `updatedAt` from `updatedAt ?? createdAt`. `updatedAt` only drives the date sort orders and is not displayed.
- `ProjectsPage` sets `isPinned` in a `useMemo`, from the `pinnedProjectIds` of `useUserConfig()`.
- `ProjectsPage` passes `onOpenProject={(id) => navigate(getProjectViewRoute(id))}` and `getProjectHref={getProjectViewRoute}`, both memoised.

Every declared prop SHALL be read. Search and sort state is controlled by the app page, so `ProjectsPage` holds `searchQuery` and `sortKey` in `useState`, with `ProjectsSortKey.Newest` as the initial value. Neither is persisted.

#### Scenario: Lib receives resolved strings, not translation keys

- **WHEN** `ProjectsPage` renders `<Projects />`
- **THEN** every `labels` value is a string already resolved by `useTranslation().t()`, and the lib source contains no `react-i18next` import

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag` and `react-router`
- **THEN** none of them occurs

#### Scenario: Pinned flag comes from the user config

- **WHEN** `pinnedProjectIds` contains `projects/a1b2c3/q4` and the listing returns that project
- **THEN** the `ProjectItem` passed to `Projects` has `isPinned: true`

### Requirement: Sort defaults to Newest and offers Oldest and Name A–Z

The lib SHALL expose `ProjectsSortKey` (`Newest = 'newest'`, `Oldest = 'oldest'`, `NameAsc = 'name-asc'`) through a kit `ButtonDropdown`:

- The dropdown uses the `IconArrowsSort` trigger icon.
- The trigger's accessible name is the applied option's label, falling back to `labels.sortLabel` for an unknown key.
- The trigger sits inside a `role="group"` whose accessible name is `labels.sortLabel`.
- `labels.sortOptions` lists the options, and the applied option is marked with `MenuItemMark`, following `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`.

Sorting applies after filtering. Pinned projects (`isPinned: true`) come before unpinned ones in every order. Within each group:

- **Newest**: by `updatedAt`, descending.
- **Oldest**: by `updatedAt`, ascending.
- **Undated projects**: in both date orders, items without `updatedAt` come last.
- **Name A–Z**: by `name`, using `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.
- **Ties**: in date orders, ties are broken by name with the same collator.

#### Scenario: Default order is Newest

- **WHEN** the page first renders unpinned projects updated at t=1, t=3 and t=2
- **THEN** the cards render in the order t=3, t=2, t=1, and the sort control shows Newest as applied

#### Scenario: Oldest reverses the date order and keeps undated last

- **WHEN** the user selects Oldest for unpinned projects updated at t=2, undated, and t=1
- **THEN** the order is t=1, t=2, then the undated project

#### Scenario: Name A–Z orders by collator

- **WHEN** the user selects Name A–Z for unpinned `beta`, `Alpha` and `alpha 10`
- **THEN** the order is `Alpha`, `alpha 10`, `beta`

#### Scenario: Pinned projects sort first

- **WHEN** projects `a` (t=3), `b` (t=1, pinned) and `c` (t=2, pinned) are listed under Newest
- **THEN** the order is `c`, `b`, `a`

### Requirement: Each project card shows its name and folder path

The lib SHALL render the visible projects as a list (`<ul>` with one `<li>` per project), keyed by `id`. Each card is the kit `CardShell` (an `<article>` with the design's radius, padding and shadow), named by the project name through `aria-label`. It shows:

- the name, through `Highlight` with `maxLines={1}`;
- when `isPinned`, an `IconPinFilled` marker (`aria-hidden`) followed by visually hidden `labels.pinnedLabel` text, on the inline end of the name row;
- under a divider, the kit `FolderPath`, named by `labels.folderPathLabel`, whose segments are `labels.sourceLabels[source]` followed by the `/`-separated `parentPath` folders.

No description, source badge or last-updated date is rendered: the listing carries no description, and the design shows the source only in the folder path.

**Interactive cards.** When `onOpenProject` and `getProjectHref` are supplied, the name SHALL be an `<a href={getProjectHref(id)}>`. Its `::after` is stretched over the card, so the whole card is the click target, while the link remains the single tab stop. A primary click without modifier keys calls `event.preventDefault()` and then `onOpenProject(id)`. A modified or middle click follows the `href`, so the project opens in a new tab. Hover and `:focus-visible` apply the same card highlight.

Without those props, cards are not interactive: no link, button or `tabIndex`.

The **New project** buttons are specified separately, in "Projects page offers New project in the header and the empty state".

**RTL impact:** the pin marker sits at the inline end through logical properties, and it is not mirrored. **i18n impact:** `projects.card.pinned` ("Pinned").

#### Scenario: Card content

- **WHEN** a project `{ name: 'Handbook', source: ProjectSource.Organization, updatedAt: 1789000000000 }` is rendered
- **THEN** its card is an `<article>` named `Handbook` that shows the name and a folder path containing only the organization source label, and renders no `<time>` element

#### Scenario: Nested project shows its folders

- **WHEN** a project has `source: ProjectSource.Personal` and `parentPath: 'marketing/2026'`
- **THEN** its folder path reads Personal, then `marketing`, then `2026`

#### Scenario: Clicking a card opens the project

- **WHEN** the user clicks the `Handbook` card on the Projects page
- **THEN** `onOpenProject('projects/public/handbook')` is called, and the router is at `/projects/view/public/handbook`

#### Scenario: Card link supports a new tab

- **WHEN** the user Ctrl+clicks or middle-clicks the card
- **THEN** `onOpenProject` is not called, and the link's `href` is `/projects/view/public/handbook`

#### Scenario: Pinned card is marked

- **WHEN** a project has `isPinned: true`
- **THEN** its card contains the text "Pinned", available to assistive technology

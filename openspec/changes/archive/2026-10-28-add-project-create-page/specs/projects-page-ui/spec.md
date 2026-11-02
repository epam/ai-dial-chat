## ADDED Requirements

### Requirement: Projects page offers New project in the header and the empty state

When `onCreateProject` is supplied, the `Projects` lib component SHALL render two **New project** buttons, both labelled `labels.createProjectLabel` and both calling `onCreateProject`:

- **Header button:** a primary kit `Button` with a leading `IconPlus` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`), on the inline end of the title row. It is rendered in every content state.
- **Empty-state button:** passed as the `action` of the empty-state `PanelEmptyState`, so it renders only in the Empty state. It does not render in the no-results, error or incomplete states.

When `onCreateProject` is omitted, neither button renders.

`ProjectsPage` passes `onCreateProject={() => navigate(ROUTES.ProjectCreate)}` (memoised with `useCallback`), and resolves `labels.createProjectLabel` from `projects.page.newProject` ("New project"). On `mobile`, the header button stays visible next to the title. The title wraps before the button is pushed out, and the page never scrolls horizontally at 320 px.

**Feature flag:** inherits `projectsEnabled` from the page. **RTL impact:** the button sits at the inline end through logical properties, and `IconPlus` is symmetric, so it is not mirrored. **i18n impact:** `projects.page.newProject`.

#### Scenario: Header button navigates to the create page

- **WHEN** projects are listed and the user activates the header **New project** button
- **THEN** `onCreateProject` is called once, and the router navigates to `/projects/new`

#### Scenario: Empty state has its own New project button

- **WHEN** there are no projects and every source is complete
- **THEN** the empty state shows "No projects yet", its description, and a **New project** button, and the header button is also present

#### Scenario: No buttons without the callback

- **WHEN** `Projects` renders without `onCreateProject`
- **THEN** no button named "New project" is rendered

## MODIFIED Requirements

### Requirement: @epam/ai-dial-projects is a host-agnostic presentational lib

A new lib `libs/projects`, published as `@epam/ai-dial-projects`, SHALL export a `Projects` component together with the `ProjectItem`, `ProjectsLabels`, `ProjectsProps` and `ProjectsStyles` types and the `ProjectSource` and `ProjectsSortKey` string enums. It SHALL also export the `ProjectCreateForm` component and its types, enums and helpers, which are specified in `project-create-ui`. The manifest and README follow `.claude/rules/libs.md`. The lib SHALL NOT import:

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
| `searchQuery` | `string` |
| `onSearchQueryChange` | `(query: string) => void` |
| `sortKey` | `ProjectsSortKey` |
| `onSortKeyChange` | `(key: ProjectsSortKey) => void` |
| `labels` | `ProjectsLabels` (adds optional `createProjectLabel`, required whenever `onCreateProject` is supplied) |
| `locale` | optional `string` |
| `styles` | optional `ProjectsStyles`, applied via `buildCssVars` |

`ProjectItem` is `{ id: string; name: string; source: ProjectSource; parentPath?: string; updatedAt?: number }`. The app mapper copies `parentPath` from `ProjectDto.parentPath` and sets `updatedAt` from `updatedAt ?? createdAt`; `updatedAt` only drives the date sort orders and is not displayed.

Every declared prop SHALL be read. Search and sort state is controlled by the app page, so `ProjectsPage` holds `searchQuery` and `sortKey` in `useState` with `ProjectsSortKey.Newest` as the initial value. Neither is persisted.

#### Scenario: Lib receives resolved strings, not translation keys

- **WHEN** `ProjectsPage` renders `<Projects />`
- **THEN** every `labels` value is a string already resolved by `useTranslation().t()`, and the lib source contains no `react-i18next` import

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag` and `react-router`
- **THEN** none of them occurs

### Requirement: Each project card shows its name and folder path

The lib SHALL render the visible projects as a list (`<ul>` with one `<li>` per project), keyed by `id`. Each card is the kit `CardShell` (an `<article>` with the design's radius, padding and shadow), named by the project name through `aria-label`, and shows:

- the name, through `Highlight` with `maxLines={1}`;
- under a divider, the kit `FolderPath`, named by `labels.folderPathLabel`, whose segments are `labels.sourceLabels[source]` followed by the `/`-separated `parentPath` folders.

No description, source badge or last-updated date is rendered: the listing carries no description, and the design shows the source only in the folder path. Cards are not interactive in this iteration: no link, button or `tabIndex`. The **New project** buttons are specified separately, in "Projects page offers New project in the header and the empty state".

#### Scenario: Card content

- **WHEN** a project `{ name: 'Handbook', source: ProjectSource.Organization, updatedAt: 1789000000000 }` is rendered
- **THEN** its card is an `<article>` named `Handbook` that shows the name and a folder path containing only the organization source label, and renders no `<time>` element

#### Scenario: Nested project shows its folders

- **WHEN** a project has `source: ProjectSource.Personal` and `parentPath: 'marketing/2026'`
- **THEN** its folder path reads Personal, then `marketing`, then `2026`

### Requirement: Projects UI strings flow through react-i18next

Every user-visible string SHALL be resolved in `ProjectsPage` with `useTranslation().t()` and passed to the lib as a plain string. The keys live in a new `projects` namespace in `apps/chat/src/i18n/locales/en.json` and are referenced through a `ProjectsI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`:

- `projects.page.title`
- `projects.page.subtitle`
- `projects.toolbar.searchPlaceholder`
- `projects.toolbar.searchAriaLabel`
- `projects.toolbar.sortNewest`
- `projects.toolbar.sortOldest`
- `projects.toolbar.sortNameAsc`
- `projects.emptyState.label`
- `projects.emptyState.description`
- `projects.noResults.label`
- `projects.error.label`
- `projects.incomplete.label`
- `projects.status.resultCount` (with `{{count}}` plural forms)
- `projects.source.personal`
- `projects.source.shared`
- `projects.source.organization`
- `projects.card.folderPath` ("Project location", the folder path's accessible name)

The sort control label reuses `ButtonsI18nKeys.Sort`, the retry label reuses `ButtonsI18nKeys.Retry`, and the clear-search label reuses `BasicI18nKeys.ClearSearch`, instead of new `projects.*` keys. The nav label key `navigation.projects` is specified in `navigation-routing`. The former `projects.card.updatedAt` key is removed together with the card's date line.

#### Scenario: Keys exist in en.json

- **WHEN** the change is applied
- **THEN** every `projects.*` key listed above exists in `en.json` and in `ProjectsI18nKeys`
- **AND** the keys `projects.toolbar.sortLabel`, `projects.toolbar.clearSearchLabel`, `projects.error.retry` and `projects.card.updatedAt` SHALL NOT exist

### Requirement: Projects page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The Projects lib and page SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The lib layout SHALL be mobile-first. Cards use one column by default and, under the `desktop:` variant from `tools/tailwind/theme.css`, three columns with a 20px gap in a grid at most 1116px wide.
- No `sm:`/`md:`/`lg:`/`xl:` prefixes are used.
- Long names truncate to one line with a tooltip, and the folder path collapses or truncates inside the card, so the page never scrolls horizontally at a 320 px viewport.
- On `mobile`, the toolbar stacks the search above the sort control.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`, `border-s-*`).
- The folder path's separators come from the kit `FolderPath`; the page adds no directional icon of its own (`IconArrowsSort` and `IconPlus` are symmetric).
- Direction is inherited from `<html dir>`. The lib does not read the language.

**Accessibility:**

- The title is the page's `<h1>`.
- The search is inside `role="search"`.
- Each card is an `<article>` named by its project, and its folder path is a `<nav>` named by `labels.folderPathLabel`.
- A visually hidden `<span role="status" aria-live="polite">` announces each of these states:
  - the result count (`projects.status.resultCount`);
  - the no-results label;
  - the empty-state label;
  - the error label;
  - the incomplete label, which takes precedence over the result count.
  It announces nothing while loading.
- Every Tabler icon passes `stroke={DIAL_KIT_ICON_STROKE}`. Decorative icons, including icons inside labelled controls, carry `aria-hidden`.
- The sort dropdown and the retry button are reachable and operable by keyboard.
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

## RENAMED Requirements

- FROM: `### Requirement: Each project card shows name, source and last-updated date`
- TO: `### Requirement: Each project card shows its name and folder path`

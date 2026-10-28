## ADDED Requirements

### Requirement: Projects page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.Projects` (`/projects`) in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectsPage` (`apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`), using the `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper. The route is registered unconditionally. The page SHALL read `useFeatureFlag('projectsEnabled')` and render `NotFoundPage` (`apps/chat/src/pages/NotFound/NotFound.tsx`) when the flag is not `true`. This is the same guard `ScheduledTasksPage` applies (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`).

**Feature flag:** `projectsEnabled` (registry key `features.projectsEnabled`, default `false`, role restriction via `PROJECTS_ENABLED_ROLES`). **RTL impact:** see the RTL requirement. **i18n impact:** see the i18n requirement.

#### Scenario: Flag on renders the page

- **WHEN** `projectsEnabled` is `true` and the user navigates to `/projects`
- **THEN** the lazy-loaded `ProjectsPage` mounts and renders the `Projects` lib component

#### Scenario: Flag off renders NotFound without requesting projects

- **WHEN** `projectsEnabled` is not `true` and the user navigates directly to `/projects`
- **THEN** the page renders the `NotFound` content, and `ProjectsApi.listProjects` is not called

#### Scenario: Page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/projects`
- **THEN** neither `ProjectsPage` nor `@epam/ai-dial-projects` is in the initial bundle

### Requirement: The app owns project data through useProjects

Data state SHALL be owned by the `useProjects(enabled: boolean)` hook (`apps/chat/src/hooks/projects/useProjects.ts`, one hook per file, with JSDoc on why it exists). No new React context is introduced, because only the page consumes the data.

The hook calls `listProjects({ signal })` from `apps/chat/src/server-api/projects.api.ts`. That wrapper calls `projectsApi.listProjects(...)` on the `ProjectsApi` instance exported from `apps/chat/src/server-api/api-client.ts`; no `fetch` and no `base.ts` helper is used. The hook maps each `ProjectDto` through `mapProjectDtoToItem` (`apps/chat/src/utils/map-project-dto.ts`), which maps `ProjectSource` onto the lib's `ProjectSource`.

The hook returns `{ projects, isLoading, hasError, retry }`:

- It fetches inside `useEffect` with an `AbortController`, and aborts on unmount or when `enabled` turns false. A cancelled request never sets state.
- `retry` is a stable `useCallback` that re-runs the fetch.
- While `enabled` is `false`, the hook sends no request.

#### Scenario: Successful load populates the list

- **WHEN** the page mounts with the flag on and `listProjects` resolves with three items
- **THEN** `isLoading` goes from `true` to `false`, `projects` has three mapped items, and `error` is `undefined`

#### Scenario: Unmount aborts the request

- **WHEN** the page unmounts while `listProjects` is pending
- **THEN** the request's `AbortSignal` is aborted, and no state update happens after unmount

#### Scenario: Retry refetches after an error

- **WHEN** `listProjects` rejects and the user activates the retry action
- **THEN** `listProjects` is called again, and a successful second response replaces the error state with the list

### Requirement: @epam/ai-dial-projects is a host-agnostic presentational lib

A new lib `libs/projects`, published as `@epam/ai-dial-projects`, SHALL export a `Projects` component together with the `ProjectItem`, `ProjectsLabels`, `ProjectsProps` and `ProjectsStyles` types and the `ProjectSource` and `ProjectsSortKey` string enums. The manifest and README follow `.claude/rules/libs.md`. The lib SHALL NOT import:

- `@epam/ai-dial-chat-api-client`, or any REST path;
- feature flags, i18n, routing or app contexts.

Every host-owned decision arrives as a prop:

| Prop | Type |
| --- | --- |
| `projects` | `ProjectItem[]` |
| `isLoading` | optional `boolean`, default `false` |
| `hasError` | optional `boolean`, default `false` |
| `onRetry` | `() => void` |
| `searchQuery` | `string` |
| `onSearchQueryChange` | `(query: string) => void` |
| `sortKey` | `ProjectsSortKey` |
| `onSortKeyChange` | `(key: ProjectsSortKey) => void` |
| `formatUpdatedAt` | `(timestamp: number) => string` |
| `labels` | `ProjectsLabels` |
| `locale` | optional `string` |
| `styles` | optional `ProjectsStyles`, applied via `buildCssVars` |

`ProjectItem` is `{ id: string; name: string; source: ProjectSource; updatedAt?: number }`. The app mapper sets `updatedAt` from `updatedAt ?? createdAt`.

Every declared prop SHALL be read. Search and sort state is controlled by the app page, so `ProjectsPage` holds `searchQuery` and `sortKey` in `useState` with `ProjectsSortKey.Newest` as the initial value. Neither is persisted.

#### Scenario: Lib receives resolved strings, not translation keys

- **WHEN** `ProjectsPage` renders `<Projects />`
- **THEN** every `labels` value is a string already resolved by `useTranslation().t()`, and the lib source contains no `react-i18next` import

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag` and `react-router`
- **THEN** none of them occurs

### Requirement: Search filters by project name and highlights the match

The lib SHALL filter `projects` client-side to those whose `name` contains the trimmed `searchQuery`, case-insensitively. Each card SHALL render the name with `Highlight` from `@epam/ai-dial-ui-kit`, passing `query={trimmedQuery}` and `maxLines={2}`. The search input SHALL be the kit `Search` component, inside a `<div role="search">`, with `labels.searchAriaLabel` as its accessible name and `labels.clearSearchLabel` on its clear action.

#### Scenario: Typing filters and highlights

- **WHEN** projects `Q4 Launch`, `Handbook` and `Launch retro` are listed and the user types `launch`
- **THEN** only `Q4 Launch` and `Launch retro` are rendered, and the `Launch` substring of each name is rendered through `Highlight`

#### Scenario: Whitespace-only query does not filter

- **WHEN** the search query is `"   "`
- **THEN** every project is rendered, and nothing is highlighted

### Requirement: Sort defaults to Newest and offers Oldest and Name A–Z

The lib SHALL expose `ProjectsSortKey` (`Newest = 'newest'`, `Oldest = 'oldest'`, `NameAsc = 'name-asc'`) through a kit `ButtonDropdown`. The dropdown uses the `IconArrowsSort` trigger icon. The trigger's accessible name is the applied option's label (falling back to `labels.sortLabel` for an unknown key), and it sits inside a `role="group"` whose accessible name is `labels.sortLabel`. `labels.sortOptions` lists the options, and the applied option is marked with `MenuItemMark`, following `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`. Sorting applies after filtering:

- **Newest**: by `updatedAt`, descending.
- **Oldest**: by `updatedAt`, ascending.
- **Undated projects**: in both date orders, items without `updatedAt` come last.
- **Name A–Z**: by `name`, using `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.
- **Ties**: in date orders, ties are broken by name with the same collator.

#### Scenario: Default order is Newest

- **WHEN** the page first renders projects updated at t=1, t=3 and t=2
- **THEN** the cards render in the order t=3, t=2, t=1, and the sort control shows Newest as applied

#### Scenario: Oldest reverses the date order and keeps undated last

- **WHEN** the user selects Oldest for projects updated at t=2, undated, and t=1
- **THEN** the order is t=1, t=2, then the undated project

#### Scenario: Name A–Z orders by collator

- **WHEN** the user selects Name A–Z for `beta`, `Alpha` and `alpha 10`
- **THEN** the order is `Alpha`, `alpha 10`, `beta`

### Requirement: Each project card shows name, source and last-updated date

The lib SHALL render the visible projects as a list (`<ul>` with one `<li>` per project), keyed by `id`. Each card shows:

- the name, through `Highlight`;
- a source badge with the text `labels.sourceLabels[source]`;
- when `updatedAt` is set, `formatUpdatedAt(updatedAt)` in a `<time dateTime={ISO string}>` element. The line is omitted when `updatedAt` is not set.

Cards are not interactive in this iteration: no link, button or `tabIndex`. No **New project** button is rendered.

#### Scenario: Card content

- **WHEN** a project `{ name: 'Handbook', source: ProjectSource.Organization, updatedAt: 1789000000000 }` is rendered
- **THEN** its card shows `Handbook`, the organization source label, and the host-formatted date inside a `<time>` element whose `dateTime` is the ISO string of that timestamp

#### Scenario: Undated card omits the date line

- **WHEN** a project has no `updatedAt`
- **THEN** its card renders no `<time>` element

### Requirement: Projects page has explicit loading, error, empty and no-results states

The lib SHALL render exactly one content state at a time:

- **Loading** (`isLoading`): the kit `Spinner`.
- **Error** (`hasError && !isLoading`): `labels.errorLabel` with a retry button labelled `labels.retryLabel` that calls `onRetry`.
- **Empty** (no projects): `PanelEmptyState` from `@epam/ai-dial-chat-shared` with `labels.emptyStateLabel` ("No projects yet") and `labels.emptyStateDescription` ("Your projects will appear here once created.").
- **No results** (projects exist but the search matches none): a separate `PanelEmptyState` with `labels.noResultsLabel`.
- **List**: otherwise.

The title, the subtitle and the toolbar (search + sort) stay rendered in every state.

#### Scenario: Loading state

- **WHEN** `isLoading` is `true`
- **THEN** a `Spinner` is rendered, and no card, empty state or error is rendered

#### Scenario: Error state with retry

- **WHEN** `hasError` is `true` and `isLoading` is `false`
- **THEN** the error label and a retry button are rendered, and activating the button calls `onRetry` once

#### Scenario: Empty state

- **WHEN** `projects` is empty and there is no error
- **THEN** `PanelEmptyState` shows "No projects yet" with "Your projects will appear here once created."

#### Scenario: No-results state is distinct from empty

- **WHEN** projects exist but none matches the query
- **THEN** the no-results state is rendered, and the empty state is not

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
- `projects.status.resultCount` (with `{{count}}` plural forms)
- `projects.source.personal`
- `projects.source.shared`
- `projects.source.organization`
- `projects.card.updatedAt` (interpolates `{{date}}`)

The sort control label reuses `ButtonsI18nKeys.Sort`, the retry label reuses `ButtonsI18nKeys.Retry`, and the clear-search label reuses `BasicI18nKeys.ClearSearch`, instead of new `projects.*` keys. The nav label key `navigation.projects` is specified in `navigation-routing`. `formatUpdatedAt` formats the date with the active language's locale (from `useLanguage`) and wraps the result in `projects.card.updatedAt`.

#### Scenario: Keys exist in en.json

- **WHEN** the change is applied
- **THEN** every `projects.*` key listed above exists in `en.json` and in `ProjectsI18nKeys`
- **AND** the keys `projects.toolbar.sortLabel`, `projects.toolbar.clearSearchLabel` and `projects.error.retry` SHALL NOT exist

### Requirement: Projects page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The Projects lib and page SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The lib layout SHALL be mobile-first. Cards use one column by default and a multi-column auto-fill grid under the `desktop:` variant from `tools/tailwind/theme.css`.
- No `sm:`/`md:`/`lg:`/`xl:` prefixes are used.
- Long names wrap or clamp inside the card, so the page never scrolls horizontally at a 320 px viewport.
- On `mobile`, the toolbar stacks the search above the sort control.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`, `border-s-*`).
- The surface has no directional icon (`IconArrowsSort` is symmetric), so no icon is mirrored.
- Direction is inherited from `<html dir>`. The lib does not read the language.

**Accessibility:**

- The title is the page's `<h1>`.
- The search is inside `role="search"`.
- A visually hidden `<span role="status" aria-live="polite">` announces each of these states:
  - the result count (`projects.status.resultCount`);
  - the no-results label;
  - the empty-state label;
  - the error label.
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

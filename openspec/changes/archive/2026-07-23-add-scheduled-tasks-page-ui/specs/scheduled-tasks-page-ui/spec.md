## ADDED Requirements

### Requirement: Scheduled Tasks page renders behind a feature flag

The application SHALL expose a lazy-loaded Scheduled Tasks page at `ROUTES.ScheduledTasks` (`/scheduled-tasks`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper pattern as other standalone pages. The route SHALL only render the Scheduled Tasks page content when `useFeatureFlag('scheduledTasksEnabled')` returns `true` for the current session; otherwise it SHALL render the same content as an unregistered path (the app's `NotFound` page).

**Feature flag:** `scheduledTasksEnabled` (registry key `features.scheduledTasksEnabled`, default `false`, optional role restriction via `SCHEDULED_TASKS_ENABLED_ROLES`). **RTL impact:** page mirrors per logical-property rules below. **i18n impact:** see i18n requirement below.

#### Scenario: Flag enabled renders the page

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to `/scheduled-tasks`
- **THEN** the lazy-loaded Scheduled Tasks page mounts inside `RouteErrorBoundary`/`Suspense`

#### Scenario: Flag disabled renders NotFound instead

- **WHEN** `scheduledTasksEnabled` resolves to `false` and the user navigates directly to `/scheduled-tasks`
- **THEN** the app renders the same `NotFound` content it renders for any unregistered path, and no Scheduled Tasks UI is mounted

#### Scenario: Page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/scheduled-tasks`
- **THEN** the Scheduled Tasks page code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

---

### Requirement: ScheduledTasks lib component renders header, toolbar, and empty state only

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, and optional `isLoading` (default `false`). It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region. The content region SHALL always render the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) in this iteration — the component SHALL NOT render task cards, list rows, or the "Shared"/"My tasks" grouping, regardless of `searchQuery` or `sortKey` values.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props.

#### Scenario: Header and toolbar render from props

- **WHEN** `ScheduledTasks` renders with `texts.title = 'Scheduled tasks'` and `texts.createButtonLabel = 'New task'`
- **THEN** the page shows a heading with that title and a button with that accessible name

#### Scenario: Content area always shows empty state

- **WHEN** `ScheduledTasks` renders with any `searchQuery` and `sortKey` value
- **THEN** the content region renders `PanelEmptyState` with `texts.emptyStateLabel`, and no card/list/section markup is present

#### Scenario: Create button invokes the injected callback

- **WHEN** the user activates the create button
- **THEN** `onCreateClick` is called exactly once, with no navigation or network call performed by the lib itself

#### Scenario: Lib has no host or integration imports

- **WHEN** the `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

---

### Requirement: Scheduled Tasks page strings flow through react-i18next

Every user-visible string on the Scheduled Tasks page (title, subtitle, create button, search placeholder, sort label/options, empty-state label) MUST be resolved via `useTranslation().t()` in the app-level page component and passed into the lib as plain strings. Keys MUST live under a `scheduledTasks` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through a typed `ScheduledTasksI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`. Generic action labels that already exist (e.g. a generic "Create" label) MUST reuse `ButtonsI18nKeys` rather than duplicating the string under a new key.

#### Scenario: Scheduled Tasks keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.page.title`, `scheduledTasks.page.subtitle`, `scheduledTasks.page.navLabel`, `scheduledTasks.toolbar.searchPlaceholder`, `scheduledTasks.toolbar.sortLabel`, and `scheduledTasks.emptyState.label`

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTasksPage` renders `<ScheduledTasks />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

---

### Requirement: Scheduled Tasks page supports RTL and meets AAA accessibility defaults

All directional layout in the Scheduled Tasks header, toolbar, and empty state MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. Any directional icon (e.g. a sort/chevron indicator) MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. The search input MUST have an accessible label; the sort control MUST expose its expanded/collapsed state via `aria-expanded` and the currently selected option via `aria-selected` or `aria-current` on the option list.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, toolbar, and empty state lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Sort control exposes expanded state

- **WHEN** the user opens the sort dropdown
- **THEN** the sort trigger has `aria-expanded="true"` and the currently active sort option is marked `aria-selected="true"` (or `aria-current`)

#### Scenario: Search input is labeled

- **WHEN** the search input renders
- **THEN** it has an accessible name (via `aria-label` or an associated `<label>`) distinct from its placeholder text

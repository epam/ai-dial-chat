# scheduled-tasks-page-ui delta

## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `labels`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, optional `error`/`onRetry`, and an optional `banner?: ReactNode` slot. The header's create button SHALL render only when `onCreateClick` is provided — an omitted callback renders no create button and no header action-group markup, so a host can withdraw the create affordance entirely (the limited-access gating) without the lib knowing why. It SHALL render, in order: a header (title, subtitle, and a right-side action group that renders the primary "create" button as its single header action only while `onCreateClick` is provided), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `Spinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` is empty because the source list itself is empty (no `searchQuery` in effect) → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `labels.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, `items` is empty, and a non-empty `searchQuery` is in effect → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `labels.noResultsLabel`. Because search is server-driven, this state reflects the server returning zero matches, not a client-side filter reducing a non-empty array to zero.
- `isLoading` is `false`, `error` is unset, and `items` is non-empty → the content region renders a single flat `ScheduledTaskCardGrid` of `ScheduledTaskCard`s, **in the order they were received** (no client-side reordering by `sortKey` — sort order is now applied server-side, see the "Server-driven search and sort over the full remote dataset" requirement). There is no grouping/sectioning of any kind — no section heading, no count badge — regardless of task ownership. When `isLoadingMore` is `true`, exactly `skeletonCount` `ScheduledTaskCardSkeleton` elements render as **trailing children inside that same `ScheduledTaskCardGrid`** (via its `trailingSkeletonCount` prop) — not in a separate grid container — so they continue filling the current CSS grid row (via `grid-auto-flow`) instead of unconditionally starting a new row and leaving a gap in a partially-filled last row.
- A scroll sentinel is rendered at the end of the content region's scrollable area; when it becomes visible and `hasMore && !isLoadingMore && !isLoading`, `onLoadMore` is invoked (if provided).

The create button SHALL collapse to an icon-only 40px circle below 1280px (the `desktop:` breakpoint mirroring `MOBILE_MAX_WIDTH_PX`), via the module's `.createButton`/`.createButtonLabel` class pair (label-span hide + circle pill).

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Fetching, pagination-state management, sort-state management, and DTO mapping happen in the app; the lib performs no sorting of `items` itself — `sortKey`/`onSortChange` are used only to drive the toolbar control's UI state (selected option, `aria-selected`), not to reorder rendered cards.

#### Scenario: Header and toolbar render from props

- **WHEN** `ScheduledTasks` renders with `labels.title = 'Scheduled tasks'` and `labels.createButtonLabel = 'New task'`
- **THEN** the page shows a heading with that title and a button with that accessible name

#### Scenario: Omitted create callback renders no create button

- **WHEN** `ScheduledTasks` renders without an `onCreateClick` prop
- **THEN** no create button renders in the header, and the header's action group renders no create-action markup; with a provided callback the button renders as before

#### Scenario: Loading state shows a spinner

- **WHEN** `ScheduledTasks` renders with `isLoading={true}`
- **THEN** the content region renders `Spinner` and no empty-state, no-results, card-grid, or skeleton markup

#### Scenario: Error state shows retry

- **WHEN** `ScheduledTasks` renders with `error` set and the user activates the retry action
- **THEN** the content region renders an error message and `onRetry` is called exactly once per activation

#### Scenario: Empty source list with no active search shows PanelEmptyState

- **WHEN** `ScheduledTasks` renders with `isLoading={false}`, no `error`, `items = []`, and no `searchQuery`
- **THEN** the content region renders `PanelEmptyState` with `labels.emptyStateLabel`, and no card/grid/section markup is present

#### Scenario: Empty items with an active search shows no-results state, not empty state

- **WHEN** `ScheduledTasks` renders with `items = []` and a non-empty `searchQuery`
- **THEN** the content region renders the no-results state with `labels.noResultsLabel`, distinct from `PanelEmptyState`

#### Scenario: Non-empty items render a flat card grid in received order

- **WHEN** `ScheduledTasks` renders with `items` containing entries for tasks owned by the current user and entries for tasks created by other users, already ordered by the caller
- **THEN** the content region renders a single `ScheduledTaskCardGrid` with items in the same order they appear in `items` (no reordering by `sortKey` inside the lib), with no section heading or count badge of any kind

#### Scenario: Loading-more state appends trailing skeletons inside the same grid

- **WHEN** `ScheduledTasks` renders with non-empty `items`, `hasMore={true}`, and `isLoadingMore={true}`
- **THEN** exactly `skeletonCount` (default 6) `ScheduledTaskCardSkeleton` elements render as additional children of the same `ScheduledTaskCardGrid` — not inside a separate grid container — each marked `aria-hidden="true"`, so they continue filling the grid's current row instead of starting a new one

#### Scenario: Reaching the scroll sentinel triggers onLoadMore

- **WHEN** the scroll sentinel at the end of the content region becomes visible, `hasMore={true}`, `isLoadingMore={false}`, and `isLoading={false}`
- **THEN** `onLoadMore` is called

#### Scenario: Scroll sentinel does not trigger onLoadMore while a load is already in flight or no more pages exist

- **WHEN** the scroll sentinel becomes visible but `isLoadingMore={true}` or `hasMore={false}`
- **THEN** `onLoadMore` is not called

#### Scenario: Create button invokes the injected callback

- **WHEN** the user activates the create button
- **THEN** `onCreateClick` is called exactly once, with no navigation or network call performed by the lib itself

#### Scenario: The header renders at most one action button

- **WHEN** `ScheduledTasks` renders with an `onCreateClick` prop
- **THEN** the header's action group contains exactly one action button (the create action); no disconnect/logout action or its markup renders, and no disconnect props exist on the component's public API

#### Scenario: The header button collapses on narrow viewports

- **WHEN** the viewport is narrower than 1280px and the create button renders
- **THEN** the create button renders as an icon-only 40px circle via the collapse class, and the header row does not overflow

#### Scenario: Lib has no host or integration imports

- **WHEN** the `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders an optional banner slot

`libs/scheduled-tasks`'s `ScheduledTasks` component SHALL accept an optional `banner?: ReactNode` prop. When provided, the component SHALL render it between the search/sort toolbar row and the content region (the status message and card grid/spinner/error/empty states) in the resulting layout, inside a wrapper that carries the same width cap and centering as the card grid (`mx-auto w-full min-w-0` with `maxWidth` from `gridLayout?.maxWidth` — default `1180px`), so the banner never renders wider than the cards below it. When omitted, nothing renders in that position — including no empty wrapper (an empty flex child would add a gap row between the toolbar and the content region). The component SHALL treat `banner` as opaque content — it MUST NOT interpret, style beyond layout placement, or attach any auth/BFF/routing/feature-flag behavior to it, and MUST NOT import any type describing what the banner represents.

#### Scenario: Banner renders between toolbar and content

- **WHEN** `ScheduledTasks` renders with `banner={<div>Example</div>}` and a non-empty `items` array
- **THEN** the rendered "Example" content appears after the search/sort toolbar and before the task card grid in document order

#### Scenario: Banner matches the card grid width

- **WHEN** `ScheduledTasks` renders with a `banner` prop and a populated card grid
- **THEN** the banner's wrapper and the card grid carry the same `maxWidth` (the `gridLayout?.maxWidth` value, default `1180px`), so the banner never renders wider than the cards below it

#### Scenario: No banner prop renders nothing extra

- **WHEN** `ScheduledTasks` renders without a `banner` prop
- **THEN** no additional element appears between the toolbar and the content region, and the rendered output is unchanged from before this requirement was added

#### Scenario: Banner renders across every content-region state

- **WHEN** `ScheduledTasks` renders with a `banner` prop while `isLoading` is `true`, while `error` is set, and while `items` is empty
- **THEN** the banner renders in each of these states — its visibility does not depend on the content region's loading/error/empty/populated state

---

## ADDED Requirements

### Requirement: Limited-access banner and create gating on the list page

When the route-scoped offline-credentials status check reports `schedulerServiceConsent: 'signed_out'`, the Scheduled Tasks list page (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`) SHALL render a non-blocking inline limited-access banner — the kit `Notification` (`@epam/ai-dial-ui-kit`) with `variant={NotificationVariant.Error}` and `type={NotificationType.SectionMessage}`, rendered through a thin `ScheduledTasksLimitedAccessBanner` wrapper (`apps/chat/src/components/ScheduledTasksLimitedAccessBanner/ScheduledTasksLimitedAccessBanner.tsx`) that takes the localized title/body as props — in the lib's existing `banner` slot, directly above the task cards, and SHALL NOT pass an `onCreateClick` callback to the `ScheduledTasks` lib component, so no "New task" button renders.

The banner SHALL follow the error-alert Notification design: the error variant's own container styling (radius, border, padding — nothing hand-set), the error variant's built-in assertive `role="alert"` live region, no action control, and no close button. The banner SHALL render on **one line**: a semibold localized "Limited access." title span followed by the localized description "You can't create or edit tasks. Contact your administrator for more details." (the kit stacks its `title` prop above the message, so the single line is composed inside the `message` ReactNode — the same bold-title-plus-supporting-text one-baseline-row composition the login banner uses). Strings resolve from the keys `scheduledTasks.limitedAccessBanner.title` ("Limited access.") and `scheduledTasks.limitedAccessBanner.body` ("You can't create or edit tasks. Contact your administrator for more details.") in `apps/chat/src/i18n/locales/en.json`, declared via `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.

`schedulerServiceConsent` of `signed_in` or `unknown` SHALL change nothing on the page. The list itself (search, sort, card clicks, pagination, and the detail route) SHALL stay fully usable while the limited banner shows — only creation is withdrawn.

Feature gating is unchanged: the page stays behind the existing `scheduledTasksEnabled` feature flag; no new flag or role gating is introduced, and no telemetry is added. RTL impact: none — the banner has no directional icon and uses no directional utilities; it inherits the writing direction.

#### Scenario: Revoked consent shows the limited-access banner and hides New task

- **WHEN** the list page's status check reports `schedulerServiceConsent: 'signed_out'`
- **THEN** the error-alert `Notification` renders in the banner slot directly above the task cards with the localized "Limited access." title and "You can't create or edit tasks. Contact your administrator for more details." description on one line, no action control, no close button, and no "New task" button renders in the header

#### Scenario: The limited banner shows regardless of the login state

- **WHEN** the status check reports `schedulerServiceConsent: 'signed_out'`
- **THEN** the limited-access banner renders whether `connected` is `true` or `false`, and the login-required banner never renders alongside or instead of it

#### Scenario: Consent present and connected changes nothing

- **WHEN** the status check reports `schedulerServiceConsent: 'signed_in'` and `connected: true`
- **THEN** no banner renders and the "New task" button renders as before

#### Scenario: Consent present and not connected keeps the login banner

- **WHEN** the status check reports `schedulerServiceConsent: 'signed_in'` or `unknown` and `connected: false`
- **THEN** the login-required banner and the "New task" button render exactly as before this change

#### Scenario: The list stays usable under limited access

- **WHEN** the limited-access banner is visible
- **THEN** search, sort, card clicks, and pagination remain fully usable and a card click navigates to the detail route

#### Scenario: The banner is announced assertively

- **WHEN** the limited-access banner transitions from not-rendered to rendered
- **THEN** its container is announced via the error variant's built-in `role="alert"` exactly once for that transition

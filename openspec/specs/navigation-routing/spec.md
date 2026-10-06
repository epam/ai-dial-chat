# Spec: navigation-routing

## Purpose

The top-level client-side routes, the navigation sidebar that reflects them, and the 404 recovery state for unknown routes.

## Requirements

### Requirement: Client-side routing resolves the top-level routes

The application SHALL declare its routes using React Router `<Routes>` in `apps/chat/src/app/app.tsx`, with paths taken from the `ROUTES` enum in `apps/chat/src/types/routes.ts`. Inside the `ChatLayout` layout route, `ROUTES.Root` (`/`) MUST render `<ConversationRoute>` (the welcome screen — it holds no message state) and `/conversations/*` MUST render a lazy-loaded `<ConversationPage>`. `ROUTES.Catalog` (`/catalog`) MUST render the lazy-loaded `<CatalogView>` (the full catalog, not a placeholder). The other authenticated pages (`ROUTES.SharedInvitation`, `ROUTES.ConversationSharedInvitation`, `ROUTES.FileManager`, `ROUTES.Settings`/`ROUTES.SettingsTab`, the `ROUTES.ScheduledTasks*` routes, the `AppsEditor`/`ToolsetEditor`/`CustomAppEditor`/`PromptEditor`/`SkillEditor` editors, `ToolsetEditorCallback` and `ToolsetSignIn`) MUST likewise be lazy-loaded inside the `RouteErrorBoundary` + `Suspense`/`RouteFallback` wrapper. Any unregistered path MUST fall through to the explicit `*` catch-all route.

#### Scenario: Root path renders the welcome screen

- **WHEN** the browser navigates to `/`
- **THEN** `<ConversationRoute>` is mounted and the welcome screen is visible with no message history

#### Scenario: Catalog path renders the catalog

- **WHEN** the browser navigates to `/catalog`
- **THEN** the lazy-loaded `<CatalogView>` is mounted

#### Scenario: Conversation path renders the conversation page

- **WHEN** the browser navigates to `/conversations/<id>`
- **THEN** the lazy-loaded `<ConversationPage>` is mounted

#### Scenario: CatalogView is lazy-loaded

- **WHEN** the JS bundle is evaluated
- **THEN** `CatalogView` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

#### Scenario: ConversationPage is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/conversations/:id`
- **THEN** `ConversationPage` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

---

### Requirement: Navigation rail reflects the active route via aria-current

`useNavigationItems` (`apps/chat/src/hooks/navigation/useNavigationItems.ts`) SHALL read `useLocation().pathname` and set each item's `isActive`: the `ROUTES.Root` item is active only on an exact `/` match or when the pathname starts with one of its `matchPaths` (`ROUTES.Conversations`); every other item is active when the pathname starts with its `path`. The desktop `NavigationPanel` from `@epam/ai-dial-navigation-panel` SHALL render each item as an `IconButton` carrying `aria-current="page"` only while it is active, swapping to the item's filled `activeIcon` glyph when one is configured.

#### Scenario: Home button is active on /

- **WHEN** the current pathname is `/`
- **THEN** the button with `aria-label` equal to the value of `navigation.home` has `aria-current="page"` and the catalog button does NOT have `aria-current`

#### Scenario: Home button is active inside a conversation

- **WHEN** the current pathname is `/conversations/<id>`
- **THEN** the Home button has `aria-current="page"`

#### Scenario: Catalog button is active on /catalog

- **WHEN** the current pathname is `/catalog`
- **THEN** the button with `aria-label` equal to the value of `navigation.catalog` has `aria-current="page"` and the home button does NOT have `aria-current`

#### Scenario: Home button exact-matches / only

- **WHEN** the current pathname is `/catalog`
- **THEN** the home button does NOT have `aria-current="page"` (prefix match on `/` MUST NOT fire for sub-paths)

---

### Requirement: Navigation buttons perform client-side navigation

On desktop, each rail item MUST be wrapped by the `renderLink` callback `<Navigation>` passes to `NavigationPanel`, which renders a React Router `<Link to={item.id}>` (the item's `path`). On mobile, `<NavigationSheet>`'s `onSelectItem` MUST call `useNavigate()(item.id)`. Navigation MUST be client-side (no full page reload).

#### Scenario: Clicking Home navigates to /

- **WHEN** the user clicks the Home button while on `/catalog`
- **THEN** the client-side router navigates to `'/'` and the `/` route is rendered

#### Scenario: Clicking Catalog navigates to /catalog

- **WHEN** the user clicks the Catalog button while on `/`
- **THEN** the client-side router navigates to `'/catalog'` and the `/catalog` route is rendered

---

### Requirement: Navigation is driven by NAVIGATION_CONFIG

`<Navigation>` (`apps/chat/src/components/Navigation/Navigation.tsx`) SHALL NOT hard-code route paths or icon components. It MUST render the items from `useNavigationItems`, which maps the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` (today: Home `ROUTES.Root`, Scheduled tasks `ROUTES.ScheduledTasks`, Catalog `ROUTES.Catalog`, File manager `ROUTES.FileManager`) after filtering it through `useVisibleNavItems`. Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new button with no changes to `Navigation.tsx`, subject to the entry's gates.

Each `NavigationItem` MAY declare an optional `featureFlag: string` field. `useVisibleNavItems` (`apps/chat/src/hooks/useVisibleNavItems.ts`) SHALL apply two gates on every render: the overlay UI feature owning the entry's route (`OverlayFeature.Catalog` for `ROUTES.Catalog`, `OverlayFeature.FileManager` for `ROUTES.FileManager`; routes absent from that map are ungated), and the entry's `featureFlag`, which passes only when `useAppConfig().status` is `UserConfigStatus.Ready` and `features[featureFlag] === true`. Filtering MUST react to a flag value becoming available/changing after initial mount.

#### Scenario: Config drives rendered buttons

- **WHEN** `NAVIGATION_CONFIG` entries carry no `featureFlag` and their route features are enabled
- **THEN** one icon button per entry is rendered in the navigation rail

#### Scenario: Flag-gated item hidden when flag is off

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is not `true` in the ready app config
- **THEN** no button for that entry is rendered

#### Scenario: Flag-gated item shown when flag is on

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is `true` in the ready app config
- **THEN** a button for that entry is rendered, with the same `aria-label`/tooltip/active-state behavior as ungated entries

#### Scenario: Ungated entries are unaffected

- **WHEN** `NAVIGATION_CONFIG` mixes gated and ungated entries
- **THEN** every ungated entry renders regardless of any flag's value

#### Scenario: A disabled overlay feature hides its entry

- **WHEN** `OverlayFeature.Catalog` (or `OverlayFeature.FileManager`) is disabled
- **THEN** the Catalog (or File manager) entry is not rendered

---

### Requirement: Navigation sidebar exposes accessible labels and tooltip

Every rail `IconButton` MUST carry an `aria-label` equal to the item's `label`, which `useNavigationItems` resolves from the `labelKey` of its `NavigationItem` via `useTranslation().t()`. The same string MUST be passed to `tooltipProps.tooltip` so hover users see the label.

#### Scenario: aria-label and tooltip match the i18n value

- **WHEN** `<Navigation>` renders with the default config
- **THEN** the Home button has `aria-label="Chat"` and `tooltip="Chat"`, and the Catalog button has `aria-label="Catalog"` and `tooltip="Catalog"` (the `en.json` values of `navigation.home` and `navigation.catalog`)

---

### Requirement: UserMenu renders for authenticated users only

`<Navigation>` SHALL render the `UserMenu` from `@epam/ai-dial-navigation-panel` in the desktop rail footer only when `useUser().status` is `AuthStatus.Authenticated` with a user and `OverlayFeature.HideUserMenu` is off. Its trigger MUST be labelled with the i18n key `auth.signedInAs` interpolated with the profile email from `useNavigationUserProfile`. The dropdown MUST offer Settings (unless `OverlayFeature.HideSettingsPage` is on) and Log out. Log out MUST open `LogoutConfirmationModal`, whose confirm action calls `logout()` from `apps/chat/src/server-api/auth.api.ts` — a `fetch` `POST` to `ApiEndpoints.AUTH_LOGOUT` with the `X-CSRF-Token` header — and then, outside the overlay, replaces the document location with `ROUTES.Login` (inside the overlay it calls `useUser().reset()` instead).

#### Scenario: Unauthenticated state renders nothing

- **WHEN** `useUser()` returns an unauthenticated status
- **THEN** no user menu is rendered in the rail footer

#### Scenario: Loading state renders nothing

- **WHEN** authentication is still loading
- **THEN** no user menu is rendered

#### Scenario: Authenticated state shows user button

- **WHEN** the user is authenticated with email `user@example.com`
- **THEN** the rail renders a user-menu trigger whose accessible name contains `'user@example.com'` via the `auth.signedInAs` i18n interpolation

#### Scenario: Log out asks for confirmation

- **WHEN** the user chooses Log out in the user menu
- **THEN** the log-out confirmation dialog opens, and only confirming it sends the logout `POST` request

---

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible navigation string MUST be looked up via `useTranslation().t()`. Keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced through typed enums in `apps/chat/src/constants/translation-keys.ts` (`NavigationI18nKeys`, `AuthI18nKeys`, `ButtonsI18nKeys`, `BasicI18nKeys`, `ChatI18nKeys`). No hard-coded English strings are permitted in `Navigation.tsx`.

#### Scenario: Navigation keys are present in en.json

- **WHEN** the locale file is inspected
- **THEN** `en.json` contains `navigation.ariaLabel`, `navigation.home`, `navigation.catalog`, `navigation.menu`, `navigation.profile`, and `navigation.back`

#### Scenario: Components use the t function

- **WHEN** any string is rendered by `Navigation`
- **THEN** that string is the result of `t(SomeI18nKeys.Member)`, never a string literal

---

### Requirement: Tests cover the navigation surface

The navigation surface SHALL have a co-located Vitest spec, `apps/chat/src/components/Navigation/tests/Navigation.spec.tsx`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour.

#### Scenario: Navigation active-state tests

- **WHEN** the test suite for `Navigation` runs
- **THEN** it covers at least: nav landmark aria-label, Home button render, Home active on `/`, Catalog active on `/catalog`, Home not active on `/catalog`, each item rendered as a link with the correct href, and feature-flag / UI-feature gating of items

---

### Requirement: Unknown authenticated routes render a 404 recovery state

The authenticated React Router route table in `apps/chat/src/app/app.tsx` SHALL include an explicit catch-all route for unknown paths. The catch-all route MUST lazy-load an app-owned 404 page and render it inside the existing `RouteErrorBoundary` and `Suspense` route wrapper pattern.

The 404 page SHALL present a visible "Page not found" state instead of an empty application shell. It SHALL provide recovery actions to navigate to `/catalog`, navigate to `/`, and navigate back in browser history. The visual 404 label MAY animate, but MUST disable non-essential motion when the user prefers reduced motion.

All user-visible strings introduced by the 404 page MUST be resolved through `react-i18next` keys in `apps/chat/src/i18n/locales/en.json` and typed constants in `apps/chat/src/constants/translation-keys.ts`.

#### Scenario: Unknown route shows 404 state

- **WHEN** an authenticated user navigates to `/unknown-route`
- **THEN** the application shell renders a 404 state with the title from `notFound.title`
- **AND** the main content area is not blank

#### Scenario: Catalog recovery action navigates to catalog

- **WHEN** the user activates the 404 page catalog action
- **THEN** the SPA navigates to `/catalog`

#### Scenario: New chat recovery action navigates to root

- **WHEN** the user activates the 404 page new chat action
- **THEN** the SPA navigates to `/`

#### Scenario: Back recovery action uses browser history

- **WHEN** the user activates the 404 page back action
- **THEN** React Router receives a `navigate(-1)` request

#### Scenario: Directional back icon mirrors in RTL

- **WHEN** the document direction is `rtl`
- **THEN** the 404 page back arrow is visually mirrored

#### Scenario: Reduced motion disables 404 animation

- **WHEN** the user has `prefers-reduced-motion: reduce` enabled
- **THEN** non-essential 404 text motion is disabled

---

### Requirement: Scheduled Task detail route and helper

`apps/chat/src/types/routes.ts`'s `ROUTES` constant SHALL declare `ScheduledTaskDetail: '/scheduled-tasks/:scheduleId'`, registered in `apps/chat/src/app/app.tsx` as a lazy-loaded route alongside the existing `ROUTES.ScheduledTasks` registration; like the list route it is registered unconditionally, and the `scheduledTasksEnabled` feature-flag guard is applied inside the page through `useFeatureFlag('scheduledTasksEnabled')`. `apps/chat/src/constants/routes.ts` SHALL export `getScheduledTaskDetailRoute(scheduleId: string): string`, returning `` `/scheduled-tasks/${encodeURIComponent(scheduleId)}` ``, mirroring the existing `getConversationRoute` helper's pattern of building a route path from a caller-supplied id.

#### Scenario: Route path resolves for a given scheduleId

- **WHEN** `getScheduledTaskDetailRoute('sched_123')` is called
- **THEN** it returns `/scheduled-tasks/sched_123`

#### Scenario: scheduleId is percent-encoded in the resulting path

- **WHEN** `getScheduledTaskDetailRoute` is called with a `scheduleId` containing characters that require percent-encoding
- **THEN** the returned path has that `scheduleId` percent-encoded via `encodeURIComponent`

#### Scenario: Detail route is registered behind the same feature flag as the list route

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to a URL matching `ROUTES.ScheduledTaskDetail`
- **THEN** the lazy-loaded `ScheduledTaskDetailPage` route registration mounts, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern as the list route

---

### Requirement: Scheduled Task edit route and helper

`apps/chat/src/types/routes.ts`'s `ROUTES` constant SHALL declare `ScheduledTaskEdit: '/scheduled-tasks/:scheduleId/edit'`, registered in `apps/chat/src/app/app.tsx` as a lazy-loaded route alongside the existing `ROUTES.ScheduledTaskDetail` registration, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern. `apps/chat/src/constants/routes.ts` SHALL export `getScheduledTaskEditRoute(scheduleId: string): string`, returning `` `${getScheduledTaskDetailRoute(scheduleId)}/edit` `` so the `scheduleId` percent-encoding is inherited from `getScheduledTaskDetailRoute` rather than re-applied.

#### Scenario: Route path resolves for a given scheduleId

- **WHEN** `getScheduledTaskEditRoute('sched_123')` is called
- **THEN** it returns `/scheduled-tasks/sched_123/edit`

#### Scenario: scheduleId is percent-encoded in the resulting path

- **WHEN** `getScheduledTaskEditRoute` is called with a `scheduleId` containing characters that require percent-encoding
- **THEN** the returned path has that `scheduleId` percent-encoded via `encodeURIComponent` (inherited from `getScheduledTaskDetailRoute`)

#### Scenario: Edit route is registered with the same wrapper pattern as the detail route

- **WHEN** the user navigates to a URL matching `ROUTES.ScheduledTaskEdit`
- **THEN** the lazy-loaded `ScheduledTaskEditPage` route registration mounts, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern as `ROUTES.ScheduledTaskDetail`

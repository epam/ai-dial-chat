# Spec: navigation-routing

## Purpose

The top-level client-side routes, the navigation sidebar that reflects them, and the 404 recovery state for unknown routes.

## Requirements

### Requirement: Client-side routing resolves the top-level routes

`apps/chat/src/main.tsx` SHALL mount the router as a data router: a module-scope `createBrowserRouter` instance rendered through `<RouterProvider>`, replacing the former `<BrowserRouter>`. The router has a single splat root route (`path: '*'`). Its element is `AppRoot` (`apps/chat/src/AppRoot.tsx`), which renders the existing provider stack and the existing `<Routes>` (`/login`, `/overlay-close`, and the authenticated `*` branch) unchanged. Hooks such as `useBlocker` that require a data router SHALL therefore work anywhere in the tree. No loaders or actions are introduced.

The application SHALL declare its routes using React Router `<Routes>` in `apps/chat/src/app/app.tsx`, with paths taken from the `ROUTES` enum in `apps/chat/src/types/routes.ts`. Inside the `ChatLayout` layout route:

- `ROUTES.Root` (`/`) MUST render `<ConversationRoute>`, the welcome screen, which holds no message state.
- `/conversations/*` MUST render a lazy-loaded `<ConversationPage>`.

`ROUTES.Catalog` (`/catalog`) MUST render the lazy-loaded `<CatalogView>`: the full catalog, not a placeholder.

The other authenticated pages MUST likewise be lazy-loaded inside the `RouteErrorBoundary` + `Suspense`/`RouteFallback` wrapper. They are:

- `ROUTES.SharedInvitation` and `ROUTES.ConversationSharedInvitation`;
- `ROUTES.FileManager`;
- `ROUTES.Settings` and `ROUTES.SettingsTab`;
- the `ROUTES.ScheduledTasks*` routes;
- the `AppsEditor`, `ToolsetEditor`, `CustomAppEditor`, `PromptEditor` and `SkillEditor` editors;
- `ToolsetEditorCallback` and `ToolsetSignIn`.

Any unregistered path MUST fall through to the explicit `*` catch-all route.

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

#### Scenario: The router is a data router

- **WHEN** any component under the authenticated tree calls `useBlocker`
- **THEN** it does not throw the "must be used within a data router" invariant, and every existing route still resolves to the same element as before

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible navigation string MUST be looked up via `useTranslation().t()`. Keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced through typed enums in `apps/chat/src/constants/translation-keys.ts` (`NavigationI18nKeys`, `AuthI18nKeys`, `ButtonsI18nKeys`, `BasicI18nKeys`, `ChatI18nKeys`). No hard-coded English strings are permitted in `SidebarNavigation.tsx`.

#### Scenario: Navigation keys are present in en.json

- **WHEN** the locale file is inspected
- **THEN** `en.json` contains `navigation.ariaLabel`, `navigation.catalog`, `navigation.menu`, `navigation.sidebar`, `navigation.back`, `navigation.collapseSidebar`, and `navigation.expandSidebar`

#### Scenario: Components use the t function

- **WHEN** any string is rendered by `SidebarNavigation`
- **THEN** that string is the result of `t(SomeI18nKeys.Member)`, never a string literal

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

### Requirement: Sidebar items reflect the active route via aria-current

`useNavigationItems` (`apps/chat/src/hooks/navigation/useNavigationItems.ts`) SHALL read `useLocation().pathname` and set each item's `isActive`:
- an item with `isExactMatch` (the `ROUTES.Root` item) is active only on an exact match of its `path`; inside a conversation the active state belongs to the conversation's row, not to New chat;
- every other item is active when the pathname starts with its `path` or one of its `matchPaths`.

`NavigationSidebar` from `@epam/ai-dial-navigation-panel` SHALL render each item with `aria-current="page"` only while it is active, swapping to the item's filled `activeIcon` glyph when one is configured. The same items feed the desktop column and the mobile drawer.

#### Scenario: New chat is active on /

- **WHEN** the current pathname is `/`
- **THEN** the New chat item has `aria-current="page"` and the catalog item does NOT have `aria-current`

#### Scenario: New chat is not active inside a conversation

- **WHEN** the current pathname is `/conversations/<id>`
- **THEN** the New chat item does NOT have `aria-current="page"`

#### Scenario: Catalog is active on /catalog

- **WHEN** the current pathname is `/catalog`
- **THEN** the Catalog item has `aria-current="page"` and the New chat item does NOT have `aria-current`

### Requirement: Sidebar items navigate client-side

Each item MUST be wrapped by the `renderLink` callback `SidebarNavigation` passes to `NavigationSidebar`, which renders a React Router `<Link to={item.id}>` (the item's `path`) carrying the link props the sidebar hands it, in the desktop column and in the mobile drawer alike. Navigation MUST be client-side (no full page reload).

#### Scenario: Clicking New chat navigates to /

- **WHEN** the user clicks New chat while on `/catalog`
- **THEN** the client-side router navigates to `'/'` and the `/` route is rendered

#### Scenario: Clicking Catalog navigates to /catalog

- **WHEN** the user clicks the Catalog item while on `/`
- **THEN** the client-side router navigates to `'/catalog'` and the `/catalog` route is rendered

### Requirement: The sidebar is driven by NAVIGATION_CONFIG

`SidebarNavigation` (`apps/chat/src/components/Navigation/SidebarNavigation.tsx`) SHALL NOT hard-code route paths or icon components. It MUST render the items from `useNavigationItems`, which maps the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` (today: New chat `ROUTES.Root`, Scheduled tasks `ROUTES.ScheduledTasks`, Catalog `ROUTES.Catalog`, File manager `ROUTES.FileManager`) after filtering it through `useVisibleNavItems`. Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new item with no change to `SidebarNavigation.tsx`, subject to the entry's gates.

Each `NavigationItem` MAY declare an optional `featureFlag: string` field. `useVisibleNavItems` (`apps/chat/src/hooks/useVisibleNavItems.ts`) SHALL apply two gates on every render: the overlay UI feature owning the entry's route (`OverlayFeature.Catalog` for `ROUTES.Catalog`, `OverlayFeature.FileManager` for `ROUTES.FileManager`; routes absent from that map are ungated), and the entry's `featureFlag`, which passes only when `useAppConfig().status` is `UserConfigStatus.Ready` and `features[featureFlag] === true`. Filtering MUST react to a flag value becoming available/changing after initial mount.

#### Scenario: Config drives rendered items

- **WHEN** `NAVIGATION_CONFIG` entries carry no `featureFlag` and their route features are enabled
- **THEN** one item per entry is rendered in the sidebar

#### Scenario: Flag-gated item hidden when flag is off

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is not `true` in the ready app config
- **THEN** no item for that entry is rendered

#### Scenario: Flag-gated item shown when flag is on

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and that flag is `true` in the ready app config
- **THEN** an item for that entry is rendered, with the same label/tooltip/active-state behavior as ungated entries

#### Scenario: Ungated entries are unaffected

- **WHEN** `NAVIGATION_CONFIG` mixes gated and ungated entries
- **THEN** every ungated entry renders regardless of any flag's value

#### Scenario: A disabled overlay feature hides its entry

- **WHEN** `OverlayFeature.Catalog` (or `OverlayFeature.FileManager`) is disabled
- **THEN** the Catalog (or File manager) entry is not rendered

### Requirement: Sidebar items expose accessible labels and tooltips

Every item MUST carry an accessible name equal to the item's `label`, which `useNavigationItems` resolves from the `labelKey` of its `NavigationItem` via `useTranslation().t()`. While the sidebar is collapsed the same string MUST be the item's tooltip.

#### Scenario: Name and tooltip match the i18n value

- **WHEN** `SidebarNavigation` renders collapsed with the default config
- **THEN** the New chat item is named and has a tooltip equal to the `en.json` value of `buttons.newChat`, and the Catalog item to that of `navigation.catalog`

### Requirement: The sidebar's user menu renders for authenticated users only

`SidebarNavigation` SHALL render the `UserMenu` from `@epam/ai-dial-navigation-panel` in the sidebar footer only when `useUser().status` is `AuthStatus.Authenticated` with a user and `OverlayFeature.HideUserMenu` is off (and, in the mobile drawer, `OverlayFeature.HideNavigationMenu` is off). Its trigger MUST be named from the profile's display name followed by the i18n key `auth.signedInAs` interpolated with the profile email from `useNavigationUserProfile`. The dropdown MUST offer Settings (unless `OverlayFeature.HideSettingsPage` is on) and Log out. Log out MUST open `LogoutConfirmationModal`, whose confirm action calls `logout()` from `apps/chat/src/server-api/auth.api.ts` — a `fetch` `POST` to `ApiEndpoints.AUTH_LOGOUT` with the `X-CSRF-Token` header — and then, outside the overlay, replaces the document location with `ROUTES.Login` (inside the overlay it calls `useUser().reset()` instead).

#### Scenario: Unauthenticated state renders nothing

- **WHEN** `useUser()` returns an unauthenticated status
- **THEN** no user menu is rendered in the sidebar footer

#### Scenario: Loading state renders nothing

- **WHEN** authentication is still loading
- **THEN** no user menu is rendered

#### Scenario: Authenticated state shows the user button

- **WHEN** the user is authenticated with email `user@example.com`
- **THEN** the footer renders a user-menu trigger whose accessible name contains `'user@example.com'` via the `auth.signedInAs` i18n interpolation

#### Scenario: Log out asks for confirmation

- **WHEN** the user chooses Log out in the user menu
- **THEN** the log-out confirmation dialog opens, and only confirming it sends the logout `POST` request

### Requirement: SidebarNavigation has a co-located spec

The navigation surface SHALL have a co-located Vitest spec, `apps/chat/src/components/Navigation/tests/SidebarNavigation.spec.tsx`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour.

#### Scenario: Navigation tests

- **WHEN** the test suite for `SidebarNavigation` runs
- **THEN** it covers at least: the landmark, New chat as the root item and its active rule, feature-flag / UI-feature gating of items, the user menu's visibility and groups, and the mobile drawer's open, close and focus behaviour

### Requirement: The root item is presented as New chat

`NAVIGATION_CONFIG`'s `ROUTES.Root` entry SHALL render:
- with the label `t('buttons.newChat')` ("New chat");
- with an outline circle-plus icon, and a filled circle-plus while active;
- as active only on an exact `/`;
- not at all while `isEnabled('hide-new-conversation')` is `true`.

`SidebarNavigation` SHALL still hard-code no route paths or icons. The navigation entries and their routes are the same at every width.

#### Scenario: Root item label

- **WHEN** the sidebar renders
- **THEN** the first navigation item is named "New chat" and links to `/`

#### Scenario: Root item hidden

- **WHEN** `isEnabled('hide-new-conversation')` is `true`
- **THEN** no New chat item renders

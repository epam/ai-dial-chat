# Spec: navigation-routing

## Requirements

### Requirement: Client-side routing resolves three top-level routes

The application SHALL declare three routes using React Router v6 `<Routes>` in `apps/chat/src/app/app.tsx`. The `/` route MUST render `<ConversationRoute>` (the welcome screen — no longer holds message state). The `/catalog` route MUST render a lazy-loaded `<CatalogView>` stub. The `/conversations/:conversationId` route MUST render a lazy-loaded `<ConversationPage>`. Any unregistered path MUST NOT match these routes without an explicit fallback route.

#### Scenario: Root path renders the welcome screen

- **WHEN** the browser navigates to `/`
- **THEN** `<ConversationRoute>` is mounted and the welcome screen is visible with no message history

#### Scenario: Catalog path renders the catalog stub

- **WHEN** the browser navigates to `/catalog`
- **THEN** the lazy-loaded `<CatalogView>` is mounted and a "coming soon" placeholder is visible

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

### Requirement: Navigation sidebar reflects the active route via aria-current

The `<Navigation>` component SHALL read `useLocation().pathname` from React Router and mark exactly one `DialGhostIconButton` with `aria-current="page"` — the one whose configured `path` matches the current pathname. No other button SHALL carry `aria-current` at the same time.

#### Scenario: Home button is active on /

- **WHEN** the current pathname is `/`
- **THEN** the button with `aria-label` equal to the value of `navigation.home` has `aria-current="page"` and the catalog button does NOT have `aria-current`

#### Scenario: Catalog button is active on /catalog

- **WHEN** the current pathname is `/catalog`
- **THEN** the button with `aria-label` equal to the value of `navigation.catalog` has `aria-current="page"` and the home button does NOT have `aria-current`

#### Scenario: Home button exact-matches / only

- **WHEN** the current pathname is `/catalog`
- **THEN** the home button does NOT have `aria-current="page"` (prefix match on `/` MUST NOT fire for sub-paths)

---

### Requirement: Navigation buttons perform client-side navigation

Each `DialGhostIconButton` in the top section of `<Navigation>` MUST call `useNavigate()(path)` when clicked. Navigation MUST be client-side (no full page reload).

#### Scenario: Clicking Home navigates to /

- **WHEN** the user clicks the Home button while on `/catalog`
- **THEN** `useNavigate` is called with `'/'` and the `/` route is rendered

#### Scenario: Clicking Catalog navigates to /catalog

- **WHEN** the user clicks the Catalog button while on `/`
- **THEN** `useNavigate` is called with `'/catalog'` and the `/catalog` route is rendered

---

### Requirement: Navigation is driven by NAVIGATION_CONFIG

The `<Navigation>` component SHALL NOT hard-code route paths or icon components. It MUST iterate over the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` to render buttons. Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new button in the sidebar with no changes to `Navigation.tsx`.

#### Scenario: Config drives rendered buttons

- **WHEN** `NAVIGATION_CONFIG` contains two entries (home, catalog)
- **THEN** exactly two icon buttons are rendered in the top `<div>` of `<nav>`

---

### Requirement: Navigation sidebar exposes accessible labels and tooltip

Every `DialGhostIconButton` in the navigation top section MUST carry an `aria-label` derived from the `labelKey` field of its `NavigationItem` via `useTranslation().t()`. The same string MUST be passed to `tooltipProps.tooltip` so hover users see the label.

#### Scenario: aria-label and tooltip match the i18n value

- **WHEN** `<Navigation>` renders with the default config
- **THEN** the Home button has `aria-label="Home"` and `tooltip="Home"`, and the Catalog button has `aria-label="Catalog"` and `tooltip="Catalog"` (based on `en.json` values)

---

### Requirement: UserMenu renders for authenticated users only

The `<UserMenu>` component SHALL render `null` when `useUser().status` is `'loading'` or `'unauthenticated'`. When `status === 'authenticated'`, it MUST render a trigger button labelled with the i18n key `auth.signedInAs` interpolated with the user's email (from `user.claims.email`) or `user.sub` as fallback. Clicking the trigger MUST open a dropdown containing a form that performs a `POST` to `/api/v1/auth/logout` on submit.

#### Scenario: Unauthenticated state renders nothing

- **WHEN** `useUser()` returns `status = 'unauthenticated'`
- **THEN** `<UserMenu>` renders `null` and no button is visible in the bottom section of `<nav>`

#### Scenario: Loading state renders nothing

- **WHEN** `useUser()` returns `status = 'loading'`
- **THEN** `<UserMenu>` renders `null`

#### Scenario: Authenticated state shows user button

- **WHEN** `useUser()` returns `status = 'authenticated'` with `user.claims.email = 'user@example.com'`
- **THEN** `<UserMenu>` renders a button whose accessible name contains `'user@example.com'` via the `auth.signedInAs` i18n interpolation

#### Scenario: Dropdown opens on click

- **WHEN** the authenticated user clicks the `<UserMenu>` trigger button
- **THEN** a dropdown appears showing the email address and a sign-out button

#### Scenario: Sign-out uses a form POST

- **WHEN** the sign-out button inside the dropdown is clicked
- **THEN** a `<form method="POST" action="/api/v1/auth/logout">` is submitted (no `fetch` call)

---

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible string introduced by this change MUST be looked up via `useTranslation().t()`. Keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced through the typed enums `NavigationI18nKeys` and `CatalogI18nKeys` in `apps/chat/src/constants/translation-keys.ts`. No hard-coded English strings are permitted in `Navigation.tsx` or `CatalogView.tsx`.

#### Scenario: Navigation keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `navigation.ariaLabel`, `navigation.home`, and `navigation.catalog`

#### Scenario: Catalog keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `catalog.ariaLabel` and `catalog.comingSoon`

#### Scenario: Components use the t function

- **WHEN** any string is rendered by `Navigation` or `CatalogView`
- **THEN** that string is the result of `t(SomeI18nKeys.Member)`, never a string literal

---

### Requirement: Tests cover the navigation surface

The change SHALL ship co-located Vitest specs covering: `Navigation.spec.tsx` and `CatalogView.spec.tsx`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour.

#### Scenario: Navigation active-state tests

- **WHEN** the test suite for `Navigation` runs
- **THEN** it covers at least: nav landmark aria-label, Home button render, Catalog button render, Home active on `/`, Catalog active on `/catalog`, Home not active on `/catalog`, click-to-navigate

#### Scenario: CatalogView render tests

- **WHEN** the test suite for `CatalogView` runs
- **THEN** it covers at least: section landmark aria-label, coming-soon text visible

---

### Requirement: Unknown authenticated routes render a 404 recovery state

The authenticated React Router route table in `apps/chat/src/app/app.tsx` SHALL include an explicit catch-all route for unknown paths. The catch-all route MUST lazy-load an app-owned 404 page and render it inside the existing `RouteErrorBoundary` and `Suspense` route wrapper pattern.

The 404 page SHALL present a visible "Page not found" state instead of an empty application shell. It SHALL provide recovery actions to navigate to `/catalog`, navigate to `/`, and navigate back in browser history.

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

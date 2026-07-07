## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Navigation buttons perform client-side navigation

Each navigation item in the desktop `<Navigation>` sidebar MUST be rendered as a React Router `<Link to={path}>` wrapping a `DialGhostIconButton`. The `<Link>` MUST render a native `<a href="...">` element so the browser exposes the target URL. Left-click on the link MUST perform client-side SPA navigation (no full page reload). Middle-click MUST open the target route in a new browser tab. The `DialGhostIconButton` MUST carry `tabIndex={-1}` so only the `<a>` participates in the tab order. The `<Link>` wrapper MUST use `className="contents"` so it introduces no new box in the layout.

#### Scenario: Left-click navigates in the same tab

- **WHEN** the user left-clicks the Home button while on `/catalog`
- **THEN** the SPA performs client-side navigation to `/` and `<ConversationRoute>` is mounted without a full page reload

#### Scenario: Left-click Catalog navigates in the same tab

- **WHEN** the user left-clicks the Catalog button while on `/`
- **THEN** the SPA performs client-side navigation to `/catalog` without a full page reload

#### Scenario: Navigation items render as anchor elements

- **WHEN** `<Navigation>` renders on desktop
- **THEN** each navigation item has a corresponding `<a>` element in the DOM with an `href` matching its configured route path

#### Scenario: Home link href is /

- **WHEN** `<Navigation>` renders with the default config
- **THEN** the Home navigation item's anchor has `href="/"`

#### Scenario: Catalog link href is /catalog

- **WHEN** `<Navigation>` renders with the default config
- **THEN** the Catalog navigation item's anchor has `href="/catalog"`

## ADDED Requirements

### Requirement: Navigation tests cover link-based rendering

The `Navigation.spec.tsx` test suite MUST include tests verifying that navigation items render as anchor elements with the correct `href` attributes.

#### Scenario: Navigation items have correct href attributes

- **WHEN** the test suite for `Navigation` renders the component
- **THEN** it verifies that each navigation item has an `<a>` element with the expected `href` value from `NAVIGATION_CONFIG`

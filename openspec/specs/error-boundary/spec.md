# error-boundary Specification

## Purpose

The React error boundary: its accessible fallback, recovery paths, placement in the application tree, and what it must never disclose.

## Requirements

### Requirement: ErrorBoundary catches descendant render and lifecycle errors
The root and route wrappers SHALL use `react-error-boundary` to catch descendant errors thrown during render, construction, or React lifecycle methods.

The component SHALL NOT catch errors thrown inside event handlers, async functions (e.g., `useEffect` bodies after mount), or errors thrown by the boundary component itself.

**Fallback props interface:**
```ts
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  actionLabel?: string; // i18n key override, default "errorBoundary.retryLabel"
}
```

**i18n keys (all in `apps/chat/src/i18n/locales/en.json`):**
```json
"errorBoundary": {
  "heading": "Something went wrong",
  "description": "An unexpected error occurred. You can try again or reload the page.",
  "retryLabel": "Try again",
  "reloadLabel": "Reload the page"
}
```

#### Scenario: Normal rendering with no error
- **WHEN** a child component renders without throwing
- **THEN** `ErrorBoundary` SHALL render children normally with no visible change

#### Scenario: Child throws during render
- **WHEN** a descendant component throws an `Error` during a render cycle
- **THEN** the library boundary SHALL catch the error and render `ErrorFallback` in place of the crashed subtree
- **THEN** the configured root `onError` callback SHALL receive `(error, info)` where `info.componentStack` is the React component stack

#### Scenario: Root logging behavior
- **WHEN** the root boundary catches an error
- **THEN** its `onError` callback SHALL log the error and React error info through `console.error`

---

### Requirement: Accessible fallback UI
The default `ErrorFallback` component SHALL render an accessible, user-friendly error UI instead of a blank screen.

**Accessibility requirements:**
- The root element SHALL have `role="alert"` so screen readers announce it on mount.
- The first interactive element (recovery button) SHALL receive `autoFocus` so keyboard users can act immediately.
- The warning icon SHALL have `aria-hidden="true"` as it is decorative.
- The heading SHALL use an `<h2>` element.
- The recovery button SHALL be keyboard-accessible and focusable.

**RTL requirements:**
- All spacing and layout SHALL use logical Tailwind properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`).
- The warning icon is symmetric — it SHALL NOT be mirrored in RTL.

**Responsiveness:**
- The fallback SHALL be centered and readable on all named breakpoints: `mobile`, `small_tablet`, `large_tablet`, `desktop`, `large_desktop`.
- SHALL NOT introduce `sm:`, `md:`, `lg:`, or `xl:` breakpoints.

**i18n:**
- All visible text SHALL come from `useTranslation` using the keys defined in the `ErrorBoundary catches descendant render and lifecycle errors` requirement above.

#### Scenario: Fallback displays heading and description
- **WHEN** an error boundary has caught an error
- **THEN** the fallback SHALL display the translated heading (`errorBoundary.heading`) and description (`errorBoundary.description`)

#### Scenario: Fallback is announced to screen readers
- **WHEN** the fallback mounts
- **THEN** a DOM element with `role="alert"` SHALL be present, causing screen readers to announce it

#### Scenario: Recovery button has focus on mount
- **WHEN** the fallback mounts
- **THEN** the recovery action button SHALL have browser focus (`document.activeElement`)

#### Scenario: Fallback uses logical spacing in LTR
- **WHEN** the document direction is `ltr`
- **THEN** the fallback layout SHALL appear left-aligned following the writing direction

#### Scenario: Fallback uses logical spacing in RTL
- **WHEN** the document direction is `rtl`
- **THEN** the fallback layout SHALL mirror correctly without any physical-direction class producing an incorrect visual

---

### Requirement: Recovery — retry and reset
The `ErrorFallback` SHALL provide a recovery action button that either resets the error boundary (per-route) or reloads the page (root).

Recovery SHALL NOT trigger automatically; it SHALL only occur in response to an explicit user action, ensuring no infinite error loops are introduced by automatic recovery.

#### Scenario: Per-route retry resets the boundary
- **WHEN** the user clicks the recovery button inside a per-route `ErrorBoundary`
- **THEN** `resetErrorBoundary` SHALL request a boundary reset
- **THEN** the boundary SHALL attempt to re-render its children
- **THEN** if the same error recurs, the boundary SHALL catch it again and show the fallback — no automatic re-retry SHALL occur

#### Scenario: Root boundary recovery reloads the page
- **WHEN** the user clicks the recovery button inside the root `ErrorBoundary`
- **THEN** `window.location.reload()` SHALL be called

#### Scenario: Recovery button label is overridable
- **WHEN** a boundary wrapper passes a custom `actionLabel` i18n key
- **THEN** the `ErrorFallback` SHALL display the text resolved from that key

---

### Requirement: Root fallback remains stable until explicit recovery
The root boundary SHALL NOT reload, reset, or retry automatically after catching an error.

#### Scenario: Root crash does not create a reload loop
- **WHEN** the root boundary catches an error
- **THEN** it SHALL render the fallback and SHALL NOT call `window.location.reload()`
- **THEN** the crashed child subtree SHALL not be retried until the user activates the recovery button

---

### Requirement: Navigation-triggered boundary reset
The per-route `ErrorBoundary` SHALL reset its error state automatically when the user navigates to a different route, so that visiting a previously crashed route from a different URL starts fresh.

**Mechanism:** A thin functional wrapper reads `useLocation().pathname` and passes it through the library boundary's `resetKeys` prop.

**State concerns:** No context or browser storage is involved in per-route reset.

#### Scenario: Navigating away from a crashed route resets the boundary
- **WHEN** a per-route boundary is in an error state (fallback is shown)
- **AND** the user navigates to a different route (`pathname` changes)
- **THEN** the library SHALL reset the boundary through `resetKeys`
- **THEN** no fallback SHALL be shown on the new route (assuming the new route renders without error)

#### Scenario: Returning to the crashed route after navigating away
- **WHEN** the per-route boundary was in an error state on route A
- **AND** the user navigated to route B and back to route A
- **THEN** the boundary SHALL attempt to re-render route A's children (key changes twice, final key matches route A)

---

### Requirement: Boundary placement in the application tree
Two boundary instances SHALL be integrated into the application entry points.

**Root boundary** (`apps/chat/src/main.tsx`):
- Wraps the entire provider + router tree after `<React.StrictMode>` but before any context providers.
- Recovery action: reload via `window.location.reload()` only after an explicit button click.

**Per-route boundaries** (`apps/chat/src/app/app.tsx`):
- One boundary per lazy-loaded route: `CatalogView` and `ConversationPage`.
- Each boundary wraps the corresponding `<Suspense fallback={<RouteFallback />}>` block.
- Recovery action: call `resetErrorBoundary`.
- Navigation-triggered `resetKeys` reset is enabled.

**Existing `<RouteFallback />` and `<Suspense>` boundaries are preserved** — `ErrorBoundary` wraps around them; it does not replace Suspense.

**Feature flag / ENABLED_FEATURES:** not gated — error handling infrastructure is always active.

#### Scenario: Root boundary placement
- **WHEN** any context provider or core module throws during render
- **THEN** the root `ErrorBoundary` SHALL catch the error and display the full-page reload fallback

#### Scenario: Per-route boundary isolation
- **WHEN** a lazy-loaded route component throws during render
- **THEN** only that route's `ErrorBoundary` SHALL activate, showing the route-level fallback
- **THEN** the application shell (header, navigation) SHALL remain mounted

#### Scenario: Suspense and ErrorBoundary coexist
- **WHEN** a lazy-loaded module is loading (Suspense pending)
- **THEN** `<RouteFallback />` (the spinner) SHALL be shown — not the error fallback
- **WHEN** the lazy-loaded module loads and then throws during first render
- **THEN** the surrounding `ErrorBoundary` SHALL catch and display the error fallback

---

### Requirement: Security — no sensitive information disclosure
The `ErrorFallback` SHALL NOT expose raw error messages, stack traces, or component stacks in the rendered UI visible to the end user.

Development context (not applicable to production UI):
- In a local development environment, engineers can inspect caught root errors via the browser DevTools console.
- No stack trace, error message, or component stack SHALL appear in any rendered DOM element accessible to the end user in any environment.

#### Scenario: Error message is not rendered to the DOM
- **WHEN** a descendant throws an error with a message containing implementation details (e.g., file paths, variable names)
- **THEN** the `ErrorFallback` rendered DOM SHALL NOT contain that message text

---

### Requirement: Telemetry and observability
The `ErrorBoundary` SHALL rely exclusively on the existing `console.error` convention for error logging, and SHALL NOT introduce an external monitoring SDK.

**Logging format (root `onError` behavior):**
```ts
console.error('[ErrorBoundary] Caught root error:', error, info);
```
The `[ErrorBoundary]` prefix SHALL be present so logs are easily filterable in browser DevTools.

**Observability impact:** none beyond `console.error`. The wrapper's `onError` callback is the future monitoring integration point.

#### Scenario: Caught error is logged to the console
- **WHEN** the root error boundary catches an error
- **THEN** `console.error` SHALL be called with `'[ErrorBoundary] Caught root error:'`, the `Error` object, and the `React.ErrorInfo` object

---

### Requirement: Unit test coverage
Tests for `ErrorBoundary` and `ErrorFallback` SHALL live at `apps/chat/src/components/ErrorBoundary/tests/ErrorBoundary.spec.tsx` and SHALL use Vitest 4 + `@testing-library/react` 16 with role, label, and text queries.

**Required test cases:**
1. Normal children render when no error is thrown.
2. Fallback renders when a descendant throws (`role="alert"` container present, heading and description text visible).
3. Recovery button (`retryLabel`) resets the boundary and re-renders children.
4. Recovery button (`reloadLabel`) calls `window.location.reload` (mocked) when used in the root-boundary configuration.
5. A root crash logs the error and React error info.
6. A root crash does not call `window.location.reload()` automatically.
7. Repeated failures: child throws → user clicks retry → child throws again → boundary shows fallback again.
8. Recovery button has focus on mount (`document.activeElement` assertion).
9. `role="alert"` is present on the fallback root element.
10. Error message text does NOT appear in the rendered DOM.
11. Navigation reset through `resetKeys` clears the route error state.

**Memoisation:** `ErrorFallback` is a pure functional component with stable props; wrapping in `React.memo` is optional but acceptable.

#### Scenario: Test suite passes with no console errors from React
- **WHEN** the test suite for `ErrorBoundary` runs
- **THEN** all required test cases SHALL pass
- **THEN** the Vitest reporter SHALL show zero failing tests for the `chat` project

#### Scenario: Tests use observable behavior queries
- **WHEN** any test assertion is written
- **THEN** the assertion SHALL use `getByRole`, `getByText`, `getByLabelText`, or `queryByText` — NOT `getByTestId` unless no semantic query is available

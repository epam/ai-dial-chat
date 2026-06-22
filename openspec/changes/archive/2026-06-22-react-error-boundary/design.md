## Context

The AI DIAL Chat frontend (`apps/chat`) has no React ErrorBoundary. When a React component throws during render or a lifecycle method — due to a coding mistake, unexpected API payload, or transient browser condition — React 19 in production unmounts the entire tree and leaves a blank page. The README lists `ErrorBoundary` as a planned component (`apps/chat/README.md:20,81`) but it was never implemented.

**Current error-handling landscape:**
- Context-level data fetching errors are caught with `try/catch` and stored in component state (`ConversationsContext.tsx:71–78`).
- `console.error` is the sole logging mechanism; no telemetry or monitoring library is installed.
- Async API errors are handled in `apps/chat/src/server-api/base.ts:116–129` and surfaced via the `NotificationContext` toast system.
- Suspense fallbacks (`<RouteFallback />`) handle loading states for lazy-loaded routes (`app.tsx:127,135`) but do not address render errors.
- No error-boundary dependency or equivalent component existed before this change.

**Constraints inherited from the codebase:**
- Tailwind named breakpoints only (`mobile`, `small_tablet`, `large_tablet`, `desktop`, `large_desktop`); no `sm:`/`md:`/`lg:`/`xl:`.
- RTL support via logical Tailwind properties.
- i18n keys in `apps/chat/src/i18n/locales/en.json` using `{domain}.{element}` format.
- Components under `apps/chat/src/components/{ComponentName}/{ComponentName}.tsx`; tests under `…/{ComponentName}/tests/`.
- No changes under `libs/*` without explicit justification.

---

## Goals / Non-Goals

**Goals:**
- Catch unhandled React render and lifecycle errors in descendant components.
- Display an accessible, translated fallback UI with a concrete recovery action.
- Prevent a single route crash from destroying the entire application shell.
- Log caught errors consistently with the existing `console.error` convention.
- Reset route error state after navigation or on an explicit user retry.
- Pass all tests verifying observable behavior via ARIA role, label, and text queries.
- Keep application-specific integration self-contained inside `apps/chat`.

**Non-Goals:**
- Catching API (network/fetch) errors — those are handled in `server-api/` and surfaced via `NotificationContext`.
- Catching errors thrown inside event handlers — those cannot be caught by React error boundaries by design.
- Integrating an external error monitoring service (Sentry, Datadog) — no such system exists; the proposal explicitly avoids introducing one.
- Error boundary inside `libs/*` — React rendering infrastructure belongs to the application shell.
- Server-side error handling or backend changes.
- Replacing the existing `NotificationContext` toast system.

---

## Decisions

### Decision 1: Custom class-based component vs. `react-error-boundary` library

**Options:**
- **A. Custom class-based `ErrorBoundary`** — React's `getDerivedStateFromError` + `componentDidCatch` lifecycle. No new dependency.
- **B. Install `react-error-boundary`** (v4, Paul Henschel/Facebook) — adds `ErrorBoundary`, `useErrorBoundary`, `withErrorBoundary`. Saves ~50 lines of boilerplate.

**Decision: Option B — `react-error-boundary` library (v6.1.2).**

Rationale:
1. The library is maintained by the React core team alumni and is the de-facto standard for React error boundaries.
2. It provides `resetKeys` for navigation-triggered reset out of the box, replacing the manual key-prop wrapper.
3. The library handles `getDerivedStateFromError` / `componentDidCatch` boilerplate; our module exports thin wrappers (`RootErrorBoundary`, `RouteErrorBoundary`) that add application-specific recovery, logging, and navigation reset behavior.
4. `FallbackProps` type from the library ensures our `ErrorFallback` is compatible with the standard ecosystem.
5. `react-error-boundary` was installed as a direct dependency in `package.json`.

---

### Decision 2: Boundary placement

**Options:**
- **A. Single root boundary** around the entire provider tree — simplest but a crash in any route destroys the whole shell.
- **B. Root boundary + per-route boundaries** around each lazy-loaded route — a crash in one route shows a contained fallback; the shell header and navigation remain intact.
- **C. Granular boundaries around every async island** — excessive complexity for this project's scale.

**Decision: Option B — root boundary in `main.tsx` + per-route boundaries in `app.tsx`.**

Placement rationale:
- **Root boundary** (`main.tsx`, wrapping `BrowserRouter` + all providers): catches catastrophic failures that escape route-level isolation (e.g., a broken context provider). It renders a stable fallback and reloads only after the user presses the recovery button.
- **Per-route boundaries** (`app.tsx`, wrapping each `<Suspense>` + lazy route): catches route-level crashes. Recovery: reset the boundary (clears the thrown error) which lets the user navigate away or retry the route.
- Per-route boundaries should be placed _outside_ the `<Suspense>` so that Suspense loading-state errors are also caught.
- Navigation-triggered reset is achieved by passing `useLocation().pathname` through the library's `resetKeys` prop.

---

### Decision 3: Error state reset on navigation

Error boundaries do not automatically reset when the route changes. A functional wrapper reads `useLocation().pathname` and passes it through `resetKeys`. The library resets the route boundary when the pathname changes.

This technique applies to per-route boundaries only. The root boundary keeps its fallback mounted until the user explicitly requests a page reload.

---

### Decision 4: Logging strategy

**Option A: `console.error`** — consistent with `ThemeContext.tsx:80`, `UserContext.tsx:40`, `ConversationsContext.tsx` and every other error-logging site in the codebase.  
**Option B: Configure the library's `onError` callback** — allows the wrapper to plug in a future monitoring service without changing fallback behavior.

**Decision: Option B with root-level `console.error` logging.**

Rationale: the library's `onError(error, info)` callback is the natural integration point. The root wrapper logs through `console.error`; it can later delegate to monitoring without coupling `ErrorFallback` to a logging transport.

---

### Decision 5: Fallback UI composition

**Option A: A single opinionated fallback** hardcoded in `ErrorBoundary`.  
**Option B: Accept a `fallback` render prop** — fully custom fallback per boundary instance.  
**Option C: Reuse one `ErrorFallback` component through `FallbackComponent` / `fallbackRender`.**

**Decision: Option C — reuse `ErrorFallback`.**

Rationale: per-route boundaries use `FallbackComponent={ErrorFallback}`. The root uses `fallbackRender` to provide the reload action and label while preserving the same visual component.

---

### Decision 6: Accessible fallback UI

The fallback renders:
- `role="alert"` on the container so screen readers announce the error automatically.
- A translated heading (h2) — `errorBoundary.heading`.
- A translated description paragraph — `errorBoundary.description`.
- A translated action button (the recovery action) — `errorBoundary.retryLabel` / `errorBoundary.reloadLabel`.
- An `IconAlertTriangle` from `@tabler/icons-react` as a decorative warning icon (no ARIA label; `aria-hidden="true"`).
- `autoFocus` on the action button so keyboard users can immediately interact without tabbing.
- Logical Tailwind properties throughout (`ms-`, `me-`, `ps-`, `pe-`) for RTL correctness.

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Root boundary catches a crash inside a context provider (e.g., `ThemeProvider`), and the fallback itself depends on that provider (e.g., `useTheme`) | `ErrorFallback` must be self-contained and must not call any custom hooks that depend on app-level context providers. Use only `useTranslation` (i18next is initialized before providers) and direct Tailwind/inline styles. |
| Root boundary reload loop: an error fires on every mount after reload | Never reload from `onError`; keep the fallback mounted and reload only after an explicit user click. |
| Per-route reset re-renders the route with the same props that caused the crash | This is intentional: the user chose to retry. If the same error recurs, the boundary catches it again. No automatic retry occurs. |
| `autoFocus` on the action button may conflict with modal focus traps | `ErrorFallback` replaces the crashed subtree entirely; no modal is expected to be open simultaneously. If it is, the modal's focus trap will override `autoFocus`, which is acceptable. |
| `useTranslation` requires the i18n provider to be initialized | `i18next` is initialized via `i18n/config.ts` before `ReactDOM.createRoot` is called (`main.tsx`), so it is always available even if the React tree has partially failed. |
| The feature adds a small runtime dependency | `react-error-boundary` centralizes proven boundary/reset behavior and keeps app wrappers narrow. |

---

## Migration Plan

1. **Deploy**: The `ErrorBoundary` component is new; adding it to `main.tsx` and `app.tsx` is additive. No data migrations, no API changes, no feature flags required.
2. **Rollback**: Remove the `ErrorBoundary` wrapper from `main.tsx` and `app.tsx`. The only visible change is removing two component wrappings — low rollback risk.
3. **Backward compatibility**: Fully backward-compatible. The component is invisible during normal operation.

---

## Open Questions

*(none — all decisions resolved by codebase investigation and the functional requirements in the user brief)*

## 1. i18n — Add fallback text keys

- [x] 1.1 Add `errorBoundary` namespace to `apps/chat/src/i18n/locales/en.json` with keys: `heading`, `description`, `retryLabel`, `reloadLabel`
- [x] 1.2 Verify: `npm exec nx lint chat -- --quiet` passes (no unused i18n key lint errors)

## 2. Slice A — ErrorFallback component (no boundary logic yet)

- [x] 2.1 Create `apps/chat/src/components/ErrorBoundary/ErrorFallback.tsx` — functional component accepting `{ error: Error; reset: () => void; actionLabel?: string }` props; render `role="alert"` container, `<h2>` heading, description `<p>`, and action `<button>` with `autoFocus`; use `useTranslation` for all text; use `IconAlertTriangle aria-hidden="true"` from `@tabler/icons-react`; use logical Tailwind properties throughout
- [x] 2.2 Create `apps/chat/src/components/ErrorBoundary/tests/ErrorBoundary.spec.tsx` (file only; import `ErrorFallback` and write initial render test: heading and description are visible, `role="alert"` present, button has focus)
- [x] 2.3 Verify: `npm exec nx test chat -- --reporter=verbose --run` passes for the new spec file

## 3. Slice B — ErrorBoundary wrappers

- [x] 3.1 Add `react-error-boundary` and create `apps/chat/src/components/ErrorBoundary/ErrorBoundary.tsx` with narrow `RootErrorBoundary` and `RouteErrorBoundary` wrappers; reuse `ErrorFallback` and log root errors through the library's `onError` callback
- [x] 3.2 Add tests in `tests/ErrorBoundary.spec.tsx` covering: (a) children render normally, (b) fallback renders after child throws, (c) reset via retry button re-renders children, (d) root errors are logged, (e) root errors do not trigger automatic reload, (f) error message text does NOT appear in rendered DOM
- [x] 3.3 Verify: `npm exec nx test chat -- --reporter=verbose --run` passes for all cases above

## 4. Slice C — Navigation-triggered route reset

- [x] 4.1 Add a `RouteErrorBoundary` named export to `apps/chat/src/components/ErrorBoundary/ErrorBoundary.tsx` — a thin functional wrapper that reads `useLocation().pathname` and passes it through `resetKeys`
- [x] 4.2 Add tests proving a route identity change clears the error state and renders children again
- [x] 4.3 Verify: `npm exec nx test chat -- --reporter=verbose --run` passes for all cases

## 5. Slice D — Explicit root recovery

- [x] 5.1 Configure `RootErrorBoundary` to keep the fallback mounted after a crash and never reload from `onError`
- [x] 5.2 Pass a root recovery callback that calls `window.location.reload()` only when the user presses the fallback action
- [x] 5.3 Add tests proving a root crash does not reload automatically and a button click reloads exactly once
- [x] 5.5 Verify: `npm exec nx test chat -- --reporter=verbose --run` passes for all cases

## 6. Integration — Wire boundaries into the application

- [x] 6.1 In `apps/chat/src/main.tsx`: import `RootErrorBoundary`; wrap the existing `<BrowserRouter>` + provider tree after `<React.StrictMode>` but before all context providers; configure its fallback action to reload only after a user click
- [x] 6.2 In `apps/chat/src/app/app.tsx`: import `RouteErrorBoundary`; wrap each `<Suspense fallback={<RouteFallback />}>` block for `CatalogView` and `ConversationPage` with `<RouteErrorBoundary>` (outer boundary, inner Suspense); leave `RouteFallback` and `Suspense` unchanged
- [x] 6.3 Add integration test to `tests/ErrorBoundary.spec.tsx`: render `RouteErrorBoundary` with a throwing child → fallback appears; simulate navigation key change → children render without fallback
- [x] 6.4 Verify: `npm exec nx test chat -- --reporter=verbose --run` passes; `npm exec nx lint chat -- --quiet` passes; `npm exec nx build chat` compiles without type errors

## 7. Final verification

- [x] 7.1 Run full affected test suite: `npm exec nx affected --target=test --base=origin/development-1.0` — zero failing tests
- [x] 7.2 Run affected lint: `npm exec nx affected --target=lint --base=origin/development-1.0` — zero lint errors
- [x] 7.3 Run affected typecheck: `npm exec nx affected --target=typecheck --base=origin/development-1.0` — zero type errors
- [x] 7.4 Run affected build: `npm exec nx affected --target=build --base=origin/development-1.0` — build succeeds
- [ ] 7.5 Manually smoke-test in dev server (`npm start`): confirm the application loads normally (no error boundary visible); open browser console and verify no unexpected errors

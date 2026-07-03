## Design

### Routing

`apps/chat/src/app/app.tsx` owns the authenticated route table. Add `NotFoundPage` with `React.lazy` next to the existing route components and register it as the final `<Route path="*">`.

The route uses the established route wrapper:

- `RouteErrorBoundary`
- `Suspense fallback={<RouteFallback />}`
- lazy route component

This keeps the 404 behaviour consistent with Catalog, editor, and conversation routes.

### UI

`apps/chat/src/pages/NotFound/NotFound.tsx` renders an app-level page, not a catalog library component. It follows the catalog empty-state visual language without embedding catalog domain logic:

- catalog background via `--cat-bg` fallback in `NotFound.module.scss`
- centered empty-state content
- no decorative icon container, border, or contrasting background
- primary action to Catalog, secondary action to New chat, and a text back action

### Library Isolation

No hand-authored `libs/*` files change. Routing paths, navigation calls, and host-specific recovery actions remain in `apps/chat`. The catalog library is not asked to know about app routes or 404 state.

### i18n

New strings:

- `notFound.ariaLabel`
- `notFound.eyebrow`
- `notFound.title`
- `notFound.description`
- `notFound.openCatalog`
- `notFound.newChat`

The existing `navigation.back` key is reused for the back action.

### RTL and Responsiveness

The page uses centered layout and logical-free spacing that does not encode left/right positioning. The back arrow has `rtl:scale-x-[-1]` because it has inherent direction. The action stack is mobile-first (`flex-col`) and switches to `desktop:flex-row`.

### Accessibility

The 404 surface is a labelled `section` landmark using `notFound.ariaLabel`. Buttons use existing UI kit button semantics. The decorative grid icon is `aria-hidden`.

### Feature Flags and APIs

No feature flag, backend endpoint, generated client, cache, telemetry, or rate limit changes are required.

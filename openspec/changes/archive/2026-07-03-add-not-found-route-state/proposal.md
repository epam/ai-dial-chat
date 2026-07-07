## Problem

Authenticated users who navigate to an unknown client-side route, for example `/sadasdas`, see the application shell with an empty content area. This looks broken and gives no recovery path.

Closest existing routing file: `apps/chat/src/app/app.tsx` declares all authenticated React Router routes but currently has no authenticated catch-all route. Closest existing visual pattern: `libs/catalog/src/components/Catalog/Catalog.tsx` renders the catalog page surface and catalog empty states use `DialNoDataContent` through `PanelEmptyState`.

## Solution

Add an authenticated catch-all `path="*"` route in `apps/chat/src/app/app.tsx` that lazy-loads an app-owned `NotFoundPage`. The page uses catalog-like structure: a catalog background, a 64px title row, centered empty-state content, and clear recovery actions to open Catalog, start a new chat, or go back.

New user-visible strings are added under `notFound.*` and referenced through `NotFoundI18nKeys`.

## Non-goals

- No backend 404 handling changes.
- No changes to unauthenticated `/login` routing.
- No redirect from unknown routes; users should see an explicit 404 state.
- No changes to `libs/catalog`; host routing stays at the app edge.

## Alternatives Considered

- Redirect unknown routes to `/`: simplest, but hides the broken URL and gives users no explanation.
- Reuse the full `Catalog` component with empty data: visually close, but semantically wrong and would require catalog-specific props for a routing error.
- App-owned 404 page following catalog visual tokens: chosen because it is small, explicit, and keeps routing knowledge in `apps/chat`.

## Acceptance Criteria

- Navigating to any authenticated unknown route renders a visible Page not found state instead of an empty shell.
- The state provides actions to open `/catalog`, start a new chat at `/`, and navigate back.
- The UI uses i18n keys for all new visible strings.
- The route component is lazy-loaded and wrapped in the existing route error boundary and Suspense fallback pattern.
- The page works on mobile and desktop without horizontal overflow; layout uses mobile-first classes and the project `desktop:` breakpoint.

## Rollback

Revert the catch-all route, remove `apps/chat/src/pages/NotFound`, and remove `NotFoundI18nKeys` plus the `notFound` translations. No data migration or API rollback is required.

## Impact

- **Modified**: `apps/chat/src/app/app.tsx`
- **Added**: `apps/chat/src/pages/NotFound/NotFound.tsx`
- **Added**: `apps/chat/src/pages/NotFound/NotFound.module.scss`
- **Added**: `apps/chat/src/pages/NotFound/tests/NotFound.spec.tsx`
- **Modified**: `apps/chat/src/constants/translation-keys.ts`
- **Modified**: `apps/chat/src/i18n/locales/en.json`

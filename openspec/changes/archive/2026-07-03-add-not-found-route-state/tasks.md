## 1. Routing

- [x] 1.1 Add lazy `NotFoundPage` import to `apps/chat/src/app/app.tsx`
- [x] 1.2 Register final authenticated `<Route path="*">` wrapped in `RouteErrorBoundary` and `Suspense`

## 2. 404 UI

- [x] 2.1 Add `apps/chat/src/pages/NotFound/NotFound.tsx`
- [x] 2.2 Style the page as a catalog-like centered empty state using `NotFound.module.scss`
- [x] 2.3 Add recovery actions for Catalog, New chat, and Back
- [x] 2.4 Mirror the directional back icon in RTL

## 3. i18n

- [x] 3.1 Add `NotFoundI18nKeys` to `apps/chat/src/constants/translation-keys.ts`
- [x] 3.2 Add `notFound.*` strings to `apps/chat/src/i18n/locales/en.json`

## 4. Tests and Verification

- [x] 4.1 Add `apps/chat/src/pages/NotFound/tests/NotFound.spec.tsx`
- [x] 4.2 Verify the NotFound recovery actions navigate to `/catalog` and `/`
- [x] 4.3 Run `npm exec nx test chat -- src/pages/NotFound/tests/NotFound.spec.tsx`
- [x] 4.4 Run `npm exec nx typecheck chat`
- [x] 4.5 Run targeted ESLint for changed app files

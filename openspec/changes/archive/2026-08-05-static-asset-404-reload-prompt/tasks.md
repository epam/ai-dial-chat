## 1. Backend — static asset 404 fix

- [x] 1.1 Exclude `/assets/**` from the frontend SPA `renderPath` fallback in `apps/chat-api/src/app/static-assets.ts`
- [x] 1.2 Exclude `/overlay-sandbox/assets/**` from the overlay sandbox SPA `renderPath` fallback in the same file
- [x] 1.3 Add regression tests in `apps/chat-api/src/app/tests/static-assets.spec.ts` covering: existing asset served with correct content type, missing frontend asset returns 404 (not `index.html`), missing overlay sandbox asset returns 404 (not the sandbox `index.html`)
- [x] 1.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` to confirm the fix and tests pass

## 2. Backend — build identifier on the health endpoint

- [x] 2.1 ~~Add optional `BUILD_ID` to `EnvironmentVariables`~~ — superseded: no new environment variable, see 2.2
- [x] 2.2 In `apps/chat-api/src/health/health.controller.ts`, compute the response's `buildId` by hashing the served frontend's `index.html` (via `resolveFrontendRootPath` from `../app/static-assets`) with `crypto.createHash('sha256')` once at module load, cached in a module-level constant; falls back to a per-process timestamp when no built frontend is present on disk (local dev)
- [x] 2.3 Update the `@ApiResponse` schema for `GET /api/health` to document the new `buildId` string field with an example value
- [x] 2.4 Regenerate the OpenAPI spec and client: `npm run openapi && npm run openapi:check`; confirm `Check200Response` in `libs/chat-api-client` gains `buildId`
- [x] 2.5 Add/extend a controller test asserting `buildId` is present and stable across repeated calls within the same process
- [x] 2.6 ~~Document `BUILD_ID` as a deploy-pipeline-provided environment variable~~ — not applicable: no env var to document

## 3. Frontend — version-check hook

- [x] 3.1 Create `apps/chat/src/hooks/useAppVersionCheck/useAppVersionCheck.ts`: on mount, call `healthApi.check()` (via the existing generated-client wrapper) to capture the baseline `buildId`; JSDoc explaining why polling exists
- [x] 3.2 Poll on a 5-minute interval while mounted; also re-check immediately on `visibilitychange` when the tab becomes visible
- [x] 3.3 On a `buildId` mismatch, set `isNewVersionAvailable` to `true` and clear the interval; on request failure, leave state unchanged and retry next interval
- [x] 3.4 Clean up the interval and any visibility listener in the `useEffect` cleanup function
- [x] 3.5 Add unit tests in `apps/chat/src/hooks/useAppVersionCheck/tests/useAppVersionCheck.spec.ts` covering: baseline capture, mismatch detection, match keeps polling, failed poll doesn't false-positive, cleanup on unmount

## 4. Frontend — full-screen reload fallback UI

- [x] 4.1 ~~Add dismiss-related i18n keys~~ — superseded: add `AppUpdateI18nKeys.Heading` / `.Message` to `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`; reuse existing `ErrorBoundaryI18nKeys.ReloadLabel` for the button instead of a new key
- [x] 4.2 ~~Create `NewVersionBanner`~~ — superseded: create `apps/chat/src/components/NewVersionFallback/NewVersionFallback.tsx`, matching `ErrorFallback`'s visual pattern (icon, heading, message, `autoFocus` primary button, `role="alert"` container); reload button calls `window.location.reload()`
- [x] 4.3 ~~RTL/logical-class check for the banner~~ — not applicable: `NewVersionFallback` has no directional layout beyond what `ErrorFallback` already establishes
- [x] 4.4 ~~Focus-visible parity for banner controls~~ — not applicable: single `PrimaryButton`, same component `ErrorFallback` already uses
- [x] 4.5 Wire `NewVersionFallback` into `apps/chat/src/app/app.tsx`: call `useAppVersionCheck` alongside `App`'s other hooks and return `<NewVersionFallback />` instead of the normal layout whenever `isNewVersionAvailable` is `true`, so it applies regardless of route
- [x] 4.6 Add component tests in `apps/chat/src/components/NewVersionFallback/tests/NewVersionFallback.spec.tsx` covering: renders `role="alert"`, heading, message, reload button (focused on mount, triggers `window.location.reload()`)

## 5. Verification

- [x] 5.1 `npm exec nx affected --target=test --base=origin/development-1.0`
- [x] 5.2 `npm exec nx affected --target=lint --base=origin/development-1.0`
- [x] 5.3 `npm exec nx build chat-api` and `npm exec nx build chat` to confirm no build regressions
- [ ] 5.4 Manually verify in a running instance: load the app, simulate a deploy by rebuilding `apps/chat` (changing `index.html`'s hash) and restarting `chat-api`, confirm `NewVersionFallback` replaces the app within one poll/visibility-change cycle and reload picks up the new build without a MIME-type error

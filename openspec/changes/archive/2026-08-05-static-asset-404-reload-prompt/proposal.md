## Why

Production browsers intermittently fail to load chat bundles with errors like
"Expected a JavaScript-or-Wasm module script but the server responded with a
MIME type of 'text/html'" for hashed files under `/assets/*.js` and
`/assets/*.css`. Root cause: `apps/chat-api`'s SPA fallback (`ServeStaticModule`
with a catch-all `renderPath`) responds to *any* unmatched route — including a
missing static asset — with `200 text/html` (`index.html`) instead of a `404`.
A stale hashed filename (referenced by an `index.html` a long-lived tab loaded
before a new deploy replaced `dist/`) therefore looks like a corrupt
JS/CSS file to the browser instead of a clear "not found." Long-lived tabs
across a deploy have no way to detect the mismatch and self-recover; they keep
requesting assets that no longer exist until the user manually reloads.

## What Changes

- Exclude `/assets/**` (both the main frontend static root and the
  `/overlay-sandbox/assets/**` root) from the SPA fallback `renderPath`, so a
  missing static asset returns a real `404` instead of `index.html`.
  *(Already implemented in `apps/chat-api/src/app/static-assets.ts` on this
  branch — this proposal formalizes and specs it.)*
- Add a "new version available" detection mechanism on the frontend: while a
  tab is open, periodically check whether the deployed build has changed
  (compare a `buildId` returned by a health endpoint against the one the tab
  loaded with) and, when a new version is detected, replace the app with a
  full-screen reload prompt — reusing the existing `ErrorFallback` visual
  pattern — instead of continuing to request stale hashed chunk filenames.

## Capabilities

### New Capabilities

- `spa-static-asset-404`: Backend static-asset serving returns `404` for any
  unmatched path under `/assets/**` (main app and overlay sandbox) instead of
  falling back to `index.html`, while unrelated client-side routes still
  receive the SPA `index.html` fallback.
- `frontend-new-version-reload`: Frontend detects that a newer build has been
  deployed while a tab is open and prompts the user to reload, so the tab
  stops requesting hashed asset filenames that no longer exist on the server.

### Modified Capabilities

- `chat-api-backend`: The existing health check endpoint's response body
  gains a stable build identifier field so the frontend can detect that a
  newer build has been deployed.

## Impact

- `apps/chat-api/src/app/static-assets.ts` — SPA fallback exclude patterns
  (backend, already implemented).
- `apps/chat-api/src/app/tests/static-assets.spec.ts` — regression coverage
  for the 404 behavior (backend, already implemented).
- New frontend code in `apps/chat` for version polling/detection and a reload
  prompt UI (not yet implemented — scoped by this change).
- `apps/chat-api/src/health/health.controller.ts` gains a `buildId` field
  computed by hashing the served frontend's `index.html`, with no new
  environment variable or deploy-pipeline coordination required.

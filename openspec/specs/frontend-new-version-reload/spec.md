## Purpose

Detect when a newer build has been deployed while a chat tab remains open, and prompt the user to reload rather than letting the tab keep running against stale static assets.

## Requirements

---

### Requirement: App-version polling hook

The `useAppVersionCheck` hook in `libs/chat-hooks/src/shared/useAppVersionCheck/useAppVersionCheck.ts` (exported from `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/utils`) SHALL own the "is a new version available" state. The host passes the health request as `checkHealth`; `apps/chat` passes `checkHealth` from `apps/chat/src/server-api/health.api.ts`, which wraps the generated `HealthApi.check()` from `@epam/ai-dial-chat-api-client` with `cache: 'no-store'` and the hook's abort signal. On mount the hook SHALL capture the returned `buildId` as the baseline for the current tab, then re-check on a fixed interval (5 minutes) while the tab is visible, whenever the tab becomes visible again (`visibilitychange`, `focus`, `pageshow`), and on the first `pointerdown`/`keydown` after an idle period at least as long as the interval. Only one request SHALL be in flight at a time, and a request still pending after 10 seconds SHALL be aborted. A response without a `buildId` and a failed request are ignored. A `vite:preloadError` event (a chunk of the running build failed to load) SHALL be prevented and SHALL report a new version immediately. Once a new version is reported, and on unmount, the hook SHALL abort the pending request and remove every timer and listener.

#### Scenario: Baseline build id captured on load

- **WHEN** the app mounts
- **THEN** the hook calls `GET /api/health` once and stores the returned `buildId` as the tab's baseline, without yet flagging a new version

#### Scenario: Poll detects a newer deployed build

- **WHEN** a subsequent poll's `buildId` differs from the baseline captured at load
- **THEN** the hook sets `isNewVersionAvailable` to `true` and stops further polling

#### Scenario: Poll confirms no change

- **WHEN** a poll's `buildId` matches the baseline
- **THEN** the hook keeps `isNewVersionAvailable` as `false` and continues polling on the next interval

#### Scenario: Hook cleans up on unmount

- **WHEN** the component using the hook unmounts
- **THEN** the polling interval is cleared and no further requests are made

#### Scenario: Transient health-check failure does not falsely report a new version

- **WHEN** a poll's request to `GET /api/health` fails (network error or non-200 response)
- **THEN** the hook leaves `isNewVersionAvailable` unchanged and retries on the next interval

#### Scenario: Hidden tab is not polled

- **WHEN** the tab is hidden while the interval elapses
- **THEN** the hook makes no request, and checks as soon as the tab becomes visible again

#### Scenario: Hung health request is aborted

- **WHEN** a health request has not settled after 10 seconds
- **THEN** the hook aborts it and the next check sends a new request

#### Scenario: Failed chunk load reports a new version

- **WHEN** the running build fails to load a chunk and Vite dispatches `vite:preloadError`
- **THEN** the hook prevents the event's default and sets `isNewVersionAvailable` to `true` without waiting for a health check

---

### Requirement: Full-screen reload prompt

A `NewVersionFallback` component in `apps/chat/src/components/NewVersionFallback/` SHALL render in place of the entire app (rendering `NewVersionAlert` from `@epam/ai-dial-chat-shared` with translated labels and an `onReload` that calls `window.location.reload()`; `NewVersionAlert` shares the error boundary's layout — the kit `StateScreen` icon badge, `h1` heading, message, and auto-focused `PrimaryButton` action, with no live-region role) when `useAppVersionCheck` reports `isNewVersionAvailable === true`. `App` (`apps/chat/src/app/app.tsx`) SHALL call `useAppVersionCheck` and return `<NewVersionFallback />` instead of its normal layout whenever `isNewVersionAvailable` is `true`, blocking further interaction with the stale build until the user reloads.

The fallback is always active and is NOT gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a reliability affordance, not a product feature toggle.

#### Scenario: Fallback replaces the app on version mismatch

- **WHEN** `isNewVersionAvailable` becomes `true`
- **THEN** `App` renders `NewVersionFallback` instead of its normal layout (navigation, conversation panel, main content)

#### Scenario: Reload action reloads the page

- **WHEN** the user activates the fallback's reload button
- **THEN** the browser performs a full page reload (`window.location.reload()`), fetching the current `index.html` and its up-to-date hashed asset references

#### Scenario: Reload button receives focus automatically

- **WHEN** the fallback mounts
- **THEN** the reload button receives focus (`autoFocus`), matching the error boundary's fallback, so keyboard users can act immediately

#### Scenario: Fallback strings are translated

- **WHEN** the fallback renders
- **THEN** its heading and message come from a new `AppUpdateI18nKeys` string enum in `apps/chat/src/constants/translation-keys.ts` with matching keys in `apps/chat/src/i18n/locales/en.json`, and its reload button reuses the existing `ErrorBoundaryI18nKeys.ReloadLabel` key rather than duplicating that string

---

### Requirement: Health endpoint exposes a build identifier

The frontend SHALL rely on `GET /api/health`'s `buildId` field (see the corresponding `chat-api-backend` modification) as the sole source of truth for detecting a new deployment. No other endpoint or asset (e.g. parsing `index.html`) SHALL be used for this comparison, keeping the detection mechanism decoupled from `apps/chat`'s build output shape.

#### Scenario: Frontend never parses index.html for version detection

- **WHEN** `useAppVersionCheck` determines whether a new version is available
- **THEN** it compares only the `buildId` field returned by `GET /api/health`, and does not fetch or inspect `index.html`

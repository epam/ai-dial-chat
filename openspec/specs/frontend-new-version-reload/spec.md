## Purpose

Detect when a newer build has been deployed while a chat tab remains open, and prompt the user to reload rather than letting the tab keep running against stale static assets.

## Requirements

---

### Requirement: App-version polling hook

A `useAppVersionCheck` hook in `apps/chat/src/hooks/` SHALL own the "is a new version available" state. On mount it SHALL capture the `buildId` from the `GET /api/health` response (via the generated `HealthApi.check()` method from `@epam/chat-api-client`) as the baseline for the current tab, then poll the same endpoint on a fixed interval (default: every 5 minutes) for as long as the tab remains open. The hook SHALL memoise its returned value and stop its interval on unmount (`useEffect` cleanup) to avoid leaking timers across route changes.

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

---

### Requirement: Full-screen reload prompt

A `NewVersionFallback` component in `apps/chat/src/components/NewVersionFallback/` SHALL render in place of the entire app (matching the visual pattern of `ErrorFallback` — an icon, heading, message, and primary action button, in a `role="alert"` container) when `useAppVersionCheck` reports `isNewVersionAvailable === true`. `App` (`apps/chat/src/app/app.tsx`) SHALL call `useAppVersionCheck` and return `<NewVersionFallback />` instead of its normal layout whenever `isNewVersionAvailable` is `true`, blocking further interaction with the stale build until the user reloads.

The fallback is always active and is NOT gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — it is a reliability affordance, not a product feature toggle.

#### Scenario: Fallback replaces the app on version mismatch

- **WHEN** `isNewVersionAvailable` becomes `true`
- **THEN** `App` renders `NewVersionFallback` instead of its normal layout (navigation, conversation panel, main content)

#### Scenario: Reload action reloads the page

- **WHEN** the user activates the fallback's reload button
- **THEN** the browser performs a full page reload (`window.location.reload()`), fetching the current `index.html` and its up-to-date hashed asset references

#### Scenario: Reload button receives focus automatically

- **WHEN** the fallback mounts
- **THEN** the reload button receives focus (`autoFocus`), matching `ErrorFallback`'s existing pattern, so keyboard users can act immediately

#### Scenario: Fallback strings are translated

- **WHEN** the fallback renders
- **THEN** its heading and message come from a new `AppUpdateI18nKeys` string enum in `apps/chat/src/constants/translation-keys.ts` with matching keys in `apps/chat/src/i18n/locales/en.json`, and its reload button reuses the existing `ErrorBoundaryI18nKeys.ReloadLabel` key rather than duplicating that string

---

### Requirement: Health endpoint exposes a build identifier

The frontend SHALL rely on `GET /api/health`'s `buildId` field (see the corresponding `chat-api-backend` modification) as the sole source of truth for detecting a new deployment. No other endpoint or asset (e.g. parsing `index.html`) SHALL be used for this comparison, keeping the detection mechanism decoupled from `apps/chat`'s build output shape.

#### Scenario: Frontend never parses index.html for version detection

- **WHEN** `useAppVersionCheck` determines whether a new version is available
- **THEN** it compares only the `buildId` field returned by `GET /api/health`, and does not fetch or inspect `index.html`

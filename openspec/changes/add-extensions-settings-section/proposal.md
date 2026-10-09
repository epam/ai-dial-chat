# Proposal: add-extensions-settings-section

## Why

Issue [#9108](https://github.com/epam/ai-dial-chat/issues/9108) delivered the signout chain for the external Scheduler auth service's offline-credentials grant, but the revoke affordance lives in the Scheduled Tasks page header — a task-management surface. Service connections are account-level concerns, not task-list concerns: a user managing their connected services should not have to visit the Scheduled Tasks page to find the single Disconnect button there. The product decision (issue #9108 follow-up plan) is a dedicated **Extensions** section in Settings that lists connected external services with a per-row logout, replacing the page-header button.

## What Changes

- **New Settings tab "Extensions"**: `SettingsTabs.Extensions` member + a `useSettingsTabConfig` entry with `IconPlugConnected`, rendered through the existing `SettingsPage`/`SettingsPanel` machinery at `/settings/extensions` (no new route registration — the tab route is data-driven like `Usage`).
- **Extensions section UI**, modeled on the Usage tab's page-heading pattern and `libs/usage-dashboard`'s `ModelLimitsSection` table pattern:
  - Heading "Extensions" (`dial-h1-text`, matching `UsageTab`'s page heading) and description "Access additional tools and capabilities through extensions." (`dial-small-text`).
  - A div-based ARIA table (`role="table"`/`row`/`columnheader`/`cell`) with columns **Name**, **Description**, and a visually empty trailing action column carrying the per-row logout button.
- **One row: the external Scheduler auth service** (the offline-credentials grant). The Name cell renders a square `InitialsAvatar` with the service's initials (derived from the Core-reported client identity, e.g. `dial-apps` → `DA`) beside the service display name; the Description cell carries the service description ("Provides access to built-in apps within the platform."). While the service is disconnected, a warning icon (the login banner's `IconAlertTriangleFilled` glyph) overlays the avatar's bottom-inline-start corner as a small badge.
- **State-dependent row action — Log in / Log out**: the action cell renders **Log out** (carrying the `IconLogout` glyph — the same icon the removed Disconnect header action used) while the service is connected and **Log in** while it is available and disconnected.
- **Logout flow relocates from `ScheduledTasksPage`**: the row's Log out button opens the existing `ConfirmationPopup`-based confirm; on confirm it calls the existing `signOutOfflineCredentials()` (no BFF change) and is **refetch-authoritative** — a fresh `GET /api/v1/offline-credentials` decides the row's next state.
- **Login flow reuses the existing machinery**: the row's Log in button drives the existing `useOfflineCredentialsLogin` OAuth-popup flow with the gate's `connect` settings; a fresh refetch decides the row's next state, mirroring the refetch-authoritative rule on both sides.
- **Auto-login on save failure (edit/create pages)**: when a scheduled-task create or edit submit fails with a 403 attributed to the logged-out service (the existing #9046 disambiguation check, which now also yields the `connect` settings), the page **auto-invokes the login flow** — at most once per Save activation. On success it automatically retries the submit with the same body; on failure (blocked/cancelled/timeout/error) it shows a login-failed toast, keeps the form state, and lets the user Save again (which re-runs the full path). The prior "session expired" toast is replaced by the login-failed fallback.
- **Removal**: the Scheduled Tasks page header Disconnect button, its dialog/state, and its i18n keys are removed; `libs/scheduled-tasks`' `onDisconnectClick`/`disconnectButtonLabel`/`disconnectAriaLabel` props are removed from the public API (README, tests, props model) — the lib reverts to a single header action.
- **i18n**: new keys under the settings namespace (tab label, heading, description, column headers, service display name fallback, logout/confirm strings, announcements); `scheduledTasks.disconnect.*` keys removed.

## Non-goals

- **Any change to the Scheduled Tasks page banner** — the banner stays as the task-list indication surface with its own Log in action; the Extensions row adds a second login entry point, not a replacement.
- **Any BFF/generated-client change** — `POST /api/v1/offline-credentials/signout`, the generated `signOutOfflineCredentials` operation, and the server-api wrapper already exist from the #9108 change; this change is frontend-only.
- **New extensions/services** — the table is designed as a list, but exactly one row exists today; no new service integrations.
- **Automatic signout on a broken/revoked-upstream grant** (unchanged #9108 open question).
- **Surfacing Core's limited-access message on genuine permission denials** (a "You can't create or edit tasks. Contact your administrator" style body) — deferred to a separate change: nothing in this repo renders or forwards such a message today, the observed 403 body is bare (`{"message": "Forbidden"}`), the BFF deliberately keeps 403s generic, and whether Core even sends such a body is unverified (the chat-api warn log would show it). The generic error toast stays the denial fallback.
- **Changes to the gate-check timing, the login banner, or the 403 check's request discipline** — the one-check-per-403 rule and the disambiguation rule are unchanged; only the outcome they drive changes (toast → auto-login).

## Capabilities

### New Capabilities

- `settings-extensions`: the Extensions Settings tab — tab registration and gating, the section heading/description, the Name/Description/action-column table, the service row (avatar + identity derivation + the disconnected-state warning badge with its "Authorize to use this extension" tooltip), the state-dependent Log in / Log out actions, the relocated confirmation + refetch-authoritative logout flow, and the section's i18n/RTL/accessibility requirements.

### Modified Capabilities

- `scheduled-tasks-offline-credentials-signout`: the signout affordance requirement moves — the disconnect action no longer renders on the Scheduled Tasks page header; the confirmation and refetch-authoritative requirements are re-homed to the Extensions section (the `offline-credentials` BFF requirements are untouched).
- `scheduled-tasks-page-ui`: the `ScheduledTasks` lib component's optional second header action (`onDisconnectClick` + disconnect labels) is removed; the header reverts to the single create action (the shared mobile-collapse class pair stays, now applied to the one button).
- `scheduled-task-auth-error-indication`: the 403-attributed failure path upgrades from a toast-only indication to an auto-login flow — the one-shot check also yields the `connect` settings, the page auto-invokes the login flow (at most once per Save activation), retries the submit on success, and falls back to a login-failed toast (replacing the "session expired" toast) with the form preserved.

## Impact

- **Code:** `apps/chat/src/types/settings-tabs.ts` (+ member), `apps/chat/src/hooks/useSettingsTabConfig.tsx` (+ entry, feature-gated), new `apps/chat/src/pages/SettingsPage/ExtensionsTab/` (+ tests), `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx` (disconnect removal + tests), `apps/chat/src/pages/ScheduledTaskCreatePage/` + `apps/chat/src/pages/ScheduledTaskEditPage/` (auto-login path + tests), `apps/chat/src/utils/scheduled-task-auth-error.ts` (check now yields `connect` settings) + a shared auto-login hook, `libs/scheduled-tasks` (props model, component, tests, README — public API removal), `apps/chat/src/constants/translation-keys.ts` + `apps/chat/src/i18n/locales/en.json` (new settings keys; `scheduledTasks.disconnect.*` and `scheduledTasks.authSessionExpiredNotification` removed/replaced).
- **Scope-creep flag (shared lib touched):** `libs/scheduled-tasks` changes are a *removal* of host-agnostic optional props — the lib keeps no host knowledge (isolation rule respected; the net direction strengthens it).
- **API compatibility:** no backend or generated-client change. The lib's public API loses three optional props — additive-only consumers are unaffected; a consumer passing them would fail typecheck (acceptable: the props are 0 revisions old, introduced in the same release train by #9108 and consumed only by `ScheduledTasksPage`).
- **i18n:** new user-visible strings under the settings namespace (tab label, heading, description, column headers, service default name and description, warning-badge tooltip "Authorize to use this extension", login/logout labels, confirm strings, announcements); `scheduledTasks.disconnect.*` keys removed. `en.json` is the only locale file today.
- **Docs:** `libs/scheduled-tasks/README.md` (prop removal), `docs/architecture.md` check (new page folder under `pages/`), `npm run validate:docs`.

## Alternatives considered

- **Keep the header button and add the Settings section** — rejected (user decision): two logout surfaces for the same grant invite drift; the Settings section becomes the single authoritative surface.
- **Reuse `libs/usage-dashboard`'s `ModelLimitsSection` directly** — rejected: its props model is usage-specific (period statuses, limit values); a parallel Extensions table in the app keeps `usage-dashboard` free of an unrelated concept. The *pattern* (div-based ARIA table, grid-template columns, avatar + name cell) is copied, not the component.
- **A new shared lib for the extensions table** — rejected: one consumer today; host knowledge (gate state, signout, confirmation) dominates the component, so an app-level section respects the library-isolation rule better than a lib would.
- **In-row confirm (no dialog)** — rejected, same reasoning as the #9108 change: revoking stops future scheduled tasks; the repo's page-level destructive-action precedent is a confirm dialog.

## Acceptance criteria

- `/settings/extensions` renders the Extensions tab with the plug-connected icon; the section shows the "Extensions" heading, the description text, and a table with Name / Description column headers and a visually empty action column header.
- While the service is available, exactly one row renders: a square avatar with the service's initials beside the service display name, and the service description.
- The action cell is state-dependent: **Log out** (with confirm dialog) while connected; **Log in** while available and disconnected; empty while the check is in flight or errored.
- While disconnected, the avatar carries the warning badge at its bottom-inline-start corner; hover/focus on the badge shows the "Authorize to use this extension" tooltip.
- Login: activating Log in opens the OAuth popup via the existing login flow; the button is disabled while the flow is in flight; a fresh refetch decides the row's next state. Logout: confirm calls `signOutOfflineCredentials()` exactly once and a fresh status check updates the row; cancel performs no request.
- The Scheduled Tasks page renders no Disconnect button under any gate state, and `libs/scheduled-tasks` exports no disconnect props.
- A 403-attributed save failure on create/edit auto-invokes the login popup (once per Save activation); successful login retries the submit and completes the save; a blocked/cancelled/failed login shows the login-failed toast with the form preserved and Save re-enabled, and a subsequent Save re-runs the full path.
- All strings resolve through i18n keys; layout uses logical properties; the table is keyboard-navigable with ARIA table semantics; `npm run validate:docs` passes.

## Rollback / backward compatibility

Frontend-only; revert restores the #9108 header-button flow (the BFF endpoint and generated client stay either way). The lib prop removal is the only externally visible contract change and only affects consumers of props that shipped in the same unreleased train.

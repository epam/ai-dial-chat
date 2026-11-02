## Why

The admin-managed application consent of the `DIAL_NATIVE` scheduler service can be absent or revoked at any time (`app_level_auth_status = SIGNED_OUT`), and a user whose consent is gone cannot run scheduled tasks no matter what they do — logging in cannot help. Today that state is invisible until the user attempts an action: create/update/resume returns `403 scheduledTaskAdminConsentRequired` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts:804`), and the Extensions tab and the Scheduled Tasks list page never learn about it at all. A user who is offline-credentials-connected sees a healthy-looking page whose every action fails with an unexplained error (issue #9357).

The Core team confirmed: `app_level_auth_status` is the right signal, always present, `SIGNED_OUT` covers both "never granted" and "revoked", `FAILED` cannot occur for `DIAL_NATIVE`, and it is independent of the user's stored offline-credentials grant.

## What Changes

- **`GET /api/v1/offline-credentials` gains a `schedulerServiceConsent` field** (`'signed_in' | 'signed_out' | 'unknown'`), relayed by the BFF from Core's `app_level_auth_status` of the scheduler external service. The consent read is extracted from `ScheduledTasksService.assertSchedulerConsent` into one shared place so the mutation pre-check and this read apply the identical rule (reject only on explicit `SIGNED_OUT`, fail open otherwise).
- **`ScheduledTasksPage` shows a "Limited access" banner** styled as the kit error-alert `Notification` (`NotificationVariant.Error`, `NotificationType.SectionMessage`, one line: bold "Limited access." + "You can't create or edit tasks. Contact your administrator for more details.", no action, no close button) in the existing banner slot directly above the task cards, and hides the "New task" button when `schedulerServiceConsent = 'signed_out'`.
- **The detail page hides its header "Edit" button** under the same condition. (The issue says "task cards"; cards carry no per-task actions — Edit lives in the detail-page header per `scheduled-task-detail-page` — so this is where the gating lands.)
- **The Extensions tab row gains a three-state design**: signed in → no warning icon, Log out button; logged out → warning icon with **no** tooltip (the current `authorizeTooltip` on the logged-out state is dropped), Log in button; consent `signed_out` → warning icon (also without a tooltip) plus a red `Badge` (`BadgeVariant.Filled`, `BadgeColor.Red`) with the localized "Limited access" label replacing the action button, its hover tooltip rendering the bold "Limited access." title and the normal-weight "Contact your administrator for more details." description.
- **The login banner is suppressed under `signed_out`** — the limited-access banner replaces it, because logging in is provably useless there.

Decision table (consent evaluated first, login state second):

```
schedulerServiceConsent  connected  → Scheduled Tasks page            → Extensions tab
signed_out               any        → Limited banner, no New task     → red badge + tooltip, no action button
signed_in                false      → Login banner + Log in           → warning badge (no tooltip) + Log in
signed_in                true       → nothing, New task + Edit       → Log out, no badge
unknown / checking / available=false → today's behavior unchanged
```

Alternatives considered: **reactive-only** (cache the 403 in client state) — rejected: the Extensions tab never performs a scheduler mutation, so the red badge could never appear, and the banner would only show after a first failure. **A new `GET /api/v1/scheduled-tasks/status` endpoint** — rejected: same data, a second route/DTO/OpenAPI surface, and the Extensions tab (not scheduled-tasks-shaped) would call a scheduled-tasks endpoint. Extending the response both surfaces already fetch on mount via `useOfflineCredentialsGate` costs one extra Core metadata read per page/tab mount (no caching, matching the recorded no-cache decision for the mutation pre-check).

Rollback: additive response field, additive UI branches — remove the field and the branches; old frontend ignores the new field, new frontend treats an absent field as `unknown` (today's behavior).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `offline-credentials`: the status endpoint response gains `schedulerServiceConsent`, read from the scheduler external service with the same fail-open rule as the mutation pre-check.
- `chat-hooks-offline-credentials`: `mapOfflineCredentialsResponse` and the gate result carry the new field through so every consumer derives its UI from the single response.
- `scheduled-tasks-offline-credentials-login`: the list-page login banner is suppressed when `schedulerServiceConsent = 'signed_out'` (the limited-access banner replaces it).
- `scheduled-tasks-page-ui`: the Limited-access banner renders under `signed_out` and the "New task" button hides.
- `scheduled-task-detail-page`: the header Edit button hides under `signed_out`.
- `settings-extensions`: the row becomes three-state (warning-badge tooltip dropped on logged-out; red Badge with limited-access tooltip replacing the action under `signed_out`).

## Impact

- **BFF** (`apps/chat-api`): `GetOfflineCredentialsResponseDto` + enum, `OfflineCredentialsService` gains the consent read, consent logic extracted from `assertSchedulerConsent` (shared with `ScheduledTasksService`), `ExternalServicesModule` import edge, OpenAPI regeneration (`npm run openapi` / `openapi:check`) and generated-client rebuild.
- **Libs**: `libs/chat-hooks` (`map-offline-credentials-response`, `useOfflineCredentialsGate`) — pass-through only, no host knowledge added; `libs/settings-panel` (`ExtensionServiceRow`) gains an optional red-badge slot fed by the app. The lib boundary holds: the app decides the state, the lib renders it.
- **Frontend** (`apps/chat`): `ScheduledTasksPage`, `ScheduledTaskDetailPage`, `ExtensionsTab`, the new banner component (counterpart of `ScheduledTasksLoginBanner`).
- **i18n**: new user-visible strings — the banner title "Limited access." and body "You can't create or edit tasks. Contact your administrator for more details.", and the Extensions badge label "Limited access" with its tooltip description "Contact your administrator for more details." (the badge tooltip's bold title reuses the banner-title key; the existing `toolsetSignin.adminConsentRequired` text is different wording and not reused). The existing `extensions.service.authorizeTooltip` tooltip on the logged-out state is dropped per the design.
- **No breaking changes** to any endpoint or component; every addition is additive.

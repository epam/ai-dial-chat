## Context

A `DIAL_NATIVE` scheduler service runs every schedule on the user's behalf under an administrator-managed application consent (`auth_settings.app_level_auth_status` on the scheduler's application resource). The Core team confirmed: the field is always present, `SIGNED_OUT` covers both "never granted" and "revoked", `FAILED` cannot occur for a `DIAL_NATIVE` service, and the consent is fully independent of the user's stored offline-credentials grant.

Current state:

- The BFF already blocks mutations on a revoked consent: `ScheduledTasksService.assertSchedulerConsent` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts:810`) reads the scheduler service via `ExternalServicesService.getExternalService` before create/update/resume/start and rejects only on an explicit `SIGNED_OUT`, failing open otherwise.
- `GET /api/v1/offline-credentials` (`apps/chat-api/src/offline-credentials/`) returns only the user-owned key: `{ available, connected, connect? }`. It knows nothing about the consent.
- The frontend never learns the consent proactively. `useOfflineCredentialsGate` (lib) and `mapOfflineCredentialsResponse` carry only `available`/`connected`. The scheduler identity (`SCHEDULER_APP_ID`/`SCHEDULER_SERVICE_ID`) is BFF-only env — the frontend cannot read the consent itself.
- The Scheduled Tasks list page shows `ScheduledTasksLoginBanner` when `available && !connected`; the Extensions tab (`apps/chat/src/pages/SettingsPage/ExtensionsTab/ExtensionsTab.tsx`) renders one row from the gate state alone, with a warning badge + `authorizeTooltip` tooltip while disconnected, and the kit `Badge` (2.0) already ships `BadgeVariant.Filled` / `BadgeColor.Red` in the pinned version.

The product decision (issue #9357): consent is evaluated before login state — `signed_out` wins over everything, because logging in cannot help.

## Goals / Non-Goals

**Goals:**

- The list page and the Extensions tab learn the scheduler consent on mount from the one status request they already make, and render the limited-access state per the decision table in `proposal.md`.
- `signed_out` hides "New task" (list page) and the header Edit button (detail page), and suppresses the login banner.
- The BFF mutation-side rule and the new proactive read are one shared implementation, not two copies.
- Additive everywhere: no endpoint shape break, no component contract break except the removed logged-out tooltip on the Extensions row (documented).

**Non-Goals:**

- Polling or real-time consent updates — mount/refetch snapshot only; the mutation `403` stays the backstop (unchanged, per the archived `2026-09-30-add-scheduled-task-admin-consent-check` non-goal).
- Changing `assertSchedulerConsent`'s mutation behavior, the fail-open rule, or any `scheduled-tasks-api` requirement — the extraction is a refactor.
- Acting on already-registered schedules (pause/delete/read remain ungated, so a user can always stop a schedule).
- Distinguishing "never granted" from "revoked" — Core reports both as `SIGNED_OUT`.
- Mapping Scheduler `upstreamCode` values to localized messages.

## Decisions

1. **The consent read is extracted into `SchedulerConsentService` in the external-services domain** (`apps/chat-api/src/external-services/scheduler-consent.service.ts`), exported by `ExternalServicesModule`.
   - It owns what `assertSchedulerConsent` owns today: resolving `SCHEDULER_APP_ID`/`SCHEDULER_SERVICE_ID` from `EnvironmentVariables` (throwing the existing `ServiceUnavailableException` when unset on first use), calling `ExternalServicesService.getExternalService`, and mapping the result to `SchedulerServiceConsentStatus`: explicit `SIGNED_OUT` on a `DIAL_NATIVE` service → `signed_out`; everything else (absent, `SIGNED_IN`, non-native, unexpected) → `signed_in`-or-`unknown` per rule 3.
   - Why there and not in the scheduled-tasks domain: `OfflineCredentialsService` would otherwise import the whole scheduled-tasks domain (module edge backwards through a heavyweight domain); both consumers already sit behind `ExternalServicesModule` (`ScheduledTasksModule` imports it today). The service belongs with the external-service/consent reading it wraps.
   - `ScheduledTasksService.assertSchedulerConsent` becomes a thin wrapper: call the shared read, throw the existing `ForbiddenException` (`ScheduledTaskErrorCode.AdminConsentRequired`) on `signed_out`. Behavior identical — the scheduled-tasks service spec keeps passing.

2. **`GET /api/v1/offline-credentials` gains `schedulerServiceConsent: 'signed_in' | 'signed_out' | 'unknown'`** (required field, new generated enum `SchedulerServiceConsentStatus`).
   - `OfflineCredentialsService.getOfflineCredentialsStatus` runs the shared read after the Core status call and appends the field. The read runs per call (the endpoint is `private, no-store`, called on page/tab mount) — no cache, matching the recorded no-cache decision for the mutation pre-check. Cost: one extra Core metadata GET per surface visit.
   - A failed consent read MUST NOT fail the status call: it logs at warn (same wording discipline as today's lookup-failure warn) and returns `unknown`. `available`/`connected` keep their meaning untouched.

3. **Fail-open maps to the login-state branch, not to limited access.**
   - `signed_out` is the only value that triggers any limited-access UI. `unknown` — which after the Core confirmation means *only* a failed BFF read — is treated exactly like `signed_in`: the login-state branch decides. This is the same rule as the mutation pre-check (reject only on explicit `SIGNED_OUT`), now applied in both places by one implementation.
   - Old BFF + new frontend: field absent → `mapOfflineCredentialsResponse` defaults it to `unknown` → today's behavior.

4. **Value casing is the BFF's own lowercase snake values**, not a relay of Core's `SIGNED_IN`/`SIGNED_OUT` literals. The DTO carries one small mapping (`SIGNED_IN → signed_in`, `SIGNED_OUT → signed_out`); the generated client exposes a clean `SchedulerServiceConsentStatus` enum and the frontend never sees Core's raw casing. Alternative (relay Core literals verbatim, skip the mapping) rejected: it leaks Core's enum casing into a public DTO for a two-line saving.

5. **The frontend threads the field through the existing lib pipeline.**
   - `mapOfflineCredentialsResponse` (lib `chat-hooks`) passes `schedulerServiceConsent ?? 'unknown'` through; `OfflineCredentialsStatusResult` and the gate result gain the field. The lib stays host-agnostic: it parses and exposes the field, it never interprets it into UI states — every consumer derives its own decision table.
   - `useOfflineCredentialsGate` consumers today: `ScheduledTasksPage` (list), `ScheduledTaskDetailPage` (detail), `ExtensionsTab`, and the sign-in/sign-out auth hooks. All of them get the field from the same response; none of them makes a new request.

6. **The list page renders the kit `Notification` as the limited-access banner, in the existing `banner` slot directly above the task cards.** `Notification` (`@epam/ai-dial-ui-kit`, 2.0) with `variant={NotificationVariant.Error}` and `type={NotificationType.SectionMessage}` matches the design reference exactly: the error-alert styling (radius/padding/border metrics are the component's own section-message styling — nothing is hand-set), and the `error` variant's built-in `role="alert"` assertive live region carries the announcement. No action (`Action=false`), not closable (`Close button=false`).
   - **One-line layout per the design reference (`Lines="One"`)**: the kit stacks its `title` prop above the message (two lines), so the single line is composed inside `message` as a ReactNode — a semibold "Limited access." span followed by the description text "You can't create or edit tasks. Contact your administrator for more details." — mirroring how `ScheduledTasksLoginBanner` composes its bold title and supporting text on one baseline row.
   - A thin wrapper component `ScheduledTasksLimitedAccessBanner` (`apps/chat/src/components/ScheduledTasksLimitedAccessBanner/`) takes the localized title/body as props and renders the configured `Notification`; only the list page renders it (see rule 7). No retry/login states — there is no user-recoverable action.
   - The login banner is suppressed under `signed_out`; the limited banner replaces it. The "New task" button hides under `signed_out` (page-level gate, mirroring how the page already hides it under the feature flag).

7. **Detail page: the header Edit button hides under `signed_out` — and nothing else changes.** The detail route already calls `useOfflineCredentialsGate` on entry, so the field arrives with no new request. No limited-access banner renders on the detail route (a review decision — the banner is a list-page surface only); the route's banner behaviour, including the credentials-failed-run login banner, is unchanged by the consent state. The Active switch, Delete, Start now and the read-only views are untouched (non-goal: a user can always stop or inspect a schedule).

8. **Extensions row: three states, driven by the app; the lib renders what it is given.**
   - `signed_in` + `connected` → no warning badge, Log out button (today).
   - `signed_in` + `!connected` → warning badge with **no** tooltip, Log in button. This drops the current `authorizeLabel` tooltip — a deliberate product decision from the issue; the `authorizeLabel` prop is removed from `ExtensionServiceItem` (`libs/settings-panel`) and from its README in the same change (`npm run validate:docs` gate).
   - `signed_out` → warning badge + kit `Badge` (`BadgeVariant.Filled`, `BadgeColor.Red`) with the localized "Limited access" label, replacing the action button (no Log in/Log out — neither is meaningful). The badge's hover tooltip renders two composed lines: the **bold** "Limited access." title and the **normal-weight** "Contact your administrator for more details." description (a ReactNode inside the kit `Tooltip`'s `tooltip` prop — the kit `Badge` takes a single `label` only, and the `Tooltip` content is a free ReactNode).
   - The avatar's warning glyph in the Name column carries **no tooltip in any state** — the logged-out tooltip (`authorizeTooltip`) is dropped, and under `signed_out` the glyph renders bare as well; only the red action-side Badge has a tooltip.
   - Lib boundary: `ExtensionServiceRow` gains optional `limitedAccessLabel`, `limitedAccessTooltipTitle`, and `limitedAccessTooltipDescription` fields on `ExtensionServiceItem` (strings arrive from the app; no i18n in the lib). The app (`ExtensionsTab`) owns the decision table and passes the row fields. The badges follow the existing warning-badge tooltip mechanics (tooltip on the glyph's own trigger, accessible name via the span, per the comment block in `ExtensionServiceRow.tsx`).
   - Kit `Badge` props confirmed against the pinned version via the ui-kit MCP lookup during implementation.

9. **i18n: new keys, no value duplication.** The existing `toolsetSignin.adminConsentRequired` value ("A DIAL administrator must approve this application's access before you can continue. Contact your administrator, then retry.") is different wording for a different surface (a retryable login failure) and is not reused. New keys: the banner title/body under the `scheduledTasks` namespace; the badge label "Limited access" and the tooltip description "Contact your administrator for more details." under the `extensions.service` namespace. The badge tooltip's bold title reuses `scheduledTasks.limitedAccessBanner.title` — the exact same string, and `ExtensionsTab` already imports `ScheduledTasksI18nKeys` — rather than re-declaring the value under a second key. `extensions.service.authorizeTooltip` is removed together with the dropped tooltip. Every key is declared in `translation-keys.ts` in the same change.

10. **OpenAPI and the generated client are part of the change.** `GetOfflineCredentialsResponseDto` gains the enum field; `npm run openapi`, `npm run openapi:check`, and a rebuild of `libs/chat-api-client` ship with the BFF change (per `apps/chat-api/AGENTS.md` — no restated details).

## Risks / Trade-offs

- [One extra Core metadata GET per page/tab mount.] → Accepted, same shape as the mutation pre-check's per-mutation read; the endpoint is already `no-store` and mount-scoped, not render-scoped.
- [Consent revoked between mount and action — the banner still says nothing is wrong.] → The existing `403 scheduledTaskAdminConsentRequired` on the mutation is the backstop; the next mount/refetch corrects the UI.
- [A failed consent read silently degrades to the pre-change UI.] → By design (fail-open); logged at warn. After the Core confirmation, `unknown` can only mean the BFF read failed, so there is no silent false-negative from Core itself.
- [Removing `authorizeLabel` from `ExtensionServiceItem` is a breaking change for hosts using the lib directly.] → Documented in the lib README in the same change; the repo's own consumers are updated in lockstep; `validate:docs` enforces the README match.
- [A credentials-failed run on the detail route under `signed_out` still shows the login banner, whose "Sign in to DIAL Chat to run this task" advice cannot help.] → Accepted review trade-off: the detail route renders no limited-access banner, so the run-derived banner behaviour is untouched; the user's next create/update still surfaces the authoritative `403 scheduledTaskAdminConsentRequired` message.

## Migration Plan

- Ship BFF, generated client, and frontend together from this repo/release. Old frontend + new BFF: the field is ignored. New frontend + old BFF: field absent → `unknown` → pre-change behavior.
- Rollback: remove the `schedulerServiceConsent` field from the DTO and the consumer branches; the extracted `SchedulerConsentService` can stay (inert) or move back inline. No data or contract to migrate.

## Open Questions

(none — the Core-team answers recorded in Context closed the field-presence, enum-semantics, and independence questions; the remaining naming and value-casing choices are decided in rules 4 and 8.)

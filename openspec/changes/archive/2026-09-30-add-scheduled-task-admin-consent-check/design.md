## Context

DIAL Scheduler runs every schedule on the user's behalf through the external service `SCHEDULER_SERVICE_ID` of application `SCHEDULER_APP_ID`. When that service is `DIAL_NATIVE`, DIAL Core issues the on-behalf-of credential only if two things hold:

- the user has offline credentials;
- an administrator-managed application consent (`auth_settings.app_level_auth_status`) is in place.

The admin can revoke that consent at any time.

Current state:

- **Chat already knows how to read the consent.** `useExternalServiceLogin.loginWithDialNative` (`apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts:115`) maps `SIGNED_OUT` to `AdminConsentRequired`. The BFF exposes the status via `ExternalServicesService.getExternalService`.
- **The scheduled-task BFF never checks it.** `ScheduledTasksService.fetchUpstream` maps every non-2xx through `mapDialHttpStatus` without passing `upstreamMessage`, so Scheduler's reason and code are logged but dropped. The user sees `502 "DIAL Core returned a server error"`.
- **The frontend pages never display server text.** They map the field codes and otherwise show a fixed localized key. The edit-page spec claims otherwise; that claim is drift.
- **`getApiErrorDetails` (`libs/chat-hooks/src/api-error/api-error.ts`)** parses `message`, `code`, and `traceparent`. `TraceparentErrorFilter` (`apps/chat-api/src/common/filters/traceparent-error.filter.ts`) spreads any object exception body unchanged, so extra body fields reach the client.

The consent pre-check was prototyped on branch `fix/scheduled-task-admin-consent`. The prototype also passed `extractDialErrorMessage(errorBody)` into `mapDialHttpStatus`. This design replaces that passthrough with dedicated fields, per the product decision to expose Scheduler's reason and code.

## Goals / Non-Goals

**Goals:**

- A revoked consent is detected on the user's next create, update, or resume, and reported as a typed `403 scheduledTaskAdminConsentRequired` with the localized "contact your administrator" message.
- Any Scheduler error reason and code reach the client (`upstreamMessage` / `upstreamCode`) and are shown to the user, with a localized fallback when Scheduler sends no text.
- No regression for OAuth scheduler services, for Core versions without the status, or for lookup failures. Existing `message`/`code` consumers are unaffected.

**Non-Goals:**

- Polling.
- Acting on already-registered schedules.
- Run-history explanations.
- Translating Scheduler text.
- Mapping specific upstream codes to localized messages. That is future work, now possible because the code is exposed.

## Decisions

1. **The consent pre-check lives in the BFF.**
   - The BFF owns the scheduler identity (`SCHEDULER_APP_ID` / `SCHEDULER_SERVICE_ID` on `EnvironmentVariables`). `private assertSchedulerConsent(accessToken)` in `ScheduledTasksService` reuses `ExternalServicesService.getExternalService`, including its application-resource fallback.
   - Wiring: `ExternalServicesModule` exports the service and `ScheduledTasksModule` imports it. There is no cycle.
   - Alternative, a frontend pre-check: rejected, because it leaks scheduler config to the client and still races.

2. **Scope: create, update, and resume**, the operations that make a schedule (re)start running.
   - Pause, delete, and reads are exempt, so a task can always be stopped.
   - The check runs before `validateConfiguration`. For update it also runs before `getScheduledTask`.

3. **Fail open on anything but an explicit `SIGNED_OUT`.**
   - The status may be absent: older Core, or the application-resource fallback.
   - A lookup failure is logged at warn level and the operation proceeds, so the check never adds a failure mode.

4. **No caching.** The lookup runs per mutation, as the issue asks. One small Core read per user-initiated mutation is acceptable. There is no cache key and no TTL.

5. **Typed consent error.**
   - `ScheduledTaskErrorCode.AdminConsentRequired = 'scheduledTaskAdminConsentRequired'`, raised as `ForbiddenException({ statusCode, error, code, message })`. This follows `DeploymentUnavailable` in `validateConfiguration`.
   - Why 403: the failure is an authorization state that the user cannot fix by retrying.

6. **Scheduler reason and code go in dedicated fields; `message` stays generic.**
   - `fetchUpstream` still calls `mapDialHttpStatus(status, context, logger, errorBody)` **without** `upstreamMessage`, so status, exception type, and generic `message` are unchanged.
   - When the status is exposable, it catches the thrown `HttpException` and rethrows `new HttpException({ ...exception.getResponse(), upstreamMessage?, upstreamCode? }, exception.getStatus())`. The normalized body keeps `statusCode`, `message`, and `error`.
   - Why not put the text into `message` through the shared `upstreamMessage` argument: the frontend could not tell Scheduler text from the BFF's English-only generics ("DIAL Core returned a server error", "Conflict"), so it couldn't fall back to a localized key. Other `mapDialHttpStatus` consumers would also stay inconsistent.
   - Why `upstreamCode` and not `code`: `code` is the typed `ScheduledTaskErrorCode` OpenAPI enum that drives field mapping. Mixing in foreign values would break that typing and could collide.

7. **One shared exposure rule.**
   - `apps/chat-api/src/common/dial/dial-error.mapper.ts` exports `isUpstreamTextExposable(status)`: false for 401/403/404, true otherwise. It sits next to `mapDialHttpStatus` with a comment tying the two together; `mapDialHttpStatus` behaviour is untouched.
   - Scheduled tasks use that function instead of re-listing statuses, following the product decision "same as the shared mapper".

8. **Sanitize what crosses the boundary.**
   - `upstreamMessage` is `extractDialErrorMessage(body)`: string body, `error.display_message`, `error.message`, then `message`. It is trimmed, dropped when empty, and truncated to 1000 characters.
   - `upstreamCode` is `error.code` or top-level `code`, only when it matches `^[A-Za-z0-9_.:-]{1,128}$`.
   - The raw body object is never forwarded. That keeps the existing "never a raw upstream body" scenarios true under a precise reading: the requirement now distinguishes the body object from the two extracted fields.
   - The delete requirement's "bare-string body not echoed" rule is the one real reversal, and it is recorded as a MODIFIED requirement.
   - The full body is still logged by `mapDialHttpStatus`.

9. **OpenAPI.**
   - `ScheduledTaskValidationErrorDto` gains `upstreamMessage?` and `upstreamCode?`.
   - The 400, 409, and 502 `@ApiResponse` entries of the Scheduler-proxied endpoints reference it, so the generated client documents the fields. The DTO keeps its name to avoid churn, even though it now also describes proxy errors.
   - Regenerate via `npm run openapi` and check with `openapi:check`.

10. **Library change is minimal and host-agnostic.**
    - `getApiErrorDetails` / `ApiErrorDetails` in `libs/chat-hooks` additionally return `upstreamCode` and `upstreamMessage`, each only when it is a non-empty string, mirroring how `code` is already parsed.
    - The lib stays generic: it parses JSON error-body fields and neither interprets nor displays them. No Scheduler, endpoint, or host knowledge enters it, so AGENTS.md "Library isolation" holds.
    - Also documented: the existing `code` field, which the `api-error-trace-correlation` spec never mentioned.
    - Alternative, a second body parse in `apps/chat`: rejected, because it duplicates the clone/parse logic the lib exists to own.

11. **Frontend message resolution: one pure helper.**
    - `resolveScheduledTaskErrorMessage(details, fallbackKey, t)` in `apps/chat/src/utils/map-scheduled-task-dto.ts` replaces the prototype's `getScheduledTaskErrorNotificationKey`. It picks the first match:
      1. admin-consent code → `t(ToolsetSigninI18nKeys.AdminConsentRequired)`;
      2. non-empty `upstreamMessage`;
      3. `t(fallbackKey)`.
    - `fallbackKey` is typed as `ScheduledTasksI18nKeys`, so `t()` stays key-checked.
    - The helper stays in `map-scheduled-task-dto.ts` rather than `scheduled-task-form-validation.ts`, because the detail page's tests mock `@epam/ai-dial-scheduled-tasks`, which the latter imports eagerly.
    - Used by: create, edit, and the Active switch.
    - Delete keeps its status-specific localized 404/409/502 messages, which are more actionable than raw text, and uses `upstreamMessage` only in its generic branch.

12. **No new i18n keys and no new UI surface.** The existing notification pattern (`useNotification`, alert semantics) carries the text. RTL: upstream text renders in the notification's inherited direction, and the Unicode bidi algorithm handles embedded LTR text.

## Risks / Trade-offs

- [Scheduler text is English-only and shown to Arabic and other locale users.] → This is the accepted product trade-off. The localized fallback applies whenever Scheduler sends no text. Known codes can later be mapped to keys via `upstreamCode`.
- [Scheduler text might reveal internal details.] → 401/403/404 are never exposed, the text is length-capped, the code is pattern-checked, and the raw body is never forwarded. Content policy is otherwise Scheduler's responsibility.
- [Consent can be revoked between the pre-check and the Scheduler call.] → The failure then surfaces with Scheduler's own `upstreamMessage`/`upstreamCode` rather than a bare 502. The window is tiny.
- [The extra Core round-trip adds latency to create, update, and resume.] → It is one metadata GET per infrequent, user-initiated action.
- [Core never reports `app_level_auth_status`.] → The request fails open by design and falls back to Scheduler's error, which is now visible.
- [A shared-lib change (`chat-hooks`) touches every consumer of `getApiErrorDetails`.] → The fields are additive and optional, and existing return keys are unchanged. Covered by lib unit tests and a README update.

## Migration Plan

- Deploy BFF, lib, and frontend together; they ship from the same repo and release.
  - Old frontend + new BFF: extra fields are ignored and the generic localized messages still show.
  - New frontend + old BFF: no fields arrive, so the localized fallback shows.
- Rollback: remove the `assertSchedulerConsent` calls and the enrichment in `fetchUpstream`. DTO fields, the enum member, lib fields, and the helper stay inert.

## Open Questions

- What status and body does DIAL Scheduler return when an on-behalf-of mint is rejected for revoked consent, and which `upstreamCode` values does it use? The answer would let known codes map to localized messages and feed run history. This is follow-up work, not a blocker.

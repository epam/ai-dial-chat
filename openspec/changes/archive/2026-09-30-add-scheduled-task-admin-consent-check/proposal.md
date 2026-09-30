## Why

When an administrator revokes the DIAL_NATIVE application consent of the DIAL Scheduler service, chat does not notice. The user's next create, edit, or resume of a scheduled task goes to DIAL Scheduler and fails with an opaque `502 "DIAL Core returned a server error"` ([Issue #8925](https://github.com/epam/ai-dial-chat/issues/8925), follow-up comment).

- Chat already has the right message: the DIAL_NATIVE sign-in flow shows `toolsetSignin.adminConsentRequired` from `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts:115`. The scheduled-task flow never reaches it, because `ScheduledTasksService.validateConfiguration` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts:640`) checks only content and the model.
- More broadly, `ScheduledTasksService.fetchUpstream` discards whatever reason and code DIAL Scheduler returns. Any Scheduler failure the BFF doesn't recognize therefore reaches the user as a generic message, with no clue what to do.

## What Changes

- **BFF consent pre-check.**
  - `createScheduledTask`, `updateScheduledTask`, and `resumeScheduledTask` read the scheduler's external service (`SCHEDULER_APP_ID` / `SCHEDULER_SERVICE_ID`) from DIAL Core before calling DIAL Scheduler. The read uses the existing `ExternalServicesService.getExternalService` and is never cached.
  - A `DIAL_NATIVE` service with `appLevelAuthStatus === 'SIGNED_OUT'` gets `403` with the new typed code `scheduledTaskAdminConsentRequired`, and nothing is sent upstream.
  - Pause and delete are exempt. The check fails open: a failed lookup, or an unknown or unreported status, proceeds to DIAL Scheduler.
- **Scheduler error reason and code reach the client.**
  - Error responses from every Scheduler-proxied endpoint carry two new optional string fields: `upstreamMessage`, the text DIAL Scheduler returned, and `upstreamCode`, the code it returned.
  - The fields follow the shared `mapDialHttpStatus` exposure rule: present for 400/405/409/412/413/422/429/5xx and never for 401/403/404.
  - `message` and our own typed `code` keep their current meaning. `upstreamMessage` is capped at 1000 characters, and `upstreamCode` must match a safe token pattern.
  - This replaces the "never a raw upstream body" / "bare-string body not echoed" wording in `scheduled-tasks-api`. The raw body object is still never forwarded, only these two extracted fields. **Contract change:** the new fields are additive, but they reverse the existing requirement that delete never echo Scheduler's bare-string error body.
- **Frontend shows the reason, with a localized fallback.**
  - `@epam/ai-dial-chat-hooks` `getApiErrorDetails` additionally returns `upstreamCode` and `upstreamMessage` when present.
  - The create page, edit page, and detail-page Active switch pick their notification text in this order:
    1. A known typed code (`scheduledTaskAdminConsentRequired` → `toolsetSignin.adminConsentRequired`).
    2. `upstreamMessage`.
    3. The page's existing localized key.
  - The delete notification keeps its status-specific localized messages for 404/409/502 and uses `upstreamMessage` only in its generic branch.
- **New enum member and DTO fields.** `ScheduledTaskErrorCode.AdminConsentRequired` is added, and `ScheduledTaskValidationErrorDto` gains `upstreamCode?` and `upstreamMessage?`. Both are published through OpenAPI, and `chat-api-client` is regenerated.
- **Spec drift fixes.**
  - The "Edit page submits via PUT" requirement claimed the notification shows the server's `message`. It never did. It is corrected to the new order.
  - The `getApiErrorDetails` requirement in `api-error-trace-correlation` never mentioned the `code` field that already exists. It is corrected alongside the new fields.

Non-goals:

- Periodic polling of consent status.
- Stopping or pausing already-running schedules when consent is revoked. That is DIAL Scheduler's or Core's decision.
- Explaining a consent failure inside run history. The Scheduler run-error payload is unconfirmed.
- Translating Scheduler's own text. It is shown as received.
- Mapping specific `upstreamCode` values to localized messages. That can follow once DIAL Scheduler's codes are known.

Alternatives considered:

- **Put Scheduler text into `message` through the shared `upstreamMessage` argument of `mapDialHttpStatus`.** Rejected: the frontend could no longer tell Scheduler text from the BFF's English-only generic texts, so it couldn't fall back to a localized key.
- **Put Scheduler's code into the existing `code` field.** Rejected: `code` is typed by the `ScheduledTaskErrorCode` OpenAPI enum and drives field mapping.
- **Expose text for 401/403/404 too.** Rejected: that goes against the shared rule that keeps auth and resource details private.
- **Poll consent.** Rejected: background traffic for a rare, admin-driven event.

Rollback and compatibility: the change is additive for existing clients. New fields are optional, `message` and `code` are unchanged, and older frontends ignore the new fields. The only behavioural reversal is that delete can now return Scheduler's text in `upstreamMessage`. To revert, remove the `assertSchedulerConsent` calls and the enrichment in `fetchUpstream`; the DTO fields, enum member, and helper can stay inert.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scheduled-tasks-api`:
  - Adds the DIAL_NATIVE consent pre-check requirement.
  - Adds the `upstreamCode` / `upstreamMessage` error-field requirement for all Scheduler-proxied endpoints.
  - Modifies "Delete a scheduled task" to allow the extracted upstream fields in place of "bare-string body not echoed".
- `scheduled-task-create-form`:
  - Create and edit notifications follow the typed code → `upstreamMessage` → localized fallback order.
  - The edit-page requirement is corrected.
- `scheduled-task-detail-page`:
  - The Active switch failure notification follows the same order.
  - The delete requirement's generic branch uses `upstreamMessage` when present.
- `api-error-trace-correlation`: `getApiErrorDetails` returns the existing `code`, plus the new `upstreamCode` and `upstreamMessage`.

## Impact

- **Backend.**
  - `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`: `assertSchedulerConsent`, and upstream-field enrichment in `fetchUpstream` replacing the prototype's `extractDialErrorMessage` passthrough.
  - `apps/chat-api/src/common/dial/dial-error.mapper.ts`: export of the shared "upstream text exposable" status rule. `mapDialHttpStatus` behaviour is unchanged.
  - `scheduled-tasks.module.ts` and `external-services.module.ts`.
  - The enum, `dto/scheduled-task-validation-error.dto.ts`, and the controller `@ApiResponse` error types.
- **Generated client.** `libs/chat-api-client`, regenerated only via `npm run openapi`.
- **Library (`libs/chat-hooks`, shared).** `getApiErrorDetails` / `ApiErrorDetails` gain two optional fields, and the README is updated. This is a small scope expansion into a shared lib. The lib still only parses generic JSON error-body fields; it learns no endpoint, host, or Scheduler knowledge. Deciding what to display stays in `apps/chat`.
- **Frontend.** `apps/chat/src/utils/map-scheduled-task-dto.ts`, `ScheduledTaskCreatePage.tsx`, `ScheduledTaskEditPage.tsx`, `ScheduledTaskDetailPage.tsx`.
- **Docs.** `apps/chat-api/README.md` (consent and upstream fields) and `libs/chat-hooks/README.md` (`getApiErrorDetails` fields).
- **i18n.** No new keys. `toolsetSignin.adminConsentRequired` is reused. `upstreamMessage` is shown untranslated as Scheduler sent it: a known trade-off for non-English locales, mitigated by the localized fallback whenever Scheduler sends no text.
- **Upstream cost.** One extra DIAL Core read per create, update, or resume.

Acceptance criteria:

- With consent revoked, create, update, and resume return `403 { code: 'scheduledTaskAdminConsentRequired' }` and DIAL Scheduler is never called. Pause and delete still work.
- When Scheduler answers `500 { error: { message: 'X', code: 'y' } }`, the BFF returns `502` with the generic `message`, `upstreamMessage: 'X'`, and `upstreamCode: 'y'`. The UI shows `X`.
- When Scheduler answers `404` with text, the BFF returns no upstream fields.
- A Scheduler error with no text shows the page's localized message. The admin-consent code always shows the localized admin-consent message.
- `npm run openapi:check`, tests, lint, typecheck, and `npm run validate:docs` pass.

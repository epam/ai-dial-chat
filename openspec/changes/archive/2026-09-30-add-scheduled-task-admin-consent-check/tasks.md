Slicing strategy: contract-first.

1. Fix the BFF error contract: the consent 403 and the `upstreamCode`/`upstreamMessage` fields, published through OpenAPI.
2. Extend the generic lib parser.
3. Have the frontend consume both.

Each slice is verifiable on its own. Tasks marked `[x]` were prototyped and verified on branch `fix/scheduled-task-admin-consent`. Apply re-verifies them against the delta specs instead of rewriting them.

## 1. BFF consent pre-check (`scheduled-tasks-api`)

- [x] 1.1 Add `AdminConsentRequired = 'scheduledTaskAdminConsentRequired'` to `apps/chat-api/src/scheduled-tasks/types/scheduled-task-error-code.enum.ts`.
- [x] 1.2 Export `ExternalServicesService` from `apps/chat-api/src/external-services/external-services.module.ts`, and import `ExternalServicesModule` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.module.ts`.
- [x] 1.3 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`, add the uncached `assertSchedulerConsent(accessToken)`:
  - Throw only for `DIAL_NATIVE` + `SIGNED_OUT`.
  - On a lookup failure, log a warning and continue.
  - Call it first in `createScheduledTask`, `updateScheduledTask` (before `getScheduledTask`) and `resumeScheduledTask`. Do not call it in pause or delete.
- [x] 1.4 Add the consent tests to `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`:
  - revoked create/update/resume never call Scheduler;
  - consent is re-read on every call;
  - pause and delete are exempt;
  - OAuth and unreported statuses pass;
  - a failed lookup defers to Scheduler.
  - Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 2. BFF upstream reason and code (`scheduled-tasks-api`)

- [x] 2.1 In `apps/chat-api/src/common/dial/dial-error.mapper.ts`, export `isUpstreamTextExposable(status)`:
  - It returns false for 401/403/404 and true otherwise.
  - Put a block comment next to `mapDialHttpStatus` tying the two together. Leave `mapDialHttpStatus` behaviour unchanged.
  - Add unit cases to `apps/chat-api/src/common/dial/dial-error.mapper.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/common/dial/dial-error.mapper.spec.ts`
- [x] 2.2 In `ScheduledTasksService.fetchUpstream`, remove the prototype's `extractDialErrorMessage(errorBody)` argument to `mapDialHttpStatus`. Instead, when `isUpstreamTextExposable(response.status)`:
  - Build `upstreamMessage`: from `extractDialErrorMessage`, trimmed, omitted when empty, truncated to 1000 characters.
  - Build `upstreamCode`: `error.code`, else top-level `code`, only when it matches `^[A-Za-z0-9_.:-]{1,128}$`.
  - Rethrow the mapped `HttpException` with `{ ...getResponse(), ...fields }` and the same status.
  - Put the extraction in a small private helper or a local pure function in the same file. Keep relative imports extensionless.
- [x] 2.3 Replace the prototype test "keeps DIAL Scheduler's own message on an upstream 5xx" in `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts` with the spec scenarios:
  - a 5xx keeps the generic `message` and adds both fields;
  - a bare-string 409 on delete gives `upstreamMessage` only;
  - 401/403/404 carry no fields;
  - an unsafe code is dropped and a long message is truncated;
  - the typed `code` is never overwritten;
  - a timeout carries no fields.
  - Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`
- [x] 2.4 Add `upstreamMessage?: string` and `upstreamCode?: string` (`@ApiPropertyOptional` with examples) to `apps/chat-api/src/scheduled-tasks/dto/scheduled-task-validation-error.dto.ts`.
- [x] 2.5 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`:
  - Set `type: ScheduledTaskValidationErrorDto` on the 400, 409 and 502 `@ApiResponse` entries of list, get, list-runs, create, update, pause, resume and delete.
  - Keep the consent 403 docs from the prototype for create, update and resume.
- [x] 2.6 Regenerate the client with `npm run openapi` (never hand-edit `libs/chat-api-client`), then run `npm run openapi:check` and `npm exec -- nx run-many -t build,lint -p chat-api-client`.
  - Verification: `libs/chat-api-client/src/generated/src/models/index.ts` has `ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired`, and `ScheduledTaskValidationErrorDto` has both new fields.
- [x] 2.7 Confirm that `apps/chat/src/server-api/api-client.ts` and `scheduled-tasks.api.ts` need no change: the endpoints keep their normal generated methods.
- [x] 2.8 Run `npm run verify:changed` after slices 1–2.
  - Result: typecheck and lint pass. The only persistent `nx test chat-api` failure, `app-config.service.spec.ts` "refinement availability for model undefined", comes from a local `apps/chat-api/.env.local` `UTILITY_MODEL` leaking through `ConfigService`, so it is unrelated to this change. The same suite passes run directly with vitest (4180/4180).

## 3. Lib error parsing (`api-error-trace-correlation`)

- [x] 3.1 In `libs/chat-hooks/src/api-error/api-error.ts`:
  - Add optional `upstreamCode` and `upstreamMessage` to `ApiErrorDetails`, with JSDoc.
  - Parse them like `code`: only a non-empty string, and omit the key otherwise.
  - Architecture guard: the lib must still contain no endpoint path, generated-client import, Scheduler naming or display decision.
- [x] 3.2 Add unit tests to `libs/chat-hooks/src/api-error/tests/api-error.spec.ts` for both spec scenarios: the fields are preserved, and non-string or empty values are omitted while `message` is unchanged.
  - Verification: `npm run test:file -- libs/chat-hooks/src/api-error/tests/api-error.spec.ts`
- [x] 3.3 Update the `getApiErrorDetails` section of `libs/chat-hooks/README.md`: document `code`, `upstreamCode` and `upstreamMessage`, and update the example destructuring. Run `npm run validate:docs`.

## 4. Frontend message resolution (`scheduled-task-create-form`, `scheduled-task-detail-page`)

- [x] 4.1 In `apps/chat/src/utils/map-scheduled-task-dto.ts`, replace the prototype's `getScheduledTaskErrorNotificationKey` with the pure helper `resolveScheduledTaskErrorMessage(details: ApiErrorDetails, fallbackKey: ScheduledTasksI18nKeys, t: TFunction): string`. It returns the first match:
  1. the admin-consent code → `t(ToolsetSigninI18nKeys.AdminConsentRequired)`;
  2. a non-empty `upstreamMessage`;
  3. `t(fallbackKey)`.
- [x] 4.2 Use the helper in:
  - `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx` (fallback `CreateErrorNotification`);
  - `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx` (fallback `EditErrorNotification`, after the field-error and NotFound branches);
  - the Active-switch failure in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` (fallback `DetailActiveStatusUpdateError`);
  - the delete failure in the same file: keep `getDeleteErrorMessageKey` for 404/409/502, and use `upstreamMessage` only for its generic branch.
- [x] 4.3 Update the unit tests in `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` for the helper: the admin code wins over `upstreamMessage`, `upstreamMessage` wins over the fallback, and an empty value falls back.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts`
- [x] 4.4 Add behaviour tests using role, label and text queries:
  - `ScheduledTaskCreatePage.spec.tsx`: the existing admin-consent test, plus "shows the Scheduler's reason" and "falls back to the localized message".
  - `ScheduledTaskEditPage.spec.tsx`: admin-consent with the draft kept and no NotFound; the upstream reason.
  - `ScheduledTaskDetailPage.spec.tsx`: resume with revoked consent reverts the switch and shows the admin message; a pause with `upstreamMessage` shows it; a delete generic failure with `upstreamMessage` shows it, while 404/409/502 keep their localized messages.
  - Verification: `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`
- [x] 4.5 i18n and RTL:
  - No new keys: `toolsetSignin.adminConsentRequired` already exists in every locale.
  - No new UI surface or directional classes, so there is no RTL work.
- [x] 4.6 Run `npm run verify:changed` after slices 3–4.
  - Result: typecheck and lint pass. Two test failures are unrelated: the local-env `app-config.service.spec.ts` case (see 2.8), and `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` "resolves with the downloaded files", which fails identically with this change stashed.

## 5. Docs and closing verification

- [x] 5.1 Rewrite the "Scheduled task application consent" section of `apps/chat-api/README.md`:
  - the consent pre-check;
  - the `upstreamMessage`/`upstreamCode` fields, with the 401/403/404 exclusion, the 1000-character cap and the code pattern;
  - that `message` stays generic.
  - Remove the prototype sentence that says the upstream message goes into `message`.
- [x] 5.2 Run `npm run validate:docs`.
- [x] 5.3 Close the change with a single `npm run verify:full`.
  - Result: typecheck, lint and format pass. `test:full` shows only the two unrelated failures recorded in 2.8 and 4.6.

## 6. Follow-ups (out of scope)

- [ ] 6.1 Confirm the status, body and `upstreamCode` values DIAL Scheduler returns when an on-behalf-of mint is rejected for revoked consent, and for other common failures. Open a separate change to map known codes to localized messages and to explain them in run history.

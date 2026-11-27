# Tasks

Slicing strategy: **vertical, single slice**. The removal touches one mapper, its two service call sites and their tests. The parameter is removed from the mapper signature, so TypeScript will not compile until every caller and test is updated. Splitting the mapper and the service into separate slices would leave a non-compiling tree in between. Group 1 is the whole code change with its tests. Group 2 is integration checks only.

## 1. Stop sending `properties.url` to DIAL Scheduler

- [x] 1.1 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`: remove `url: string` from `UpstreamSchedulePayload.properties`; delete `buildScheduledTaskChatCompletionUrl` and the comment above it; drop the `dialCoreUrl` parameter so the signature is `toUpstreamSchedulePayload(body, dialApiVersion, serviceId)`; remove `url` from the built `properties`; remove the `StringUtils` import (it has no other use in this file). Keep `target_type`, `api_version`, `create_conversation`, `extra_headers`, `retry`, `timeout`, `payload`, `service_id`, `timezone` and `description` unchanged. Verify: `grep -rn buildScheduledTaskChatCompletionUrl apps/chat-api/src` returns nothing.
- [x] 1.2 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`: update both `toUpstreamSchedulePayload` calls (`createScheduledTask` and `updateScheduledTask`) to `(body, this.dialClient.dialApiVersion, serviceId)`. Do not touch `DialClientService`, `SchedulerUpstreamClient` or `DIAL_CORE_URL`. Verify: covered by 1.5 and the typecheck in 2.1.
- [x] 1.3 In `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts`: delete the `buildScheduledTaskChatCompletionUrl` describe block and its import; remove the `DIAL_CORE_URL` constant and the `DIAL_CORE_URL` argument from every `toUpstreamSchedulePayload` call, including the `toPayload` helper; remove `url: 'http://dial-core/openai'` from the full `toEqual` in "builds the fixed chat_completion body for a date trigger…"; add `expect(upstream.properties).not.toHaveProperty('url')` to that date-trigger test and to "builds the fixed body for a cron trigger". Verify: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts` passes.
- [x] 1.4 In `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`: update the `toUpstreamSchedulePayload(body, 'http://core', '2024-10-21', 'scheduler')` call to `toUpstreamSchedulePayload(body, '2024-10-21', 'scheduler')`. Verify: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts` passes.
- [x] 1.5 In `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`: in the create test that parses the POST `sentBody`, add `expect(sentBody.properties).not.toHaveProperty('url')`; add the same assertion for the PUT body sent by `updateScheduledTask` (extend an existing successful-update test that captures the request body, or add one named after the behaviour, e.g. "sends no properties.url on update"). Verify: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts` passes.
- [x] 1.6 Run `npm run verify:changed` once for the completed slice. Verify: typecheck, lint and tests for the affected projects pass.
  - Result: typecheck and lint pass. The test step fails only on the pre-existing failures described in the note under group 2. The three changed scheduled-tasks spec files pass (244/244).

## 2. Integration checks

> **Pre-existing failures (not caused by this change):** on `development` (f0b8bdf67) the full `chat-api` test run fails 211 tests in 8 files under `apps/chat-api/src/app-config/tests/` and in `apps/chat-api/src/config/tests/explicit-environment.spec.ts`, with `TypeError: pairs.map is not a function` in `apps/chat-api/src/app-config/managed-runtime/managed-runtime.settings.ts`. The same 211 failures reproduce on a clean tree with this change stashed. The affected files pass when run on their own (262/262), with or without this change, so the failure comes from cross-file interference in the full run. `format:check` also flags 11 files outside this change (committed `docs/architecture.md` and `docs/chat-overlay-migration-guide.md`, plus untracked local `*-prompts/` directories). The tasks below are accepted on that basis.

- [x] 2.1 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`. Verify: both pass.
  - Result: lint passes. Tests: 9266 pass; the only failures are the 211 pre-existing ones above (9477 tests in total; the clean tree has 9480, the difference being the 3 deleted `buildScheduledTaskChatCompletionUrl` tests).
- [x] 2.2 Run `npm run openapi && npm run openapi:check`. Verify: no diff in `libs/chat-api-client/openapi.json`, which confirms the public contract is unchanged.
- [x] 2.3 Run `npm run validate:specs` and `openspec validate remove-scheduler-properties-url`. Verify: both pass. Strict-mode length warnings on the re-added create requirement are expected (design.md D4).
- [x] 2.4 Run `npm run verify:full` once to close the change. Verify: it passes.
  - Result: `typecheck:full` and `lint:check` pass. `format:check` fails only on the 11 pre-existing files above (every file of this change is Prettier-clean), and that failure stops `verify:full` before its test step. The full test suite was run in 2.1.

## Workflow follow-up

- Release gate (design.md "Migration Plan" step 2): before merge, on a live DIAL Scheduler, confirm that a create without `url` is accepted and a triggered run creates a conversation, and that a PUT on a schedule created before this change is accepted and still runs. Record the result in the PR description. If either is rejected, do not merge.
- Fill in the ticket link and reason in `proposal.md` (Why).
- Archive the change after review. At archive, confirm that `openspec/specs/scheduled-tasks-api/spec.md` no longer mentions `buildScheduledTaskChatCompletionUrl` or `properties.url`.

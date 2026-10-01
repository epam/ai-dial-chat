## 1. Vertical slice: Start now creates a visible History entry

Strategy: **vertical**, delivering the bodyless start request through BFF, generated client, app hook and presentation before adding fast status tracking. Slice 2 depends on slice 1; slice 3 completes recovery and compatibility. Resolve the three recorded product assumptions from `design.md` against any user replies before applying affected UI tasks. Follow `apps/chat/AGENTS.md` and `apps/chat-api/AGENTS.md`; preserve extensionless TypeScript imports and frontend bundler resolution. Keep unrelated cleanup out of this change.

- [x] 1.1 Add `startScheduledTask` to `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` and `scheduled-tasks.service.ts`: bodyless routed POST, HTTP 202 `ScheduledTaskRunDto`, existing id/session/feature/CSRF handling, deleted-task 409, no external-sign-in precheck, no list-cache invalidation or automatic POST retry. Document every specified response in Swagger.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`.

- [x] 1.2 Add dedicated service and supertest controller coverage in those backend test files for acceptance, ignored override body, paused/completed eligibility, 400/401/403/404/409/429/502/503, no credential precheck, no mutation/list invalidation, and one upstream call. Keep backend tests in the existing domain `tests/` directory per its AGENTS.md.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`.

- [x] 1.3 Generate the start contract with `npm run openapi` and `npm run openapi:check`; build/lint `chat-api-client` through `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Verify a strongly typed normal `startScheduledTask` method and HTTP 202 schema. Reuse the `scheduledTasksApi` singleton in `apps/chat/src/server-api/api-client.ts`; add its thin wrapper and request-contract tests in `apps/chat/src/server-api/scheduled-tasks.api.ts` and `tests/scheduled-tasks.api.spec.ts`.

  **Verification:** the generation/build/lint commands above and `npm run test:file -- apps/chat/src/server-api/tests/scheduled-tasks.api.spec.ts`. Never hand-edit `libs/chat-api-client` generated files.

- [x] 1.4 Add `apps/chat/src/hooks/scheduled-tasks/useStartScheduledTask.ts` and its dedicated `tests/useStartScheduledTask.spec.ts`: synchronous duplicate guard, current-schedule accepted DTOs, stale-response cleanup, id deduplication and terminal-over-InProgress merge. Compose with existing pagination in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, preserving older rows, server offsets and schedule metadata. Ensure pending/failed initial history cannot hide a confirmed accepted row.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useStartScheduledTask.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`. Cover acceptance before initial history, overlapping load-more, repeated manual runs, empty history and navigation races.

- [x] 1.5 Add the optional callback/state/labels contract in `libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts` and Start now after Edit in `src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`; wire app eligibility and callbacks in the detail page. Confirm kit button props using UI Kit MCP `searchEntity` / `getEntityDetails`. Reuse the existing play/status treatment and include JSDoc for public additions.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx libs/scheduled-tasks/src/tests/public-contract.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`. Test action order, loading/deleted/disabled states, optional-prop compatibility and one callback per activation. Architecture guard: no API paths, generated clients, auth/env/flags, routing, app imports, i18n or persistence inside this library; only host props/callbacks.

- [x] 1.6 Add the new `ScheduledTasksI18nKeys` members in `apps/chat/src/constants/translation-keys.ts` and keys from `design.md` in `apps/chat/src/i18n/locales/en.json`; apply the repository locale policy to supported locales including Arabic. Thread all visible and accessible labels through the app; add acceptance/pending announcements without moving focus.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx`. Verify rendered labels, keyboard activation and non-repeated live announcements through role/label/text queries.

- [x] 1.7 Verify the completed acceptance slice with `npm run verify:changed` once. Include feature-gate regression coverage in the controller and page tests; no new feature key is introduced.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`, followed by the single slice check.

## 2. Vertical slice: Observe the accepted run until completion

Depends on slice 1. Keep generic shared-history polling unchanged.

- [x] 2.1 Add `apps/chat-api/src/scheduled-tasks/dto/get-scheduled-task-run.dto.ts` and `getScheduledTaskRun` in the existing controller/service; document both allowlisted path params, typed HTTP 200 response and all specified errors. Extend `dto/scheduled-task-run.dto.ts` and `scheduled-tasks.mapper.ts` with optional `resultStage` only, mapping list/start/get-one consistently and omitting arbitrary upstream results.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`.

- [x] 2.2 Add dedicated mapper/service and supertest tests in the files above for single-run success/terminal states, nullable fields, credentials-stage projection, unknown/foreign run 404, malformed path ids, guard enforcement, upstream errors and no caching. Confirm no regression in existing list response mapping.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`.

- [x] 2.3 Regenerate the extended contract with `npm run openapi` / `npm run openapi:check`, then `npm exec nx build chat-api-client` / `npm exec nx lint chat-api-client`. Add the abortable normal-method `getScheduledTaskRun` wrapper through the existing singleton in `apps/chat/src/server-api/scheduled-tasks.api.ts`; test the exact ids and cancellation signal.

  **Verification:** generation/build/lint commands above and `npm run test:file -- apps/chat/src/server-api/tests/scheduled-tasks.api.spec.ts`. Inspect generated method and optional `resultStage` types; do not edit generated sources.

- [x] 2.4 Extend `useStartScheduledTask.ts` with single-flight two-second GET polling, absolute 70-second deadline, visibility pause/catch-up, terminal updates from either source, cleanup and GET-only status retry. Surface status-refresh feedback in the app detail page while retaining last-known History status; ignore stale list snapshots after terminal updates.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useStartScheduledTask.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`. Use fake timers for cadence/deadline/hidden-tab and deferred requests for races; assert no POST retry, no concurrent GETs and no post-navigation announcements.

- [x] 2.5 Add dedicated hook tests for transient polling errors, Retry-After, terminal 401/403/404 handling, deadline with InProgress retained, late response cleanup, GET-only retry and a terminal state learned from the ordinary history source. Verify Success/Error/duration/navigation presentation using existing run mapper/list tests.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useStartScheduledTask.spec.ts apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`.

- [x] 2.6 Run `npm run verify:changed` once for the completed tracking slice, retaining ordinary shared-hook polling and pagination regression coverage.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/useScheduledTaskRuns.spec.ts`, followed by the single slice check.

## 3. Vertical slice: Recovery, responsive behavior and release contract

Depends on slices 1–2.

- [x] 3.1 Wire credentials-stage recovery and start-error feedback in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, reusing `components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner.tsx` and the app's offline-credentials hooks. Preserve 404/409 messages and ambiguous-response guidance; no automatic execution after login. Place status/recovery feedback in app-owned UI so libraries receive no auth behavior.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx apps/chat/src/components/ScheduledTasksLoginBanner/tests/ScheduledTasksLoginBanner.spec.tsx`. Cover credential error, login success/cancellation/popup failure, no auto-rerun, deleted-action disabling and trace-aware failure feedback.

- [x] 3.2 Adapt the header in `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx` and its `.module.scss` for the agreed mobile treatment; retain tabs/title, Start now text and 44px targets. Add a dedicated RTL/accessibility check: logical spacing, mirrored navigation, direction-independent play icon, decorative aria-hidden icons, keyboard/focus and live status. Keep library styling within existing theme contracts.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`. Cover mobile/desktop branches and `dir="rtl"` via role/label/text assertions. Do not claim jsdom checks prove physical pixel layout; no unsolicited browser audit or manual-testing task is added.

- [x] 3.3 Update `apps/chat-api/README.md`, `apps/chat/README.md`, `libs/scheduled-tasks/README.md` and `libs/chat-api-client/README.md` where they document changed API behavior, public props or generated methods. Update the scheduled-task endpoint summary in `docs/architecture.md` in the same change. Document manual execution versus exhausted triggers, response casing, polling/retry and credentials recovery; keep examples aligned with actual exports. No unrelated architecture rewrite or new diagram is needed for this existing BFF flow.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts apps/chat/src/server-api/tests/scheduled-tasks.api.spec.ts`, plus `npm run validate:docs` for affected READMEs/public contracts.

- [x] 3.4 Run `npm run verify:changed` once for the completed recovery/presentation slice, `npm run openapi:check` and `npm run validate:docs`; run `npm run build:quiet` because backend route metadata, generated exports and library CSS affect builds. Finish with exactly one `npm run verify:full`. Record actual results; leave unrelated findings as follow-ups.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts`, then the listed final checks. No live task execution is needed for automated verification.

## 4. Review corrections

These corrections enforce existing acceptance criteria; they add no new product scope.

- [x] 4.1 Fix page-scoped start/poll lifecycle, visibility/timer races, absolute deadline, and shared eligibility in `useStartScheduledTask.ts` and `ScheduledTaskDetailPage.tsx`. Recheck credentials after a newly observed credential failure and retain a History retry next to accepted rows. Each correction must have a regression test reproducing its original failure; navigation, terminal history, retry backoff and no automatic POST retry remain covered.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useStartScheduledTask.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`, then `npm run verify:changed` for the completed slice.

- [x] 4.2 Preserve Scheduler Retry-After through the run-status BFF response and honor it during polling/visibility restoration. Keep safe mapped errors and trace handling. Cover service extraction and the HTTP header in controller tests; regenerate Swagger/client if the response-header contract changes.

  **Verification:** `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.controller.spec.ts apps/chat/src/hooks/scheduled-tasks/tests/useStartScheduledTask.spec.ts`, then `npm run verify:changed`.

- [x] 4.3 Correct the generated-method README signatures, record the necessity and verification of each fix here, and run final checks.

  **Verification:** `npm run openapi:check`, `npm run validate:docs`, `npm run build:quiet`, and one `npm run verify:full` after the review corrections.

### Necessity and regression evidence

| Review finding | Why the correction is needed | Evidence |
| --- | --- | --- |
| Visibility/timer race | A pending tick invalidated the catch-up GET and permanently stopped observation. | Deferred-GET test returns Success across the old timer boundary and confirms no extra polling. |
| Stale POST outcomes | Leaving the page could still show notifications; late error decoding could affect a new task. | Accepted/rejected POST after unmount, feature disablement, and page unmount during error decoding. |
| Conflicting eligibility | The button used merged terminal status while the hook rejected against an older InProgress list snapshot. | Hook and page tests permit a second explicit POST after polled completion and still block genuinely active runs. |
| Credentials recovery | The route's initial connected result can predate a credential failure. | A new credential-error run refetches the gate once and exposes login, without repeating POST. |
| Absolute deadline | An in-flight GET could keep observation pending beyond 70 seconds. | At the deadline the signal is aborted, the row remains InProgress, late results are ignored, and GET-only refresh works. |
| History retry | An accepted row suppressed initial History error and removed the only retry action. | The page retains the row, alert and working History retry together. |
| Retry-After transport | Browser backoff cannot work if BFF discards Scheduler's header. | Service and supertest cover both header formats and mapped error body; hook tests cover visibility/manual backoff bypass. |
| Generated-client README | The documented positional arguments do not match generated request-object parameters. | Compared directly with generated ScheduledTasksApi methods; corrected instance-call examples; validate:docs passes. |

The exact frontend suites pass 84 tests and the backend service/controller suites
pass 212 tests, including 18 added regression cases. The two review implementation
items form one end-to-end correction slice, verified together by verify:changed.


Completed verification for the review slice:

- `npm run verify:changed`: PASS (affected typecheck, lint, and all affected tests, including consumer fixtures).
- `npm run build:quiet`: PASS on the final implementation.
- `npm run openapi`: PASS; regenerated from Swagger, including the Retry-After response-header contract.
- `npm run openapi:check`: PASS.
- `npm run validate:docs`: PASS.

The first validation attempts caught import ordering and an intentional batched
activation test needing a scoped lint explanation; both were corrected before
the passing affected run. One earlier Nx Vitest plugin worker exited during graph
construction; a subsequent invocation completed without tooling changes.


Final gate: `npm run verify:full` PASS (full typecheck, lint, formatting, and tests;
35 test projects plus their dependencies). Full test log:
`tmp/agent-logs/2026-09-30T13-44-47-577Z-test-full.log`.
Affected test log: `tmp/agent-logs/2026-09-30T13-34-57-200Z-test-changed.log`.
Final build log: `tmp/agent-logs/2026-09-30T13-32-20-155Z-build-affected.log`.
All review corrections are complete. No live scheduled task was executed.

## Context

`apps/chat/src/utils/map-scheduled-task-dto.ts` holds four exports that `ScheduledTasksPage`, `ScheduledTaskDetailPage` and `useScheduledTaskSubmit` call:

- `buildScheduleLabel`;
- `mapScheduledTaskDtoToItem` and `mapScheduledTaskDtosToItems`;
- `getDeleteErrorMessageKey`;
- `resolveScheduledTaskErrorMessage`.

`apps/chat/src/utils/map-scheduled-task-run-dto.ts` holds `formatRunDuration`, `formatRunTimestamp`, `findMatchingConversation` and `mapScheduledTaskRunDtoToItem` / `mapScheduledTaskRunDtosToItems`. `ScheduledTaskDetailPage`, `TaskHistorySection` and `ScheduledTaskConversationBanner` call them.

Each export takes an i18next `TFunction` and reads `ScheduledTasksI18nKeys`. Under that, the logic is decided entirely by the DTO:

- the `describeScheduledTaskTrigger` kind switch, and the browser timezone it passes;
- the fixed-Monday weekday trick used to name a `dayOfWeek`;
- the duration split into hours, minutes and seconds, with zero units dropped;
- the same-calendar-day test;
- the upstream run status → `ScheduledTaskRunStatus` map, which falls back to `Missed`;
- 404/409 → "not found" and 502 → "retryable";
- admin-consent code → localized message, otherwise the trimmed upstream reason, otherwise the fallback.

The archived audit that kept these files host-owned (`openspec/changes/archive/2026-08-26-extract-reusable-chat-utilities-and-api-transport/design.md`, D-list "17 files stay host-owned") grouped them with the usage mappers. Those mappers were later moved to `libs/chat-hooks/src/usage/` under the narrow exception in `.claude/rules/libs.md`. A second DIAL-Core-backed host today re-implements these mappers inline in its pages, already with different output.

## Goals / Non-Goals

**Goals:**
- Every DTO-driven rule above lives once, in `libs/chat-hooks/src/scheduled-task/`, and is exported from the root and from `./scheduled-tasks`.
- The lib receives every user-visible string through typed formatter objects. It never sees a translation key, a plural suffix or `i18next`.
- `apps/chat` behaviour and rendered output are byte-for-byte unchanged, with no call site edits.

**Non-Goals:**
- Changing any label, plural or key, or adding a string.
- Moving `scheduled-task-form-validation.ts`. Its field-error copy mapping stays app-owned, as `scheduled-tasks-reuse-contract` already specifies.
- Moving the app's `conversationIdsMatch`. It depends on `normalizeConversationId` from `apps/chat/src/constants/routes.ts`, which is route policy.
- Adopting the adapters in any other host. That is a follow-up in that host.

## Decisions

### D1. Typed formatter callbacks, not `t` plus a key map

The lib defines three formatter interfaces:

- `ScheduledTaskScheduleLabels`:
  - `onceAt(date)`, `everyNMinutes(count)` and `hourlyAt(minute)`;
  - `dailyAt(time)`, `weeklyAt(day, time)`, `everyNWeeks(count, day, time)` and `monthlyAt(day, time)`;
  - `invalid` and `recurringFallback`, which are plain strings.
- `ScheduledTaskRunDurationLabels`: `hours(count)`, `minutes(count)`, `seconds(count)` and `suffix(duration)`.
- `ScheduledTaskRunTimestampLabels`: `todayAt(time)` and `dateAt(date, time)`.

Each callback receives values that are already locale-formatted (date, time, weekday) or plain counts. The host keeps its plural rules.

Alternatives:
- **`t` plus `SCHEDULED_TASK_I18N_KEYS`, the `USAGE_DATA_I18N_KEYS` pattern in `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`.** Rejected: it bakes `apps/chat`'s key paths and i18next plural suffixes into the lib, and every host would have to mirror that bundle.
- **A pre-resolved string object, like `folderLabels: DeploymentFolderLabels`.** Rejected: most strings are parameterized (counts, dates, times), so the host would have to pre-compute every combination.

### D2. Locale, timezone, "now" and id comparison are parameters

Each of these is a parameter with a default that keeps today's output:

- `timeZone` defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`, which is today's behaviour.
- `locale` is optional and passed to `Intl.DateTimeFormat`. When omitted, it stays `undefined`, as today.
- `now` defaults to `new Date()`.
- `conversationIdsMatch` is required wherever unread state is resolved.

These are browser APIs or caller values, not host integration knowledge. Defaulting them keeps calls short and keeps tests deterministic.

### D3. Delete failures return a lib enum; the app maps it to keys

`classifyScheduledTaskDeleteError(status)` returns `ScheduledTaskDeleteErrorKind.NotFound` / `Retryable` / `Generic`, a string enum in `scheduled-task-display.ts`. `getDeleteErrorMessageKey` stays in the app as a `switch` from that enum to `ScheduledTasksI18nKeys`. This follows the extract-to-lib rule: "keep the app's own copy-mapping in the app".

### D4. Error-message selection takes pre-translated strings

`selectScheduledTaskErrorMessage(details, { adminConsentRequired, fallback })`:

1. returns `adminConsentRequired` for `ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired`;
2. otherwise returns the trimmed `upstreamMessage`;
3. otherwise returns `fallback`.

The app adapter `resolveScheduledTaskErrorMessage(details, fallbackKey, t)` keeps its signature and passes `t(ToolsetSigninI18nKeys.AdminConsentRequired)` and `t(fallbackKey)`. Two strings are translated eagerly where one is used. The cost is negligible, and the lib stays free of `t`.

### D5. App files stay as adapters with their current names

`map-scheduled-task-dto.ts` and `map-scheduled-task-run-dto.ts` keep every export name and signature.

- Each export builds the formatter objects from `t` in a small local `build*Labels(t)` helper and calls the lib function, imported under a distinct lib name such as `formatScheduledTaskScheduleLabel`, `toScheduledTaskItem` or `formatScheduledTaskRunTimestamp`.
- `findMatchingConversation` stays app-side. It is a one-line lookup over the app's `conversationIdsMatch`.

The result:

- no call site changes;
- the many spec paths in `scheduled-tasks-page-ui`, `scheduled-task-detail-page`, `scheduled-task-create-form`, `scheduled-task-conversation-context` and `conversation-sources-sidebar` stay valid;
- `useScheduledTaskSubmit.spec.tsx`'s `vi.mock('../../../utils/map-scheduled-task-dto')` keeps working.

Lib names are distinct from app names, so an adapter never shadows the function it wraps.

### D6. No module-level read of the scheduled-tasks enum

`ScheduledTaskDetailPage.spec.tsx` mocks `@epam/ai-dial-scheduled-tasks` with an object literal. A lib module that builds `Record<string, ScheduledTaskRunStatus>` at import time would crash that suite when it loads. The upstream-status map is therefore built inside `toScheduledTaskRunItem`, as a `switch` over `ScheduledTaskRunDtoStatusEnum` that defaults to `Missed`. The extract-to-lib skill calls this trap "module-level reads of another lib".

### D7. Isolation justification for the narrow exception

The `.claude/rules/libs.md` "DIAL-Core response-to-display adapters in `chat-hooks`" exception requires three things, recorded here:

- **(a) The response shape drives the adaptation.** Every rule is driven by the generated response's own shape: the trigger fields, `durationSeconds`, `startTime`, the `status` enum, the HTTP status and `ScheduledTaskErrorCode`. No product decision is involved.
- **(b) The behaviour is characterized by tests.** `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` and `map-scheduled-task-run-dto.spec.ts` move with the code, translated to a fake formatter. They must pass unchanged in assertion before the adapters are rewired.
- **(c) Hosts vary only through callbacks and parameters.** Every host consumes the adapters the same way. Translated strings, locale, timezone, "now" and conversation-id comparison arrive as callbacks or parameters.

Imports stay within the `./scheduled-tasks` peer set: api-client DTO types, `@epam/ai-dial-scheduled-tasks` item types and `ScheduledTaskRunStatus`, and the lib's own `describeScheduledTaskTrigger` and `ApiErrorDetails`.

## Risks / Trade-offs

- **[Risk] A formatter argument order or plural count drifts from today's `t()` options.** → The app specs keep wiring tests that assert the exact key and options each formatter passes to `t`, for one case per trigger kind and per duration unit.
- **[Risk] A host passes non-memoized formatter objects into a `useMemo`'d mapping and recomputes every render.** → The README states the objects must be stable. `apps/chat`'s adapters build them inside the mapping call that is already memoized by its callers, so nothing changes there.
- **[Trade-off] Two vocabularies for one concept.** The lib names (`toScheduledTaskItem`) differ from the app names (`mapScheduledTaskDtoToItem`) to avoid shadowing. The README maps one to the other.
- **[Trade-off] The lib cannot localize weekday names itself.** It formats them with `Intl.DateTimeFormat(locale, { weekday: 'long' })` on the same fixed-Monday reference date as today, so a host gets localized names only by passing `locale`.

## Migration Plan

1. Add `scheduled-task-display.ts` and its spec, made from the moved `describe` blocks. Run lint, typecheck and test for `@epam/ai-dial-chat-hooks`.
2. Rewrite both app files as adapters and trim their specs to the wiring cases. Run lint, typecheck and test for `@epam/chat`.
3. Update the README, `.claude/rules/libs.md`, `AGENTS.md` (the exception summary) and the `chat-hooks-domain-utilities` spec. Then run `validate:docs`, `validate:specs` and `validate:lib-duplicates`.

**Rollback:** revert the change. Nothing outside the two adapter files consumes the new exports.

## Open Questions

None blocking. Whether other hosts converge on `apps/chat`'s exact copy (for example a schedule label instead of a next-run time) is their own product decision. The adapters support either, since a host can still render `nextRunTime` itself.

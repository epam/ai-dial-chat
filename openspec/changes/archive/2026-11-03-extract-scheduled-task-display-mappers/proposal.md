## Why

Turning scheduler responses into the props `@epam/ai-dial-scheduled-tasks` renders — a task's schedule label, a run's status, timestamp and duration, which delete failure the user sees, which scheduler error text is shown — is the same job for every DIAL-Core-backed host. Today only `apps/chat` has it, in `apps/chat/src/utils/map-scheduled-task-dto.ts` and `apps/chat/src/utils/map-scheduled-task-run-dto.ts`. A second host therefore re-implements simplified copies inline in its pages, and those copies have already diverged: a next-run time instead of the schedule, `(Ns)` instead of `(1m 1s)`, and no "today at" form.

Both files were recorded as host-owned on the grounds that "the translated string genuinely *is* the entire function output" (`openspec/changes/archive/2026-08-26-extract-reusable-chat-utilities-and-api-transport/design.md`). That rationale does not hold for them. Only the final strings are translated. Everything that decides the output is driven by the DTO:

- which trigger kind a task has, and in which timezone it is shown;
- how a run duration splits into units;
- whether a timestamp falls on today;
- how an upstream run status maps to the lib enum;
- which HTTP status means "not found" or "retryable";
- when the scheduler's own reason is shown.

The usage mappers in the same "host-owned" list were later moved to `libs/chat-hooks` on exactly this argument (`libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`).

## What Changes

- **New: display adapters in `libs/chat-hooks/src/scheduled-task/`.** Exported from the root and from `./scheduled-tasks`:
  - **Schedule label.** The `describeScheduledTaskTrigger`-based schedule label goes through a typed `ScheduledTaskScheduleLabels` formatter interface. Locale and timezone are parameters; the timezone defaults to the browser's.
  - **Task items.** `ScheduledTaskDto` maps to `ScheduledTaskItem`, singly and as a list.
  - **Run formatting.** Run duration (`ScheduledTaskRunDurationLabels`) and run timestamp (`ScheduledTaskRunTimestampLabels`) have their own formatter interfaces, and `now` is a parameter.
  - **Run items.** `ScheduledTaskRunDto` maps to `ScheduledTaskRunItem`, singly and as a list. A `conversationIdsMatch` callback resolves `isUnread`.
  - **Delete errors.** A failed delete's HTTP status classifies into a new string enum `ScheduledTaskDeleteErrorKind`: `NotFound`, `Retryable` or `Generic`.
  - **Mutation errors.** Scheduler mutation-error message selection takes pre-translated `adminConsentRequired` and `fallback` strings.
- **`apps/chat` becomes the thin i18n adapter.**
  - `map-scheduled-task-dto.ts` and `map-scheduled-task-run-dto.ts` keep their exported names and `(…, t, …)` signatures, so no call site changes.
  - Each export builds the formatter objects from `t()` and `ScheduledTasksI18nKeys`, then delegates to the lib.
  - `getDeleteErrorMessageKey` maps the lib enum to the app's keys, and `findMatchingConversation` passes the app's `conversationIdsMatch`.
- **Tests move with the logic.** The DTO-driven `describe` blocks move to `libs/chat-hooks/src/scheduled-task/tests/`, with a local fake formatter. The app specs keep only the wiring cases (keys and plural counts reach `t()`).
- **Docs.**
  - The README gets a section per new export.
  - `.claude/rules/libs.md` "Narrow isolation exceptions" names these adapters as a second reference case of the DIAL-Core response-to-display exception. The justification is recorded in this change's `design.md`.
- No **BREAKING** change: the lib only gains exports, and the app's exports keep their signatures.

**Alternatives considered:**
1. **Leave both files host-owned (baseline).** Rejected: every other host keeps re-deriving trigger, timezone and status rules, and they already drift.
2. **`t` plus an exported key map, as `USAGE_DATA_I18N_KEYS` does.** Rejected: the lib would hard-code this app's key paths and plural suffixes, and the other host would have to adopt the app's bundle layout.
3. **Typed formatter callbacks (chosen).** The lib knows no keys, no `i18next` and no plural rules; each host decides its copy.

## Capabilities

### New Capabilities
- `chat-hooks-scheduled-task-display`: the DTO-to-display adapters for scheduled tasks and runs in `@epam/ai-dial-chat-hooks`. Covers their formatter interfaces, parameters, outputs and the enum they return, and that they receive no translation keys, no i18n library and no app id policy.

### Modified Capabilities
- `chat-hooks-domain-utilities`:
  - The requirement "Host-owned `apps/chat/src/utils/` files are unaffected" drops `map-scheduled-task-dto.ts` and `map-scheduled-task-run-dto.ts` from its untouched list.
  - It records that their DTO-driven logic now lives in `libs/chat-hooks/src/scheduled-task/`, while the app files stay as translated adapters.

Spec text in `scheduled-tasks-page-ui`, `scheduled-task-detail-page`, `scheduled-task-create-form`, `scheduled-task-conversation-context` and `conversation-sources-sidebar` that names these app functions stays valid. The functions keep their paths, names and observable output, so no requirement there changes.

## Impact

- **Code:**
  - New `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`, its spec, and `index.ts` / `entry-points/scheduled-tasks.ts` exports.
  - `apps/chat/src/utils/map-scheduled-task-dto.ts` and `map-scheduled-task-run-dto.ts` are rewritten as adapters; their specs are trimmed.
- **Library isolation (shared lib, flagged as scope):**
  - The lib reads only DTO types from `@epam/ai-dial-chat-api-client`, `ScheduledTaskItem` / `ScheduledTaskRunItem` / `ScheduledTaskRunStatus` from `@epam/ai-dial-scheduled-tasks` (already a peer of `./scheduled-tasks`), and `ApiErrorDetails` from its own `api-error` module.
  - Translated strings, locale, timezone and the conversation-id comparison stay at the app edge. They arrive through formatter objects and parameters built in the two app adapter files.
  - The entry-point peer set does not change.
- **i18n:** no new user-visible strings and no new keys; existing `scheduledTasks.*` keys and plurals are reused unchanged.
- **Rollback:** revert the change. The app files return to their self-contained form and nothing else depends on the new lib exports.

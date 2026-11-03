# chat-hooks-scheduled-task-display Specification

## Purpose

DTO-to-display adapters for scheduled tasks and their runs, published from
`@epam/ai-dial-chat-hooks` (root and `./scheduled-tasks`): schedule labels,
card and history items, run duration and timestamp formatting, and error
classification. Every user-visible word arrives through host formatter
callbacks or pre-translated strings, and locale, timezone, "now" and the
conversation-id comparison arrive as parameters, so any DIAL-Core-backed host
can render `@epam/ai-dial-scheduled-tasks` with its own copy.

## Requirements

### Requirement: Scheduled-task display adapters are exported by `@epam/ai-dial-chat-hooks` without host knowledge

`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts` SHALL export the following from both the root `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/scheduled-tasks`:

- functions: `formatScheduledTaskScheduleLabel`, `toScheduledTaskItem`, `toScheduledTaskItems`, `formatScheduledTaskRunDuration`, `formatScheduledTaskRunTimestamp`, `toScheduledTaskRunItem`, `toScheduledTaskRunItems`, `classifyScheduledTaskDeleteError` and `selectScheduledTaskErrorMessage`;
- the `ScheduledTaskDeleteErrorKind` string enum;
- the interfaces `ScheduledTaskScheduleLabels`, `ScheduledTaskRunDurationLabels` and `ScheduledTaskRunTimestampLabels`.

The module SHALL NOT import any of the following:

- `i18next` or `react-i18next`;
- a translation key, or any module under `apps/`;
- routing, app contexts or storage.

Every user-visible string SHALL reach it through a formatter callback or a pre-translated string argument. The module SHALL import only:

- `@epam/ai-dial-chat-api-client` DTO types and enums;
- `@epam/ai-dial-scheduled-tasks` item types and `ScheduledTaskRunStatus`;
- the lib's own `describeScheduledTaskTrigger` and `ApiErrorDetails`.

The peer set of `./scheduled-tasks` SHALL stay unchanged. The module SHALL NOT read another lib's enum at module scope.

No component or hook owns state for this capability: every export is a pure function of its arguments.

#### Scenario: The lib holds no translation key
- **WHEN** `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts` is inspected
- **THEN** it contains no `scheduledTasks.` key string, no `i18next` import and no `TFunction` type

#### Scenario: Both entry points expose the adapters
- **WHEN** a host imports `toScheduledTaskRunItems` from `@epam/ai-dial-chat-hooks/scheduled-tasks` and `formatScheduledTaskScheduleLabel` from `@epam/ai-dial-chat-hooks`
- **THEN** both resolve, and `docs/host-install-matrix.md` lists the same peers for `./scheduled-tasks` as before the change

#### Scenario: A test that mocks the scheduled-tasks lib still loads the module
- **WHEN** a suite mocks `@epam/ai-dial-scheduled-tasks` with an object literal that omits `ScheduledTaskRunStatus` and imports a module that imports `scheduled-task-display.ts`
- **THEN** the import succeeds; only a call to `toScheduledTaskRunItem` reads the enum

### Requirement: Schedule labels come from the trigger descriptor through host formatters

`formatScheduledTaskScheduleLabel(task, labels, { locale?, timeZone? })` SHALL call `describeScheduledTaskTrigger(task.trigger, { timeZone })`.

- `timeZone` SHALL default to `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- The function SHALL return exactly one `ScheduledTaskScheduleLabels` member's output for the descriptor kind:

  | Kind | Formatter call |
  |---|---|
  | `OneTime` | `onceAt(date)`, where `date` is formatted with `Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })` |
  | `EveryNMinutes` | `everyNMinutes(intervalMinutes)` |
  | `Hourly` | `hourlyAt(time)` |
  | `Daily` | `dailyAt(time)` |
  | `Weekly` | `weeklyAt(day, time)` |
  | `EveryNWeeks` | `everyNWeeks(intervalWeeks, day, time)` |
  | `Monthly` | `monthlyAt(dayOfMonth, time)` |
  | `Invalid` | `invalid` |
  | any other kind (including `Custom`) | `recurringFallback` |

- `day` SHALL be the weekday name for `dayOfWeek`, formatted with `Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })` on the UTC date `2023-01-02` plus `dayOfWeek` days (APScheduler Monday = 0).

#### Scenario: A daily trigger stored in UTC renders in the viewer's timezone
- **WHEN** `formatScheduledTaskScheduleLabel` is called for a daily trigger at UTC `07:00` with `timeZone: 'Europe/Berlin'` during summer time
- **THEN** it returns `labels.dailyAt('09:00')`

#### Scenario: A weekly trigger names its weekday in the requested locale
- **WHEN** it is called for a weekly trigger whose descriptor has `dayOfWeek: '0'` with `locale: 'en-US'`
- **THEN** `labels.weeklyAt` receives `'Monday'` as `day`

#### Scenario: An unrecognized descriptor uses the fallback
- **WHEN** the descriptor kind is `Custom`
- **THEN** it returns `labels.recurringFallback`

### Requirement: Task and run DTOs map to the scheduled-tasks lib items without reinterpretation

**Task items.** `toScheduledTaskItem(task, labels, options)` SHALL return a `ScheduledTaskItem` built as follows:

- `id`, `displayName`, `isActive` and `isCompleted` are copied from the DTO.
- `descriptionPreview` is `task.description`, with no truncation.
- `scheduleLabel` is `formatScheduledTaskScheduleLabel(task, labels, options)`.

**Run items.** `toScheduledTaskRunItem(run, { timestampLabels, durationLabels, conversations, conversationIdsMatch, locale?, now? })` SHALL return a `ScheduledTaskRunItem` built as follows:

| Field | Value |
|---|---|
| `id` | the run's `id` |
| `status` | mapped from `ScheduledTaskRunDtoStatusEnum` `Success`, `Error`, `InProgress` and `Missed` to the same-named `ScheduledTaskRunStatus` member; any other value maps to `Missed` |
| `timestampLabel` | `formatScheduledTaskRunTimestamp` of `startTime` without a duration |
| `durationLabel` | `formatScheduledTaskRunDuration(run.durationSeconds, durationLabels)` |
| `conversationId` | copied from the run |
| `isUnread` | `true` only when an entry of `conversations` satisfies `conversationIdsMatch(entry.id, run.conversationId)` and has `isUnread === true` |
| `errorText` | copied from the run |

**Lists.** `toScheduledTaskItems` and `toScheduledTaskRunItems` SHALL map arrays and preserve their order.

#### Scenario: An unknown upstream run status renders as missed
- **WHEN** `toScheduledTaskRunItem` receives a run whose `status` is not one of the four known values
- **THEN** the item's `status` is `ScheduledTaskRunStatus.Missed`

#### Scenario: Unread state uses the host's id comparison
- **WHEN** a run's `conversationId` is `'conversations/bucket/a'`, `conversations` holds `{ id: 'bucket/a', isUnread: true }`, and the host's `conversationIdsMatch` treats those ids as equal
- **THEN** the item's `isUnread` is `true`; with a comparison that returns `false` it is `false`

#### Scenario: Task fields pass through unchanged
- **WHEN** `toScheduledTaskItem` receives a DTO with `isActive: false`, `isCompleted: true` and a 500-character `description`
- **THEN** the item carries `isActive: false`, `isCompleted: true` and the full description as `descriptionPreview`

### Requirement: Run duration and timestamp formatting delegate every word to host formatters

**Duration.** `formatScheduledTaskRunDuration(durationSeconds, labels)` SHALL behave as follows:

- It returns `undefined` when `durationSeconds` is `undefined` or `null`.
- Otherwise it splits the value into hours, minutes and seconds and keeps the non-zero units in that order, each rendered by `labels.hours` / `labels.minutes` / `labels.seconds`. A zero duration renders as `labels.seconds(0)`.
- It joins the units with a single space and returns `labels.suffix(joined)`.

**Timestamp.** `formatScheduledTaskRunTimestamp(startTime, durationSeconds, labels, { durationLabels?, locale?, now? })` SHALL behave as follows:

- It formats the time with `Intl.DateTimeFormat(locale, { timeStyle: 'short' })`.
- When `startTime` falls on the same local calendar day as `now`, which defaults to the current time, it returns `labels.todayAt(time)`.
- Otherwise it returns `labels.dateAt(date, time)`, where `date` uses `{ month: 'short', day: 'numeric' }`.
- When `durationSeconds` is present and `durationLabels` is supplied, it appends a single space and the formatted duration.

#### Scenario: Zero units are omitted
- **WHEN** `formatScheduledTaskRunDuration(3605, labels)` is called
- **THEN** it returns `labels.suffix(labels.hours(1) + ' ' + labels.seconds(5))`

#### Scenario: A run from today uses the today formatter
- **WHEN** `formatScheduledTaskRunTimestamp` is called with a `startTime` on the same local day as `now`
- **THEN** it returns `labels.todayAt(<short time>)` and does not call `labels.dateAt`

### Requirement: Error presentation is classified by the lib and worded by the host

**Delete errors.** `classifyScheduledTaskDeleteError(status)` SHALL return the following `ScheduledTaskDeleteErrorKind`:

| HTTP status | Kind |
|---|---|
| 404 or 409 | `NotFound` |
| 502 | `Retryable` |
| anything else, including `undefined` | `Generic` |

**Mutation errors.** `selectScheduledTaskErrorMessage(details, { adminConsentRequired, fallback })` SHALL return, in this order:

1. `adminConsentRequired` when `details.code` is `ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired`;
2. otherwise `details.upstreamMessage` trimmed, when non-empty;
3. otherwise `fallback`.

It SHALL never return the BFF's generic `message`.

#### Scenario: A conflict on delete reads as not found
- **WHEN** `classifyScheduledTaskDeleteError(409)` is called
- **THEN** it returns `ScheduledTaskDeleteErrorKind.NotFound`

#### Scenario: A blank upstream reason falls back
- **WHEN** `selectScheduledTaskErrorMessage({ upstreamMessage: '   ' }, { adminConsentRequired: 'A', fallback: 'F' })` is called
- **THEN** it returns `'F'`

### Requirement: `apps/chat` output is unchanged after adopting the adapters

The following exports SHALL keep their names, signatures and returned strings:

- `buildScheduleLabel`, `mapScheduledTaskDtoToItem`, `mapScheduledTaskDtosToItems`, `getDeleteErrorMessageKey` and `resolveScheduledTaskErrorMessage` in `apps/chat/src/utils/map-scheduled-task-dto.ts`;
- `formatRunDuration`, `formatRunTimestamp`, `findMatchingConversation`, `mapScheduledTaskRunDtoToItem` and `mapScheduledTaskRunDtosToItems` in `apps/chat/src/utils/map-scheduled-task-run-dto.ts`.

Each SHALL build its formatter objects from `t()` with the same `ScheduledTasksI18nKeys` / `ToolsetSigninI18nKeys` keys and interpolation options it passes today, and delegate to the lib.

The change introduces:

- no new i18n keys and no new user-visible strings;
- no `ENABLED_FEATURES` gate beyond the existing scheduled-tasks one;
- no RTL impact, since the adapters produce plain text into existing slots;
- no telemetry and no cached data.

#### Scenario: Translation calls are identical before and after
- **WHEN** an app adapter is called with a `t` that records its calls, for one task per trigger kind and one run per duration shape
- **THEN** each returned string equals the pre-change output and is produced by the same key and interpolation options as before (an adapter MAY additionally translate the plain-string labels it passes eagerly, such as the invalid/fallback schedule labels and both error messages)

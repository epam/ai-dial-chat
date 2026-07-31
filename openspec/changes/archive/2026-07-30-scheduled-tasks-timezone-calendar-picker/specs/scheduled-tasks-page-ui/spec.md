## MODIFIED Requirements

### Requirement: Client-side search and sort over the fetched list

`ScheduledTasksPage`/`ScheduledTasks` SHALL filter the fetched `items` by case-insensitive substring match against `displayName` (and `descriptionPreview` when present) using `searchQuery`, and SHALL sort the filtered items by `sortKey`: `firstToRun`/`lastToRun` order by `sortValues.nextRunAt` ascending/descending (items missing `nextRunAt` sort last), `newest` orders by `sortValues.createdAt` descending (items missing `createdAt` sort last), and `nameAZ` orders by `displayName` ascending. No new query parameters are sent to `GET /api/v1/scheduled-tasks`; filtering and sorting operate entirely on the already-fetched array.

`map-scheduled-task-dto.ts`'s `formatCronScheduleLabel` SHALL convert the stored UTC `cron.fields.hour`/`minute` (and `day_of_week`/`day` when present) back to the current browser's local time before formatting the display label, using the same reference-`Date` conversion technique (inverse direction) as the submit-side conversion in `buildCronFields`, so the displayed recurring schedule time always matches the wall-clock time that will actually execute. This mirrors the existing local-display behavior already used for "once" schedules via `Intl.DateTimeFormat(undefined, ...)`.

#### Scenario: Search matches display name

- **WHEN** `searchQuery = "competitor"` and `items` includes one entry with `displayName = "Competitor Updates"` and others that don't match
- **THEN** only the matching entry is rendered in the card grid

#### Scenario: Sort by nameAZ orders alphabetically

- **WHEN** `sortKey = "nameAZ"` and `items` contains `displayName` values `"Zeta"`, `"Alpha"`
- **THEN** the rendered card order is `"Alpha"`, `"Zeta"`

#### Scenario: Items missing sort field sort last

- **WHEN** `sortKey = "newest"` and one item has no `sortValues.createdAt` while others do
- **THEN** the item without `createdAt` renders after all items that have it

#### Scenario: Recurring schedule label shows the local equivalent of the stored UTC time

- **WHEN** a task's `trigger.cron.fields` stores UTC `hour = '7'`, `minute = '0'`, and the browser's timezone is UTC+2
- **THEN** `formatCronScheduleLabel` renders a label showing `09:00`, not `07:00`

#### Scenario: Weekly recurring label shows the local day, not the stored UTC day

- **WHEN** a task's `trigger.cron.fields` stores UTC `day_of_week` for Tuesday with `hour = '21'`, `minute = '30'`, and the browser's timezone is UTC+2 (so the local equivalent is Monday `23:30`)
- **THEN** `formatCronScheduleLabel` renders a label showing Monday `23:30`, not Tuesday `21:30`

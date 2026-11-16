# Spec Delta

## ADDED Requirements

### Requirement: Scheduled task carries an IANA time zone

`POST /api/v1/scheduled-tasks` and `PUT /api/v1/scheduled-tasks/:scheduleId` SHALL accept an optional top-level `timezone` beside `trigger` and forward it upstream. Responses SHALL return it as stored, or `UTC` when absent. The response schema marks it optional so existing clients stay valid; the server always fills it.

```json
{
  "displayName": "Morning briefing",
  "timezone": "Europe/Berlin",
  "trigger": { "cron": { "fields": { "hour": "9", "minute": "0" } } },
  "model": "gpt-4.1-mini-2025-04-14",
  "prompt": "Summarize my calendar"
}
```

Generated SDK method names do not change; the field is additive on the existing operations (`CreateScheduledTaskBodyDto`, `UpdateScheduledTaskBodyDto`, `ScheduledTaskDto`).

#### Scenario: Zone is forwarded and returned

- **WHEN** a client creates a task with `timezone: "Europe/Berlin"`
- **THEN** the upstream request carries `timezone: "Europe/Berlin"` and the `201` response contains `timezone: "Europe/Berlin"`

#### Scenario: Upstream response without a zone

- **WHEN** DIAL Scheduler returns a schedule with no `timezone`
- **THEN** the BFF response contains `timezone: "UTC"`

### Requirement: Omitted time zone is forwarded as UTC

An omitted `timezone` SHALL be forwarded upstream as `UTC` on create and on update, because DIAL Scheduler resets an omitted zone on update. Callers that want to keep a zone MUST resend it.

#### Scenario: Omitted zone on create means UTC

- **WHEN** a client creates a task without `timezone`
- **THEN** the upstream request carries `timezone: "UTC"` and the response contains `timezone: "UTC"`

#### Scenario: Update without a zone resets to UTC

- **WHEN** a client updates a task without `timezone`
- **THEN** the upstream request carries `timezone: "UTC"`

### Requirement: Unknown time zones are rejected before reaching the scheduler

The BFF SHALL validate `timezone` as a string of 1 to 64 characters matching an allowlist of IANA identifier characters (letters, digits, `/`, `_`, `+`, `-`), accepted only if `Intl.DateTimeFormat` constructs with it. An invalid value SHALL return `400 Bad Request` with the standard validation error body and no upstream call. The value SHALL be forwarded with its case unchanged.

#### Scenario: Unknown identifier

- **WHEN** a client sends `timezone: "Mars/Olympus"`
- **THEN** the response is `400` and the scheduler is not called

#### Scenario: Offset instead of identifier

- **WHEN** a client sends `timezone: "+02:00"`
- **THEN** the response is `400`

#### Scenario: Path-like input

- **WHEN** a client sends `timezone: "../../etc/passwd"`
- **THEN** the response is `400`

#### Scenario: Legacy identifier is accepted

- **WHEN** a client sends `timezone: "Asia/Calcutta"`
- **THEN** the request is accepted and forwarded unchanged

### Requirement: Wrongly cased time zones surface the scheduler's rejection

`Intl` ignores case while DIAL Scheduler is case-sensitive, so a wrongly cased identifier that passes the BFF check is rejected upstream with `422` at `body.timezone`. The BFF SHALL surface that through the existing scheduler-error mapping with the upstream reason, not as a generic `502`.

#### Scenario: Wrong case is rejected by the scheduler

- **WHEN** a client sends `timezone: "europe/berlin"` and the scheduler answers `422` at `body.timezone`
- **THEN** the BFF response carries the upstream reason and code

### Requirement: Offset-less trigger datetimes are zone-local

`trigger.date`, `trigger.cron.startDate` and `trigger.cron.endDate` SHALL accept a datetime with an offset or `Z` (an absolute instant, as today) or without one (`YYYY-MM-DDTHH:mm:ss[.SSS]`), which DIAL Scheduler reads as wall time in the task's `timezone`. Values SHALL be forwarded unchanged and cron `fields` SHALL NOT be shifted by the BFF.

#### Scenario: Local one-time date

- **WHEN** a task is created with `timezone: "Europe/Berlin"` and `trigger.date: "2027-01-01T09:00:00"`
- **THEN** the upstream request carries both values unchanged

#### Scenario: Instant values still work

- **WHEN** a client sends `startDate: "2026-07-31T22:00:00.000Z"`
- **THEN** the request is accepted exactly as before this change

### Requirement: Activity-window ordering ignores the server time zone

The BFF SHALL compare two offset-less window boundaries by wall-clock order, independent of the server's own zone, and SHALL compare a mix of offset-less and offset values as instants using the task's zone. An end that is not strictly after the start SHALL return `400`.

#### Scenario: Window order across offset-less values

- **WHEN** `startDate` is `2026-08-01T00:00:00.000` and `endDate` is `2026-07-31T23:59:59.999`
- **THEN** the response is `400` because the end is not after the start

#### Scenario: Server zone has no effect

- **WHEN** the same offset-less window is validated with the process zone set to `UTC` and to `America/Sao_Paulo`
- **THEN** both results are identical

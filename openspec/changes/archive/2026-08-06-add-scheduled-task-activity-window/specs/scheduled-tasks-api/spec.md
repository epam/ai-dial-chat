## ADDED Requirements

### Requirement: Cron trigger activity window (startDate/endDate)

`ScheduleCronDto` (`apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`) SHALL gain two optional fields, siblings of the existing `fields`:

```json
{
  "trigger": {
    "cron": {
      "fields": { "hour": "9", "minute": "0" },
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2026-12-31T23:59:59.999Z"
    }
  }
}
```

- `startDate?: string` — `@IsOptional() @IsISO8601()`
- `endDate?: string` — `@IsOptional() @IsISO8601()`

Both fields apply only to a `cron` (recurring) trigger and are optional; when unset, the create/update behavior for `POST /api/v1/scheduled-tasks` and `PUT /api/v1/scheduled-tasks/:scheduleId` is unchanged from today.

`scheduled-tasks.mapper.ts` SHALL enforce, alongside the existing `assertExactlyOneTriggerVariant` check (same function, extended — not a new class-validator decorator, since these are cross-field checks over optional sibling fields that class-validator's per-property decorators cannot express):

- **Ordering**: when both `startDate` and `endDate` are present and `endDate` is not strictly after `startDate` → `400 Bad Request`.
- **One-shot rejection**: when `startDate` and/or `endDate` is present on a request whose `trigger` is `date` (one-shot) rather than `cron` → `400 Bad Request`. `startDate`/`endDate` only exist on `ScheduleCronDto`, so this case only arises if a caller sends both `trigger.date` and `trigger.cron.startDate`/`endDate` in the same malformed request — which the existing "exactly one trigger variant" check independently also rejects, but this check gives a body-mentions-cron-fields-with-a-date-trigger request the same clear rejection even before that check would otherwise run.

`toUpstreamSchedulePayload` SHALL extend the upstream `cron` shape (`UpstreamScheduleTrigger.cron: { fields: Record<string, string>; start_date?: string; end_date?: string }`) and include `start_date`/`end_date` **only when** the corresponding camelCase value is present and non-empty — omitted entirely otherwise, matching the existing `description` omission pattern (`...(body.description ? { description: body.description } : {})`), never sent as `null`. This applies identically to create and update, since `UpdateScheduledTaskBodyDto` reuses the create body shape.

`fromUpstreamSchedule` SHALL map upstream `trigger.cron.start_date` / `trigger.cron.end_date` back to `startDate` / `endDate` on the `cron` object of the response `ScheduleTriggerDto`, defaulting to `undefined` when absent, and MUST NOT throw when the upstream `trigger` object is missing entirely (list items carry only `trigger_type`).

#### Scenario: Recurring create with a bounded window sends both upstream keys

- **WHEN** a create request has `trigger.cron.fields`, `trigger.cron.startDate: "2026-08-01T00:00:00.000Z"`, and `trigger.cron.endDate: "2026-12-31T23:59:59.999Z"`
- **THEN** the upstream request body's `trigger.cron` includes `start_date: "2026-08-01T00:00:00.000Z"` and `end_date: "2026-12-31T23:59:59.999Z"` alongside `fields`

#### Scenario: Recurring create with no window omits both upstream keys

- **WHEN** a create request has `trigger.cron.fields` and no `startDate`/`endDate`
- **THEN** the upstream request body's `trigger.cron` contains only `fields` — no `start_date` or `end_date` key, and neither is sent as `null`

#### Scenario: endDate not after startDate is rejected

- **WHEN** a create or update request has `trigger.cron.startDate` and `trigger.cron.endDate` where `endDate` is equal to or earlier than `startDate`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: startDate/endDate on a one-shot trigger is rejected

- **WHEN** a create or update request includes `trigger.cron.startDate` and/or `trigger.cron.endDate` together with `trigger.date` set
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Update accepts the same window fields as create

- **WHEN** an authenticated, feature-enabled user submits a valid update body with `trigger.cron.startDate`/`endDate` for an existing `scheduleId`
- **THEN** the upstream `PUT` request body's `trigger.cron` includes `start_date`/`end_date` under the same omission rule as create, and the response is `200 OK`

#### Scenario: Get response round-trips the activity window

- **WHEN** `GET /api/v1/scheduled-tasks/:scheduleId` is called for a schedule whose upstream `trigger.cron` includes `start_date`/`end_date`
- **THEN** the response `ScheduledTaskDto.trigger.cron` includes `startDate`/`endDate` mapped from those upstream values

#### Scenario: List response mapping does not throw when trigger is absent

- **WHEN** `fromUpstreamSchedule` is called with an upstream object that has no `trigger` field (as returned by the list endpoint for individual items)
- **THEN** it returns a `ScheduledTaskDto` with `trigger.cron` `undefined`, without throwing

## MODIFIED Requirements

### Requirement: Cancel returns to returnUrl; valid submit calls the BFF create endpoint

The create-task page SHALL read a `returnUrl` query parameter (default `ROUTES.ScheduledTasks` when absent or invalid). Cancel SHALL discard in-progress form state, perform no network call, and navigate to `returnUrl`.

A valid submit SHALL call `POST /api/v1/scheduled-tasks` through `apps/chat/src/server-api/scheduled-tasks.api.ts` (wrapping the generated `@epam/chat-api-client` method from `add-scheduled-tasks-api`) with a body matching `CreateScheduledTaskBodyDto`: `displayName`, `trigger`, `model`, `prompt`, and optional `description` (trimmed; included only when non-empty, otherwise omitted from the body entirely — never sent as an empty string). The body SHALL NOT include a `stream` field — streaming is fixed server-side and is not client-controllable. The page's client-side validator SHALL reject a `description` longer than 500 characters before submit, mirroring the BFF's `@MaxLength(500)`. On **201 Created**, the page SHALL show a success notification via `useNotification` and navigate to `returnUrl`. On **4xx/5xx**, the page SHALL show an error notification, remain on the form with user-entered values (including `description`) preserved, and re-enable the Create action.

**Dependency:** requires `add-scheduled-tasks-api` (`POST /api/v1/scheduled-tasks` + `scheduled-tasks.api.ts` wrapper) to be implemented first.

#### Scenario: Cancel discards changes and returns

- **WHEN** the user has typed into the display name field and activates Cancel
- **THEN** the app navigates to `returnUrl` and no notification or network call occurs

#### Scenario: Valid submit persists via BFF and returns

- **WHEN** all required fields pass validation and the user activates Create
- **THEN** the app sends `POST /api/v1/scheduled-tasks` with `{ displayName, trigger, model, prompt, description? }` (no `stream` field), shows a success notification on 201, and navigates to `returnUrl`

#### Scenario: Submit failure keeps the form open

- **WHEN** the user activates Create and the BFF returns 400 or 502
- **THEN** an error notification is shown, the user remains on the create form with their input preserved, and no navigation to `returnUrl` occurs

#### Scenario: Missing returnUrl falls back to the list route

- **WHEN** the create route is opened without a `returnUrl` query parameter
- **THEN** Cancel and a successful submit both navigate to `ROUTES.ScheduledTasks`

#### Scenario: Invalid returnUrl falls back to the list route

- **WHEN** the create route is opened with an empty, absolute, protocol-relative, backslash-containing, or control-character-containing `returnUrl`
- **THEN** Cancel and a successful submit both navigate to `ROUTES.ScheduledTasks`

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `texts`, `values`, `errors`, `modelOptions` (`{ id, label }[]`), `onFieldChange`, `onCancel`, `onSubmit`, and optional `isSubmitting` (default `false`).

It SHALL render:

- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), rendered between Display name and Schedule type, with `maxLength={500}` and accessible feedback (e.g. a character count or inline validation message per `errors.description`) shown when the field is non-empty
- **Schedule type** — control to choose one-shot vs recurring (`values.scheduleType`: `'once' | 'recurring'`)
- **Run at** — a `Calendar` control (`mode={CalendarMode.DateTime}`, imported from `@epam/ai-dial-ui-kit`) shown when `scheduleType === 'once'`, bound to `values.runAt`; replaces the native `<input type="datetime-local">` previously used for this field
- **Frequency** — dropdown (Daily / Weekly / Monthly) shown when `scheduleType === 'recurring'` (`values.frequency`)
- **Time** — a `Calendar` control (`mode={CalendarMode.Time}`, imported from `@epam/ai-dial-ui-kit`) for recurring schedules, bound to `values.time` (`HH:mm` local wall-clock string, validated at app edge); replaces the native `<input type="time">` previously used for this field
- **Day of week** — a `Calendar` control (`mode={CalendarMode.Weekday}`, imported from `@epam/ai-dial-ui-kit`) shown when frequency is Weekly, bound to `values.dayOfWeek` via `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` (`libs/scheduled-tasks/src/utils/calendar-value.ts`), which convert between `Calendar`'s ISO weekday value (`"1"`=Monday..`"7"`=Sunday) and `values.dayOfWeek`'s APScheduler-convention string (`"0"`=Monday..`"6"`=Sunday); replaces the free-text `<input>` previously used for this field
- **Day of month** — shown when frequency is Monthly (`values.dayOfMonth`)
- **Model** — required dropdown populated from `modelOptions` (`values.modelId`)
- **Prompt** — required textarea (`values.prompt`)
- **Cancel / Create** actions

`values` SHALL NOT include a `stream` field, and the form MUST NOT render a stream toggle — scheduled task runs are always non-streaming background executions and this is not a user-configurable option.

`description` is optional and MUST NOT participate in the Create-button required-field guard. The Create action SHALL be disabled while `isSubmitting` is `true` or while `displayName`, `modelId`, or `prompt` are empty (minimum client-side guard; full validation lives in the page).

The `Run at` and `Time` `Calendar` controls' `onChange` callbacks MUST adapt the ui-kit's `CalendarValue` (`Date | string | null`) into calls to `onFieldChange('runAt', ...)` / `onFieldChange('time', ...)` using the same value shapes the page already consumes (`values.runAt` as a `Date`-constructible value, `values.time` as an `"HH:mm"` string) — this is a UI-control swap, not a change to the `values`/`onFieldChange` contract.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics. Importing `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` is permitted — it is a generic design-system control with no host-specific integration knowledge.

#### Scenario: Required-field guard blocks submit

- **WHEN** `displayName` is empty or `modelId` is unset
- **THEN** the Create button is disabled

#### Scenario: Submitting is reflected in the UI

- **WHEN** `isSubmitting` is `true`
- **THEN** the Create button is disabled and shows a busy/loading affordance

#### Scenario: Model options are passed in, not fetched

- **WHEN** `ScheduledTaskCreateForm` renders with `modelOptions={[{ id: 'gpt-4o', label: 'GPT-4o' }]}`
- **THEN** the model dropdown lists that option and the lib performs no deployment/API fetch

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskCreateForm`) is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules; imports of `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` are present and allowed

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Create button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and accessible feedback is shown once the field is non-empty

#### Scenario: Once schedule uses the Calendar DateTime control

- **WHEN** `scheduleType === 'once'`
- **THEN** the "Run at" field renders `Calendar` with `mode={CalendarMode.DateTime}`, not a native `<input type="datetime-local">`

#### Scenario: Recurring schedule uses the Calendar Time control

- **WHEN** `scheduleType === 'recurring'`
- **THEN** the "Time" field renders `Calendar` with `mode={CalendarMode.Time}`, not a native `<input type="time">`

#### Scenario: Weekly recurring schedule uses the Calendar Weekday control with ISO/APScheduler conversion

- **WHEN** `scheduleType === 'recurring'`, `frequency === 'weekly'`, and the user selects Monday in the "Day of week" `Calendar` (`mode={CalendarMode.Weekday}`, ISO value `"1"`)
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), not `'1'`

#### Scenario: Form does not expose a stream control

- **WHEN** the create-task form renders
- **THEN** no stream toggle or `values.stream`-bound control is present in the rendered output

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, schedule-section labels, frequency option labels, model/prompt/description labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Cancel/Create MUST reuse `ButtonsI18nKeys.Cancel` and `ButtonsI18nKeys.Create`.

#### Scenario: New keys exist for schedule and model copy

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.scheduleSectionLabel`, `scheduledTasks.create.scheduleTypeOnce`, `scheduledTasks.create.scheduleTypeRecurring`, `scheduledTasks.create.frequencyDaily`, `scheduledTasks.create.frequencyWeekly`, `scheduledTasks.create.frequencyMonthly`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelLabel`, `scheduledTasks.create.promptLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.descriptionMaxLengthError`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`, and no longer needs a `streamLabel` key

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys` and Cancel/Create from `ButtonsI18nKeys`, not duplicated feature-scoped strings

### Requirement: Create-task page supports RTL and meets AAA accessibility defaults

All directional layout in the create-task header and form MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. Every form field MUST have an accessible label distinct from its placeholder. Dropdowns (frequency, model) MUST expose `aria-expanded` and mark the selected option via `aria-selected`/`aria-current`. Focus-visible styling on Cancel/Create MUST match hover feedback per `.claude/rules/a11y.md`.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the create-task header and form lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Form fields are labeled

- **WHEN** the create-task form renders
- **THEN** display name, schedule controls, model, and prompt each have an accessible name distinct from any placeholder text

#### Scenario: Model dropdown exposes expanded/selected state

- **WHEN** the user opens the model dropdown
- **THEN** the trigger has `aria-expanded="true"` and the selected model option is marked `aria-selected="true"` (or `aria-current`)

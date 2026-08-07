## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `labels`, `values`, `errors`, `modelOptions` (`{ id, label }[]`), `onFieldChange`, `onCancel`, `onBack`, `onSubmit`, and optional `isSubmitting` (default `false`).

It SHALL render a full-width header followed by a responsive two-column body:

**Header**

- Start side: a back control (chevron icon, mirrored in RTL via `rtl:scale-x-[-1]`) that calls `onBack` when activated, followed by the page title (`labels.pageTitle`).
- End side: Cancel (`labels.cancelButtonLabel`, calls `onCancel`) and Save (`labels.createButtonLabel`, calls `onSubmit`) actions, in that order.

**Details column** (left on desktop, first in DOM order on mobile)

- Section heading `labels.detailsSectionTitle` and subtitle `labels.detailsSectionSubtitle`.
- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), with `maxLength={500}` and accessible feedback (e.g. a character count or inline validation message per `errors.description`) shown when the field is non-empty
- **Schedule** — unchanged from the previous single-column layout: schedule type control (`values.scheduleType`: `'once' | 'recurring'`), Run at datetime input when `scheduleType === 'once'` (`values.runAt`), Frequency dropdown when `scheduleType === 'recurring'` (`values.frequency`), Time input (`values.time`), Day of week when Weekly (`values.dayOfWeek`), Day of month when Monthly (`values.dayOfMonth`) — same fields, same conditional rendering, same validation as before, only relocated into this column
- **Model or Agent** — required dropdown populated from `modelOptions` (`values.modelId`)

**Configuration column** (right on desktop, second in DOM order on mobile)

- Section heading `labels.configurationSectionTitle` and subtitle `labels.configurationSectionSubtitle`.
- **Instructions** — required `MarkdownEditor` (from `@epam/ai-dial-ui-kit`) bound to `values.prompt` via `onFieldChange('prompt', value)`, labeled via `labels.instructionsLabel`
- **Stream** — toggle (`values.stream`, default `true`), rendered only when the host explicitly supplies stream-related labels/wiring; omitting the visible control MUST NOT change the submitted `stream` value's default

On `desktop` breakpoint, the two columns SHALL render side by side (Details narrower, Configuration wider, e.g. via a `grid-cols-3` split with Details spanning 1 column and Configuration spanning 2). On `mobile`, the columns SHALL stack full-width, Details above Configuration. Only Tailwind logical properties (`ps/pe`, `text-start/end`, etc.) and the project's named breakpoints (`mobile`, `desktop`) MAY be used for this layout — no `sm:`/`md:`/`lg:`/`xl:` prefixes.

`description` is optional and MUST NOT participate in the Save-button required-field guard. The Save action SHALL be disabled while `isSubmitting` is `true` or while `displayName`, `modelId`, or `prompt` are empty (minimum client-side guard; full validation lives in the page).

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics.

#### Scenario: Required-field guard blocks submit

- **WHEN** `displayName` is empty or `modelId` is unset
- **THEN** the Save button is disabled

#### Scenario: Submitting is reflected in the UI

- **WHEN** `isSubmitting` is `true`
- **THEN** the Save button is disabled and shows a busy/loading affordance

#### Scenario: Model options are passed in, not fetched

- **WHEN** `ScheduledTaskCreateForm` renders with `modelOptions={[{ id: 'gpt-4o', label: 'GPT-4o' }]}`
- **THEN** the model dropdown lists that option and the lib performs no deployment/API fetch

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskCreateForm`) is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Save button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and accessible feedback is shown once the field is non-empty

#### Scenario: Back control calls onBack without submitting

- **WHEN** the user activates the back control in the header
- **THEN** `onBack` is called, `onSubmit` is not called, and no field values are reset

#### Scenario: Details and Configuration render as two distinct regions

- **WHEN** `ScheduledTaskCreateForm` renders
- **THEN** the Display name, Description, Schedule, and Model or Agent fields render under the `labels.detailsSectionTitle` heading, and the Instructions editor renders under the `labels.configurationSectionTitle` heading

#### Scenario: Instructions editor updates the prompt value

- **WHEN** the user types in the Instructions markdown editor
- **THEN** `onFieldChange('prompt', <new value>)` is called with the editor's current text

#### Scenario: Desktop layout splits into two columns

- **WHEN** the viewport matches the `desktop` breakpoint
- **THEN** Details and Configuration render side by side, Details narrower than Configuration

#### Scenario: Mobile layout stacks the columns

- **WHEN** the viewport matches the `mobile` breakpoint
- **THEN** Details renders full-width above Configuration, both stacked in that order

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, section headings/subtitles, schedule-section labels, frequency option labels, model/instructions/description/stream labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Cancel MUST reuse `ButtonsI18nKeys.Cancel`; the Save action (previously labeled Create) MUST reuse `ButtonsI18nKeys.Save`.

#### Scenario: New keys exist for section headings and instructions

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.detailsSectionTitle`, `scheduledTasks.create.detailsSectionSubtitle`, `scheduledTasks.create.configurationSectionTitle`, `scheduledTasks.create.configurationSectionSubtitle`, `scheduledTasks.create.instructionsLabel`, `scheduledTasks.create.scheduleSectionLabel`, `scheduledTasks.create.scheduleTypeOnce`, `scheduledTasks.create.scheduleTypeRecurring`, `scheduledTasks.create.frequencyDaily`, `scheduledTasks.create.frequencyWeekly`, `scheduledTasks.create.frequencyMonthly`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelOrAgentLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.descriptionMaxLengthError`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`, and no longer contains `scheduledTasks.create.promptLabel`

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys`, Cancel from `ButtonsI18nKeys.Cancel`, and Save from `ButtonsI18nKeys.Save`, not duplicated feature-scoped strings

### Requirement: Create-task page supports RTL and meets AAA accessibility defaults

All directional layout in the create-task header and two-column form MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. The header's back chevron MUST mirror in RTL via `rtl:scale-x-[-1]`. Every form field MUST have an accessible label distinct from its placeholder. Dropdowns (frequency, model) MUST expose `aria-expanded` and mark the selected option via `aria-selected`/`aria-current`. Focus-visible styling on the back control, Cancel, and Save MUST match hover feedback per `.claude/rules/a11y.md`.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the create-task header, back chevron, and two-column form lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Form fields are labeled

- **WHEN** the create-task form renders
- **THEN** display name, schedule controls, model, instructions editor, and stream (when rendered) each have an accessible name distinct from any placeholder text

#### Scenario: Model dropdown exposes expanded/selected state

- **WHEN** the user opens the model dropdown
- **THEN** the trigger has `aria-expanded="true"` and the selected model option is marked `aria-selected="true"` (or `aria-current`)

#### Scenario: Back control is keyboard accessible

- **WHEN** the user tabs to the back control and activates it with Enter or Space
- **THEN** `onBack` is called

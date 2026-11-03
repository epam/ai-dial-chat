## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `labels`, `values`, `errors`, `modelSelector` (`ReactNode`), `modelLabelId` (`string`), `onFieldChange`, `onCancel`, `onBack`, `onSubmit`, and optional `isSubmitting` (default `false`). `modelLabelId` is applied as the `id` of the Model or Agent field's `Label` element; the host generates it (e.g. via React `useId()`) rather than a hardcoded literal, and passes the same value as `modelSelector`'s own `aria-labelledby` target, so two concurrently-mounted form instances (or any future host reusing the component) never collide on a shared DOM id.

The form SHALL render inside the shared `BuilderFormContainer` shell (`@epam/ai-dial-builder-form`) as a full-width header followed by a responsive two-column body:

- **Header** — start side: a back control (arrow icon, mirrored in RTL via `rtl:scale-x-[-1]`) that calls `onBack` when activated, followed by the page title (`labels.pageTitle`). End side: Cancel (`labels.cancelButtonLabel`, calls `onCancel`) and the submit action (`labels.createButtonLabel`, calls `onSubmit`), in that order — shown at the `desktop` breakpoint; at `mobile` the pair moves to the form's sticky footer (see "Create-task form chrome adapts to mobile").
- **Details column** — a `role="group"` region labeled `labels.detailsSectionTitle`, holding Display name, Description, Repeat and its conditional schedule fields, and Model or Agent.
- **Configuration column** — a `role="group"` region labeled `labels.configurationSectionTitle`, holding Skill and Instructions.

At the `desktop` breakpoint the two columns SHALL render side by side, Details narrower than Configuration. At `mobile` they SHALL stack full-width, Details above Configuration. Only Tailwind logical properties and the project's named breakpoints (`mobile`, `desktop`) MAY be used for this layout.

The page shell SHALL keep its header outside the scrolling region and use the same responsive header spacing as the detail view (`px-4 py-2` below desktop; `px-8 py-0` with a 64 px height at desktop). The stacked mobile body SHALL own one vertical scrollbar; at desktop the body SHALL be a non-wrapping clipped row whose Details and Configuration columns scroll independently, matching the agent editor layout and preventing document-level scrolling.

It SHALL render:

- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), rendered between Display name and Repeat, with `maxLength={500}`, inline validation per `errors.description`, and a character counter (`{length}/500`, `0/500` when empty) that is always shown at the end of the row below the field — passed as `TextRefinementField`'s `caption` — so typing never shifts the fields below it
- **Repeat** — a single dropdown (`DialSelectField`) bound to `values.repeat: ScheduledTaskRepeat` (`'oneTime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'`), replacing the separate "Schedule type" (once/recurring) and "Frequency" (daily/weekly/monthly) dropdowns. It is NOT wrapped in a `<fieldset>`/`<legend>` with a visible "Schedule" section heading — the schedule controls render as a plain grouped block inside the Details column, which already carries its own `role="group"`/`aria-label` (`labels.detailsSectionTitle`)
- **Run at** — the internal `ScheduledTaskRunAtField` component (`libs/scheduled-tasks/src/components/ScheduledTaskRunAtField`, not re-exported from the package index), wrapping a `Calendar` control (`mode={CalendarMode.DateTime}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'oneTime'`, bound to `values.runAt` (a `datetime-local`-style string) through the field's own `runAtToCalendarValue`/`calendarValueToRunAt` adaptation, with `errors.runAt` rendered below the control in the same inline-error pattern via the field's `errorClassName` prop. The field sets the earliest selectable moment to its mount time — a `minDate` pinned once per mount — so days strictly before the mount date render unselectable in the picker's month grid and activating them fires no `onFieldChange('runAt', …)`; the mount date itself and future days remain selectable. The earliest selectable moment is "now", not "now + lead": the page's existing submit-time lead validation (`runAt` must lead "now") is unchanged and still rejects `now`-ish selections at submit
- **Time** — a `Calendar` control (`mode={CalendarMode.Time}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat` is `'daily'`, `'weekly'`, `'monthly'`, or `'custom'` (NOT shown for `'hourly'`), bound to `values.time` (`HH:mm` local wall-clock string, validated at app edge)
- **Day of week** — a `Calendar` control (`mode={CalendarMode.Weekday}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'weekly'`, bound to `values.dayOfWeek` via `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` (`libs/scheduled-tasks/src/utils/calendar-value.ts`), which convert between `Calendar`'s ISO weekday value (`"1"`=Monday..`"7"`=Sunday) and `values.dayOfWeek`'s APScheduler-convention string (`"0"`=Monday..`"6"`=Sunday)
- **Every** — a `Select` control (imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'custom'`, labeled `labels.everyLabel` ("Every"), bound to `values.everyWeeks` (a `"1"`–`"10"` string) with options built from `labels.everyWeekOptions` (`{ value: '1', label: '1 week' }` … `{ value: '10', label: '10 weeks' }`). A dropdown always yields a valid value, so no `errors.everyWeeks` is rendered and no validation error exists for this field
- **Day of week (custom)** — a row of circular `Button` controls (imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'custom'`, rendered below the Time field under a visible required `Label` carrying the existing `labels.dayOfWeekLabel` ("Day") with a required marker; the Label's host-generated `id` is referenced by the row's `role="group"` via `aria-labelledby`, so the visible label doubles as the group's accessible name (the same Label-id + `aria-labelledby` linkage the Model or Agent field uses). Seven buttons — one per weekday, separated by a 2px gap (`gap-0.5`) — each render `labels.customDayOptions[day].shortLabel` (a single letter, e.g. "M") as the visible label and carry `labels.customDayOptions[day].fullName` as `aria-label`, so assistive tech announces the full day name, not the letter. The selected day's button carries `variant={ButtonVariant.Primary}` and the rest `variant={ButtonVariant.Neutral}`, all with `appearance={ButtonAppearance.Solid}` and a `w-10 rounded-full` class pair fixing each button at 40×40px and circular; each button carries `aria-pressed` reflecting its selection. The row is single-select: activating an unselected button calls `onFieldChange('dayOfWeek', <APScheduler day string>)`; activating the already-selected button is a no-op (the field is required, so there is always exactly one selected day). `errors.dayOfWeek` renders below the row in the same inline-error pattern
- **Day of month** — shown when `values.repeat === 'monthly'` (`values.dayOfMonth`)
- **Minute** — a required text input (matching the `Day of month` field's `Input` pattern) shown when `values.repeat === 'hourly'`, bound to `values.minute` (a `"0"`-`"59"` string); no `Time`, `Day of week`, or `Day of month` field is rendered for `'hourly'`
- **Model or Agent** — a required field rendering the host-supplied `modelSelector` element in place of a lib-owned selection control, wrapped in the lib's own required-label/error markup (the "Model or Agent" label, a required marker, and `errors.modelId` rendered below the control) using the same visual pattern already used for `Calendar` fields without a built-in `labelProps` (see `withRequiredMarker`). The lib performs no deployment lookup, filtering, or catalog navigation itself — it only renders whatever `modelSelector` the host passes.
- **Skill** - optional host-composed slot in Configuration above Instructions with `skillSelector`, `labels.skillLabel`, `values.skillUrls`, and `errors.skillUrls`; the composed UI-kit Select owns its label/error association
- **Instructions** - markdown editor (`values.prompt`), required only when no skill is selected; its label carries the required marker (red asterisk) exactly while `values.skillUrls` is empty and drops it once a skill is selected, with or without the Refine action
- **Cancel / Create** actions

When `values.repeat === 'custom'`, the form SHALL render exactly the **Every** dropdown, the **Time** field, and the **Day of week (custom)** button row below it, in that order — and SHALL NOT render the Start date / End date pickers (Custom has no activity window; see "ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules").

`values` SHALL NOT include a `stream` field, and the form MUST NOT render a stream toggle — streaming is fixed server-side (`stream: true`) and is not a user-configurable option.

`description` is optional and MUST NOT participate in the Create-button required-field guard. The Create action SHALL be disabled while `isSubmitting` or host-supplied `isSubmitDisabled` is `true`, while `errors.modelId` is present, or while `displayName` or `values.modelId` is empty, while both trimmed `prompt` and `values.skillUrls` are empty, while `errors.skillUrls` is present, or — when `values.repeat === 'custom'` — while `values.dayOfWeek` or `values.time` is empty (minimum client-side guard; full validation uses shared checked preparation at the app boundary). `values.modelId` itself continues to be owned and set by the host via the `modelSelector` element's own `onSelect` callback (bound to `onFieldChange('modelId', ...)` by the host, outside the lib) — the lib's required-field guard reads `values.modelId` exactly as it did before this change; only the rendered control changed.

The `Run at` and `Time` `Calendar` controls' `onChange` callbacks (inside `ScheduledTaskRunAtField` for `runAt`, in the form for `time`) MUST adapt the ui-kit's `CalendarValue` (`Date | string | null`) into calls to `onFieldChange('runAt', ...)` / `onFieldChange('time', ...)` using the same value shapes the page already consumes (`values.runAt` as a `Date`-constructible value, `values.time` as an `"HH:mm"` string) — this is a UI-control swap, not a change to the `values`/`onFieldChange` contract.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics. Importing `Calendar`/`CalendarMode`/`Select`/`Button` (with `ButtonVariant`/`ButtonAppearance`) from `@epam/ai-dial-ui-kit` is permitted — they are generic design-system controls with no host-specific integration knowledge. `modelSelector` MUST remain an opaque `ReactNode` prop — the lib MUST NOT know it is a deployment selector, a dropdown, or anything about its internal behavior.

#### Scenario: Required-field guard blocks submit

- **WHEN** `displayName` is empty or `values.modelId` is unset
- **THEN** the Create button is disabled

#### Scenario: Submitting is reflected in the UI

- **WHEN** `isSubmitting` is `true`
- **THEN** the Create button is disabled and shows a busy/loading affordance

#### Scenario: Model field renders the host-supplied selector as an opaque slot

- **WHEN** `ScheduledTaskCreateForm` renders with `modelSelector={<button>Select Model or Agent</button>}`
- **THEN** that exact element renders in the Model or Agent field's position, wrapped by the lib's own "Model or Agent" required label and (when present) `errors.modelId` message, and the lib performs no deployment/API fetch

#### Scenario: Model field label id comes from the host, not a hardcoded literal

- **WHEN** `ScheduledTaskCreateForm` renders with `modelLabelId="a-generated-id"`
- **THEN** the "Model or Agent" `Label` element's `id` is `"a-generated-id"`, and `ScheduledTaskCreatePage`/`ScheduledTaskEditPage` each generate this value via `useId()` rather than sharing a fixed string literal, so two instances of the form never collide on the same DOM id

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskCreateForm`) is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/ai-dial-chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules; imports of `Calendar`/`CalendarMode`/`Select`/`Button` from `@epam/ai-dial-ui-kit` are present and allowed

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Create button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and the counter below it reads `0/500` before any input and updates as the user types

#### Scenario: No visible Schedule section heading is rendered

- **WHEN** the create-task form renders
- **THEN** no "Schedule" (or equivalently-worded) section legend or heading appears above the Repeat dropdown; the Repeat control and its conditional fields render inside the Details column's existing `role="group"` with no additional heading element

#### Scenario: One-time repeat uses the Calendar DateTime control

- **WHEN** `values.repeat === 'oneTime'`
- **THEN** the "Run at" field renders `Calendar` with `mode={CalendarMode.DateTime}`, not a native `<input type="datetime-local">`, and no Time, Day of week, or Day of month field renders

#### Scenario: Hourly repeat renders a Minute field and no time, weekday, or month-day fields

- **WHEN** `values.repeat === 'hourly'`
- **THEN** the "Minute" `Input` renders bound to `values.minute`, and no Time, Day of week, or Day of month field renders

#### Scenario: Daily, Weekly, and Monthly repeat values use the Calendar Time control

- **WHEN** `values.repeat` is `'daily'`, `'weekly'`, or `'monthly'`
- **THEN** the "Time" field renders `Calendar` with `mode={CalendarMode.Time}`, not a native `<input type="time">`

#### Scenario: Weekly repeat uses the Calendar Weekday control with ISO/APScheduler conversion

- **WHEN** `values.repeat === 'weekly'` and the user selects Monday in the "Day of week" `Calendar` (`mode={CalendarMode.Weekday}`, ISO value `"1"`)
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), not `'1'`

#### Scenario: Custom repeat renders the Every dropdown, Time field, and labeled day button row in that order

- **WHEN** `values.repeat === 'custom'`
- **THEN** the "Every" `Select` renders bound to `values.everyWeeks` with ten options ("1 week"…"10 weeks"), the "Time" `Calendar` (`mode={CalendarMode.Time}`) renders with the timezone hint, and the day-of-week button row renders below it under a visible required "Day" label — seven circular 40×40px `Button`s, the selected day Primary Solid and the rest Neutral Solid, each labeled with its `customDayOptions` short label and carrying its full-name `aria-label` and an `aria-pressed` state, inside a `role="group"` whose accessible name is the visible label — and neither the Start date nor End date picker renders

#### Scenario: Custom day button selection uses the APScheduler day convention

- **WHEN** `values.repeat === 'custom'` and the user activates the Monday button (short label "M")
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), the Monday button becomes the selected one (Primary Solid, `aria-pressed="true"`), and activating Monday again fires no `onFieldChange`

#### Scenario: Required-field guard blocks submit until the Custom schedule is complete

- **WHEN** `values.repeat === 'custom'` and either `values.dayOfWeek` or `values.time` is empty
- **THEN** the Create button is disabled, regardless of the other fields being valid

#### Scenario: Form does not expose a stream control

- **WHEN** the create-task form renders
- **THEN** no stream toggle or `values.stream`-bound control is present in the rendered output

#### Scenario: Past days are unselectable in the run-at picker

- **WHEN** `values.repeat === 'oneTime'` and the user opens the run-at picker's month grid
- **THEN** every day strictly before the field's mount date renders disabled, and activating such a day fires no `onFieldChange('runAt', …)` — the out-of-range click is a no-op

#### Scenario: The mount date and future days remain selectable

- **WHEN** the user activates the field's mount date or any later day in the run-at picker
- **THEN** `onFieldChange('runAt', <datetime-local string>)` fires with the picked moment (local midnight when no time-of-day was set yet; the pre-picked time-of-day is kept when one exists)

#### Scenario: The earliest selectable moment does not change while the form stays open

- **WHEN** the create or edit form re-renders repeatedly after the run-at field mounted (e.g. the user edits other fields for several minutes)
- **THEN** the earliest selectable moment stays pinned at the field's mount time rather than advancing with each render, and the memoized `minDate` identity does not churn the `Calendar`'s internal effects

#### Scenario: Back control calls onBack without submitting

- **WHEN** the user activates the back control in the header
- **THEN** `onBack` is called, `onSubmit` is not called, and no field values are reset

#### Scenario: Details and Configuration render as two distinct regions

- **WHEN** `ScheduledTaskCreateForm` renders
- **THEN** the Display name, Description, Repeat, and Model or Agent fields render inside the group labeled `labels.detailsSectionTitle`, and the Skill and Instructions fields render inside the group labeled `labels.configurationSectionTitle`

#### Scenario: Instructions editor updates the prompt value

- **WHEN** the user types in the Instructions markdown editor
- **THEN** `onFieldChange('prompt', <new value>)` is called with the editor's current text

#### Scenario: Desktop layout splits into two columns

- **WHEN** the viewport matches the `desktop` breakpoint
- **THEN** Details and Configuration render side by side, Details narrower than Configuration

#### Scenario: Mobile layout stacks the columns

- **WHEN** the viewport matches the `mobile` breakpoint
- **THEN** Details renders full-width above Configuration, both stacked in that order

### Requirement: Scheduled task configuration exposes a controlled optional Skill field

Create and edit SHALL render Skill above Instructions. `ScheduledTaskCreateForm` SHALL accept optional `skillSelector: ReactNode` and render it without duplicating the composed control's label/error markup. The host-composed UI-kit Select SHALL receive `labels.skillLabel` and ordinary field errors so its own label and error are associated with its combobox. Host-confirmed unavailable skills SHALL instead carry the per-tag unavailable state and tooltip without making healthy tags erroneous; the form still receives the availability error for its save guard. When the slot is absent, the form SHALL still render `errors.skillUrls` as a live form-level error. The library SHALL add `skillUrls?: string[]` to form values and `skillUrls?: string` to localized errors; it SHALL NOT resolve catalog data or feature flags.

Existing page-local controlled form values SHALL own selection. `SkillSelectorField` from `@epam/ai-dial-skills` SHALL report append/removal through `onFieldChange('skillUrls', value)` via the app adapter. No new context or second uncontrolled selection state SHALL be introduced. The library minimum save guard SHALL accept nonblank instructions or a nonempty skill array, and SHALL reject a skill field error; checked preparation remains mandatory before writing.

#### Scenario: Select replace and remove on create and edit

- **WHEN** a user selects or removes skills in either form
- **THEN** the controlled draft keeps the ordered references, ignores duplicate selections, and the control immediately reflects the value
- **AND** removing the last skill with blank instructions disables save

#### Scenario: Skill picker lists all skills

- **WHEN** the user opens the Skill field
- **THEN** the app supplies every personal, shared, and public skill (deduplicated by reference) as a checkbox option, without favorites filtering, a Browse action, or a change to chat's selection
- **AND** every breakpoint uses the responsive UI-kit `Select` multiple popover with search
- **AND** the input uses the model selector's UI-kit styling and renders selected skills with removable UI-kit tags, including the unavailable-tag renderer when needed
- **AND** the Skill field and Instructions editor share the same available width and 996px maximum width

#### Scenario: Instructions only skill only and combined content

- **WHEN** required name, model, and schedule are valid
- **THEN** instructions only, a supported skill with empty instructions, and a supported skill with instructions can each be saved
- **AND** empty or whitespace-only instructions without a skill cannot be saved

#### Scenario: Support changes without submitting

- **WHEN** a selected skill is paired with a model or agent whose `features.skillsSupported` is false, absent, or not yet resolved
- **THEN** the field immediately becomes invalid, Create/Save is disabled, and `skillSelector.unsupportedTooltipLabel` is displayed
- **AND** changing to a supporting deployment or removing the skill clears that compatibility error without discarding instructions

#### Scenario: Disabled field explains why it is disabled

- **WHEN** the selected model or agent does not support skills
- **THEN** an empty Skill field is disabled; with saved selections, opening and adding are prevented while the UI-kit tags remain removable
- **AND** hovering it shows a tooltip with the reason `skillSelector.unsupportedTooltipLabel` while at least one skill is selected, unless an unavailable tag owns the more specific tooltip; with no skill selected there is no tooltip or caption
- **AND** on a touch-only device the tooltip renders nothing, so the reason is not shown visually there

#### Scenario: Missing skill metadata cannot bypass validation

- **WHEN** a saved skill URL is present but the catalog is loading or no longer returns that skill
- **THEN** the edit page waits for the availability check before enabling Save; pending or unavailable references use their decoded short name, confirmed unavailability adds the localized suffix and error tag, and removal remains possible
- **AND** capability validation still uses URL presence and a temporary metadata failure SHALL NOT imply deletion

#### Scenario: Capability recovers after a server rejection

- **WHEN** a save returns `scheduledTaskSkillUnsupported` and deployment support subsequently changes from false to true
- **THEN** the stale server error clears and the unchanged draft can be submitted again
- **AND** unrelated rerenders do not clear a server rejection while capability data remains unchanged

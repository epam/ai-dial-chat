# scheduled-task-panel-sections Specification

## Purpose

The History and Details sections of a scheduled-task conversation's sources panel: their typography, run-row layout, title metrics, expanded/reset state ownership, and the host-driven alignment of the panel's files/sources sections with the task accordions.

## Requirements

### Requirement: Task section headings render on the small semibold scale at a fixed height

The History and Details accordion headings of a task conversation's sources panel SHALL render at `dial-tiny-semi-text` (12px/16px, weight 600) inside a 24px-tall title element, and the files/sources section headings SHALL render at the same `dial-tiny-semi-text` scale via the panel's `styles.typography.sectionTitleClassName`.

Because the kit `Accordion` hardcodes its title span at `dial-body-text` (line-height 24) and a nested inline span cannot shrink a line box below the parent's strut, the accordion title SHALL be a block-level span (`dial-tiny-semi-text block truncate py-1`): the `block` display lets the 12/16 line-height apply, and `py-1` grows the element to 24px with the text vertically centered.

RTL: `py-1` is direction-agnostic; no mirroring is needed.

#### Scenario: Accordion titles use their own line height

- **WHEN** a task conversation's sources panel renders its History and Details accordions
- **THEN** each title span carries `dial-tiny-semi-text`, `block`, and `py-1`, so the 12px text sits on a 16px line inside a 24px-tall element

#### Scenario: File and source section headings match the accordions

- **WHEN** the panel renders Uploaded files, Generated files, or Sources sections
- **THEN** each `<h2>` heading renders at `dial-tiny-semi-text`

### Requirement: History run rows lead with the status icon and distinguish not-yet-viewed runs

Each run row in the History section SHALL render its status icon at the row start at 19px with stroke 2 (the design-approved `RUN_STATUS_ICON_SIZE` / `RUN_STATUS_ICON_STROKE` constants), with the timestamp following it and the unread dot in a fixed 12px slot at the row end.

The row (pill) SHALL carry `px-3` (12px) horizontal padding on both sides, replacing the former end-only padding and its SCSS start-padding override.

Viewed-row timestamps SHALL render at `dial-small-paragraph-text` (14px/24px); rows whose run is not yet viewed (`isUnread`) SHALL render at `dial-small-paragraph-semi-text` (14px/24px, weight 600) — settable per surface through the `runTimestampUnreadClassName` typography prop, which `ScheduledTaskHistorySection` SHALL thread with a default on its own 14/20 scale (`dial-small-semi-text`).

The History accordion's content region SHALL use a 12px inline-start inset (`contentClassName="ps-3"`), overriding the kit's 16px start padding.

RTL: `ps-3` and `px-3` are logical utilities; the row order flips with `dir` automatically.

#### Scenario: Status icon leads the row

- **WHEN** a run row renders
- **THEN** the status icon is the first element inside the row's start group, before the timestamp, at 19px with `stroke` 2

#### Scenario: Not-yet-viewed rows render semibold

- **WHEN** a row's run has `isUnread: true`
- **THEN** its timestamp carries `dial-small-paragraph-semi-text` while viewed rows carry `dial-small-paragraph-text`

#### Scenario: Unread dot sits at the row end

- **WHEN** a row's run has `isUnread: true`
- **THEN** the unread dot renders inside the reserved 12px slot at the row's end, so the timestamp width is identical across rows

### Requirement: Details fields use the small value scale with secondary labels

The Details section's field labels (Model, Skill, Instructions) SHALL render at `dial-tiny-text text-secondary` (12px/16px, #57647A) and field values at `dial-small-text` (14px/20px) — the `ScheduledTaskDetailsSummary` typography defaults, overridable through its `styles.typography` props.

The Instructions markdown SHALL render its text at `dial-small-text` (14px/20px) through a custom `MarkdownRendererClassNames` passed by the app's `TaskDetailsSection` (paragraphs and lists at `dial-small-text`, headings at `dial-small-semi-text`), because neither built-in markdown preset matches 14/20 (default is 16/26, COMPACT is 14/24).

#### Scenario: Labels are secondary and values are small

- **WHEN** the Details section renders the Model, Skill and Instructions fields
- **THEN** each label carries `dial-tiny-text text-secondary` and each value carries `dial-small-text`

#### Scenario: Instructions text sits on the small scale

- **WHEN** the task's prompt renders as markdown in the Details section
- **THEN** its paragraphs carry `dial-small-text`

### Requirement: Files and sources sections align with the task accordions through a host-passed class

`libs/source-panel` SHALL expose an optional `styles.sectionClassName` merged onto each Uploaded files, Generated files, and Sources section root, with no default indent — hosts that render accordions inside `additionalSections` pass `'px-4'` to line the sections up with them; hosts that do not keep the former layout.

#### Scenario: Default stays unindented

- **WHEN** the panel renders without `styles.sectionClassName`
- **THEN** the section roots carry no extra horizontal padding

#### Scenario: Host opts into the accordion gutter

- **WHEN** the app passes `styles.sectionClassName: 'px-4'`
- **THEN** every files/sources section root carries `px-4`

### Requirement: Each task section owns its accordion state

The History and Details sections SHALL be owned by `TaskHistorySection` and `TaskDetailsSection` components that read their data as props from the container (the single context consumer) and own their expanded state, resetting it on a `scheduleId` change — History to expanded, Details to collapsed. Reset coverage lives in each section's own spec.

#### Scenario: Sections reset on schedule change

- **WHEN** the active schedule changes while a section is collapsed or expanded against its default
- **THEN** the section resets — History to expanded, Details to collapsed

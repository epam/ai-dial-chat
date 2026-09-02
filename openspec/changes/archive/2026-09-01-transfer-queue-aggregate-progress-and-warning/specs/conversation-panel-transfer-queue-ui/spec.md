## RENAMED Requirements

FROM: ### Requirement: A per-row spinner replaces the aggregate bar
TO: ### Requirement: A per-row spinner replaces the aggregate bar while expanded

## MODIFIED Requirements

### Requirement: A per-row spinner replaces the aggregate bar while expanded

While the job rows are visible, the component SHALL NOT render an aggregate progress indicator;
each `InProgress` row carries its own indicator instead. A header collapse/expand toggle SHALL hide
or show the job rows without unmounting the header, and SHALL expose `aria-expanded` plus an
`aria-controls` pointing at the rows container. A failed-count badge SHALL render only when at
least one job has status `Failed`. The header's `title` SHALL be rendered verbatim as supplied by
the host, which is responsible for composing any count into it.

#### Scenario: No aggregate bar is rendered while expanded
- **GIVEN** 4 jobs where 2 are not `InProgress`, and the queue is expanded
- **WHEN** the component renders
- **THEN** no aggregate progress indicator is present; each `InProgress` row carries its own
  spinner and no row shows a completion percentage

#### Scenario: Collapsing hides rows, not the header
- **WHEN** the collapse toggle is activated
- **THEN** job rows are hidden while the header remains visible

#### Scenario: Failed-count badge appears only with a failure present
- **GIVEN** no job has status `Failed`
- **THEN** no failed-count badge is rendered

#### Scenario: A warned job is not a failure
- **GIVEN** 3 jobs of which 1 has status `Warning` and none has status `Failed`
- **THEN** no failed-count badge is rendered

#### Scenario: The host owns the header count
- **GIVEN** the host passes `title` as `"Exporting 3 files"`
- **THEN** the header renders exactly that string; the component performs no pluralization

## ADDED Requirements

### Requirement: The collapsed queue shows a determinate aggregate progress bar

When the queue is collapsed and at least one job has status `InProgress`, the component SHALL
render the UI kit `ProgressBar` at `ElementSize.Small` directly beneath the header row, spanning
the queue's width. Its `value` SHALL be the arithmetic mean of `progress.percent` across all jobs,
rounded to the nearest integer, with terminal jobs contributing their settled percent. The bar
SHALL NOT render while the queue is expanded, and SHALL NOT render once no job is `InProgress`.
No percentage SHALL be rendered as visible text.

#### Scenario: Collapsed with work in flight

- **GIVEN** a collapsed queue whose jobs' `progress.percent` values are `100`, `40`, and `10`, and
  at least one job is `InProgress`
- **WHEN** the component renders
- **THEN** a progress bar is present beneath the header with `value` `50`

#### Scenario: Expanded shows no bar

- **GIVEN** the same jobs with the queue expanded
- **THEN** no progress bar is rendered, and each `InProgress` row still shows its spinner

#### Scenario: Nothing in flight, no bar

- **GIVEN** a collapsed queue whose jobs are all `Success`, `Failed`, `Warning`, or `Canceled`
- **THEN** no progress bar is rendered

#### Scenario: The percentage is never visible text

- **GIVEN** a collapsed queue with an aggregate value of `50`
- **THEN** the string `50%` does not appear in the queue's visible text

### Requirement: The aggregate bar is named and read by the host's strings

The bar SHALL take its accessible name from `labels.queueProgressAriaLabel` and its
`aria-valuetext` from `labels.queueProgressValueText(completed, total)`, where `completed` is the
number of jobs that are no longer `InProgress` and `total` is the job count. The component SHALL
NOT construct either string, and SHALL NOT fall back to the UI kit's default `Progress` name.

#### Scenario: The bar announces file counts, not a percentage

- **GIVEN** 10 jobs of which 3 have settled, and `queueProgressValueText` returns `"3 of 10 files done"`
- **WHEN** the collapsed queue renders
- **THEN** the bar's `aria-valuetext` is `"3 of 10 files done"` and its accessible name is
  `labels.queueProgressAriaLabel`

### Requirement: A warned job renders an amber status icon naming its reason

A job with status `Warning` SHALL render an amber warning icon in the row's status slot, in place
of the success check. The icon SHALL carry `role="img"` and an `aria-label` of
`labels.jobWarningMessage(job.warningCode)`, and SHALL expose the same string through a tooltip.
The accessible name SHALL NOT depend on the tooltip, which renders nothing on a touch screen.

#### Scenario: The warned row states its reason without a pointer

- **GIVEN** a job with status `Warning` and `warningCode` `AttachmentSkipped`
- **WHEN** the row renders
- **THEN** an element with `role="img"` carries `aria-label` equal to
  `labels.jobWarningMessage(AttachmentSkipped)`, with no hover required

#### Scenario: A warned row shows no success check

- **GIVEN** a job with status `Warning`
- **THEN** the row renders no success check icon and no cancel control

### Requirement: A warned job suppresses the success-only auto-close

The success-only auto-close SHALL fire only when every job has status `Success`. A queue holding
any job with status `Warning` SHALL remain open until the user closes it. Closing such a queue
SHALL NOT raise the unfinished-work confirmation, because a warned job has finished.

#### Scenario: A warning keeps the queue on screen

- **GIVEN** 2 jobs, one `Success` and one `Warning`
- **WHEN** the auto-close delay elapses
- **THEN** `onClose` has not been called

#### Scenario: Closing a warned queue needs no confirmation

- **GIVEN** a queue whose jobs are `Success` and `Warning`, with none `InProgress` or `Failed`
- **WHEN** the close control is activated
- **THEN** `onClose` is called directly and no confirmation dialog opens

### Requirement: The warning color is a host-overridable CSS variable

`ImportExportQueueColors` SHALL expose `warningIcon`, mapped through `buildCssVars` to a
`--cp-transfer-queue-*` custom property and consumed from the component's scss module, and the
component SHALL NOT hardcode a Tailwind color class for it. The aggregate bar SHALL NOT gain
color overrides: it is the UI kit's `ProgressBar`, whose `className` reaches only its track, so
retinting its fill would require styling the kit's internal DOM to restate theming the kit already
derives from the same 2.0 tokens.

#### Scenario: A host retints the warning icon

- **GIVEN** a host passing `colors.warningIcon`
- **WHEN** the queue renders
- **THEN** the corresponding custom property carries that value and the rendered color follows it

### Requirement: Text on a filled status surface uses an on-control token

Text the component paints over one of its own filled color surfaces SHALL end its color's `var()`
chain in a token intended for text on a filled control, and that fallback pair SHALL reach at least
the contrast the project's accessibility target requires. A muted body-text token SHALL NOT be used
as the fallback for text on a filled surface.

#### Scenario: The failed-count badge is legible on its own fill

- **GIVEN** neither `colors.failureCountBackground` nor `colors.failureCountText` is overridden
- **WHEN** the badge renders over the `--bg-control-error` fill
- **THEN** its text resolves to the on-control text token, not the muted `--text-tertiary`, and the
  two fallbacks contrast at no less than 4.5:1

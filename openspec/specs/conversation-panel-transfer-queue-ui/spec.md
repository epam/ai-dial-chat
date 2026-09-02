# conversation-panel-transfer-queue-ui Specification

## Purpose

Component-level contract for `ImportExportQueue`, a controlled, labels-driven queue panel exported by `@epam/ai-dial-conversation-panel` with no i18n, context, or hook dependency — all jobs, callbacks, and user-visible strings are supplied by the app.

## Requirements

### Requirement: ImportExportQueue is a controlled, labels-driven component owned by `libs/conversation-panel`

`@epam/ai-dial-conversation-panel` SHALL export an `ImportExportQueue` component and its
`ImportExportQueueProps`/`ImportExportQueueLabels`/`ImportExportQueueColors`/`ImportExportQueueTypography`/`ImportExportQueueStyles`
types from the package root. The component SHALL accept `title: string`, `jobs: ConversationTransferJob[]`,
`onClose: () => void`, `onCancel: (jobId: string) => void`, and a `labels` object carrying every
user-visible string it renders. It SHALL NOT accept an `onRetry` or `onDismiss` prop.

The component SHALL NOT import `react-i18next`, any translation-key constant, an application
Context, a routing utility, or `@epam/ai-dial-chat-hooks`. `ConversationTransferJob`,
`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferSubject`,
`ConversationTransferProgress`, `ConversationTransferProgressUnits`, and
`ConversationTransferErrorCode` SHALL be imported from `@epam/ai-dial-chat-shared`, not from
`@epam/ai-dial-chat-hooks`.

#### Scenario: Component renders nothing with an empty queue
- **WHEN** `jobs` is an empty array
- **THEN** the component renders `null`

#### Scenario: Architecture guard — no i18n or transfer-hook import
- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** `ImportExportQueue`'s source file contains no `react-i18next` import and no import from
  `@epam/ai-dial-chat-hooks`

#### Scenario: Retry is not part of the component contract
- **WHEN** a host passes an `onRetry` prop
- **THEN** it is a type error; the component exposes no retry control in any job state

### Requirement: ImportExportQueue exposes portable style overrides

`ImportExportQueue` SHALL accept an optional `styles` prop that groups typed colors, typography
classes, root/body class hooks, and arbitrary CSS custom properties. Themeable colors SHALL use
component-scoped CSS variables prefixed `--cp-transfer-queue-` with app-theme and hex fallbacks,
and no host theme code SHALL be imported into the library. The in-progress indicator is the UI
kit `Spinner`, themed by the kit's own tokens, so `ImportExportQueueColors` SHALL expose no
progress-indicator entries.

#### Scenario: Consumer overrides queue styling
- **WHEN** the host passes `styles.colors`, `styles.typography`, class hooks, or `styles.cssVars`
- **THEN** the overrides are applied without importing host theme code into the library

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

### Requirement: A job row is identified by its file, not its conversation

Each job row SHALL identify the job by the **file** it transfers: a leading file-type icon derived
from the file name's extension (`.dial`/`.zip`, `.json`, or a generic fallback), followed by
`job.fileName` rendered through `EllipsisTooltip` so the full name is revealed on hover and exposed
as `aria-label` only when the name is actually clipped. The conversation title and the source-folder
breadcrumb SHALL NOT be rendered.

Each row SHALL end in a fixed-footprint trailing status slot whose content is determined by
`job.status`:

- `InProgress` — the UI kit `Spinner` at `DIAL_ICON_SIZE.SM`, named by
  `labels.jobProgressAriaLabel(job.fileName)`, sharing its grid cell with an always-mounted,
  always-focusable cancel control (see the hover-reveal requirement).
- `Success` — a check icon.
- `Failed` — a filled alert icon whose accessible name and tooltip are
  `labels.jobErrorMessage(job.errorCode)`.
- `Canceled` — no icon; instead the row renders `labels.canceledLabel` as trailing secondary text
  and dims the file name to the secondary text color.

`Success`, `Failed`, and `Canceled` rows SHALL expose no interactive control.

#### Scenario: A row is identified by its file name
- **WHEN** a job's `fileName` is `2026-09-01_ai_dial_chat_with_attachments.dial`
- **THEN** the row shows that string as its only label, with no conversation title and no breadcrumb line

#### Scenario: A clipped file name reveals itself on hover
- **GIVEN** a file name wider than the row
- **WHEN** the user hovers it
- **THEN** a tooltip shows the full name, and the truncated element carries the full name as its `aria-label`

#### Scenario: The file-type icon follows the extension
- **WHEN** a row's `fileName` ends in `.dial` or `.zip`
- **THEN** its leading icon is the archive icon; a `.json` name gets the JSON icon and any other
  extension gets the generic file icon

#### Scenario: A failed row explains itself without a tooltip
- **GIVEN** a job with status `Failed` and `errorCode` `FileTooLarge`
- **WHEN** the row renders
- **THEN** the alert icon's accessible name is `labels.jobErrorMessage(FileTooLarge)`, so the reason
  reaches a mobile screen where a tooltip renders nothing

#### Scenario: A cancelled row stays visible and is marked as cancelled
- **GIVEN** a job with status `Canceled`
- **THEN** its row is still present, shows `labels.canceledLabel` in the trailing slot, renders the
  file name in the secondary text color, and exposes no control

#### Scenario: Finished rows have no controls
- **WHEN** a job's status is `Success`, `Failed`, or `Canceled`
- **THEN** its row exposes no button of any kind

### Requirement: The cancel control is hover-revealed but always keyboard-reachable

An `InProgress` row's cancel control SHALL be mounted and focusable at all times, and SHALL share a
single grid cell with the row's `Spinner` so that revealing one and hiding the other causes
no layout shift. Visibility SHALL be driven by CSS on the row's hover and focus-within states, never
by conditional mounting or a JavaScript `onMouseEnter` state flag. The control SHALL carry
`labels.cancelJobAriaLabel(fileName)` as its accessible name and SHALL call `onCancel(job.id)`.

#### Scenario: Hovering an in-progress row swaps the spinner for the cancel control
- **GIVEN** a row whose job is `InProgress`
- **WHEN** the pointer enters the row
- **THEN** the cancel control becomes visible in place of the spinner, and the row's height and
  the horizontal position of every other element are unchanged

#### Scenario: The cancel control is reachable without a pointer
- **GIVEN** a row whose job is `InProgress` and a keyboard-only user
- **WHEN** the user tabs to the row's cancel control and activates it
- **THEN** `onCancel` is called with that job's id

#### Scenario: Cancel is not offered on a settled row
- **WHEN** a job's status is `Success`, `Failed`, or `Canceled`
- **THEN** no cancel control is mounted for that row

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

### Requirement: The in-progress indicator comes from the UI kit, not from `libs/conversation-panel`

`libs/conversation-panel` SHALL NOT own a progress or spinner component. An `InProgress` row SHALL
render `Spinner` from `@epam/ai-dial-ui-kit`, sized `DIAL_ICON_SIZE.SM` and named by the host's
`labels.jobProgressAriaLabel(job.fileName)`. `@epam/ai-dial-conversation-panel` SHALL export no
progress-indicator component or props type.

The spinner SHALL NOT be mirrored under `dir="rtl"`: it is a symmetric indicator.

#### Scenario: The indicator is never anonymous
- **GIVEN** a row whose job is `InProgress`
- **WHEN** the component renders
- **THEN** the row exposes an indicator whose accessible name is
  `labels.jobProgressAriaLabel(job.fileName)`

#### Scenario: No percentage or unit readout is rendered
- **GIVEN** a job whose `progress` carries `percent` and `units`
- **WHEN** the row renders
- **THEN** neither value appears in the DOM, and no element carries `aria-valuenow` or
  `aria-valuetext`

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

### Requirement: Close confirmation for unfinished or failed work

Activating `onClose`'s trigger SHALL call `onClose` immediately, without confirmation, when every
job has status `Success` or `Canceled` — a cancelled job represents work the user already chose to
stop, so nothing further is lost. If at least one job is `InProgress` or `Failed`, the component
SHALL first show its own confirmation dialog (`role="dialog"`) with a description selected by
`labels.closeQueueConfirmDescriptionInProgress` / `...Failed` / `...Mixed`, and SHALL call `onClose`
only if the user confirms.

#### Scenario: All-succeeded close needs no confirmation
- **GIVEN** every job has status `Success`
- **WHEN** the close trigger is activated
- **THEN** `onClose` is called immediately with no confirmation dialog shown

#### Scenario: A cancelled job needs no confirmation either
- **GIVEN** every job has status `Success` or `Canceled`, with at least one `Canceled`
- **WHEN** the close trigger is activated
- **THEN** `onClose` is called immediately with no confirmation dialog shown

#### Scenario: In-progress or failed work requires confirmation
- **GIVEN** at least one job is `InProgress` or `Failed`
- **WHEN** the close trigger is activated
- **THEN** a confirmation dialog appears and `onClose` is not yet called

#### Scenario: Cancelling the confirmation leaves the queue open
- **GIVEN** the confirmation dialog is open
- **WHEN** the user cancels it
- **THEN** the dialog closes and `onClose` is not called

### Requirement: Success-only auto-close after 8 seconds

The component SHALL call `onClose` automatically 8 seconds after the last job settles, but only while
every job in `jobs` has status `Success`. If any job is or becomes `InProgress`, `Failed`, or
`Canceled` at any point during that window, the scheduled auto-close SHALL be cancelled; a
subsequent render where every job is again `Success` SHALL restart the 8-second window. A
`Canceled` job suppresses auto-close so the user is guaranteed to see the outcome of their own
cancellation.

#### Scenario: All-success queue auto-closes
- **GIVEN** every job has status `Success`
- **WHEN** 8 seconds pass with no user interaction
- **THEN** `onClose` is called automatically

#### Scenario: A failed or in-progress job suppresses auto-close
- **GIVEN** at least one job is `Failed` or `InProgress`
- **WHEN** 8 seconds pass
- **THEN** `onClose` is not called

#### Scenario: A cancelled job suppresses auto-close
- **GIVEN** at least one job is `Canceled`
- **WHEN** 8 seconds pass
- **THEN** `onClose` is not called and the cancelled row stays on screen

#### Scenario: A new job starting during the countdown cancels it
- **GIVEN** every job is `Success` and the 8-second countdown is running
- **WHEN** a new `InProgress` job is added to `jobs`
- **THEN** the countdown is cancelled

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

### Requirement: Component tests move to `libs/conversation-panel`

`libs/conversation-panel` SHALL own the component-level Vitest/@testing-library/react test suites for
`ImportExportQueue`, plus a unit suite for the pure `getTransferFileIcon`
extension mapping, covering every scenario above. `apps/chat` SHALL keep only a thin wiring test that
renders the real component connected to `useConversationExport`/`useConversationImport` and a real
`useTranslation`-backed labels object, asserting at least one translated string renders correctly.

#### Scenario: The extension mapping is unit-tested, not asserted through the DOM
- **WHEN** the file-icon mapping is verified
- **THEN** it is asserted against `getTransferFileIcon`'s return value, not by querying a vendor
  icon class name in the rendered row

#### Scenario: App wiring test catches a broken label wire-up
- **WHEN** the app-level wiring test renders `ImportExportQueue` through the app's real label-building
  code
- **THEN** it asserts a specific translated string (not a translation key) is present in the DOM

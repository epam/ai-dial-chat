# conversation-panel-transfer-queue-ui Specification

## Purpose

Component-level contract for `ImportExportQueue`, a controlled, labels-driven queue panel exported by `@epam/ai-dial-conversation-panel` with no i18n, context, or hook dependency — all jobs, callbacks, and user-visible strings are supplied by the app.

## Requirements

### Requirement: ImportExportQueue is a controlled, labels-driven component owned by `libs/conversation-panel`

`@epam/ai-dial-conversation-panel` SHALL export an `ImportExportQueue` component and its
`ImportExportQueueProps`/`ImportExportQueueLabels`/`ImportExportQueueStyles` types from the package root. The component SHALL
accept `title: string`, `jobs: ConversationTransferJob[]`, `onClose: () => void`,
`onDismiss: (jobId: string) => void`, `onRetry: (jobId: string) => void`, and a `labels` object carrying
every user-visible string the component renders. The component SHALL NOT import `react-i18next`, any
translation-key constant, an application Context, or a routing utility. `ConversationTransferJob`,
`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, and `ConversationTransferSubject`
SHALL be imported from `@epam/ai-dial-chat-shared`, not from `@epam/ai-dial-chat-hooks`.

#### Scenario: Component renders nothing with an empty queue
- **WHEN** `jobs` is an empty array
- **THEN** the component renders `null`

#### Scenario: Architecture guard — no i18n or transfer-hook import
- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** `ImportExportQueue`'s source file contains no `react-i18next` import and no import from
  `@epam/ai-dial-chat-hooks`

### Requirement: ImportExportQueue exposes portable style overrides

`ImportExportQueue` SHALL accept an optional `styles` prop that groups typed colors, typography
classes, root/body class hooks, and arbitrary CSS custom properties. Themeable colors SHALL use
component-scoped CSS variables with app-theme and hex fallbacks.

#### Scenario: Consumer overrides queue styling
- **WHEN** the host passes `styles.colors`, `styles.typography`, class hooks, or `styles.cssVars`
- **THEN** the overrides are applied without importing host theme code into the library

### Requirement: Job label, breadcrumb, and status-slot rendering are preserved

Each job row SHALL render a primary label — the subject's `title` when `subject.kind` is `Single`, or
`labels.allConversationsJobLabel` when `subject.kind` is `All` — and, only for a `Single` subject that
carries a `sourceBreadcrumb`, a secondary breadcrumb line beneath the label. Each row's trailing status
slot SHALL show a success icon for `Success`, a retry control plus an alert icon for `Failed`, and a
dismiss control for `InProgress`; `Success` and `Failed` rows SHALL NOT expose a dismiss control.

#### Scenario: Single-subject job shows its title and breadcrumb
- **WHEN** a job's `subject` is `{ kind: Single, title: "My Chat", sourceBreadcrumb: "Work / " }`
- **THEN** the row shows "My Chat" as its primary label and "Work / " as a secondary line

#### Scenario: All-subject job uses the aggregate label
- **WHEN** a job's `subject.kind` is `All`
- **THEN** the row's primary label is `labels.allConversationsJobLabel`, with no secondary line

#### Scenario: Finished rows have no dismiss control
- **WHEN** a job's status is `Success` or `Failed`
- **THEN** its row exposes no dismiss control (a `Failed` row exposes only its retry control)

### Requirement: Aggregate progress, collapse/expand, and failed-count badge

The component SHALL compute an aggregate progress percentage as the round of
`(jobs not InProgress) / jobs.length * 100` and pass it to a progress indicator. A header
collapse/expand toggle SHALL hide or show the job rows without unmounting the header or progress
indicator. A failed-count badge SHALL render only when at least one job has status `Failed`.

#### Scenario: Aggregate progress reflects finished-vs-total
- **GIVEN** 4 jobs where 2 are not `InProgress`
- **WHEN** the component renders
- **THEN** the progress indicator shows 50%

#### Scenario: Collapsing hides rows, not the header
- **WHEN** the collapse toggle is activated
- **THEN** job rows are hidden while the header and progress indicator remain visible

#### Scenario: Failed-count badge appears only with a failure present
- **GIVEN** no job has status `Failed`
- **THEN** no failed-count badge is rendered

### Requirement: Close confirmation for unfinished or failed work

Activating `onClose`'s trigger SHALL call `onClose` immediately, without confirmation, only when every
job has status `Success`. If at least one job is `InProgress` or `Failed`, the component SHALL first show
its own confirmation dialog (`role="dialog"`) with a description selected by
`labels.closeQueueConfirmDescriptionInProgress` / `...Failed` / `...Mixed`, and SHALL call `onClose` only
if the user confirms.

#### Scenario: All-succeeded close needs no confirmation
- **GIVEN** every job has status `Success`
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
every job in `jobs` has status `Success`. If any job is or becomes `InProgress` or `Failed` at any point
during that window, the scheduled auto-close SHALL be cancelled; a subsequent render where every job is
again `Success` SHALL restart the 8-second window.

#### Scenario: All-success queue auto-closes
- **GIVEN** every job has status `Success`
- **WHEN** 8 seconds pass with no user interaction
- **THEN** `onClose` is called automatically

#### Scenario: A failed or in-progress job suppresses auto-close
- **GIVEN** at least one job is `Failed` or `InProgress`
- **WHEN** 8 seconds pass
- **THEN** `onClose` is not called

#### Scenario: A new job starting during the countdown cancels it
- **GIVEN** every job is `Success` and the 8-second countdown is running
- **WHEN** a new `InProgress` job is added to `jobs`
- **THEN** the countdown is cancelled

### Requirement: Component tests move to `libs/conversation-panel`

`libs/conversation-panel` SHALL own the component-level Vitest/@testing-library/react test suite for
`ImportExportQueue`, covering every scenario above. `apps/chat` SHALL keep only a thin wiring test that
renders the real component connected to `useConversationExport`/`useConversationImport` and a real
`useTranslation`-backed labels object, asserting at least one translated string renders correctly.

#### Scenario: App wiring test catches a broken label wire-up
- **WHEN** the app-level wiring test renders `ImportExportQueue` through the app's real label-building
  code
- **THEN** it asserts a specific translated string (not a translation key) is present in the DOM

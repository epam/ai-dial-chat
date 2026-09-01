## REMOVED Requirements

### Requirement: ImportExportQueue is a controlled, labels-driven component owned by `libs/conversation-panel`

**Reason**: The transfer queue no longer lives in `libs/conversation-panel`. It moved to
`libs/chat-shared`, beside the `ConversationTransferJob` contract it renders, so a host can show
transfer progress without taking on the panel's `react-window` and `@epam/ai-dial-sidebar`
dependencies — the concrete motivation being a second application (`pg-chat`) that wants the toast
but not the conversation sidebar.

**Migration**: Import `ImportExportQueue` and its `ImportExportQueueProps` /
`ImportExportQueueLabels` / `ImportExportQueueColors` / `ImportExportQueueTypography` /
`ImportExportQueueStyles` types from `@epam/ai-dial-chat-shared` instead of
`@epam/ai-dial-conversation-panel`. No compatibility re-export is added, per
`remove-cross-package-reexports`. The component's contract is restated — with the redesigned row,
progress, and cancellation behaviour — under the new `transfer-queue-ui` capability.

### Requirement: ImportExportQueue exposes portable style overrides

**Reason**: Superseded by the identically-named requirement under `transfer-queue-ui`, which also
renames the CSS custom properties from `--cp-transfer-queue-*` to `--ieq-*` now that the prefix no
longer stands for "conversation panel".

**Migration**: Rename any `--cp-transfer-queue-*` override to `--ieq-*`. The typed `styles.colors`
API is unchanged apart from the new `progressTrack`, `progressIndicator`, and `divider` entries.

### Requirement: Job label, breadcrumb, and status-slot rendering are preserved

**Reason**: The row is now identified by the transferred file rather than the conversation, and the
status slot gained determinate progress and a `Canceled` state while losing the retry control.

**Migration**: Covered by "A job row is identified by its file, not its conversation" under
`transfer-queue-ui`. Hosts drop `labels.allConversationsJobLabel`, `labels.closeJobAriaLabel`, and
`labels.retryJobAriaLabel`, and supply `labels.cancelJobAriaLabel`, `labels.canceledLabel`,
`labels.jobErrorMessage`, `labels.jobProgressAriaLabel`, and `labels.jobProgressValueText` instead.

### Requirement: Aggregate progress, collapse/expand, and failed-count badge

**Reason**: The aggregate progress bar is gone; progress is now determinate and per row.

**Migration**: Covered by "Per-row progress replaces the aggregate bar" under `transfer-queue-ui`.

### Requirement: Close confirmation for unfinished or failed work

**Reason**: Restated under `transfer-queue-ui`, where a `Canceled` job is added to the set of
statuses that need no confirmation.

**Migration**: No host change required beyond the new import path.

### Requirement: Success-only auto-close after 8 seconds

**Reason**: Restated under `transfer-queue-ui`, where a `Canceled` job now also suppresses the
countdown.

**Migration**: No host change required beyond the new import path.

### Requirement: Component tests move to `libs/conversation-panel`

**Reason**: The suites moved with the components.

**Migration**: Covered by "Component tests live in `libs/chat-shared`" under `transfer-queue-ui`.

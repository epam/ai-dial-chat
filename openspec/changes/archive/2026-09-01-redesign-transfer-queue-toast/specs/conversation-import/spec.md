## MODIFIED Requirements

### Requirement: Import job queue and cancellation

The system SHALL track each imported file as one job in its own `ImportExportQueue` component instance (imported from `@epam/ai-dial-conversation-panel`; see `conversation-panel-transfer-queue-ui` for the component's own contract), separate from (and stacked alongside, not merged with) the export queue instance, with in-progress, success, failed, and canceled states.

Each row SHALL be identified by the **selected file's name** (`file.name`), preceded by a file-type icon derived from its extension, and SHALL show a per-job determinate circular progress indicator while in progress, driven by that job's `progress.percent` per the `conversation-transfer-progress` capability. The panel SHALL NOT render an aggregate progress bar. The source-folder breadcrumb SHALL NOT be rendered — the file name is the row's only label.

An in-progress job SHALL be cancellable through a per-row cancel control that is revealed on row hover and always reachable by keyboard; cancelling aborts its in-flight requests (via the app's `useConversationImport` hook — the library component only calls the `onCancel` callback the app supplies) and leaves the row visible with status canceled. A failed job SHALL show a filled alert icon whose tooltip states the failure reason resolved from the job's `errorCode`; it SHALL NOT expose a retry control, though `retryJob` remains on `useConversationImport`'s public API for the host. Because this is the same `ImportExportQueue` component used for export, it also auto-closes 8 seconds after every job succeeds with none in progress, failed, or canceled — see the auto-close requirement in the conversation-export spec. The app SHALL supply the component's `labels` object and its count-based `title` via `useTranslation`; the component itself has no i18n import.

#### Scenario: One job per imported file

- **WHEN** the user imports two separate single-conversation files
- **THEN** the queue shows two job rows, each labelled by its own file name and independently tracked as in-progress / success / failed / canceled

#### Scenario: Row shows the file name, not a breadcrumb

- **WHEN** a single-conversation file carrying a source folder path is imported
- **THEN** its queue row shows only the selected file's name; no folder-path breadcrumb line is rendered

#### Scenario: Import progress is determinate and per row

- **GIVEN** an archive holding 10 attachments, 4 of which have uploaded
- **WHEN** the queue panel renders
- **THEN** that row's circular indicator shows a determinate value strictly between 0 and 100, reflecting only that job

#### Scenario: Import and export queues stay visually distinct

- **WHEN** an import job and an export job are both active (or recently finished and not yet dismissed) at the same time
- **THEN** two separate `ImportExportQueue` instances are shown, each with its own count-based title ("Importing 1 file" / "Exporting 1 file") passed via its `title` prop — a user exporting something never sees it appear inside a panel titled "Importing", or vice versa

#### Scenario: Cancel an in-progress import

- **WHEN** the user activates an in-progress import row's cancel control
- **THEN** its in-flight requests are aborted, the job's status becomes canceled, and the row stays in the queue showing the "Canceled" label with its file name dimmed

#### Scenario: A failed import explains itself

- **GIVEN** an import that failed because no storage bucket could be resolved
- **WHEN** the user hovers or focuses the row's alert icon
- **THEN** a tooltip shows the translated message for `ConversationTransferErrorCode.MissingBucket`, and the row exposes no retry button

#### Scenario: Retry through the hook re-imports the file

- **WHEN** the host calls `retryJob` for a failed import job
- **THEN** the whole file re-imports from the start with a fresh abort controller, reusing the already-parsed file data, under the same job id with progress reset to 0

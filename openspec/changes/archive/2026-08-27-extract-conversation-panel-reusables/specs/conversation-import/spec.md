## MODIFIED Requirements

### Requirement: Import job queue and cancellation

The system SHALL track each imported file as one job in its own `ImportExportQueue` component instance (imported from `@epam/ai-dial-conversation-panel`; see `conversation-panel-transfer-queue-ui` for the component's own contract), separate from (and stacked alongside, not merged with) the export queue instance, with in-progress, success, and failed states and a determinate aggregate progress bar. When a job represents a single conversation and the file carries a source folder path, its row SHALL show that folder-path breadcrumb as a secondary line above the name. An in-progress job SHALL be cancellable (aborting its in-flight requests, via the app's `useConversationImport` hook — the library component only calls the `onDismiss` callback the app supplies); a failed job SHALL be retryable in place (via the app's `onRetry` callback). Because this is the same `ImportExportQueue` component used for export, it also auto-closes 8 seconds after every job succeeds with none in progress or failed — see the auto-close requirement in the conversation-export spec. The app SHALL supply the component's `labels` object via `useTranslation`; the component itself has no i18n import.

#### Scenario: One job per imported file

- **WHEN** the user imports two separate single-conversation files
- **THEN** the queue shows two job rows, each independently tracked as in-progress / success / failed

#### Scenario: Row shows source folder breadcrumb

- **WHEN** a single-conversation file carries a source folder path
- **THEN** its queue row shows that folder-path breadcrumb as a secondary line above the conversation name

#### Scenario: Import and export queues stay visually distinct

- **WHEN** an import job and an export job are both active (or recently finished and not yet dismissed) at the same time
- **THEN** two separate `ImportExportQueue` instances are shown, each with its own title ("Importing" / "Exporting") passed via its `title` prop — a user exporting something never sees it appear inside a panel titled "Importing", or vice versa

#### Scenario: Cancel an in-progress import

- **WHEN** the user dismisses an in-progress import job
- **THEN** its in-flight requests are aborted and the job is removed from the queue

#### Scenario: Retry a failed import

- **WHEN** the user retries a failed import job
- **THEN** the whole file re-imports from the start with a fresh abort controller, reusing the already-parsed file data

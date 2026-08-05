# Spec: conversation-import

## Purpose

Client-side import of one export file (`.json` or `.dial`/`.zip`, v5 envelope, old- or new-chat origin) into the current user's conversations. Covers the file-picker entry point and accepted types, tolerant parsing of both archive JSON-entry names, bounded-concurrency attachment re-upload to `uploads/<YYYY-MM>/` with automatic ` (n)` name-collision disambiguation and path-allowlist validation, attachment-URL and renamed-title rewriting, fresh-UUID id/path regeneration for collision-free saves, a per-file job queue with cancel/retry, and success/failure/warning/unsupported-format notifications.

## Requirements

### Requirement: Import entry point and accepted file types

The system SHALL provide an "Import" action in the conversation panel header menu that opens a file picker accepting `.json`, `.dial`, and `.zip` files. Selecting a file SHALL start an import job without navigating away or blocking the rest of the app.

#### Scenario: Opening the import picker

- **WHEN** the user selects "Import" in the conversation panel header menu
- **THEN** a file picker restricted to `.json`, `.dial`, and `.zip` opens

#### Scenario: Starting an import

- **WHEN** the user selects a supported file
- **THEN** the file is parsed and one in-progress import job (per file) is added to the ImportExportQueue, and importing begins immediately

#### Scenario: Job label reflects file contents

- **WHEN** the imported file contains exactly one conversation
- **THEN** the job is labeled with that conversation's name (with its source folder breadcrumb, when present)

#### Scenario: Job label for a multi-conversation file

- **WHEN** the imported file contains more than one conversation (e.g. an export-all file)
- **THEN** the job is labeled "All conversations"

#### Scenario: Re-selecting the same file

- **WHEN** the user selects the same file twice in a row
- **THEN** the second selection still starts a new import job (the file input resets between selections)

### Requirement: Parse the v5 export envelope

The system SHALL parse the file into an export envelope `{ version, history, folders }` where `version` is `5`. For `.json` the file content is the envelope; for `.dial`/`.zip` the envelope is read from the archive's conversation-JSON entry. The system SHALL reject files whose parsed content does not have `version: 5` with an array `history`, surfacing an unsupported-format notification, and SHALL NOT transform conversation content this iteration (conversations are imported as-is). `version: 5` is written by both this app's own export and the old (`development` branch) chat app.

#### Scenario: Valid v5 JSON file

- **WHEN** a `.json` file containing `{ version: 5, history: [...], folders: [...] }` is imported
- **THEN** every conversation in `history` is imported

#### Scenario: Unsupported version

- **WHEN** an imported file's envelope has a `version` other than 5 (or missing)
- **THEN** the import fails with an unsupported-format notification and no conversation is saved

#### Scenario: Malformed file

- **WHEN** an imported file is not valid JSON (or, for an archive, contains no readable conversation-JSON entry)
- **THEN** the import fails with an unsupported-format notification and no conversation is saved

### Requirement: Read archives produced by old and new chat

For `.dial`/`.zip` files, the system SHALL locate the conversation-JSON entry under both the new-chat name `conversation.json` and the old-chat name `conversations/conversations_history.json`, and SHALL collect attachment bytes from entries under `res/<path>`. The archive's JSON entry name is what determines old-vs-new archive layout detection — both old and new chat write the same `version: 5` envelope.

#### Scenario: New-chat archive

- **WHEN** a `.dial` archive contains `conversation.json` and `res/<path>` entries
- **THEN** the envelope is read from `conversation.json` and the `res/` entries are collected as attachments

#### Scenario: Old-chat archive

- **WHEN** a `.zip`/`.dial` archive contains `conversations/conversations_history.json` and `res/<path>` entries
- **THEN** the envelope is read from that entry and the `res/` entries are collected as attachments

### Requirement: Re-upload archive attachments to a month-level folder, disambiguating name collisions

For each imported conversation, the system SHALL re-upload every referenced archive attachment to `uploads/<YYYY-MM>/<safe-file-name>` in the current user's bucket, where `<YYYY-MM>` is the local year-month at import time — the same month-level folder convention used by regular (non-import) attachment uploads. Uploads use create-only mode so an existing file is never silently overwritten.

Before uploading, the system SHALL list the destination month folder once per import job and use its contents to pre-fill a per-job name registry. For every attachment about to be uploaded, if the registry already contains its file name — whether from that listing, from an earlier attachment in the same job, or recorded after a create-only conflict — the system SHALL append a ` (n)` suffix before the file extension (`report.pdf` → `report (1).pdf` → `report (2).pdf`, incrementing until free) rather than rejecting the upload. Suffix assignment SHALL be resolved in the fixed order the conversation's attachments are referenced, independent of upload completion order, and the same source file referenced by two different conversations in the archive SHALL be uploaded — and suffixed — as two separate attachments (in contrast to two references to the same file within one conversation, which SHALL still be uploaded once). If a create-only upload is nonetheless rejected as a conflict (a race with a concurrent upload outside this job), the system SHALL retry with the next available suffix up to a bounded number of attempts before giving up. An attachment whose path fails validation, cannot be found in the archive, or exhausts its conflict retries SHALL be skipped and reported as a warning while the conversation still imports.

#### Scenario: Attachment upload and location

- **WHEN** a `.dial` archive conversation references an attachment present under `res/<path>`
- **THEN** the attachment is uploaded to `uploads/<YYYY-MM>/<safe-file-name>` in the user's bucket

#### Scenario: Colliding attachment name already exists in the bucket

- **WHEN** an archive attachment's file name is already listed in the destination month folder (from an earlier upload or a previous import)
- **THEN** the attachment is uploaded under a ` (n)`-suffixed name instead of being rejected, and the conversation still imports

#### Scenario: Two archive attachments share a basename

- **WHEN** two different archive attachments — whether from different source folders in one conversation or from two different conversations referencing the same source path — would resolve to the same destination file name
- **THEN** the first is uploaded under its plain name and the second under a ` (1)`-suffixed name, in the order their conversations and attachment references are processed

#### Scenario: Conflict retry on a race with a concurrent upload

- **WHEN** a create-only upload is rejected as a conflict despite the name registry believing it free
- **THEN** the system retries under the next available suffix, up to a bounded number of attempts

#### Scenario: Skipped attachment

- **WHEN** an attachment fails path validation, cannot be found in the archive, or exhausts its conflict retries
- **THEN** that attachment is skipped, a warning notification is shown, and the conversation still imports

#### Scenario: JSON import has no attachment upload

- **WHEN** a `.json` (no-archive) file is imported
- **THEN** no attachment upload, and no destination-folder listing, occurs and attachment URLs are left unchanged

### Requirement: Rewrite attachment references to new upload locations

After re-uploading an archive attachment, the system SHALL rewrite the corresponding `message.custom_content.attachments[].url` (and `reference_url` where present) to the uploaded file's returned `files/{bucket}/{path}` URL, so the imported conversation points at the newly uploaded files. When the upload was suffixed to resolve a name collision, the system SHALL also rewrite the attachment's `title` to the suffixed file name, so the displayed name matches the file actually stored; an attachment uploaded under its original name SHALL keep its original `title` unchanged.

#### Scenario: Reference rewrite

- **WHEN** an archive attachment originally referenced as `files/{oldBucket}/{path}` is uploaded to the current user's bucket
- **THEN** the message attachment's `url` (and `reference_url` if set) is updated to the new `files/{userBucket}/uploads/<YYYY-MM>/<name>` URL

#### Scenario: Title rewrite on a suffixed upload

- **WHEN** an archive attachment is uploaded under a ` (n)`-suffixed name to resolve a collision
- **THEN** the message attachment's `title` is updated to that suffixed name

#### Scenario: Title left unchanged on a non-suffixed upload

- **WHEN** an archive attachment is uploaded under its original, unsuffixed name
- **THEN** the message attachment's `title` is left as it was in the source file

### Requirement: Save each conversation as a new conversation with a regenerated id

The system SHALL rebase each imported conversation's id/path to the current user's bucket and regenerate its trailing UUID before saving, so an import never overwrites an existing conversation and no conflict/replace dialog is shown. Folder path segments in the id/`folderId` SHALL be preserved (not flattened), so the conversation retains its folder location for when the folder feature ships. Each conversation SHALL be persisted via the existing conversation save API, and the conversation list SHALL be refreshed after the import.

#### Scenario: Collision-free save

- **WHEN** a conversation is imported whose name matches an existing conversation
- **THEN** it is saved as a new conversation with a freshly regenerated UUID in its id/path, without any replace/skip/postfix prompt

#### Scenario: Folder segments preserved

- **WHEN** an imported conversation's id contains folder path segments
- **THEN** those segments are preserved (rebased to the user's bucket) in the saved id/`folderId`, and the conversation is displayed at the root while no folder UI exists

#### Scenario: Multi-segment deployment id preserved

- **WHEN** an imported conversation's id was built from a deployment with a path-like id (e.g. `anthropic/claude-3`), so the id/`folderId` contain intermediate segments belonging to the deployment id rather than a folder
- **THEN** those deployment-id segments are preserved in the rebased id/path exactly as they were, alongside any real folder segments

#### Scenario: List refresh

- **WHEN** an import completes successfully
- **THEN** the conversation list is refreshed so the imported conversation(s) appear

### Requirement: Import job queue and cancellation

The system SHALL track each imported file as one job in its own `ImportExportQueue` panel instance, separate from (and stacked alongside, not merged with) the export queue panel, with in-progress, success, and failed states and a determinate aggregate progress bar. When a job represents a single conversation and the file carries a source folder path, its row SHALL show that folder-path breadcrumb as a secondary line above the name. An in-progress job SHALL be cancellable (aborting its in-flight requests); a failed job SHALL be retryable in place. Because this is the same `ImportExportQueue` panel used for export, it also auto-closes 8 seconds after every job succeeds with none in progress or failed — see the auto-close requirement in the conversation-export spec.

#### Scenario: One job per imported file

- **WHEN** the user imports two separate single-conversation files
- **THEN** the queue shows two job rows, each independently tracked as in-progress / success / failed

#### Scenario: Row shows source folder breadcrumb

- **WHEN** a single-conversation file carries a source folder path
- **THEN** its queue row shows that folder-path breadcrumb as a secondary line above the conversation name

#### Scenario: Import and export queues stay visually distinct

- **WHEN** an import job and an export job are both active (or recently finished and not yet dismissed) at the same time
- **THEN** two separate queue panels are shown, each with its own title ("Importing" / "Exporting") — a user exporting something never sees it appear inside a panel titled "Importing", or vice versa

#### Scenario: Cancel an in-progress import

- **WHEN** the user dismisses an in-progress import job
- **THEN** its in-flight requests are aborted and the job is removed from the queue

#### Scenario: Retry a failed import

- **WHEN** the user retries a failed import job
- **THEN** the whole file re-imports from the start with a fresh abort controller, reusing the already-parsed file data

### Requirement: Aggregate success and failure notifications

When an import operation settles, the system SHALL show a success notification naming every conversation that imported successfully and, separately, a failure notification naming every conversation that failed (`"<name>" was not imported. Please try again.`). Both notifications MAY appear together when an operation partially succeeds. An unsupported/unreadable file SHALL instead show a single unsupported-format notification.

#### Scenario: All conversations imported

- **WHEN** every conversation in the file imports successfully
- **THEN** a success notification lists all imported conversation names and no failure notification is shown

#### Scenario: Partial success

- **WHEN** some conversations import and others fail
- **THEN** a success notification names the imported conversations and a failure notification names the failed ones

#### Scenario: Unsupported file

- **WHEN** the selected file is not a valid v5 export (bad version, malformed, or no readable archive entry)
- **THEN** a single unsupported-format notification is shown and no job rows are created

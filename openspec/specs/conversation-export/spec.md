# Spec: conversation-export

## Purpose

Lets a user export one or all of their conversations from the conversation panel — as a JSON v5 envelope, or as a `.dial` ZIP bundling the conversation with its attachments — tracked through a non-modal export queue panel, with no new backend endpoint and no feature flag gating.

## Requirements

### Requirement: Export format is a versioned JSON v5 envelope

The system SHALL serialize exported conversations into a single JSON document with the shape:

```json
{
  "version": 5,
  "history": [ /* conversation objects (ConversationResponseDto) */ ],
  "folders": [ /* folder objects (FolderInterface) */ ]
}
```

`version` SHALL be the numeric literal `5`. `history` SHALL be typed `ExportConversationV5[]`, where `ExportConversationV5` is a dedicated, version-scoped alias of the in-lib domain `Conversation` (from `libs/chat-shared/src/models/chat.ts`); it SHALL contain the full, unmodified conversation objects with no transformation applied. The element type SHALL NOT be `ConversationResponseDto` from `@epam/chat-api-client` (a `type:shared` lib may not import the generated client) and SHALL NOT be left generic; the objects returned by the server-api wrappers are structurally compatible with the domain `Conversation`. `folders` SHALL be typed `ExportFolderV5[]`. Because the app currently has **no** conversation-folder model (`Conversation` carries only `folderId: string`; no `FolderInterface` exists), the export format SHALL define its own minimal net-new `ExportFolderV5` (`{ id: string; name: string; folderId?: string }`) and, until a folder model exists, MAY emit `folders: []`.

This branch's domain `Conversation` has no `publicationInfo` field and no publication/sharing subsystem exists here (unlike the legacy `development` branch, where `ShareEntity.publicationInfo` is a real field). No stripping step is required or implemented; if a publication/sharing feature is ported to this branch in the future, this requirement SHALL be revisited.

The export format SHALL start at version 5: only `ExportFormatV5` is defined by this change (`ExportFormatV1`–`ExportFormatV3` SHALL NOT be created). `SupportedExportFormats` SHALL be `ExportFormatV5` for now and SHALL be extended to `ExportFormatV4 | ExportFormatV5` when a future import feature is added; versions below 4 SHALL NOT be supported. These net-new type definitions (`ExportFormatV5`, `ExportConversationV5`, `ExportFolderV5`, `LatestExportFormat`, `SupportedExportFormats`) SHALL live in `libs/chat-shared/src/types/import-export.ts` (package `@epam/ai-dial-chat-shared`) and be re-exported from the lib entrypoint (`libs/chat-shared/src/index.ts`). Serialization ownership: a pure utility module in `apps/chat/src/utils/` (kebab-case file, named `export const` arrow functions with explicit return types, tests in `apps/chat/src/utils/tests/`) owns the mapping from conversation/folder data to the v5 envelope; it takes data in and returns a `Blob`, holding no React or API state.

#### Scenario: Envelope carries version 5 and both arrays

- **WHEN** one or more conversations are serialized for export
- **THEN** the produced JSON has `version === 5`, a `history` array of the conversation objects, and a `folders` array

#### Scenario: No fields are altered

- **GIVEN** a conversation object with messages, attachments metadata, and settings
- **WHEN** it is serialized into the export envelope
- **THEN** every field is byte-for-byte preserved

---

### Requirement: Export a single conversation without attachments as JSON

The system SHALL let a user export one conversation, without attachments, from the conversation's context menu. The full conversation content SHALL be fetched from the existing conversation-content wrapper (`getConversation(path)` in `apps/chat/src/server-api/conversations.api.ts`), serialized into the JSON v5 envelope, wrapped in a `Blob` of type `application/json`, and offered as a browser download by reusing the existing `triggerBlobDownload(blob, filename)` helper in `apps/chat/src/utils/file-download.ts` (do not hand-roll a new `<a download>`). Like every other export mode, this path SHALL create a queue job (see the export-queue requirement) so the user has one consistent place to see the status of every export they trigger, even ones that complete almost immediately. The downloaded file SHALL be named per the file-naming requirement.

#### Scenario: Single JSON export downloads immediately

- **GIVEN** a user opens a conversation's context menu
- **WHEN** the user chooses Export → "without attachments"
- **THEN** the conversation content is fetched, a `.json` file containing the v5 envelope with that one conversation in `history` is downloaded, and a queue job tracks the operation to completion

#### Scenario: Fetch failure surfaces an error and downloads nothing

- **GIVEN** the conversation-content fetch fails
- **WHEN** the user chooses Export → "without attachments"
- **THEN** an error toast is shown and no file is downloaded

---

### Requirement: Export a single conversation with attachments as a `.dial` ZIP

The system SHALL let a user export one conversation, with attachments, producing a `.dial` ZIP archive (built with `fflate`) that contains the conversation's JSON v5 envelope plus every referenced attachment file. Each attachment SHALL be fetched through the existing file-download BFF endpoint (`GET /api/v1/files/download`), and placed inside the archive under a `res/<relative-path>/<filename>` layout. Attachment fetches SHALL run with a bounded parallelism of at most 5 concurrent requests. This path SHALL create a queue job (see the export-queue requirement) because it is a potentially long operation; the app remains fully usable while it runs. The downloaded file SHALL be named per the file-naming requirement.

#### Scenario: ZIP export bundles conversation and attachments

- **GIVEN** a conversation with two attachments
- **WHEN** the user chooses Export → "with attachments"
- **THEN** a `.dial` archive is downloaded containing the conversation JSON envelope and both attachment files under `res/…`

#### Scenario: Attachment fetches are throttled

- **GIVEN** a conversation referencing 12 attachments
- **WHEN** the ZIP export runs
- **THEN** no more than 5 attachment download requests are in flight at any moment

#### Scenario: A failed attachment is skipped with a warning

- **GIVEN** one attachment of several fails to download
- **WHEN** the ZIP export runs
- **THEN** that attachment is omitted from the archive, a warning toast informs the user, and the archive containing the remaining files is still downloaded

---

### Requirement: Export all conversations as a single JSON file

The system SHALL let a user export all of their conversations, without attachments, from the conversation panel header menu. The system SHALL enumerate the full conversation list from the existing conversation-list BFF endpoint, following pagination via `nextToken` until all pages are retrieved, fetch each conversation's content, serialize everything into one JSON v5 envelope, and download it as a single `.json` file named per the file-naming requirement. This action SHALL NOT show any submenu or mode selection (it is always without attachments) and SHALL create a queue job for the duration of the operation, during which the rest of the app remains usable. Bulk export WITH attachments is out of scope.

#### Scenario: Export-all follows pagination

- **GIVEN** a user has more conversations than fit in one list page (nextToken present)
- **WHEN** the user chooses "Export all conversations"
- **THEN** the system requests subsequent pages using `nextToken` until exhausted and includes every conversation in `history`

#### Scenario: Export-all creates a queue job

- **WHEN** "Export all conversations" is running
- **THEN** a queue job is created and reaches success or failed when the operation completes or aborts, and the user can continue using the chat while it is visible

#### Scenario: A missing conversation is skipped, not fatal

- **GIVEN** one conversation returns 404 while fetching content during export-all
- **WHEN** export-all runs
- **THEN** that conversation is skipped, a toast notifies the user, and the export continues with the remaining conversations

---

### Requirement: Exported files use a deterministic name built from a fixed template

The system SHALL name downloaded files from a fixed template combined with the current date `YYYY-MM-DD` (zero-padded month and day, mirroring `development`'s `getCurrentDate`) and an app-name part — never from user-supplied text. The app-name part SHALL be resolved at the app edge and passed into the pure util as a plain string; since `development-1.0` exposes no app display-name, the app SHALL pass the constant default `ai_dial` (matching `development`'s fallback). The names SHALL be:

- Single conversation, without attachments: `<YYYY-MM-DD>_<appName>_chat_conversation.json`
- Single conversation, with attachments: `<YYYY-MM-DD>_<appName>_chat_with_attachments.dial`
- All conversations: `<YYYY-MM-DD>_<appName>_chat_conversations_history.json`

#### Scenario: File name is composed from date, app name, and fixed suffix

- **GIVEN** the current date is 2026-07-10 and the app-name part is `ai_dial`
- **WHEN** a single conversation is exported without attachments
- **THEN** the downloaded file is named `2026-07-10_ai_dial_chat_conversation.json`

#### Scenario: No user input reaches the file name

- **GIVEN** a conversation whose title contains characters like `/`, `..`, or spaces
- **WHEN** it is exported
- **THEN** the file name is unaffected by the title and follows the fixed template

---

### Requirement: An export job is named by its output file from the moment it is enqueued

`buildExportFileName` SHALL be called when the job is added to the queue, not when the download is triggered, and the resulting name SHALL be stored on the job as `fileName` and reused verbatim for the eventual `triggerBlobDownload` call. A row SHALL therefore never display a placeholder, a conversation title, or a name that differs from the file the user finally receives.

#### Scenario: The row name matches the downloaded file

- **GIVEN** a single-conversation export with attachments started on 2026-09-01
- **WHEN** the job is enqueued
- **THEN** its row immediately reads `2026-09-01_ai_dial_chat_with_attachments.dial`, and the file the browser downloads on completion carries exactly that name

#### Scenario: A cancelled job's row still names the file that was never written

- **GIVEN** an export cancelled before completion
- **THEN** its row still shows the file name it would have produced, alongside the "Canceled" label

---

### Requirement: Export UI entry points are injected by the app, not the panel library

The conversation panel library (`libs/conversation-panel`) SHALL remain host-agnostic: it SHALL NOT know about export, API endpoints, download triggering, or i18n. The app SHALL surface export through two entry points wired at the app edge:

1. A per-conversation "Export" item added to the `DropdownItem[]` returned by the app's `getActions` callback in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (the library's `ConversationRow` renders whatever items the app supplies). This item SHALL use the ui-kit's native nested-item support (`DropdownItem.children`) to expose a hover-revealed submenu with two items, "with attachments" and "without attachments" — mirroring the existing "Language"/"Keyboard shortcuts" submenu pattern in `apps/chat/src/components/Navigation/UserMenu.tsx`. The parent "Export" item SHALL NOT have its own `onClick` and SHALL NOT open a modal/popup; each child item's `onClick` starts the corresponding export directly.
2. An "Export all conversations" item added to the panel header overflow menu. That menu is the app component `apps/chat/src/components/ConversationPanel/ConversationPanelHeaderMenu.tsx` (currently exposing only "Delete all chats"), which is injected into the library via the opaque `headerActions` slot (see `conversation-panel-header-menu`). Activating it starts export-all directly.

The transient export state (the job queue, each job's status and step-count progress) SHALL be owned by a dedicated app-level hook that consumes `useConversationExport` from `@epam/ai-dial-chat-hooks`; the queue is rendered by the `ImportExportQueue` component from `@epam/ai-dial-conversation-panel` (see `conversation-panel-transfer-queue-ui`), which the app supplies with `jobs`, `onDismiss`/`onRetry`/`onClose` callbacks, and a translated `labels` object — the app builds the labels object via `useTranslation` and passes it down; the queue component itself has no i18n import. All host/API knowledge stays outside the lib boundary. The `getActions` callback SHALL remain memoized (`useCallback`) so conversation rows do not re-render on every parent render. The export entry points and the queue panel itself SHALL NOT use a modal/popup (`DialPopup` or similar) — see the export-queue requirement for the non-modal design; the sole exception is the queue's own panel-level close confirmation (see the confirmation requirement below), which deliberately uses a confirmation dialog when closing would abort or discard unfinished work.

#### Scenario: Context-menu export reveals a submenu, not a modal

- **GIVEN** a conversation row context menu is open
- **WHEN** the user hovers or focuses "Export"
- **THEN** a submenu offering "with attachments" and "without attachments" appears, and no modal/dialog is opened

#### Scenario: Header menu export-all starts without any modal

- **GIVEN** the conversation panel header menu is open
- **WHEN** the user activates "Export all conversations"
- **THEN** export-all begins immediately as a new queue job and no dialog is ever shown

#### Scenario: Architecture guard — panel lib stays clean

- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** no import of `@epam/chat-api-client`, `apps/chat/src/server-api`, app contexts, routing utilities, `useTranslation`, `fflate`, or `process.env` is present in any lib source file

#### Scenario: App wires the library queue component with translated labels

- **WHEN** `ConversationPanelView` renders the export queue
- **THEN** it renders `@epam/ai-dial-conversation-panel`'s `ImportExportQueue` with a `labels` object built from `useTranslation`, not an app-owned queue component

---

### Requirement: Export submenu for single-conversation export

The system SHALL let the user choose "with attachments" (→ `.dial` ZIP) or "without attachments" (→ `.json`) via a hover/focus-revealed submenu nested under the "Export" context-menu item (the ui-kit's native `DropdownItem.children`), not via a modal/popup. The submenu SHALL be keyboard-accessible via the ui-kit's existing dropdown/submenu keyboard handling (arrow keys to navigate into and within the submenu, `Enter`/`Space` to activate an item, `Escape` to close the menu without exporting) — this is the same keyboard behavior already provided by `DialDropdown` for the existing "Language" and "Keyboard shortcuts" submenus in `UserMenu.tsx`; no bespoke focus-trap or dialog semantics are introduced for this feature. Selecting a child item starts the corresponding export immediately; the menu closes via the dropdown's own dismissal behavior.

#### Scenario: Selecting a submenu item starts the matching export

- **GIVEN** the "Export" submenu is open
- **WHEN** the user selects "with attachments"
- **THEN** the `.dial` ZIP export begins for that conversation

#### Scenario: Closing the menu without a selection does not export

- **GIVEN** the "Export" submenu is open
- **WHEN** the user closes the menu (e.g. via `Escape` or clicking outside) without selecting an item
- **THEN** no export starts

---

### Requirement: Non-modal export queue for long-running exports

The system SHALL display export progress and history in a non-modal, non-blocking **export queue panel** fixed to the bottom-end corner of the screen, rather than a single status indicator. The panel SHALL NOT use a modal/popup component (no `DialPopup`, no scrim, no focus trap) — the rest of the app, including the chat itself, SHALL remain fully interactive while it is visible. The panel SHALL expose `role="status"` with `aria-live="polite"` on its container so assistive technology announces progress, and SHALL render nothing when there are no jobs.

The panel SHALL support **multiple concurrent export jobs**: starting a new export (single-conversation JSON, single-conversation ZIP, or export-all) while one or more others are still running SHALL add an independent entry rather than replacing or queuing behind the existing one(s); each job's fetch/outcome SHALL be tracked independently — including the single-JSON export, which typically completes almost immediately and so appears in the panel only briefly before settling to success.

Progress is reported **per job**, not at the panel level: each in-progress row SHALL show its own determinate circular indicator driven by that job's `progress.percent` (see the `conversation-transfer-progress` capability). The panel SHALL NOT render an aggregate progress bar. The panel header SHALL contain a count-based title composed by the app (`"Exporting 1 file"` / `"Exporting 3 files"`), a collapse/expand toggle that hides or shows the individual job rows without removing the panel itself, a panel-level close control that clears the whole queue (see the dismissal requirement below), and, when at least one job has failed, a failed-count badge.

Each job SHALL be one of four states — **in progress**, **success**, **failed**, or **canceled** — and SHALL render as its own row identified by the **file name** the export writes, with a leading file-type icon and state-appropriate controls (see the requirements below for exactly which controls appear per state). The conversation title and source-folder breadcrumb SHALL NOT appear in a row.

#### Scenario: Queue panel is announced to assistive tech

- **WHEN** at least one export job exists
- **THEN** an element with `role="status"` and `aria-live="polite"` is present, communicating export progress

#### Scenario: Queue panel does not block the rest of the app

- **WHEN** the queue panel is visible
- **THEN** the user can still interact with the chat and the rest of the UI — no scrim or overlay intercepts pointer events elsewhere on the page, and no `dialog` role is rendered merely by the panel being visible (a `dialog` SHALL only ever appear as the deliberate, user-triggered close-confirmation described below)

#### Scenario: Multiple concurrent exports each get their own row

- **GIVEN** the user starts exporting three different conversations before any of them finishes
- **WHEN** the queue panel renders
- **THEN** all three appear as separate rows, each reflecting only its own status and its own progress

#### Scenario: A single long-running export shows real progress

- **GIVEN** one export-with-attachments job is the only job in the queue and 3 of its 10 attachments have downloaded
- **WHEN** the queue panel renders
- **THEN** that row's circular indicator shows a determinate value strictly between 0 and 100, and no aggregate progress bar is present

#### Scenario: The header names how many files are transferring

- **GIVEN** three export jobs are in the queue
- **WHEN** the queue panel renders
- **THEN** its header reads "Exporting 3 files", pluralized by the app through `t(key, { count })`

#### Scenario: Collapsing the panel hides job rows, not the panel itself

- **WHEN** the user activates the collapse toggle
- **THEN** the individual job rows are hidden while the header (and its expand toggle) remain visible

#### Scenario: Queue panel disappears once every job is dismissed

- **WHEN** the last remaining job is dismissed
- **THEN** the queue panel is removed entirely

---

### Requirement: Dismissing exports cancels in-progress work

An **in-progress** job row SHALL expose a per-row cancel control, revealed on row hover and always reachable by keyboard, which aborts the underlying in-flight request(s) (via `AbortController`/`AbortSignal` threaded through the `getConversation`/`listConversations`/`downloadFile` server-api wrappers) — no partial work SHALL continue in the background, and no file SHALL be downloaded for a cancelled job. Cancelling SHALL NOT remove the row: the job SHALL remain visible with status **canceled**, its trailing slot showing a "Canceled" label and its file name dimmed, so the user has a record of what they stopped.

**Success**, **failed**, and **canceled** rows SHALL expose no per-row control at all. Finished jobs are cleared through the panel-level close control in the header, which dismisses **all** jobs at once (aborting any that are still in progress). Because no row has a per-row remove control, the queue is emptied via the panel-level close rather than by removing rows one by one.

#### Scenario: Cancelling an in-progress job cancels the underlying work

- **GIVEN** a job is in progress (e.g. mid-attachment-fetch or mid-conversation-listing)
- **WHEN** the user activates its per-row cancel control
- **THEN** the in-flight request(s) for that job are aborted and no file is ever downloaded for it

#### Scenario: A cancelled job keeps its row

- **GIVEN** the user has cancelled an in-progress export
- **WHEN** the queue panel re-renders
- **THEN** the job's row is still present with status canceled, showing the "Canceled" label and the dimmed file name

#### Scenario: Finished jobs have no per-row control

- **GIVEN** a job has status success, failed, or canceled
- **THEN** its row exposes no button — no close, no retry, no cancel

#### Scenario: The panel-level close clears the whole queue

- **GIVEN** every job in the queue has settled as success or canceled, with none in progress or failed
- **WHEN** the user activates the panel-level close control in the header
- **THEN** every job is removed immediately (no confirmation), any still-in-progress request is aborted, and the panel disappears

---

### Requirement: Confirming panel-level close when work would be lost

Activating the panel-level close control SHALL clear the queue immediately, without confirmation, when every job has status success or canceled — a canceled job represents work the user already chose to stop, so nothing further is lost. If at least one job is still **in progress** or has **failed**, activating the panel-level close control SHALL first show the `ImportExportQueue` component's own confirmation dialog (`role="dialog"`) asking the user to confirm, since closing would abort in-progress work or discard the record of a failure the user has not yet acknowledged. Confirming clears the queue exactly as described above; cancelling the confirmation dismisses only the dialog and leaves the queue untouched. This confirmation is the one deliberate, user-triggered exception to the panel's otherwise non-modal design (see the queue-panel requirement above), and it is rendered by the library component itself, driven by the `labels` object the app supplies.

#### Scenario: Closing an all-succeeded queue needs no confirmation

- **GIVEN** every job in the queue has status success
- **WHEN** the user activates the panel-level close control
- **THEN** the queue is cleared immediately and no confirmation dialog appears

#### Scenario: Closing a queue whose only unfinished work was cancelled needs no confirmation

- **GIVEN** every job in the queue has status success or canceled
- **WHEN** the user activates the panel-level close control
- **THEN** the queue is cleared immediately and no confirmation dialog appears

#### Scenario: Closing a queue with in-progress or failed work asks for confirmation

- **GIVEN** the queue contains at least one job that is in progress or failed
- **WHEN** the user activates the panel-level close control
- **THEN** a confirmation dialog appears and the queue is not yet cleared

#### Scenario: Confirming the close clears the queue

- **GIVEN** the confirmation dialog is open
- **WHEN** the user confirms
- **THEN** every job is removed, any still-in-progress request is aborted, and the panel disappears

#### Scenario: Cancelling the confirmation leaves the queue untouched

- **GIVEN** the confirmation dialog is open
- **WHEN** the user cancels (or dismisses) the dialog instead of confirming
- **THEN** the dialog closes, no job is removed, and no in-flight request is aborted

---

### Requirement: Auto-closing the queue once every job has succeeded

The queue panel SHALL close itself automatically 8 seconds after the last job in it settles, but only when **every** job has status success. If any job is still **in progress**, is (or becomes) **failed**, or has been **canceled** at any point during that 8-second window, the auto-close SHALL NOT fire; the panel then stays open until the user closes it manually (going through the confirmation flow above when applicable). A canceled job suppresses auto-close so the user is guaranteed to see the outcome of their own cancellation. This applies to both the import queue and the export queue, since both render the same `ImportExportQueue` panel.

#### Scenario: All jobs succeed and the user takes no action

- **GIVEN** every job in the queue has status success
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the queue panel closes itself automatically

#### Scenario: A failed job blocks auto-close

- **GIVEN** the queue contains at least one job with status failed
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the panel does NOT auto-close; it remains open until the user closes it manually

#### Scenario: A canceled job blocks auto-close

- **GIVEN** the queue contains at least one job with status canceled
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the panel does NOT auto-close and the canceled row stays on screen

#### Scenario: A job still in progress blocks auto-close

- **GIVEN** the queue contains at least one job still in progress
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the panel does NOT auto-close

#### Scenario: A new job starting during the countdown cancels it

- **GIVEN** every job in the queue has status success and the 8-second auto-close countdown is running
- **WHEN** the user starts a new export/import before the countdown elapses
- **THEN** the countdown is cancelled (the panel does not close itself) because the queue once again contains an in-progress job

---

### Requirement: Retrying a failed export job

`useConversationExport` SHALL continue to expose `retryJob(jobId)`, which re-attempts the export with the exact same parameters (same conversation id/title/mode for a single export; a fresh `listConversations` pass for export-all) **reusing the same job id** — the row updates in place back to in-progress, with its progress reset to 0 and its recorded error code cleared, rather than a new row being appended.

The export queue panel SHALL NOT surface a retry control on a failed row. A failed row instead shows a filled alert icon whose tooltip states the failure reason, resolved from the job's `errorCode` through the app-supplied `labels.jobErrorMessage` callback. Retry remains available to the host on the hook's public API, and the user's in-app recovery path is to start the export again from the conversation's context menu.

#### Scenario: A failed row explains the failure instead of offering a bare retry

- **GIVEN** a job failed because the assembled archive exceeded the size limit
- **WHEN** the user hovers or focuses the row's alert icon
- **THEN** a tooltip reads "Export failed. File is too large", and the row exposes no retry button

#### Scenario: Retrying through the hook reruns the job in place

- **GIVEN** a job for conversation "Dynamic Weather Elements" has status failed
- **WHEN** the host calls `retryJob` with that job's id
- **THEN** the same job id transitions back to in-progress with `progress.percent` reset to 0 and `errorCode` cleared, and the export is re-attempted with the same conversation id, title, and mode

#### Scenario: A successful retry updates the existing row, not a new one

- **GIVEN** a retried job eventually succeeds
- **WHEN** the queue panel re-renders
- **THEN** there is still exactly one row for that export, now showing success

---

### Requirement: Attachment paths are validated before being written into the archive

The system SHALL validate every attachment path before adding it to the ZIP archive, to prevent path-traversal or ZIP entry-name injection. Validation SHALL first check the path against the character allowlist `^[a-zA-Z0-9._\-/]+$`, then, because that character class alone permits `.`, `..`, and `/` and therefore does not by itself block traversal, SHALL additionally split the path on `/` and reject it if any segment is empty (blocking a leading, trailing, or doubled `/`) or equal to `.` or `..`. A path that fails either check SHALL be skipped (with a warning toast) and SHALL NOT be written to the archive.

#### Scenario: A valid path is added under res/

- **GIVEN** an attachment with a path matching the allowlist
- **WHEN** the ZIP is built
- **THEN** the file is written under `res/<relative-path>/<filename>`

#### Scenario: A malformed path is rejected

- **GIVEN** an attachment path containing a `..` traversal segment (e.g. `../../etc/passwd`), an absolute path, a doubled slash, or characters outside the allowlist
- **WHEN** the ZIP is built
- **THEN** the attachment is skipped, not written to the archive, and a warning toast is shown

---

### Requirement: Export outcomes are reported via success and failure toasts

All user-facing toasts SHALL be raised through the app's notification context — `useNotification().showNotification({ variant, title, message })` from `apps/chat/src/context/NotificationContext.tsx`, using `NotificationVariant` from `@epam/ai-dial-ui-kit` (`Success` on completion, `Error` for failures, `Warning` for skips). Each toast has a fixed title (`ConversationExportI18nKeys.SuccessTitle` = "Export successful" / `FailedTitle` = "Export failed") and a message naming the affected conversation(s) where applicable, matching the product design. Toasts fire **in addition to** the export queue panel's own per-job status slot (determinate ring while in progress, checkmark for success, alert icon with an explanatory tooltip for failed, "Canceled" label for cancelled) — the two are complementary, not exclusive: the toast is a transient heads-up, the queue row is the persistent record:

- **Single-conversation export success** (either mode): `Success` toast, message interpolates the conversation title — `"{{title}}" exported.`
- **Export-all success**: `Success` toast, message `All conversations exported.`
- **Single-conversation export failure** (any non-401 error fetching the conversation): `Error` toast, message interpolates the conversation title — `"{{title}}" was not exported. Please try again.` The operation aborts (no download).
- **Export-all — one conversation 404s**: `Error` toast using the same per-title failure message for that conversation; that conversation is skipped and the operation continues with the rest.
- **Export-all — any other failure** (listing conversations, or a non-404 error fetching a conversation): `Error` toast, message `Conversations were not exported. Please try again.`; the operation aborts.
- **Individual attachment fetch error during ZIP export**: `Warning` toast (`One or more attachments could not be exported and were skipped.`); that attachment is skipped and the export continues.
- **Archive exceeds the size limit**: `Error` toast, message `"{{title}}" was not exported. The file is too large.`; the job's `errorCode` is `FileTooLarge` and the same reason is shown in the row's tooltip.
- **`401` (any request)**: defer to the existing global unauthorized handler (redirect to login); do not raise a duplicate toast.
- **User-initiated cancellation**: no toast of any kind. The user knows they cancelled; the canceled row is the record.

Beyond the unauthorized/not-found/too-large distinctions above, no other HTTP status (403/429/5xx) SHALL produce a different visible message — the toast text is a single generic per-conversation (or per-operation) message, not one message per status code. All failures SHALL still be logged via `console.error` with no sensitive data (no tokens, cookies, or full bodies). All user-visible strings SHALL come from react-i18next `useTranslation` with keys declared in `ConversationExportI18nKeys`.

#### Scenario: Single export success names the conversation

- **WHEN** a single conversation titled "Simple Greeting and Response" is exported successfully
- **THEN** a `Success` toast titled "Export successful" with message `"Simple Greeting and Response" exported.` is shown

#### Scenario: Single export failure names the conversation

- **WHEN** fetching a conversation titled "Dynamic Weather Elements" fails with any non-401 status
- **THEN** an `Error` toast titled "Export failed" with message `"Dynamic Weather Elements" was not exported. Please try again.` is shown and no file is downloaded

#### Scenario: Export-all success is generic

- **WHEN** export-all completes and the combined file is downloaded
- **THEN** a `Success` toast titled "Export successful" with message "All conversations exported." is shown

#### Scenario: Export-all aborts on a non-404 failure

- **WHEN** listing conversations or fetching a conversation during export-all fails with a status other than 404 (or the list request itself fails)
- **THEN** an `Error` toast titled "Export failed" with the generic export-all failure message is shown and the operation is aborted

#### Scenario: Cancelling raises no toast

- **WHEN** the user cancels an in-progress export
- **THEN** no `Error`, `Success`, or `Warning` toast is shown, and the only feedback is the canceled row in the queue panel

#### Scenario: An oversized archive is reported in both places

- **WHEN** an export-with-attachments job fails because the archive exceeds the size limit
- **THEN** an `Error` toast titled "Export failed" states that the file is too large, and the job's row tooltip states the same reason

#### Scenario: Errors are logged without sensitive data

- **WHEN** any export error is handled
- **THEN** it is logged via `console.error` and the log contains no tokens, cookies, or full request/response bodies

---

### Requirement: Export strings are internationalized and direction-aware

All new user-visible export strings SHALL be added as react-i18next keys and grouped under a dedicated key set (the `ConversationExportI18nKeys` enum in the translation-key constants), with English defaults added to the locale file. Keys SHALL cover at least: the context-menu "Export" label, "Export all conversations" label, the "with attachments" and "without attachments" submenu options, the count-based queue title (pluralized through `t(key, { count })`), the "Canceled" row label, the per-error-code failure messages rendered in a failed row's tooltip, the cancel-control accessible name, the progress indicator's accessible name and unit readout, the success title/messages, and the failure title/messages (including the interpolated per-title variants). The `RetryJobAriaLabel`, `CloseJobAriaLabel`, and `AllConversationsJobLabel` keys SHALL be removed, since none of those strings is rendered any more. Direction-agnostic queue chrome — the collapse/expand/close accessible names, the close-confirmation copy, the "Canceled" label, and the progress unit readouts — SHALL be declared once under `ConversationExportI18nKeys` and reused by the import queue's labels rather than duplicated under `ConversationImportI18nKeys`; only direction-specific strings (queue title, cancel accessible name, progress accessible name, and the per-error-code messages) SHALL exist in both key sets.

The export UI (context-menu item, submenu, export queue panel) SHALL use CSS logical properties / Tailwind logical utilities (`ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end`, `start-*`/`end-*`) so it flips correctly under `dir="rtl"`. Any directional chevron/submenu-affordance icon (e.g. the submenu-open indicator on "Export") SHALL be mirrored with `rtl:scale-x-[-1]`; symmetric icons — including the circular progress ring and the row's file-type, check, and alert icons — SHALL NOT be flipped.

#### Scenario: All export strings resolve through i18n

- **WHEN** the export UI renders in English
- **THEN** every visible label, row label, tooltip, and toast text resolves from a `ConversationExportI18nKeys` key, with no hardcoded literals

#### Scenario: The queue title pluralizes

- **GIVEN** the active language is English
- **WHEN** the queue holds one job and then three
- **THEN** the header reads "Exporting 1 file" and then "Exporting 3 files"

#### Scenario: Export UI flips under RTL

- **GIVEN** the active language is Arabic and `dir="rtl"` is set on `<html>`
- **WHEN** the "Export" submenu and the export queue panel render
- **THEN** their inline spacing and alignment mirror correctly, the submenu-open indicator is horizontally flipped, and the progress ring still sweeps clockwise

---

### Requirement: Export availability and gating

Conversation export SHALL be an additive, always-available feature and SHALL NOT be hidden behind an `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` flag. It SHALL introduce no new backend endpoint, no OpenAPI contract change, and no new authorization rule — it consumes existing conversation-list, conversation-content, and file-download endpoints under the caller's existing session and permissions.

#### Scenario: Export requires no feature flag

- **WHEN** a signed-in user with default configuration opens the conversation context menu or panel header menu
- **THEN** the Export entry points are present without any feature flag being enabled

#### Scenario: No new backend surface is added

- **WHEN** the change is implemented
- **THEN** no new controller, route, or OpenAPI operation is introduced and the export uses only pre-existing endpoints

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: An export job is named by its output file from the moment it is enqueued

`buildExportFileName` SHALL be called when the job is added to the queue, not when the download is triggered, and the resulting name SHALL be stored on the job as `fileName` and reused verbatim for the eventual `triggerBlobDownload` call. A row SHALL therefore never display a placeholder, a conversation title, or a name that differs from the file the user finally receives.

#### Scenario: The row name matches the downloaded file

- **GIVEN** a single-conversation export with attachments started on 2026-09-01
- **WHEN** the job is enqueued
- **THEN** its row immediately reads `2026-09-01_ai_dial_chat_with_attachments.dial`, and the file the browser downloads on completion carries exactly that name

#### Scenario: A cancelled job's row still names the file that was never written

- **GIVEN** an export cancelled before completion
- **THEN** its row still shows the file name it would have produced, alongside the "Canceled" label

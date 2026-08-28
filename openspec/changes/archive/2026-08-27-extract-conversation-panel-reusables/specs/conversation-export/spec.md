## MODIFIED Requirements

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

### Requirement: Non-modal export queue for long-running exports

The system SHALL display export progress and history in a non-modal, non-blocking **export queue panel** fixed to the bottom-end corner of the screen, using the `ImportExportQueue` component from `@epam/ai-dial-conversation-panel` (see `conversation-panel-transfer-queue-ui` for the component's own contract), rather than a single status indicator. The panel SHALL NOT use a modal/popup component (no scrim, no focus trap) — the rest of the app, including the chat itself, SHALL remain fully interactive while it is visible. The panel SHALL expose `role="status"` with `aria-live="polite"` on its container so assistive technology announces progress, and SHALL render nothing when there are no jobs.

The panel SHALL support **multiple concurrent export jobs**: starting a new export (single-conversation JSON, single-conversation ZIP, or export-all) while one or more others are still running SHALL add an independent entry rather than replacing or queuing behind the existing one(s); each job's fetch/outcome SHALL be tracked independently — including the single-JSON export, which typically completes almost immediately and so appears in the panel only briefly before settling to success. Progress is reported at the panel level only (not per job): the panel SHALL show an aggregate progress indicator reflecting the fraction of jobs that have finished (succeeded or failed) out of the total number of jobs currently in the panel. The panel header SHALL contain a collapse/expand toggle that hides or shows the individual job rows without removing the panel itself, a panel-level close control that clears the whole queue (see the dismissal requirement below), and, when at least one job has failed, a failed-count badge.

Each job SHALL be one of three states — **in progress**, **success**, or **failed** — and SHALL render as its own row with the export's label (the conversation title, or the export-all label) and state-appropriate controls (see the requirements below for exactly which controls appear per state).

#### Scenario: Queue panel is announced to assistive tech

- **WHEN** at least one export job exists
- **THEN** an element with `role="status"` and `aria-live="polite"` is present, communicating export progress

#### Scenario: Queue panel does not block the rest of the app

- **WHEN** the queue panel is visible
- **THEN** the user can still interact with the chat and the rest of the UI — no scrim or overlay intercepts pointer events elsewhere on the page, and no `dialog` role is rendered merely by the panel being visible (a `dialog` SHALL only ever appear as the deliberate, user-triggered close-confirmation described below)

#### Scenario: Multiple concurrent exports each get their own row

- **GIVEN** the user starts exporting three different conversations before any of them finishes
- **WHEN** the queue panel renders
- **THEN** all three appear as separate rows, each reflecting only its own status

#### Scenario: Aggregate progress reflects finished-vs-total jobs

- **GIVEN** 4 jobs are in the queue and 2 have finished (success or failed)
- **WHEN** the queue panel renders
- **THEN** its aggregate progress indicator shows a 50% determinate value

#### Scenario: Collapsing the panel hides job rows, not the panel itself

- **WHEN** the user activates the collapse toggle
- **THEN** the individual job rows are hidden while the header (and its expand toggle) remain visible

#### Scenario: Queue panel disappears once every job is dismissed

- **WHEN** the last remaining job is dismissed
- **THEN** the queue panel is removed entirely

---

### Requirement: Dismissing exports cancels in-progress work

An **in-progress** job row SHALL expose a per-row close control that dismisses that job; dismissing it SHALL abort the underlying in-flight request(s) (via `AbortController`/`AbortSignal` threaded through the `getConversation`/`listConversations`/`downloadFile` server-api wrappers) — no partial work SHALL continue in the background, and no file SHALL be downloaded for a dismissed job. **Success** and **failed** rows SHALL NOT expose a per-row close control; finished jobs are cleared through the panel-level close control in the header, which dismisses **all** jobs at once (aborting any that are still in progress). Because a finished job has no per-row close, the queue is emptied via the panel-level close rather than by removing rows one by one. The `ImportExportQueue` component itself only calls the `onDismiss`/`onClose` callbacks the app supplies; aborting the underlying request is the app-level `useConversationExport` hook's responsibility, not the component's.

#### Scenario: Dismissing an in-progress job cancels the underlying work

- **GIVEN** a job is in progress (e.g. mid-attachment-fetch or mid-conversation-listing)
- **WHEN** the user clicks its per-row close control
- **THEN** the in-flight request(s) for that job are aborted, the job's row is removed, and no file is ever downloaded for it

#### Scenario: Finished jobs have no per-row close control

- **GIVEN** a job has status success or failed
- **THEN** its row exposes no per-row close control (a failed row exposes only its retry control)

#### Scenario: The panel-level close clears the whole queue

- **GIVEN** every job in the queue has finished (success or failed) with none in progress or failed
- **WHEN** the user activates the panel-level close control in the header
- **THEN** every job is removed immediately (no confirmation), any still-in-progress request is aborted, and the panel disappears

---

### Requirement: Confirming panel-level close when work would be lost

Activating the panel-level close control SHALL clear the queue immediately, without confirmation, only when every job has already succeeded. If at least one job is still **in progress** or has **failed**, activating the panel-level close control SHALL first show the `ImportExportQueue` component's own confirmation dialog (`role="dialog"`) asking the user to confirm, since closing would abort in-progress work or discard the record of a failure the user has not yet retried or acknowledged. Confirming clears the queue exactly as described above; cancelling the confirmation dismisses only the dialog and leaves the queue untouched. This confirmation is the one deliberate, user-triggered exception to the panel's otherwise non-modal design (see the queue-panel requirement above), and it is rendered by the library component itself, driven by the `labels` object the app supplies.

#### Scenario: Closing an all-succeeded queue needs no confirmation

- **GIVEN** every job in the queue has status success
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

The queue panel SHALL close itself automatically 8 seconds after the last job in it settles, but only when **every** job has status success — matching the no-confirmation-needed condition above. If any job is still **in progress** or is (or becomes) **failed** at any point during that 8-second window, the auto-close SHALL NOT fire; the panel then stays open until the user closes it manually (going through the confirmation flow above when applicable). This applies to both the import queue and the export queue, since both render the same `ImportExportQueue` component with independent props.

#### Scenario: All jobs succeed and the user takes no action

- **GIVEN** every job in the queue has status success
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the queue panel closes itself automatically

#### Scenario: A failed job blocks auto-close

- **GIVEN** the queue contains at least one job with status failed
- **WHEN** 8 seconds pass with no user interaction
- **THEN** the panel does NOT auto-close; it remains open until the user closes it manually

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

A job with status **failed** SHALL expose a retry control (finished rows have no per-row close control). Activating retry SHALL re-attempt the export with the exact same parameters (same conversation id/title/mode for a single export; a fresh `listConversations` pass for export-all) **reusing the same job id** — the row updates in place back to in-progress rather than a new row being appended. The retry control itself is rendered by the `ImportExportQueue` component and only invokes the app-supplied `onRetry` callback; the app's `useConversationExport` hook performs the actual re-attempt.

#### Scenario: Retrying a failed single-conversation export reruns it in place

- **GIVEN** a job for conversation "Dynamic Weather Elements" has status failed
- **WHEN** the user activates its retry control
- **THEN** the same job id transitions back to in-progress and the export is re-attempted with the same conversation id, title, and mode

#### Scenario: A successful retry updates the existing row, not a new one

- **GIVEN** a retried job eventually succeeds
- **WHEN** the queue panel re-renders
- **THEN** there is still exactly one row for that export, now showing success

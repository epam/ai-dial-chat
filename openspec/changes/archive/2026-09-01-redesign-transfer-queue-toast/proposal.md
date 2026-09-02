## Why

The conversation import/export queue toast shipped with a placeholder layout: rows are labelled
by **conversation title**, progress is a single aggregate linear bar that only counts *settled
jobs* (so a lone long-running export sits at 0% until it is finished), cancelling a job erases
its row without trace, and a failure offers a bare retry icon with no indication of what went
wrong. The new design replaces all four with a file-oriented row that shows what the user is
actually waiting for — the file being written or read, its real completion percentage, and, on
failure, the reason.

## What Changes

- **BREAKING** (library API) — `ImportExportQueue` rows become **file**-oriented: each row renders
  a file-type icon, the transfer's file name truncated with an ellipsis tooltip, and a fixed
  trailing status slot. The conversation title / folder-breadcrumb row layout is removed, along
  with `labels.allConversationsJobLabel` and the `onRetry` prop.
- **BREAKING** (shared model) — `ConversationTransferJob` gains `fileName: string`,
  `progress: ConversationTransferProgress` (`{ completed: number; total: number }`), and an
  optional `errorCode`; `ConversationTransferJobStatus` gains a `Canceled` member.
- Per-row activity indication — the UI kit `Spinner` on each in-flight row, replacing the queue's
  single aggregate linear bar. A monotonic `progress` contract driven by real unit counts
  (conversation fetch + each attachment download/upload + archive build) is computed by the hooks
  and carried on the job, but the row does not render it. This departs from the Figma frame's
  "PAY ATTENTION" note that the loader be determinate; the kit ships no determinate ring, and
  reusing its `Spinner` was chosen over owning a bespoke one here.
- Cancelling an in-progress transfer is now distinct from dismissing it: the row's cancel control
  is revealed on row hover / keyboard focus, aborts the work, and leaves the row in place showing
  a `Canceled` label with the file name dimmed. `dismissJob` (remove from list) stays available
  to the host but is no longer wired to a row control.
- Failed rows show a filled alert icon whose tooltip carries a host-translated failure reason,
  resolved through a new `labels.jobErrorMessage(code)` callback. The retry control is removed
  from the row (`retryJob` remains on the hooks' public API).
- The header title becomes count-based (`"Exporting 1 file"` / `"Exporting 3 files"`), composed by
  the app via `t(key, { count })`; the component still receives a plain `title: string`.
- Applies to **both** directions — `useConversationImport` reports progress and file names on the
  same contract as `useConversationExport`.
- `libs/conversation-panel` adds no indicator of its own — the row renders `Spinner` from
  `@epam/ai-dial-ui-kit`, whose colors come from the kit's own theme tokens. The queue's
  `--cp-transfer-queue-*` custom properties keep their names and gain no progress entries.

## Capabilities

### New Capabilities

- `conversation-transfer-progress`: the determinate progress contract — what one progress unit
  means for each transfer kind, when `total` is known, how `completed` advances, and how a job
  reaching a terminal status settles its progress.

### Modified Capabilities

- `conversation-panel-transfer-queue-ui`: the queue stays in `libs/conversation-panel`, and its
  contract is reshaped in place — file-oriented rows, a per-row kit `Spinner`,
  hover-revealed but keyboard-reachable cancel, `Canceled` rendering, the error message on the
  alert icon, and the reshaped props/labels. The conversation-title/breadcrumb row and the
  aggregate progress bar are removed.
- `chat-hooks-conversation-transfer`: the queue primitive gains `cancelJob` and progress
  reporting; `addJob` takes a file name; jobs carry `errorCode` alongside the existing
  structured error events.
- `conversation-export`: export jobs are named by their output file name at enqueue time,
  report determinate progress, and end in `Canceled` rather than disappearing; "Retrying a
  failed export job" is no longer reachable from the queue row.
- `conversation-import`: import jobs are named by the selected file, report determinate
  progress, and share the same cancellation semantics.

## Impact

- `libs/chat-shared/src/models/conversation-transfer.ts` — `ConversationTransferJob`,
  `ConversationTransferJobStatus`, new `ConversationTransferProgress`.
- `libs/chat-hooks/src/conversation/conversation-transfer/queue.ts` — `cancelJob`,
  `setJobProgress`, `addJob(subject, fileName, total)`.
- `libs/chat-hooks/src/conversation/useConversationExport/`,
  `libs/chat-hooks/src/conversation/useConversationImport/` — progress instrumentation around
  the existing `runWithConcurrency` attachment loops; `errorCode` written onto the job.
- `libs/conversation-panel/src/components/ImportExportQueue/` — row and header rewritten; the
  reshaped `libs/conversation-panel/src/models/import-export-queue.ts` props/labels and the new
  `libs/conversation-panel/src/utils/transfer-file.ts` icon mapping sit beside it.
- `libs/conversation-panel/src/index.ts` — `getTransferFileIcon` joins the existing queue exports.
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — labels object,
  count-based title, `onCancel` wiring; `apps/chat/src/constants/translation-keys.ts` and
  `apps/chat/src/i18n/locales/*.json` — new keys, removed `RetryJobAriaLabel` /
  `AllConversationsJobLabel`.
- READMEs for `libs/chat-shared`, `libs/chat-hooks`, `libs/conversation-panel`, plus the
  three-layer paragraph in `docs/architecture.md` (`npm run validate:docs`).
- No backend, no new endpoint, no feature flag.

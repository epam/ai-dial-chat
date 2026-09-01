## Why

The conversation import/export queue toast shipped with a placeholder layout: rows are labelled
by **conversation title**, progress is a single aggregate linear bar that only counts *settled
jobs* (so a lone long-running export sits at 0% until it is finished), cancelling a job erases
its row without trace, and a failure offers a bare retry icon with no indication of what went
wrong. The new design replaces all four with a file-oriented row that shows what the user is
actually waiting for — the file being written or read, its real completion percentage, and, on
failure, the reason.

## What Changes

- **BREAKING** (library ownership) — `ImportExportQueue` and its new `CircularProgress` indicator
  move from `@epam/ai-dial-conversation-panel` to `@epam/ai-dial-chat-shared`, beside the
  `ConversationTransferJob` contract they render. A host can then show transfer progress without
  taking on the panel's `react-window` and `@epam/ai-dial-sidebar` dependencies — the concrete
  driver being `pg-chat`, which wants the toast but not the conversation sidebar. No compatibility
  re-export is left behind, per `remove-cross-package-reexports`.
- **BREAKING** (library API) — `ImportExportQueue` rows become **file**-oriented: each row renders
  a file-type icon, the transfer's file name truncated with an ellipsis tooltip, and a fixed
  trailing status slot. The conversation title / folder-breadcrumb row layout is removed, along
  with `labels.allConversationsJobLabel` and the `onRetry` prop.
- **BREAKING** (shared model) — `ConversationTransferJob` gains `fileName: string`,
  `progress: ConversationTransferProgress` (`{ completed: number; total: number }`), and an
  optional `errorCode`; `ConversationTransferJobStatus` gains a `Canceled` member.
- Per-row **determinate** circular progress, driven by real unit counts (conversation fetch +
  each attachment download/upload + archive build), replacing the aggregate linear bar. The
  Figma frame calls this out explicitly: the loader must show real progress, not spin.
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
- `libs/chat-shared` gains a determinate `CircularProgress` (the UI kit ships only `ProgressBar`,
  a linear indicator). The queue's CSS custom properties are renamed `--cp-transfer-queue-*` →
  `--ieq-*` and the ring's `--cprog-*`, since `--cp-` no longer stands for "conversation panel".

## Capabilities

### New Capabilities

- `transfer-queue-ui`: the `ImportExportQueue` and `CircularProgress` component contracts, now
  owned by `libs/chat-shared` — file-oriented rows, per-row determinate progress, hover-revealed
  but keyboard-reachable cancel, `Canceled` rendering, the error message on the alert icon, and the
  reshaped props/labels.
- `conversation-transfer-progress`: the determinate progress contract — what one progress unit
  means for each transfer kind, when `total` is known, how `completed` advances, and how a job
  reaching a terminal status settles its progress.

### Modified Capabilities

- `conversation-panel-transfer-queue-ui`: **every requirement is removed** — the capability's
  subject moved out of `libs/conversation-panel`. Its contract is restated, redesigned, under the
  new `transfer-queue-ui` capability.
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
- `libs/chat-shared/src/components/ImportExportQueue/` and `.../CircularProgress/` — moved from
  `conversation-panel`, with the row and header rewritten; `libs/chat-shared/src/models/import-export-queue.ts`
  props/labels and `libs/chat-shared/src/utils/transfer-file.ts` move with them.
- `libs/conversation-panel/src/index.ts` — the queue exports are removed; the lib keeps the
  virtualized panel and `RenameConversationPopup`.
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — labels object,
  count-based title, `onCancel` wiring; `apps/chat/src/constants/translation-keys.ts` and
  `apps/chat/src/i18n/locales/*.json` — new keys, removed `RetryJobAriaLabel` /
  `AllConversationsJobLabel`.
- READMEs for `libs/chat-shared`, `libs/chat-hooks`, `libs/conversation-panel`
  (`npm run validate:docs`).
- No backend, no new endpoint, no feature flag.

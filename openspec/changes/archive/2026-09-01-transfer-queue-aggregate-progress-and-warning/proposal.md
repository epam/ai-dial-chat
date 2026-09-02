## Why

The design for the "export all conversations" notification carries an explicit
instruction — *"Loader should be determinate, which means that it should show a
real loading progress, not just spin around"* — and shows a queue row state the
code cannot currently reach. Two gaps follow:

1. **Nothing renders progress.** `redesign-transfer-queue-toast` (archived
   2026-09-01) replaced the aggregate bar with a per-row indeterminate `Spinner`
   and recorded that as a requirement. But the data was never removed:
   `ConversationTransferProgress.percent` still describes itself as "always
   determinate … renderable as a real percentage from its first frame" and is
   computed, monotonic, and phase-weighted on every job. When the user collapses
   the toast, the rows — and with them every indication that work is still
   moving — disappear entirely, leaving a title and two buttons.

2. **The warning row is unreachable.** `ConversationTransferWarningEvent` and
   `ConversationTransferWarningCode.AttachmentSkipped` already exist, and the
   export hook emits a warning when attachments are skipped from the archive.
   It then immediately calls `queue.succeedJob(jobId)`, so the job settles as
   `Success` and shows a blue check. A partially-complete export is currently
   indistinguishable from a clean one.

## What Changes

- Render a determinate aggregate `ProgressBar` under the queue header **while
  the queue is collapsed**. Expanded state is unchanged — per-row spinners
  already convey activity there, and the design shows the bar only on the
  collapsed toast.
- Restore the `progressTrack` / `progressIndicator` color tokens and their
  `buildCssVars` entries to `ImportExportQueueColors`, removed by task 11.2 of
  the archived change.
- **BREAKING** (`@epam/ai-dial-chat-shared`): add `Warning` to
  `ConversationTransferJobStatus`. Consumers that exhaustively switch on the
  status will no longer compile until they handle the new member.
- **BREAKING** (`@epam/ai-dial-conversation-panel`): `ImportExportQueueLabels`
  gains three required members — `jobWarningMessage(code)`,
  `queueProgressAriaLabel`, and `queueProgressValueText(completed, total)`.
  Hosts must supply them.
- Carry `warningCode` on `ConversationTransferJob` beside the existing
  `errorCode`, and settle warned jobs through a new `queue.warnJob(jobId, code)`
  instead of `succeedJob`.
- Render the warned row with an amber triangle whose accessible name is the
  warning reason, mirroring the existing `Failed` treatment.
- Define how a warned job scores against the queue's aggregate rules: it is
  terminal, is **not** a clean success, and does not count as a failure.
- Fix the failed-count badge's text color. It falls back to `--text-tertiary`
  (`#848e9c`), a muted token for text on a plain background, painted over the
  `--bg-control-error` (`#ae2f2f`) fill — a 1.95:1 contrast ratio. The
  design system's on-control token `--text-control-permanent` (`#fcfcfc`)
  brings it to 6.30:1.

### Decisions on warning semantics

A warned job completed its work, so treating it as a failure would overstate the
problem, while treating it as a clean success is what this change exists to fix.
It therefore resolves as follows:

| Aggregate rule                              | A warned job…                                     |
| ------------------------------------------- | ------------------------------------------------- |
| Failed-count badge                          | is **not** counted — nothing failed               |
| Close confirmation (`hasInProgress`/`hasFailed`) | raises no confirmation — its work is done    |
| Success-only 8s auto-close (`isEverySucceeded`) | **suppresses** auto-close                     |
| Aggregate progress percent                  | contributes its settled percent, like any terminal job |

Suppressing auto-close is the load-bearing choice: a warning that vanishes after
eight seconds is a warning the user never read.

## Capabilities

### New Capabilities

None. All three affected capabilities already have specs.

### Modified Capabilities

- `conversation-transfer-progress`: the requirement "Progress is a contract on
  the job, not rendered by the queue" currently forbids rendering `percent` in
  any form. Narrow it: still never rendered per row, but rendered as the
  collapsed-state aggregate.
- `conversation-panel-transfer-queue-ui`: aggregate progress returns, scoped to
  the collapsed state (the archived change removed the previous, unscoped
  "Aggregate progress, collapse/expand, and failed-count badge" requirement).
  Adds the warning row state and the warned-job aggregate rules above.
- `chat-hooks-conversation-transfer`: warning events now settle a job into a
  `Warning` status carrying its `warningCode`, rather than into `Success`.

## Impact

**Libraries**

- `libs/chat-shared/src/models/conversation-transfer.ts` — `Warning` member,
  `warningCode` field.
- `libs/chat-hooks/src/conversation/conversation-transfer/queue.ts` — `warnJob`.
- `libs/chat-hooks/src/conversation/useConversationExport/useConversationExport.ts`
  — call `warnJob` instead of `succeedJob` at the `AttachmentSkipped` site
  (~line 346).
- `libs/conversation-panel/` — `ImportExportQueue` (aggregate value, collapsed
  gating, new CSS vars), `ImportExportQueueHeader` (the bar),
  `ImportExportQueueRow` (amber triangle), `models/import-export-queue.ts`
  (labels, colors), `ImportExportQueue.module.scss` (warning + progress classes).

The per-row `Spinner` is explicitly **out of scope** and stays as it is.

**Application**

- `apps/chat` — supply the three new labels and the warning/progress colors;
  add `en.json` strings and `translation-keys.ts` entries.

**Dependencies**

`ProgressBar` (design system 2.0) from `@epam/ai-dial-ui-kit`, at
`size={ElementSize.Small}` (4px). Already a dependency; no new packages.

**Docs**

`libs/conversation-panel/README.md`, `libs/chat-shared/README.md`, and
`libs/chat-hooks/README.md` document the changed enum and label surface, so all
three need updating in the same change (`npm run validate:docs`).

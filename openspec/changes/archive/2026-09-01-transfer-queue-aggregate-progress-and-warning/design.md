## Context

`ImportExportQueue` is a controlled, labels-driven toast owned by
`libs/conversation-panel`. It receives `jobs` and renders a header (title,
failed-count badge, collapse toggle, close) over a scrollable list of rows, one
per transferred file.

`redesign-transfer-queue-toast` (archived 2026-09-01) reshaped it around files
and real progress, but its task 11.2 removed every rendered form of that
progress: the `progressTrack` / `progressIndicator` colors, their `buildCssVars`
entries, the `.progressRing` class, and the `jobProgressValueText` label, in
favour of a per-row indeterminate `Spinner`. The synced spec records this as
*"Progress is a contract on the job, not rendered by the queue"*.

The computation survived intact. `ConversationTransferProgress` still documents
itself as *"always determinate — there is no indeterminate state, so a job is
renderable as a real percentage from its first frame"*, with `percent` clamped
0–100, monotonically non-decreasing per job id, and advanced through fixed
kind-specific phase weights. So this change renders a value that is already
correct; it does not compute a new one.

Warnings are similarly half-built. `ConversationTransferWarningEvent` and
`ConversationTransferWarningCode.AttachmentSkipped` exist, and
`useConversationExport` emits a warning when `buildDialArchive` reports skipped
attachment paths — then calls `queue.succeedJob(jobId)` on the next line
(`useConversationExport.ts:346-353`). The event reaches the host's toast, but
the job itself settles as `Success`, so the queue row shows a blue check.

## Goals / Non-Goals

**Goals:**

- Show real, determinate progress on the collapsed toast, where no per-row
  indicator is visible.
- Make a partially-complete transfer visibly distinct from a clean one.
- Keep every host-owned string and color outside `libs/*`.

**Non-Goals:**

- Changing the per-row `Spinner`. The design's determinate-loader note applies
  to the batch toast header; the row keeps its indeterminate spinner and its
  hover-revealed cancel control exactly as they are.
- Rendering a numeric percentage as visible text. The bar is the readout; the
  numbers reach assistive technology through `aria-valuetext`.
- Reviving the collapse/expand or failed-count-badge requirements that the
  archived change folded into newer ones — only aggregate progress returns.
- New warning *reasons*. Both export and import already emit
  `AttachmentSkipped` and both are converted to the new status; no additional
  `ConversationTransferWarningCode` member is introduced.

## Decisions

### The bar renders only while collapsed

The design shows the bar under the toast whose chevron points **up**, which in
`ImportExportQueueHeader` is the collapsed state
(`isCollapsed ? IconChevronUp : IconChevronDown`). That placement is the whole
justification: expanded, every row already carries its own spinner and file
name, so an aggregate bar would restate what is on screen. Collapsed, the rows
are unmounted and the toast otherwise shows no sign that work continues.

Gating on `isCollapsed` rather than rendering it always also keeps the expanded
toast identical to the shipped design, so this change cannot regress it.

The bar renders only when at least one job is still `InProgress`. A collapsed
toast whose jobs have all settled shows no bar — a full bar sitting under a
finished queue reads as "still working".

### `ProgressBar` from the UI kit, not a bespoke element

`ProgressBar` is the design system 2.0 component for this
(`size={ElementSize.Small}` = 4px, matching the design's hairline). It already
resolves its own accessible name and derives the announced percentage from
`value` / `max`, so a hand-rolled `role="progressbar"` would only reintroduce
a11y details the kit has solved.

### Aggregate value is the unweighted mean of `job.progress.percent`

```
Math.round(jobs.reduce((sum, job) => sum + job.progress.percent, 0) / jobs.length)
```

Every job contributes, terminal ones at their settled percent — `succeedJob`
already writes `TRANSFER_PROGRESS_COMPLETE`, and `cancelJob` / `failJob` freeze
the percent where it stopped. Weighting by conversation count or byte size was
rejected: neither is known when the queue is built, so a weighted bar would jump
as discovery refined the weights, and per-job `percent` is *already* internally
phase-weighted.

Monotonicity is per job, not per queue: enqueuing a fresh job into a queue of
finished ones legitimately drops the mean. That is correct — the queue as a
whole is genuinely less complete than it was.

### Warning is a job status, not only an event

`ConversationTransferJobStatus` gains `Warning = 'warning'` and
`ConversationTransferJob` gains `warningCode?: ConversationTransferWarningCode`,
beside the existing `errorCode`. The queue gains:

```ts
warnJob(jobId: string, warningCode: ConversationTransferWarningCode): void
```

which settles the job the way `succeedJob` does — `percent` to
`TRANSFER_PROGRESS_COMPLETE`, `errorCode` cleared — but with
`status: Warning` and the code attached. `useConversationExport` calls it
instead of `succeedJob` at the `AttachmentSkipped` site. The existing
`onWarning` callback still fires: hosts that render their own toast keep working
unchanged.

Keeping the code on the job (rather than only in the event) is what lets the row
name its own icon. The row never sees the event stream.

`warnJob` refuses to settle a job that is no longer `InProgress`. This is
deliberately stricter than its siblings: `updateJob` merges unconditionally, so
`succeedJob` and `failJob` would happily relabel a canceled row, and only
`setJobProgress` guards on status today. Call sites currently cover the gap with
`if (signal.aborted) return`, but a warning is raised *after* the transfer body
has finished and is the likeliest of the three to land late, so it carries its
own guard rather than relying on every caller to remember. Extending the same
guard to `succeedJob` and `failJob` is a worthwhile follow-up and is out of
scope here.

### A warned job is terminal, not a failure, and blocks auto-close

Restating the proposal's table as the rule the code implements: `failedCount`
and the close-confirmation branches continue to test `Failed` only, so a warned
job neither inflates the badge nor demands confirmation on close. But
`isEverySucceeded` must test `Success` **exclusively**, which it already does —
the point is that adding `Warning` to the enum must not tempt an
`isTerminal`-style predicate that folds the two together. An eight-second
auto-close would dismiss the warning before it was read.

### Colors and strings stay host-supplied

Three tokens return to or join `ImportExportQueueColors` —
`progressTrack`, `progressIndicator`, `warningIcon` — each mapped to a
`--cp-transfer-queue-*` CSS variable through `buildCssVars` and consumed from
`ImportExportQueue.module.scss`. Hardcoded Tailwind color classes are not an
option here; per the repo's theming rule, a lib with `buildCssVars` theming
routes every color through a scss module class backed by a CSS variable.

`ImportExportQueueLabels` gains three members, all host-built:

| Member                                    | Purpose                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `jobWarningMessage(code)`                 | Warning row's accessible name and tooltip      |
| `queueProgressAriaLabel`                  | Names the bar — never the kit's "Progress" fallback |
| `queueProgressValueText(completed, total)`| `aria-valuetext`, e.g. "3 of 10 files done"    |

`queueProgressValueText` takes settled and total job counts rather than the
percent: "3 of 10 files" is a more useful reading than "36%" when the underlying
work is a file list. The lib passes numbers and renders the returned string; it
never builds one.

### Row rendering mirrors `Failed`

The amber triangle (`IconAlertTriangleFilled`) sits in the same
`STATUS_SLOT_CLASS` slot, wrapped in the same `Tooltip`, with
`role="img"` + `aria-label={labels.jobWarningMessage(job.warningCode)}` and
`tabIndex={0}`. The existing comment on the `Failed` branch explains why the
name is on the element and not only in the tooltip — a tooltip renders nothing
on a mobile screen — and that reasoning applies identically here.

`IconAlertTriangleFilled` is a filled glyph, so it takes no `stroke` prop, the
same way the existing `IconAlertCircleFilled` does not.

## Risks / Trade-offs

**The mean misrepresents unequal jobs.** Ten conversations and one 500-page
archive advance the bar at the same rate. Accepted: the alternative needs
weights that are not known at enqueue time, and the bar's job is to show that
work is moving, not to predict a completion time.

**Two breaking changes in one release.** The new enum member breaks exhaustive
switches, and the three required label members break every `ImportExportQueue`
caller. Both are compile-time failures with an obvious fix, and `apps/chat` is
the only in-repo caller. Making the labels optional with English defaults was
rejected — it would put untranslated strings in a lib, against the repo's i18n
rule.

**The spec reverses a decision recorded eight days' work ago.** The narrowing is
deliberate and stated as such in the delta: per-row progress rendering stays
forbidden, and only the collapsed aggregate is carved out. Anyone reading the
history should be able to see that the reversal is scoped, not a reversion of
the whole redesign.

**`onSuccess` still fires for a warned export.** The existing single-conversation
path calls `onSuccess` and `onWarning` together, and this change keeps that so
hosts rendering their own toasts are unaffected. It does mean a warned job
reports through both callbacks — surprising read, but changing it would alter
notification behaviour beyond this change's scope.

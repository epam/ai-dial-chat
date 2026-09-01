## Context

`ImportExportQueue` (at the time of writing in `libs/conversation-panel`, moved to
`libs/chat-shared` by Decision 4) is a controlled, labels-driven panel fed by two
hooks in `libs/chat-hooks` — `useConversationExport` and `useConversationImport` — that share the
`useConversationTransferQueue` primitive. Today a job is `{ id, subject, status }` where `subject`
is a conversation (`{ kind: Single, title, sourceBreadcrumb? }` or `{ kind: All }`). The panel
renders one row per job labelled by that title, plus a single aggregate `ProgressBar` whose value
is `settledJobs / totalJobs` — for the overwhelmingly common single-job case that is 0% or 100%
and nothing in between.

The new design reframes the row around the **file** rather than the conversation, and demands a
determinate per-row ring. Both hooks already loop over attachments through `runWithConcurrency`
with a known ref list, so real completion counts are available; they are simply never reported.

Constraints that shape the solution:

- `libs/chat-shared` sits at the base of the lib graph — it may take the UI kit and Tabler as
  peers (it already does, for `CopyButton`, `DeploymentIcon` and friends) but may not import another
  workspace lib. Neither it nor `conversation-panel` may reach i18n; every user-visible string
  arrives through `labels`.
- `@epam/ai-dial-ui-kit` ships `ProgressBar` (linear) only — there is no circular indicator
  (confirmed via the kit's MCP catalogue).
- The in-flight `remove-cross-package-reexports` change forbids compatibility re-export shims, so
  any symbol that moves packages must have its importers updated directly.
- WCAG 2.1 AAA: a control that only exists on hover is unreachable by keyboard.

## Goals / Non-Goals

**Goals:**

- One row per transferred file, identified by the file's own name, with a truncation tooltip.
- A determinate ring that starts moving on the first unit of work and never runs backwards.
- Cancellation that leaves visible evidence (`Canceled`) instead of erasing the row.
- A failure that tells the user *why*, in their language, without the lib knowing any language.
- Identical semantics for import and export, on one shared contract.

**Non-Goals:**

- Byte-level progress. Rejected in favour of unit-level (see Decision 1); `downloadFileRaw` /
  `uploadFile` on the generated client expose no stream or `Content-Length` hook.
- Changing the export file-name template (`conversation-export` spec, "Exported files use a
  deterministic name built from a fixed template"). See Open Questions.
- Promoting `CircularProgress` into `@epam/ai-dial-ui-kit` (separate repository/release train).
- Redesigning the separate success/failure notification toasts, which stay as they are.
- Any backend change, new endpoint, or feature flag.

## Decisions

### 1. Progress is a monotonic weighted percentage, with an optional unit readout

```ts
// libs/chat-shared/src/models/conversation-transfer.ts
export enum ConversationTransferUnitKind {
  Attachment = 'attachment',
  Conversation = 'conversation',
}

export interface ConversationTransferProgress {
  /** 0–100. Monotonically non-decreasing for the life of a job. */
  percent: number;
  /** Optional readout for `aria-valuetext`; absent while the count is unknown. */
  units?: {
    completed: number;
    total: number;
    kind: ConversationTransferUnitKind;
  };
}
```

**Why not `{ completed, total }` in raw work units.** The attachment count is unknown until the
conversation has been fetched. A job that starts at `1/1` and then learns it has ten attachments
would jump from 100% back to 9% — the one thing a determinate ring must never do. Fixed phase
weights avoid the problem entirely: the phase boundaries are known at enqueue time, and only the
*subdivision* of the transfer phase is discovered later.

Phase weights (constants in `libs/chat-hooks/src/conversation/conversation-transfer/progress.ts`):

| Transfer                        | Prepare          | Transfer                  | Finalize                   |
| ------------------------------- | ---------------- | ------------------------- | -------------------------- |
| Export single, no attachments   | 20 — fetch conv. | —                         | 80 — serialize + download  |
| Export single, with attachments | 15 — fetch conv. | 70 — per attachment down. | 15 — build ZIP + download  |
| Export all                      | 20 — list pages  | 70 — per conversation get | 10 — serialize + download  |
| Import                          | 10 — parse file  | 70 — per attachment up.   | 20 — per conversation save |

A phase with zero discovered units is skipped: its whole weight is credited at once, so an
attachment-free `.dial` export still runs 15 → 85 → 100 rather than stalling.

**Why not indeterminate until the count is known.** The Figma frame carries an explicit
"PAY ATTENTION" note that the loader must be determinate. An indeterminate opening frame would
violate it for exactly the case the design illustrates.

`percent` is clamped and `Math.max`-ed against the previous value inside `setJobProgress`, so a
concurrency race between two attachment callbacks cannot produce a backwards step. On reaching
`Success` the queue writes `percent: 100`; `Failed` and `Canceled` freeze the last value (the ring
is not rendered in those states anyway).

### 2. `Canceled` is a terminal status, distinct from dismissal

`ConversationTransferJobStatus` gains `Canceled`. The queue primitive gains:

```ts
cancelJob: (jobId: string) => void; // abort + keep the row, status = Canceled
dismissJob: (jobId: string) => void; // abort + remove the row  (unchanged)
```

`cancelJob` aborts the controller, drops it from `controllersRef`, and patches the job — it does
**not** drop the retry function, so `retryJob` still works on a cancelled job for hosts that want
it. Every `if (signal.aborted) return` guard already in both hooks keeps the aborted run from
writing a competing status afterwards.

Consequences for the two panel-level behaviours:

- **Close confirmation** — `Canceled` needs none: the user already chose to stop that work and
  nothing further is lost. Confirmation stays gated on `InProgress || Failed`.
- **Auto-close** — `Canceled` *suppresses* the 8-second auto-close, like `Failed`. A row the user
  never gets to read is worse than a toast that waits for an explicit dismiss.

### 3. The error reason travels as a code on the job; the host translates it

`ConversationTransferErrorCode` moves from `libs/chat-hooks/.../types.ts` to
`libs/chat-shared/src/models/conversation-transfer.ts`, joining the other UI-facing transfer
contracts that spec `chat-hooks-conversation-transfer` §"UI-facing transfer contract ownership"
already places there. `chat-hooks` imports it from `chat-shared` and its own importers are updated
at the call site — no compatibility re-export, per `remove-cross-package-reexports`.

The job gains `errorCode?: ConversationTransferErrorCode`, written next to `status: Failed` in
every existing failure branch (the `onError` event is unchanged and still carries
`titles`/`traceId` for the separate notification toast). The panel renders the tooltip text
returned by a new label callback:

```ts
jobErrorMessage: (code: ConversationTransferErrorCode) => string;
```

This keeps the lib translation-free while letting the app render the design's
"Export failed. File is too large".

A new code `FileTooLarge` backs that copy. It is raised in two places during an attachment
export: eagerly, when the summed attachment byte length exceeds `maxArchiveBytes` (a
`useConversationExport` param defaulting to a documented constant), and defensively, when
`buildDialArchive` throws a `RangeError` from a failed buffer allocation. Failing eagerly matters
— the alternative is the browser tab dying mid-zip with no toast at all.

**Sizing `maxArchiveBytes`.** The limit is applied to the *summed input* bytes, but the constraint
it guards is *peak heap*, and the current pipeline amplifies input roughly threefold. All
attachments are held simultaneously as `ZipAttachmentEntry.data`; `zipSync` then allocates an
output buffer of comparable size (attachments are typically already-compressed media, so the ZIP
barely shrinks); and `buildDialArchive` copies that output once more via
`new Uint8Array(zipped)` before handing it to `Blob`. All three are live at the same moment.

The default is therefore **512 MiB**, which puts peak allocation near 1.5 GiB — inside a typical
64-bit desktop tab's budget, and far enough from the ceiling that a mobile browser is not
guaranteed to die. A cap anywhere near the ~2 GiB `ArrayBuffer` ceiling would be the wrong number:
that ceiling constrains a single buffer, not the three the pipeline holds at once.

`zipSync` also blocks the main thread, so a several-hundred-megabyte archive freezes the UI for
seconds regardless of whether it completes. That is a second, independent argument for a
conservative default. Moving to `zipAsync` in a worker (or a streaming ZIP writer) is the real fix
and is out of scope here; the cap is a guardrail against tab death, not a product policy about how
much a user may export.

### 4. `CircularProgress` and the queue are built in `libs/chat-shared`

Two concentric SVG `<circle>`s, the foreground driven by `stroke-dasharray` / `stroke-dashoffset`,
rotated `-90deg` so the sweep starts at twelve o'clock. It carries `role="progressbar"` with
`aria-valuenow` / `aria-valuemin` / `aria-valuemax`, an `aria-label` supplied by the caller, and
`aria-valuetext` when the caller passes one.

**Direction.** The ring is *not* mirrored in RTL. It is a symmetric indicator, which `AGENTS.md`
§RTL explicitly exempts, and a counter-clockwise progress ring reads as *undoing* work in every
locale.

**Why not the kit's `ProgressBar`.** It is linear; the design's row has a 20px square status slot
with no horizontal room, and swapping in a bar would change the row's whole geometry.

**Why `chat-shared` rather than `conversation-panel`.** `conversation-panel` depends on
`react-window` and peers on `@epam/ai-dial-sidebar`; a host that wants the transfer toast and
nothing else would take both on. `chat-shared` already owns the `ConversationTransferJob` contract
the queue renders, already ships presentational components (`CopyButton`, `DeploymentIcon`,
`PanelEmptyState`, …), and already peers on the UI kit — so the queue and its ring sit beside the
model they present, with no new dependency edge. (The `AGENTS.md` line describing `chat-shared` as
"interfaces and types only" is stale relative to the code and is not a constraint this change can
honour or violate.) The CSS custom properties are renamed accordingly: `--cp-transfer-queue-*` →
`--ieq-*` and the ring's own `--cprog-*`, matching the short-prefix convention the other
`chat-shared` stylesheets use (`--pes-*`, `--rs-*`).

**Why local rather than a UI-kit contribution.** `@epam/ai-dial-ui-kit` lives in a separate
repository on its own release cadence; blocking this change on a kit release is not warranted.
Recorded as a follow-up in Open Questions.

### 5. Hover-to-cancel is implemented as opacity, not conditional mounting

The ring and the cancel button occupy the same CSS grid cell of the status slot, so switching
between them shifts nothing. The button is **always mounted and focusable**; visibility is driven
by `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` on the row's `group`, with
the ring taking the inverse. Conditionally mounting the button on `onMouseEnter` would make cancel
unreachable by keyboard, which fails the AAA target the repo sets.

### 6. The file name is resolved at enqueue, not at completion

`buildExportFileName(kind, EXPORT_APP_NAME)` moves from the download call to the `addJob` call and
its result is threaded to `triggerBlobDownload`, so the row shows the true final name from frame
one rather than a placeholder. `addJob` becomes
`addJob(subject: ConversationTransferSubject, fileName: string)`. For import the file name is
simply `file.name`.

`subject` is retained — it still carries the conversation titles the success/failure
*notification* toasts interpolate — but the panel no longer reads it, and
`labels.allConversationsJobLabel` is deleted.

### 7. The file-type icon is derived from the extension

A pure `getTransferFileIcon(fileName)` in `libs/chat-shared` maps `.dial`/`.zip` to
`IconFileZip` and `.json` to `IconJson`, with `IconFile` as the fallback. Tabler only, per the
project's "no inline SVGs" rule; the DIAL-branded document glyph in the Figma frame has no Tabler
equivalent and is deferred as a design-asset task.

## Risks / Trade-offs

- **Weighted percentage is an approximation.** One 400 MB attachment and one 4 KB attachment each
  advance the ring by the same slice, so the ring can sit still for a long time inside the
  transfer phase. → Mitigated by the `units` readout ("3 of 10 attachments") surfaced through
  `aria-valuetext` and available to the host for a visible caption later. Byte-level progress was
  considered and ruled out: the generated client returns a whole `Response`, not a stream.
- **Moving `ConversationTransferErrorCode` across packages touches every importer** in
  `chat-hooks` and `apps/chat`. → It is a mechanical import-path rewrite caught by `tsc`; the
  no-shim rule from `remove-cross-package-reexports` makes doing it directly the correct move
  rather than a risk to route around.
- **Dropping the row-level retry control** removes the only in-panel recovery path for a failed
  export. → `retryJob` stays on both hooks' public API, so the host can re-expose it; and the
  design's error tooltip tells the user what to change, which the bare retry icon never did. The
  `conversation-export` spec's "Retrying a failed export job" requirement is amended, not deleted.
- **A cancelled job now pins the toast open** until the user dismisses it. → Deliberate (Decision
  2); a `Canceled` row the user never sees defeats the point of keeping it.
- **`maxArchiveBytes` is a guess until measured.** Set too low it blocks legitimate exports; too
  high it lets the tab die anyway. → Exposed as a hook parameter so the host can tune it without a
  library release, and sized against the pipeline's ~3× amplification rather than the
  `ArrayBuffer` ceiling (Decision 3). One cheap way to buy headroom later: drop the redundant
  `new Uint8Array(zipped)` copy in `buildDialArchive` — `Blob` accepts the `Uint8Array` fflate
  already returned — which removes a third of the peak. Not done here, since it is unrelated to
  this change's surface.

## Migration Plan

No data migration and no persisted state — the queue lives entirely in React state for the
lifetime of the page. The change ships as one release across `chat-shared` → `chat-hooks` →
`conversation-panel` → `apps/chat`, in that dependency order, each slice verified with
`npm run verify:changed`. Consumers outside this workspace — `pg-chat` is the known one — must move
their `ImportExportQueue` import from `@epam/ai-dial-conversation-panel` to
`@epam/ai-dial-chat-shared` and rename any `--cp-transfer-queue-*` CSS override to `--ieq-*` when
they pick up the new package versions. Rollback is a straight revert; nothing outside the workspace consumes
these packages at the changed versions.

## Resolved Questions

1. **Export file-name template — unchanged.** The `conversation-export` spec's
   `<YYYY-MM-DD>_<appName>_<kind>.<ext>` stands, and `buildExportFileName` is not touched beyond
   being called earlier (Decision 6). The Figma frame's
   `epam_ai_dial_chat_with_attachments_08_28.dial` differs in two ways, and neither is a template
   change:
   - The `epam_` prefix is the **app-name part**, not new template structure. The spec already says
     that part "SHALL be resolved at the app edge and passed into the pure util as a plain string",
     and `EXPORT_APP_NAME = 'ai_dial'` carries a comment saying it is a placeholder until an app
     display-name config exists. The frame is showing a configured tenant; the code is showing the
     documented fallback. When app-name config lands, the frame's string is what this template
     already produces.
   - The trailing `08_28` loses the year and is ambiguous between `MM_DD` and `DD_MM`.
     `YYYY-MM-DD` first is the better engineering choice regardless: it sorts lexicographically in
     a downloads folder, it is unambiguous in every locale, and it mirrors legacy `development`'s
     `getCurrentDate` so files exported from old and new chat interleave correctly.
2. **Default `maxArchiveBytes` — 512 MiB.** Rationale in Decision 3: the pipeline holds roughly 3×
   the input bytes at peak, so the cap is sized against heap budget, not the `ArrayBuffer` ceiling.
3. **Branded file glyph — out of scope.** Stay on Tabler's generic file icons (Decision 7); the
   DIAL document glyph is a separate design-asset task.

## Open Questions

1. **`CircularProgress` in the UI kit.** Worth proposing upstream once the shape settles here, so
   the next consumer does not build a third ring.

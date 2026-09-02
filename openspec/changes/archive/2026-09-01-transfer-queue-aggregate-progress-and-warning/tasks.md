# Tasks

Each numbered section is one slice. Verify with
`npm run test:file -- <path>` during the red/green loop and
`npm run verify:changed` at the end of a slice.

## 1. Warning becomes a job status (`libs/chat-shared`)

- [x] 1.1 Add `Warning = 'warning'` to `ConversationTransferJobStatus` in
      `libs/chat-shared/src/models/conversation-transfer.ts`.
- [x] 1.2 Add `warningCode?: ConversationTransferWarningCode` to
      `ConversationTransferJob`, beside the existing `errorCode`. The code enum lives in
      `libs/chat-hooks`; move it to `chat-shared` alongside `ConversationTransferErrorCode` so
      `chat-shared` does not import from `chat-hooks` (type:shared imports nothing), and re-export
      it from `chat-hooks` for existing import paths.
- [x] 1.3 Update `libs/chat-shared/README.md` for both the enum member and the new field.

## 2. `warnJob` in the transfer queue (`libs/chat-hooks`)

- [x] 2.1 Add `warnJob(jobId, warningCode)` to
      `libs/chat-hooks/src/conversation/conversation-transfer/queue.ts`, mirroring `succeedJob`:
      status `Warning`, `progress.percent` at `TRANSFER_PROGRESS_COMPLETE`, `warningCode` set,
      `errorCode` cleared. It must go through the same `updateJob` already-settled guard.
- [x] 2.2 Expose it on the hook's return value and its result type.
- [x] 2.3 Tests in `conversation-transfer/tests/queue.spec.ts`: a warned job settles with the code
      and a complete percent; `warnJob` against an already-`Canceled` job is discarded.

## 3. Export emits the warned status (`libs/chat-hooks`)

- [x] 3.1 In `useConversationExport.ts` (~line 346), call `queue.warnJob(jobId, AttachmentSkipped)`
      instead of `queue.succeedJob(jobId)` at the skipped-attachment site. Keep the existing
      `onWarning?.()` call — hosts rendering their own toast must be unaffected.
- [x] 3.2 (Done: neither the `WithoutAttachments` path nor `exportAll` can skip an attachment — `exportAll` builds its envelope with an empty attachment list — so only the one site changed. Import DID have an equivalent site and was converted too.) Check the `exportAll` path for an equivalent skipped-attachment site and apply the same
      treatment if one exists; if it does not, note that in the slice so it is a deliberate omission
      rather than an oversight.
- [x] 3.3 Tests in `useConversationExport/tests/useConversationExport.spec.ts`: an export with
      skipped attachments settles the job at `Warning` with the code, still downloads the archive,
      and still calls `onWarning`.
- [x] 3.4 Update `libs/chat-hooks/README.md` for `warnJob` and the changed warning outcome.

## 4. Colors and labels (`libs/conversation-panel`)

- [x] 4.1 Add `warningIcon` to `ImportExportQueueColors` in `models/import-export-queue.ts`, with
      its `buildCssVars` entry (`--cp-transfer-queue-warning-icon`) in `ImportExportQueue.tsx`.
      (Revised during apply: `progressTrack`/`progressIndicator` were dropped. The kit's
      `ProgressBar` puts `className` on its track only and paints its fill with its own
      `bg-control-accent` token, so overriding them would mean styling kit internals to restate
      theming the kit already does correctly.)
- [x] 4.2 Add the matching classes to `ImportExportQueue.module.scss`. No hardcoded Tailwind color
      classes — the lib routes color through CSS variables.
- [x] 4.3 Add `jobWarningMessage(code)`, `queueProgressAriaLabel`, and
      `queueProgressValueText(completed, total)` to `ImportExportQueueLabels`. All three are
      required; do not give them English defaults inside the lib.
- [x] 4.4 Fix the failed-count badge's text color in `ImportExportQueue.module.scss`. Its
      `--cp-transfer-queue-failure-count-text` fallback chain currently ends at
      `var(--text-tertiary, #848e9c)` — a muted grey meant for text on a plain background, sitting
      on the `--bg-control-error` (`#ae2f2f`) fill. That is a 1.95:1 contrast ratio. Change the
      fallback to `var(--text-control-permanent, #fcfcfc)`, the design system's token for text on
      a filled control, which brings it to 6.30:1.

## 5. The warned row (`libs/conversation-panel`)

- [x] 5.1 Render a `Warning` branch in `ImportExportQueueRow.tsx` using
      `IconAlertTriangleFilled`, mirroring the existing `Failed` branch: same `STATUS_SLOT_CLASS`,
      same `Tooltip`, `role="img"` + `aria-label={labels.jobWarningMessage(job.warningCode)}` +
      `tabIndex={0}`. Filled glyphs take no `stroke` prop.
- [x] 5.2 Confirm a warned row renders no cancel control and no success check.
- [x] 5.3 Tests: the warned row's reason is reachable without hovering.

## 6. The collapsed aggregate bar (`libs/conversation-panel`)

- [x] 6.1 Add an arrow-function helper computing the rounded mean of `progress.percent` across all
      jobs. Co-locate it with the component's other helpers.
- [x] 6.2 Render `ProgressBar` (`@epam/ai-dial-ui-kit`, `size={ElementSize.Small}`) beneath the
      header, only when `isCollapsed` **and** at least one job is `InProgress`. Pass
      `labels.queueProgressAriaLabel` as its name and
      `labels.queueProgressValueText(settledCount, jobs.length)` as `aria-valuetext`.
- [x] 6.3 Confirm no percentage is rendered as visible text.
- [x] 6.4 Verify `isEverySucceeded` still tests `Success` exclusively so a `Warning` job suppresses
      the 8s auto-close, and that `failedCount` and the close-confirmation branches still test
      `Failed` only so a warned job neither inflates the badge nor demands confirmation.
- [x] 6.5 Tests in `ImportExportQueue/tests/ImportExportQueue.spec.tsx`: bar present collapsed with
      work in flight and absent expanded; absent collapsed once nothing is `InProgress`; correct
      mean; `aria-valuetext` comes from the label; a `Warning` job blocks auto-close, is excluded
      from the failed badge, and closes without confirmation.
- [x] 6.6 Update `libs/conversation-panel/README.md` for the new labels, colors, and the bar.

## 7. Host wiring (`apps/chat`)

- [x] 7.1 Supply the three new labels in both the export and import label objects, and the three
      new colors.
- [x] 7.2 Add `en.json` strings and `translation-keys.ts` entries. `queueProgressValueText` needs
      plural forms (`_one`/`_other`) the way `queueTitle` already does.
- [x] 7.3 Add a warning message string for `AttachmentSkipped`.
- [x] 7.4 Update `ConversationPanelView.spec.tsx` if the new `role="progressbar"` collides with its
      existing queue-panel queries.

## 8. Verification

- [x] 8.1 `npm run verify:changed`. All 27 frontend projects typecheck; lint is 0 errors across the
      four changed projects; tests green (chat-shared 320, conversation-panel 133, chat-hooks 1395,
      chat 2012). The one failing task, `@epam/chat-api:typecheck`, is pre-existing and unrelated —
      it arrived with the `development` merge, and `chat-api` imports nothing from `chat-shared`.
- [x] 8.2 `npm run validate:docs` — introduces no new failure. The single reported problem
      (`libs/chat-hooks/README.md` documents `useGridEditingScroll` as a `chat-hooks` export when it
      lives in `chat-shared`) is pre-existing on both `development` and this branch.
- [x] 8.3 Contrast measured. **The failed-count badge is fixed**: its text went from `#848e9c` on
      the `#ae2f2f` fill (1.95:1) to `#fcfcfc` (6.30:1) — WCAG AA, though short of the 7:1 the
      project targets for AAA normal text. No darker `control-error*` background exists in the
      design system, so 7:1 is unreachable on a filled red badge without a new token.
      **Unresolved: the amber warning icon is `--text-warning-icon` (`#eec840`), which is 1.58:1 on
      the `#fcfcfc` queue background — it fails even the 3:1 that WCAG 1.4.11 asks of a meaningful
      graphic.** It is the design system's own warning token and matches the Figma frame, and the
      icon carries an `aria-label`, so nothing is lost to a screen reader — but it is genuinely
      hard to see. Needs a designer/kit decision: a darker warning token (`--text-visual-brown-2`,
      `#b45309`, measures 4.89:1) or a filled/outlined treatment. Not changed unilaterally here.
- [ ] 8.4 Check the collapsed bar under `dir="rtl"` — it must fill from the inline start. Not
      verifiable in jsdom; fold into 8.5.
- [ ] 8.5 Real-browser pass of the collapsed toast and the warned row on `mobile` and `desktop`.
      Needs a running DIAL Core and an authenticated session, which this environment has no access
      to.
- [ ] 8.6 Run the five-axis review from `.claude/skills/code-review-and-quality/SKILL.md` before
      opening the PR.

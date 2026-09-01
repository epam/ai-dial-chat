## 0. Preconditions

Decisions 1–3 below are settled — see design.md §Resolved Questions. They are listed so the
implementer does not re-open them.

- [x] 0.1 File-name template stays `<YYYY-MM-DD>_<appName>_<kind>.<ext>`. The frame's `epam_` prefix is the app-name part that `EXPORT_APP_NAME` already stands in for, not a template change. `buildExportFileName` and `formatDateYMD` are not modified.
- [x] 0.2 `maxArchiveBytes` defaults to 512 MiB, sized against the pipeline's ~3× peak amplification.
- [x] 0.3 Tabler's generic file icons; no branded DIAL glyph in this change.
- [x] 0.4 `remove-cross-package-reexports` has already landed in code — `libs/chat-hooks/src/index.ts` re-exports nothing from `chat-shared`. The `chat-hooks-conversation-transfer` delta was corrected to require direct imports instead of a barrel re-export.

## 1. Shared contracts (`libs/chat-shared`)

- [x] 1.1 Add `Canceled` to `ConversationTransferJobStatus` in `libs/chat-shared/src/models/conversation-transfer.ts`.
- [x] 1.2 Add `ConversationTransferUnitKind` (`Attachment`, `Conversation`) and `ConversationTransferProgress` (`{ percent; units? }`) with JSDoc stating the 0–100 range and the monotonicity guarantee.
- [x] 1.3 Move `ConversationTransferErrorCode` from `libs/chat-hooks/src/conversation/conversation-transfer/types.ts` into `conversation-transfer.ts`, adding the new `FileTooLarge` member.
- [x] 1.4 Extend `ConversationTransferJob` with `fileName: string`, `progress: ConversationTransferProgress`, and `errorCode?: ConversationTransferErrorCode`.
- [x] 1.5 Export every new name from `libs/chat-shared/src/index.ts` and update `libs/chat-shared/README.md`.
- [x] 1.6 Verified with `nx run @epam/ai-dial-chat-shared:typecheck` and `npm run validate:docs`. No model spec added: `chat-shared` is types-only, so a test here would only assert enum literals; the progress rules (clamp, monotonicity, terminal settling) are behaviour of the queue and are tested in slice 3.

## 2. Progress arithmetic (`libs/chat-hooks`)

- [x] 2.1 Create `libs/chat-hooks/src/conversation/conversation-transfer/progress.ts` holding the per-kind phase-weight table from the design and a pure `computePercent(phase, completedUnits, totalUnits)` helper. Include the zero-unit case that credits a phase's whole weight at once.
- [x] 2.2 Unit-test `computePercent` against every row of the weight table, including 0 attachments, 1 attachment, and the import 10/70/20 split.
- [x] 2.3 Verify: `npm run test:file -- libs/chat-hooks/src/conversation/conversation-transfer/tests/progress.spec.ts`.

## 3. Queue primitive (`libs/chat-hooks`)

- [x] 3.1 Change `addJob(subject, fileName)` in `queue.ts` to seed `progress: { percent: 0 }` and `fileName`.
- [x] 3.2 Add `setJobProgress(jobId, progress)` that clamps `percent` to 0–100 and discards any write lower than the stored value.
- [x] 3.3 Add `cancelJob(jobId)`: abort the controller, delete it from `controllersRef`, keep the retry fn, patch status to `Canceled`. Leave `dismissJob` unchanged.
- [x] 3.4 Add `failJob(jobId, errorCode)` (or extend the existing `updateJob` calls) so every failure branch records `errorCode`; make `Success` force `percent: 100` and `retryJob` reset `percent` to 0 and clear `errorCode`.
- [x] 3.5 Update `ConversationTransferQueue`'s JSDoc to state the cancel-vs-dismiss distinction.
- [x] 3.6 Extend `libs/chat-hooks/src/conversation/conversation-transfer/tests/queue.spec.ts` (add if absent) to cover: cancel keeps the row, cancel aborts, progress never decreases, progress clamps, success forces 100, retry resets.
- [x] 3.7 Verify: `npm run test:file` on the queue spec.

## 4. Export hook (`libs/chat-hooks`)

- [x] 4.1 In `useConversationExport`, call `buildExportFileName(...)` at enqueue and pass it to `addJob`; thread the same string into `triggerBlobDownload` instead of rebuilding it.
- [x] 4.2 Report prepare-phase progress after `getConversation` / after the `listConversations` loop.
- [x] 4.3 Report transfer-phase progress inside `fetchAttachments`' `runWithConcurrency` callback (one unit per settled attachment, whether downloaded or skipped) and inside the export-all per-conversation loop, setting `units` accordingly.
- [x] 4.4 Add the `maxArchiveBytes` param defaulting to `DEFAULT_MAX_ARCHIVE_BYTES = 512 * 1024 * 1024`, with a JSDoc note that the bound is on summed *input* bytes because the pipeline holds ~3× that at peak; fail with `FileTooLarge` before calling `buildDialArchive` when the sum exceeds it, and map a `RangeError` out of `buildDialArchive` to `FileTooLarge` rather than `Unknown`.
- [x] 4.5 Write `errorCode` on the job in every existing failure branch; leave the `onError` events untouched.
- [x] 4.6 Expose `cancelJob` from `UseConversationExportResult`.
- [x] 4.7 Extend `useConversationExport.spec.ts`: progress sequence for a 3-attachment export, zero-attachment export jumps the transfer phase, cancel mid-download produces no `triggerBlobDownload` and no `onSuccess`, oversized archive fails as `FileTooLarge` without calling `buildDialArchive`.
- [x] 4.8 Verify: `npm run test:file` on the export hook spec.

## 5. Import hook (`libs/chat-hooks`)

- [x] 5.1 Pass `file.name` to `addJob`.
- [x] 5.2 Report the 10/70/20 prepare/upload/save progress split, setting `units` to `Attachment` during uploads and `Conversation` during saves.
- [x] 5.3 Write `errorCode` on the job in every failure branch and expose `cancelJob` from `UseConversationImportResult`.
- [x] 5.4 Extend `useConversationImport.spec.ts` with the progress sequence, the cancel-keeps-the-row case, and the `MissingBucket` `errorCode` assertion.
- [x] 5.5 Update `libs/chat-hooks/README.md` for the new return values, params, and the moved `ConversationTransferErrorCode` import path; run `npm run validate:docs`.
- [x] 5.6 `npm run verify:changed` run. chat-shared/chat-hooks typecheck, lint, and tests are green; the only failure is `@epam/ai-dial-conversation-panel:typecheck` on `ImportExportQueue.spec.tsx` job fixtures now missing `fileName`/`progress` — expected, and fixed by slice 7 which rewrites that suite. Re-checked at 7.10.

## 6. `CircularProgress` (`libs/conversation-panel`)

- [x] 6.1 Create `libs/conversation-panel/src/components/CircularProgress/CircularProgress.tsx` — two SVG circles, `stroke-dasharray`/`stroke-dashoffset`, `-90deg` rotation, `role="progressbar"` with `aria-valuenow`/`min`/`max`, required `aria-label`, optional `aria-valuetext`.
- [x] 6.2 Add `CircularProgress.module.scss` with `--cp-circular-progress-track` / `--cp-circular-progress-indicator` CSS vars and app-theme + hex fallbacks, matching the existing `ImportExportQueue.module.scss` pattern.
- [x] 6.3 Confirm no `rtl:` mirroring is applied, and add the RTL non-flip assertion to the tests.
- [x] 6.4 Write `tests/CircularProgress.spec.tsx`: arc length for 0/25/100, `aria-valuenow` wiring, `aria-valuetext` present only when supplied, accessible name required.
- [x] 6.5 Export it from `libs/conversation-panel/src/index.ts` and document it in that lib's `README.md`.

## 7. `ImportExportQueue` rewrite (`libs/conversation-panel`)

- [x] 7.1 Reshape `models/import-export-queue.ts`: drop `onRetry`, `allConversationsJobLabel`, `retryJobAriaLabel`, and the `jobDescriptionClassName` typography hook; add `onCancel`, `cancelJobAriaLabel(fileName)`, `canceledLabel`, `jobErrorMessage(code)`, `jobProgressAriaLabel(fileName)`, `jobProgressValueText(units)`, plus the new canceled/progress color and typography overrides.
- [x] 7.2 Add a pure `getTransferFileIcon(fileName)` mapping `.dial`/`.zip` → `IconFileZip`, `.json` → `IconJson`, else `IconFile`, each rendered with `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`.
- [x] 7.3 Rewrite `JobRow`: leading file icon, `EllipsisTooltip` on `job.fileName`, and the four-state trailing slot (ring, check, alert-with-`Tooltip`, `Canceled` text). Dim the file name in the canceled state via a scss-module class, not a hardcoded Tailwind color.
- [x] 7.4 Implement the hover-reveal cancel: `group` on the row, ring and button in one grid cell, `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` — the button stays mounted and focusable in all cases.
- [x] 7.5 Remove the aggregate `ProgressBar` from the header and render `title` verbatim.
- [x] 7.6 Update the close-confirmation predicate to `InProgress || Failed` (canceled no longer requires confirmation) and the auto-close predicate to "every job `Success`" (canceled now suppresses it).
- [x] 7.7 Audit every directional utility in the rewritten markup for `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`, and confirm no icon in the row is flipped.
- [x] 7.8 Rewrite `tests/ImportExportQueue.spec.tsx` to cover every scenario in the `conversation-panel-transfer-queue-ui` delta, including the keyboard-reachability of cancel and the absence of any control on settled rows.
- [x] 7.9 Update `libs/conversation-panel/README.md` for the new props/labels and run `npm run validate:docs`.
- [x] 7.10 Verify: `npm run verify:changed`.

## 8. App wiring and i18n (`apps/chat`)

- [x] 8.1 In `apps/chat/src/constants/translation-keys.ts`: remove `RetryJobAriaLabel` and `AllConversationsJobLabel`; add `CancelJobAriaLabel`, `CanceledLabel`, `JobProgressAriaLabel`, `JobProgressAttachments`, `JobProgressConversations`, and one key per `ConversationTransferErrorCode` member, in both `ConversationExportI18nKeys` and `ConversationImportI18nKeys`.
- [x] 8.2 Change `QueueTitle` in both key sets to a `_one`/`_other` pluralized pair and pass `{ count: jobs.length }` at the call site.
- [x] 8.3 Add English defaults to `apps/chat/src/i18n/locales/en.json`, including "Export failed. File is too large" for `FileTooLarge`, and mirror the key set into every other locale file.
- [x] 8.4 Rebuild both `ImportExportQueueLabels` objects in `ConversationPanelView.tsx`, wire `onCancel` to each hook's `cancelJob`, and delete the `onRetry` wiring.
- [x] 8.5 Suppress the failure toast for a user-initiated cancellation, and add the `FileTooLarge` branch to the export failure notification.
- [x] 8.6 Update the app-level wiring test to assert a translated string from the new label set renders.
- [x] 8.7 `npm run verify:changed` green: typecheck 15s, lint 107s, tests 402s, all passing.

## 10. Move the queue into `libs/chat-shared`

Driven by `pg-chat`, which wants the transfer toast without `conversation-panel`'s `react-window`
and `@epam/ai-dial-sidebar` dependencies.

- [x] 10.1 Move `CircularProgress/`, `ImportExportQueue/`, `models/import-export-queue.ts`, and `utils/transfer-file.ts` (with both test suites) from `libs/conversation-panel` to `libs/chat-shared`.
- [x] 10.2 Rewrite the moved files' imports: package specifiers (`@epam/ai-dial-chat-shared`) become relative paths (`../../models/conversation-transfer`, `../../utils/build-css-vars`, `../../utils/merge-class`), and the queue's spec stops mocking the package it now lives in.
- [x] 10.3 Rename the CSS custom properties: `--cp-transfer-queue-*` → `--ieq-*`, `--cp-circular-progress-*` → `--cprog-*`, matching the short-prefix convention of the other `chat-shared` stylesheets.
- [x] 10.4 Drop the queue exports from `libs/conversation-panel/src/index.ts` and add them to `libs/chat-shared/src/index.ts`. No compatibility re-export, per `remove-cross-package-reexports`.
- [x] 10.5 Point `apps/chat` at the new source: `ImportExportQueue` and `ImportExportQueueLabels` now come from `@epam/ai-dial-chat-shared`.
- [x] 10.6 Move the README sections from `libs/conversation-panel/README.md` into `libs/chat-shared/README.md` under Components, retargeting the import package and the CSS-var names; update `docs/architecture.md`'s three-layer paragraph.
- [x] 10.7 Restructure the spec deltas: `conversation-panel-transfer-queue-ui` becomes an all-`REMOVED` delta with per-requirement Reason/Migration, and the contract is restated under a new `transfer-queue-ui` capability owned by `chat-shared`.
- [x] 10.8 Verify: `npm run verify:changed` and `npm run validate:docs`.

## 9. Documentation and final verification

- [x] 9.1 `docs/architecture.md` three-layer paragraph updated: `chat-shared` now also owns the determinate-progress contract and the `ConversationTransferErrorCode` taxonomy, and `conversation-panel` owns `CircularProgress` alongside `ImportExportQueue`.
- [ ] 9.2 **Not done — needs a human or an E2E run.** Reaching the queue in a real browser needs a running DIAL Core plus an authenticated session, which this environment has no access to. Check the four row states, hover-to-cancel, `mobile`/`desktop`, and `dir="rtl"` before merge.
- [ ] 9.3 **Partially covered by tests, still needs a real-browser pass.** `ImportExportQueue.spec.tsx` reaches the cancel control by three `userEvent.tab()` presses and activates it with Enter, so keyboard reachability is asserted in jsdom; confirm focus order and the absence of a trap in a real browser as part of 9.2.
- [x] 9.4 `npm run verify:changed` is fully green (typecheck, lint, tests across every affected project). `npm run verify:full` additionally fails on `@epam/chat-api` and `mcp-app-sandbox` — 796 typecheck errors that reproduce identically on a stashed clean tree, so they pre-date this change and are untouched by it. `npm run validate:docs` reports only the pre-existing `useGridEditingScroll` drift in `libs/chat-hooks/README.md`, also present on a clean tree.
- [ ] 9.5 Run the five-axis review from `.claude/skills/code-review-and-quality/SKILL.md` before opening the PR.

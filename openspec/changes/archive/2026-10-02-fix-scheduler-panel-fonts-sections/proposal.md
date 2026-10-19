## Why

GitHub issue #9047: in a scheduled task conversation's sources panel, the typography of the History/Details fields and file sections does not match the panel design — fonts jump between 16px, 14px and 10px, the History run rows carry thin right-aligned status icons, the accordion titles sit at the wrong height, and the files/sources sections sit one gutter left of the task accordions.

## Problem

- `ScheduledTaskDetailsSummary` rendered field values at `dial-body-text` (16px) beside labels at `dial-tiny-text` (12px), and the skill value used a template-literal class concat.
- `ScheduledTaskRunHistoryList` rows: status icons right-aligned at 16px/1.5-stroke (thin, unclear at that size), asymmetric padding (`pe-2` end-only plus a SCSS start-padding override that fought the utilities), and viewed/unviewed rows shared one timestamp class, so unread rows were not visually distinct.
- The kit `Accordion` title is hardcoded `dial-body-text` (line-height 24): a nested inline title span can never shrink the line box below that strut, so the 12/16 design title rendered ~24px tall.
- `FilesSection`/`SourcesSection` in `libs/source-panel` sat at the body's 16px gutter while host accordions add the kit's own `px-4` on top (32px) — and the lib had no style channel to close that gap.
- `ConversationSourcesPanelContainer` owned History, Details, and panel-composition logic in one ~480-line component.

## What Changes

- **History rows** (`libs/scheduled-tasks`): status icon moves to the row start at 19px with Tabler-native stroke 2 (`RUN_STATUS_ICON_SIZE`/`RUN_STATUS_ICON_STROKE` local constants, design-approved exceptions to the kit token scale); the unread dot moves to a fixed slot at the row end; pill padding `px-3` (Figma `Spacing-03` = 12px); viewed timestamps `dial-small-paragraph-text` (14/24), not-viewed bold `dial-small-paragraph-semi-text` via the new `runTimestampUnreadClassName` typography prop (threaded through `ScheduledTaskHistorySection` with a 14/20-consistent default).
- **Details** (`libs/scheduled-tasks`): `ScheduledTaskDetailsSummary` field labels default `dial-tiny-text text-secondary` (#57647A), values `dial-small-text` (14/20); instructions markdown renders at 14/20 via a custom `MarkdownRendererClassNames` in the app's `TaskDetailsSection`.
- **Section headings** (app): accordion titles render as `dial-tiny-semi-text block truncate py-1` — the `block` escapes the kit title span's `dial-body-text` strut so the 12/16 line-height applies, and `py-1` grows the element to the design's 24px; the History accordion content start inset is 12px via `contentClassName="ps-3"` (Tailwind generates `.ps-3` after the kit's `.px-4`, so it wins).
- **Section alignment** (`libs/source-panel`): new optional `styles.sectionClassName` merged onto each files/sources section root — the lib default is unchanged; the app passes `px-4` to line the sections up with the task accordions.
- **Container split** (app): `TaskHistorySection` and `TaskDetailsSection` components own their accordion, expanded/reset-on-schedule-change state, mapping, and labels; the container is the single context consumer passing data slices as props. Props, not context reads inside the memoized sections, because a memo'd section reading the plain-function context mocks never re-renders in tests, making the reset untestable.
- The **Process section from the issue is dropped**: the DIAL Scheduler writes no per-stage data for scheduled runs (run DTO carries only status/start/end/conversation_id/result.stage), so the stepper the mockup shows has no data source.

## Capabilities

### New Capabilities

- `scheduled-task-panel-sections`: the History and Details sections of a task conversation's sources panel — their typography, run-row layout, title metrics, expanded/reset state ownership, and the host-driven alignment of the files/sources sections with the task accordions.

## Non-goals

- A Process section (scheduler writes no stage data — issue scope narrowed to fonts; do not re-add without a Scheduler contract change).
- Per-schedule file attachments (no DTO/form/backend support exists).
- File-card typography (stays `dial-caption-text`).
- The pre-existing chat test failures from the ui-kit bump (`AvatarShape`/`Badge` mocks) — separate fix.

## Alternatives considered

- Nested inline title span with the typography class only — rejected: the kit's `dial-body-text` strut pins the line box at 24px; `block` display is the minimal escape.
- Sections reading contexts directly (no props) — rejected: untestable under memo with plain-function context mocks; the container-as-single-consumer shape is also lower coupling.
- Hardcoding `px-4` into the published `source-panel` sections — rejected (code-review finding): every other host would get an un-overridable double indent; a style channel with an unchanged default carries the host decision at the app edge.

## Rollback

Non-breaking. Revert the commit; the `source-panel` and `scheduled-tasks` lib defaults are unchanged for hosts that never pass the new props, and the new props (`sectionClassName`, `runTimestampUnreadClassName`) are additive. No API, DTO, or i18n-key additions remain (the `processTitle` key was removed with the Process section).

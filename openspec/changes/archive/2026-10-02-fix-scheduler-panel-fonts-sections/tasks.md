Slicing strategy: **vertical** — each slice ships a self-contained piece of the panel redesign and is independently verifiable by its own spec run.

## 1. Lib typography defaults

- [x] 1.1 `ScheduledTaskDetailsSummary`: value default `dial-body-text` → `dial-small-text`; labels default `dial-tiny-text text-secondary`; skill-value template literal → `mergeClasses`; JSDoc updated.
  - Verification: `npm exec nx test @epam/ai-dial-scheduled-tasks`
- [x] 1.2 `ScheduledTaskRunHistoryList`: `runTimestampClassName` default → `dial-small-paragraph-text`; new `runTimestampUnreadClassName` (default `dial-small-paragraph-semi-text`) applied to `isUnread` rows; JSDoc updated.
  - Verification: `npm exec nx test @epam/ai-dial-scheduled-tasks`

## 2. Run-row layout

- [x] 2.1 Move the status icon to the row start at 19px / stroke 2 (`RUN_STATUS_ICON_SIZE`, `RUN_STATUS_ICON_STROKE`); unread dot to a fixed slot at the row end; pill `px-3`; delete the `.rowLayout` SCSS start-padding override.
  - Verification: `npm exec nx test @epam/ai-dial-scheduled-tasks`
- [x] 2.2 Thread `runTimestampUnreadClassName` through `ScheduledTaskHistorySection` (default `dial-small-semi-text`).
  - Verification: `npm exec nx test @epam/ai-dial-scheduled-tasks`

## 3. Section components (app)

- [x] 3.1 Split the container into `TaskHistorySection` / `TaskDetailsSection` (own accordion + reset state, mapping, labels; container = single context consumer passing props).
  - Verification: `npm exec nx test @epam/chat --testPathPattern ConversationSourcesPanel`
- [x] 3.2 Titles as `dial-tiny-semi-text block truncate py-1`; History `contentClassName="ps-3"`; Instructions markdown via custom `MarkdownRendererClassNames` at 14/20.
  - Verification: `npm exec nx test @epam/chat --testPathPattern ConversationSourcesPanel`
- [x] 3.3 Section specs with reset coverage (`TaskHistorySection/tests`, `TaskDetailsSection/tests`); remove the redundant `inert` wrappers (kit Accordion already inerts its collapsed region).
  - Verification: `npm exec nx test @epam/chat --testPathPattern "TaskHistorySection|TaskDetailsSection"`

## 4. source-panel style channel

- [x] 4.1 Add `styles.sectionClassName` (default none) threaded to both `FilesSection` and `SourcesSection` roots; app passes `px-4`; README documents the field.
  - Verification: `npm exec nx test @epam/ai-dial-source-panel`

## 5. Full verification

- [x] 5.1 `npm exec nx test @epam/ai-dial-scheduled-tasks` (287), `@epam/ai-dial-source-panel`, chat panel + section specs; `npm exec nx lint` on all touched projects; `npm run validate:docs`.

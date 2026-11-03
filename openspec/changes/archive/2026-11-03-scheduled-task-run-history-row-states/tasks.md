Slicing strategy: **risk-first, then vertical**. Slice 1 checks the highest-risk assumption: that the kit `Accordion` can be styled as the design's row pill (design D1). Slice 2 builds the full accordion in the lib. Slice 3 threads the new label through every wrapper and both app hosts, end to end. Slice 4 covers docs and the final checks.

## 1. Spike: kit Accordion as a row pill (decides D1)

- [x] 1.1 In `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx`, render an expandable row (`status === Error` and non-empty `errorText`) as `<li><Accordion caretPosition={AccordionCaretPosition.End} …>`. Put the status icon, timestamp and duration in `title`. Style the header pill through `headerClassName` and `ScheduledTaskRunHistoryList.module.scss`. Use the doubled-class selector where it must beat the kit's own hover utility.
- [x] 1.2 Compare the result against the states frame in the issue comment for:
  - pill height, radius and padding;
  - 12px caret footprint and end inset;
  - timestamp alignment against a plain row;
  - timestamp typography.

  **Outcome: D1 fallback adopted.** The kit caret is a fixed `IconChevronRight` (right when collapsed, down when expanded; the design is down/up), and the content has a fixed `pt-3` gap. Props can change neither, so `design.md` D1/D6 were updated. Record the outcome on this line: kit path kept, or the D1 fallback (native `<button aria-expanded aria-controls>` + `grid-template-rows` transition + `inert`) adopted. If you fall back, update D1 and D6 in `design.md` in the same slice.
- **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`. Existing tooltip tests are expected to fail here; 2.5 replaces them.

## 2. Lib: row states and failed-run accordion

- [x] 2.1 In `libs/scheduled-tasks/src/models/scheduled-task-run-history-list-props.ts`, add these optional fields, each with JSDoc stating its default:
  - `ScheduledTaskRunHistoryListLabels.openConversationLabel` (default `'Open conversation'`)
  - `ScheduledTaskRunHistoryListColors.errorDetailsTextColor` (fallback `--text-secondary`)
  - `ScheduledTaskRunHistoryListTypography.errorDetailsClassName` (default `'dial-tiny-text'`)
  - `ScheduledTaskRunHistoryListStyles.rowExpandedBackground` (default `--bg-control-accent-alpha-active`)

  Also rewrite the `errorText` JSDoc in `libs/scheduled-tasks/src/models/scheduled-task-run-item.ts`: the text is revealed in the row's expandable details, it is not part of the accessible name, and it is ignored for every status other than `Error`.
- [x] 2.2 In `ScheduledTaskRunHistoryList.tsx`:
  - Add `useState<Set<string>>` for expanded run ids. Use a `handleToggle` handler; it never calls `onRunClick`.
  - Remove the error `Tooltip` and the `tabIndex` on the icon wrapper.
  - Remove `errorText` from `accessibleName`, and pass that name as the `Accordion` `ariaLabel`.
  - Render the details region: `errorText` with `errorDetailsClassName`, plus `whitespace-pre-wrap wrap-break-word`, inset to the timestamp's start edge.
  - When `conversationId` is set and `onRunClick` is supplied, render a kit `LinkButton` labelled `labels.openConversationLabel ?? 'Open conversation'` that calls `onRunClick(run)`.
  - In the end slot, show the chevron on expandable rows and the unread dot otherwise (D6).
  - Drop `max-w-[328px]` from the row and skeleton classes so the pill fills the card.
- [x] 2.3 In `ScheduledTaskRunHistoryList.module.scss`:
  - Add `.errorDetailsText` (`var(--strhl-error-details-text, var(--text-secondary, #57647a))`).
  - Add the expanded-header background (`var(--strhl-row-expanded-bg, var(--bg-control-accent-alpha-active, #2764d933))`).
  - Apply hover and `:focus-visible` to the Accordion header as well as `.interactiveRow`, with focus = hover + outline.
  - Add a `prefers-reduced-motion: reduce` override for the region's transition if the kit doesn't already provide one.

  In the component, map `--strhl-error-details-text` and `--strhl-row-expanded-bg` in `buildCssVars`. Each var must have both a setter and a reader.
- [x] 2.4 RTL: use only logical utilities (`px-3`, `ps-*`, `text-start`) in the new markup. Leave the chevron unmirrored. Add a `dir="rtl"` test asserting that the status icon precedes the timestamp and that the end slot is last in DOM order, with no `rtl:scale-x` on the chevron.
- [x] 2.5 In `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`, replace the two tooltip tests. Cover each scenario of the delta spec using role, name and text queries:
  - collapsed with `aria-expanded="false"`, and an accessible name without the error text;
  - click, Enter and Space toggle the row; `onRunClick` is not called;
  - collapsed content is not reachable (`inert`);
  - the "Open conversation" link calls `onRunClick` exactly once, and is absent without `conversationId` or without `onRunClick`;
  - `Error` without `errorText` is not expandable;
  - `Success` with `errorText` is ignored;
  - an unread failed row shows the chevron and no dot, with the unread name suffix;
  - expanded state survives re-render with appended items;
  - hover class on expandable and navigable rows, none on static rows.
- [x] 2.6 Architecture guard: confirm the list still imports nothing host-owned. That means no `/api` paths, `@epam/ai-dial-chat-api-client`, `apps/chat`, routing, i18n, env, feature flags, analytics or storage. Confirm the expandable decision reads only `status` and `errorText`.
- **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx`, then `npm run verify:changed`.

## 3. Thread the label through the wrappers and both app hosts

- [x] 3.1 Add an optional `openConversationLabel` to the labels of `ScheduledTaskHistorySection` (`libs/scheduled-tasks/src/models/scheduled-task-history-section-props.ts`), `ScheduledTaskDetailView` (`libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts`) and `ScheduledTaskConversationHistorySection` (its labels interface in `ScheduledTaskConversationHistorySection.tsx`). Forward it in each component's `labels={{…}}` to the list.
- [x] 3.2 In `ScheduledTaskHistorySection.tsx`, also forward `rowExpandedBackground` and `errorDetailsClassName` next to the existing `row*`/typography fields. Add both to `ScheduledTaskHistorySectionStyles` with JSDoc defaults. *As built:* `rowExpandedBackground` went into `ScheduledTaskHistorySectionStyles`. `errorDetailsClassName` became a top-level prop (default `dial-tiny-text`) beside the section's existing `runTimestampClassName`/`runTimestampUnreadClassName`. `errorDetailsTextColor`/`chevronIconColor` were added to `ScheduledTaskHistorySectionColors`.
- [x] 3.3 i18n: add `"historyOpenConversationLabel": "Open conversation"` under `scheduledTasks.detail` in `apps/chat/src/i18n/locales/en.json`. Add `DetailHistoryOpenConversationLabel = 'scheduledTasks.detail.historyOpenConversationLabel'` to `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.4 Fill the label with `t(ScheduledTasksI18nKeys.DetailHistoryOpenConversationLabel)` in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, inside the memoised labels object it already passes to `ScheduledTaskDetailView`, and in `apps/chat/src/components/ConversationSourcesPanel/TaskHistorySection/TaskHistorySection.tsx`, inside its existing labels `useMemo`.
- [x] 3.5 Tests: for each wrapper, assert that the host's `openConversationLabel` reaches the link of an expanded failed run with a conversation:
  - `libs/scheduled-tasks/src/components/ScheduledTaskHistorySection/tests/ScheduledTaskHistorySection.spec.tsx`
  - `libs/scheduled-tasks/src/components/ScheduledTaskConversationHistorySection/tests/ScheduledTaskConversationHistorySection.spec.tsx`
  - `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx`

  For the app hosts, assert that the translated key renders and that activating the link navigates the same way a row click does:
  - `apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`
  - `apps/chat/src/components/ConversationSourcesPanel/TaskHistorySection/tests/TaskHistorySection.spec.tsx`

  Update any existing assertion on the old error-text `aria-label` suffix.
- **Verification:** `npm run test:file --` with each of the five spec files above, then `npm run verify:changed`.

## 4. Docs and close-out

- [x] 4.1 In `libs/scheduled-tasks/README.md`:
  - Replace the two tooltip sentences (the `ScheduledTaskDetailView` overview and the `ScheduledTaskConversationHistorySection` section) with the expandable-details behavior and the in-panel "Open conversation" link.
  - Document `openConversationLabel`, `errorDetailsTextColor`, `errorDetailsClassName` and `rowExpandedBackground` with their defaults wherever the list's labels and styles are listed.
- [x] 4.2 Run `npm run validate:docs` and `npm run validate:specs`. Fix any README or spec reference drift.
- [x] 4.3 Follow-up, out of scope: if the slice-1 spike found a kit `Accordion` gap (for example, the header title typography can't be overridden), note it for the kit repo rather than patching it here. *Recorded gaps for `@epam/ai-dial-ui-kit` `Accordion` (0.16.0-dev.67):* (1) no way to set the caret glyph or its rotation (it is a fixed `IconChevronRight` that turns 90°); (2) the content wrapper hardcodes `pt-3`; (3) the title span hardcodes `dial-body-text text-primary`. A caret slot or render prop plus a content-spacing class prop would let this list go back to the kit component.
- **Verification:** `npm run verify:full` once, as the final check.

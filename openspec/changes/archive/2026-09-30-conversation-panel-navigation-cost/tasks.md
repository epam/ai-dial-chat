Slicing strategy: risk-first, then vertical. Slice 1 proves the highest-risk part: the two-phase collapse must be exactly equivalent to the current single pass. Slices 2–4 each remove one layer of navigation churn and ship independently. Slice 5 wires the host and proves the end-to-end render count.

Prerequisite: PR #9184 (`conversation-switch-render-churn`) is merged into `development` before slice 5.

## 1. Two-phase scheduled-task collapse (apps/chat)

- [x] 1.1 In `apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts`, add failing tests:
  - `applyActiveScheduledTaskRun(grouping, id)` returns the same `grouping.collapsed` reference for:
    - an ordinary conversation id;
    - an unknown id;
    - the newest run's id.
  - It returns a new array showing the older run for an older active run.
  - A table-driven test runs every existing scenario input through the two phases and asserts element-wise equality with the single-pass result.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts` (new tests fail).
- [x] 1.2 In `apps/chat/src/utils/collapse-scheduled-task-conversations.ts`, add `groupScheduledTaskConversations` and `applyActiveScheduledTaskRun` (design D3), and re-implement `collapseScheduledTaskConversations` as the two phases composed. Keep the existing representative rules and input order. Export the `ScheduledTaskGrouping` interface from the same module.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts` (all green, including the existing scenarios).
- [x] 1.3 Slice check: `npm run verify:changed`.
  - Result: typecheck and lint pass. `test:changed` shows only 4 failures, which also fail on `development` without this change: 3 in `ConversationView.reply.spec.tsx`, 1 in `useSkillFileSystemPicker.spec.ts`.

## 2. `useConversationPanelItems`: map-based lookup and per-DTO cache (libs/chat-hooks)

- [x] 2.1 In `libs/chat-hooks/src/conversation/useConversationPanelItems/tests/useConversationPanelItems.spec.ts`, add failing tests:
  - an unchanged DTO keeps its item across an `items` change, while a new DTO maps to a new item;
  - a new resolver or a new `deployments` array rebuilds every item;
  - an id match wins over a reference match;
  - the reference match is used when no id matches;
  - a DTO removed from `items` and re-added later is mapped fresh.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationPanelItems/tests/useConversationPanelItems.spec.ts`.
- [x] 2.2 In `useConversationPanelItems.ts`:
  - build the `byId` and `byReference` maps with `useMemo([deployments])`, first match wins (design D1);
  - add the per-DTO cache: read during the memo, stored into the ref in a `useEffect`, holding only the current DTOs (design D2).
  - Keep the output shape and the existing memo guarantee.
  - Verification: the same spec, all green.
- [x] 2.3 Architecture guard. `libs/chat-hooks` gains no import of app code, i18n, routing, env, network or UI rendering, and `findDeploymentByIdOrReference` is unchanged. Check with `git diff -- libs/chat-hooks/src/catalog` (empty) and a review of new imports.
- [x] 2.4 In `libs/chat-hooks/README.md`, update the `useConversationPanelItems` "Returns" paragraph: unchanged DTOs keep their item identity while the other inputs are unchanged. Run `npm run validate:docs`.
- [x] 2.5 Slice check: `npm run verify:changed`.

## 3. `memo(ConversationRow)` and a memoized menu (libs/conversation-panel)

- [x] 3.1 In `libs/conversation-panel/src/components/ConversationRow/tests/ConversationRow.spec.tsx`, add failing tests:
  - re-rendering the row with identical props does not call `getActions` again;
  - a new `getActions` while the menu is open updates the visible menu items;
  - `getActions` returning `[]` renders no trigger (this existing behavior stays covered).
  - Verification: `npm run test:file -- libs/conversation-panel/src/components/ConversationRow/tests/ConversationRow.spec.tsx`.
- [x] 3.2 In `libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx`:
  - wrap the component in `memo`;
  - `useMemo` the menu items on `[getActions, item]`;
  - `useMemo` the `DeploymentIcon` `labels` (on `item.iconTooltip`) and `styles` (on `itemIconBadgeClassName`) (design D5).
  - Verification: the same spec, all green.
- [x] 3.3 In `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`, make `rowProps.onDragStart` a stable `useCallback` that reads `virtualRows` from a ref assigned in an effect. Replace the inline arrow at the `rowProps` memo.
  - Verification: `npm run test:file -- libs/conversation-panel/src/utils/tests/drag.spec.ts libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`.
- [x] 3.4 In `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`, add a failing-then-green test. The spec's `react-window` mock renders every row, so count `ConversationRow` renders through a spy on the `getActions` prop (called once per row body render with D5). With stable `conversations` and `getActions`, changing `activeConversationId` from A to B calls `getActions` only for A and B.
  - Verification: `npm run test:file -- libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`.
  - Done as follows. `getActions` is memoized per row on `[getActions, item]`, so the rows that do re-render (A and B) do not call it either, and it cannot count renders. Instead, the spec's ui-kit `Highlight` mock logs each row title, since a row body renders its title once. The test asserts that only A and B are logged, that `getActions` is not called at all, and that `aria-current` moves to B. It is red without `memo(ConversationRow)`.
- [x] 3.5 Slice check: `npm run verify:changed`.

## 4. Smaller overscan (libs/conversation-panel)

- [x] 4.1 In `ConversationPanel.tsx`, change `handleListResize` to `Math.max(5, Math.ceil(Math.ceil(height / ITEM_ROW_HEIGHT) / 2))` (design D6). Extract the formula as a named, unit-tested helper in `libs/conversation-panel/src/utils/conversation-row.ts` (for example `getOverscanCount(height)`).
- [x] 4.2 In `libs/conversation-panel/src/utils/tests/conversation-row.spec.ts`, add tests:
  - 0px gives 5;
  - 900px gives 13;
  - a height below one row gives 5.
  - Verification: `npm run test:file -- libs/conversation-panel/src/utils/tests/conversation-row.spec.ts`.
- [x] 4.3 Architecture guard. `libs/conversation-panel` gains no host knowledge (routes, i18n, contexts, env), and there are no public prop or export changes (`git diff -- libs/conversation-panel/src/index.ts libs/conversation-panel/src/models` is empty). The README needs no change: overscan is not documented. Run `npm run validate:docs`.
- [x] 4.4 Slice check: `npm run verify:changed`.

## 5. Host wiring (apps/chat)

- [x] 5.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`:
  - replace the collapse `useMemo` with the grouping memo on `[items]` and the active-run memo on `[grouping, activeConversationId]` (design D3);
  - move `panelActiveConversationId` into a ref assigned in an effect, read it inside the duplicate action's click handler, and drop it from `getActions`' dependencies (design D4).
- [x] 5.2 In `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`, add tests:
  - navigating between two ordinary conversations keeps the `conversations` prop passed to the mocked lib panel as the same reference;
  - `getActions` keeps its identity across the navigation;
  - duplicating a read-only conversation that is the active one still navigates to the copy (the existing behavior, now read through the ref).
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`.
- [x] 5.3 Slice check: `npm run verify:changed`.

## 6. Close-out

- [x] 6.1 Run `npm run validate:docs`.
  - Result: passed (49 markdown files).
- [x] 6.2 Run `npm run verify:full` once.
  - Result: typecheck:full, lint:check and format:check pass. test:full reports 14 failures, the same list as on `development` before this change:
    - `@epam/chat` (4): `ConversationView.reply.spec.tsx` ×3 and `useSkillFileSystemPicker.spec.ts`.
    - `@epam/ai-dial-conversation-input` (9).
    - `@epam/chat-api` (1).
  - None of them are in a file this change touches.
  - Every `@epam/ai-dial-conversation-panel` and `@epam/ai-dial-chat-hooks` test passes.

## 1. Lib — detail-view adapters in `@epam/ai-dial-chat-hooks`

- [x] 1.1 Add an optional `timeZone` parameter to `formatScheduledTaskInstant` in `libs/chat-hooks/src/scheduled-task/scheduled-task-time-format.ts` (an invalid zone still returns the raw value).
- [x] 1.2 Add `formatScheduledTaskNextRunTime`, `formatScheduledTaskActiveWindow`, `getScheduledTaskActivationBlock`, the `ScheduledTaskActivationBlock` enum and the `ScheduledTaskZoneLabels` / `ScheduledTaskActiveWindowLabels` / `ScheduledTaskNextRunOptions` interfaces to `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts` (already exported from the root and `./scheduled-tasks`).
- [x] 1.3 Document every new export in `libs/chat-hooks/README.md`.
- [x] 1.4 Unit tests: `libs/chat-hooks/src/scheduled-task/tests/scheduled-task-time-format.spec.ts` (explicit zone, default zone, raw fallbacks) and the new cases in `libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts` (every scenario in the `chat-hooks-scheduled-task-display` delta).
  - Verification: `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-time-format.spec.ts libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts`

## 2. App — thin adapters and the page

- [x] 2.1 Add `buildNextRunLabel` and `buildActiveWindowLabel` to `apps/chat/src/utils/map-scheduled-task-dto.ts` as `t()` adapters over the lib functions, sharing one `withTimezone` builder with `buildScheduleLabel`.
- [x] 2.2 In `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, replace the inline `nextRunLabel` / `activeWindowLabel` memos with the adapters, and the inline Active-switch disable checks with `getScheduledTaskActivationBlock`.
- [x] 2.3 Unit tests in `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` for the `scheduled-task-detail-page` scenarios; update the page's activity-window assertions in `apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx` to the zone suffix key.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`

## 3. Verification

- [x] 3.1 `openspec validate label-scheduled-task-detail-zones --strict`, `npm run validate:specs`, `npm run validate:docs`
- [x] 3.2 `npm run verify:changed`

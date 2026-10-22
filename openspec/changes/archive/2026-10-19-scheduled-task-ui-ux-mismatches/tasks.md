# Tasks: scheduled-task-ui-ux-mismatches

The implementation already exists on the branch; these tasks capture the spec record and verify nothing regressed.

## 1. Delta specs

- [x] 1.1 Write `specs/scheduled-task-create-form/spec.md` delta: the Configuration-heading-no-subtitle requirement, the boundary-picker requirement rewritten for the hourly date-and-time mode and cadence-stable shapes, and the boundary validation/conversion requirement rewritten for the shape-branching `buildCronWindowBoundary` and `isoToLocalDateTime` hydration.
- [x] 1.2 Write `specs/scheduled-task-detail-page/spec.md` delta: the 440px delete-dialog cap requirement (doubled-specificity stylesheet, `styles.popupClassName` threading, viewport-shrink behavior, regression test).

## 2. Implementation verification (already on the branch)

- [x] 2.1 `ScheduledTaskCreateForm` renders no Configuration subtitle; `configurationSectionSubtitle` absent from `ScheduledTaskCreateFormLabels`, `useScheduledTaskFormLabels`, `ScheduledTasksI18nKeys`, and `en.json`; the consumer fixture and lib specs updated.
- [x] 2.2 `ScheduledTaskBoundaryField` renders the hourly date-and-time pair and the day-based date-only pair; boundary shapes survive repeat switches.
- [x] 2.3 `buildCronWindowBoundary` converts `YYYY-MM-DDTHH:mm` at the exact picked moment; `mapScheduledTaskDtoToFormValues` hydrates hourly boundaries via `isoToLocalDateTime` (`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` + its tests).
- [x] 2.4 `ScheduledTaskDeleteModal` caps the dialog at 440px via `ScheduledTaskDeleteModal.module.scss` threaded through `styles.popupClassName`, guarded by `ScheduledTaskDeleteModal.spec.tsx`.

## 3. Gates

- [x] 3.1 `npm run test:file` green for the touched suites (`ScheduledTaskDeleteModal`, `ScheduledTaskBoundaryField`, create-form suites, `scheduled-task-trigger`).
- [x] 3.2 `npm run validate:specs` green (0 errors) and `openspec validate --specs` green for the change's capabilities.
- [x] 3.3 `npm run typecheck:affected` green.

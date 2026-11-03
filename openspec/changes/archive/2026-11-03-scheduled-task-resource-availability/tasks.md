## 1. Availability and previews (vertical slice)

- [x] 1.1 Resolve skill metadata availability and stale-response protection in the scheduled-task app hooks; retain the display-name compatibility wrapper.
- [x] 1.2 Render deferred skill/model previews with localized unavailable names, tooltips and error color in both task detail surfaces.
- [x] 1.3 Verify `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskSkillPreview.spec.tsx`, `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskModelPreview.spec.tsx`, `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskSkillDisplayNames.spec.tsx` and `apps/chat/src/hooks/scheduled-tasks/tests/useUnavailableScheduledTaskSkills.spec.tsx` via `npm run test:file`.

## 2. Editor availability (depends on slice 1)

- [x] 2.1 Add optional unavailable tags, labels and theme overrides to SkillSelectorField; retain removal and disable adding unavailable options.
- [x] 2.2 Wire resolved selections into ScheduledTaskEditPage, invalid model presentation, pending Save gating and direct submit protection.
- [x] 2.3 Verify `apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`, `apps/chat/src/components/ScheduledTaskSkillField/tests/ScheduledTaskSkillField.spec.tsx`, `apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorFieldTrigger.spec.tsx`, `libs/skills/src/components/SkillSelectorField/tests/SkillSelectorField.spec.tsx` and `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx` via `npm run test:file`.
- [x] 2.4 Confirm library isolation and preserve keyboard, mobile selector and RTL interaction paths without new host integrations in libs.

## 3. Documentation and review

- [x] 3.1 Add app translations and document optional library props and actual availability behavior in the app/library READMEs.
- [x] 3.2 Build/typecheck the two changed libraries through Nx and run app TypeScript; record the unrelated existing lint boundary error.
- [x] 3.3 Complete the five-axis review and validate the synchronized main specs with `openspec validate --specs` and `npm run validate:specs`.
- [x] 3.4 Run final documentation and scoped regression checks and record remaining verification limitations.

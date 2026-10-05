## 1. Array contract

- [x] 1.1 Replace DTOs, mapper and service skillUrl contracts with arrays; verify scheduled-tasks backend DTO/mapper/service/controller tests.
- [x] 1.2 Regenerate Swagger client; verify openapi:check and chat-api-client build/lint and existing generated singleton/wrappers.
- [x] 1.3 Update form, validation, request preparation and detail array props; verify scheduled-tasks and chat-hooks scheduled-task tests.

## 2. Selection and host integration

- [x] 2.1 Convert SkillSelectorField to the UI-kit multiple Select; verify selection, duplicate prevention, removal and unsupported-model tests.
- [x] 2.2 Update app picker, metadata hook, create/edit/detail pages and plural translations; verify app scheduled-task tests and preserved feature gating.
- [x] 2.3 Verify wrapping mobile layouts, focus/keyboard operation and RTL through component tests.

## 3. Documentation and quality

- [x] 3.1 Update library READMEs, API docs and architecture; verify validate:docs and OpenSpec validation.
- [x] 3.2 Run changed-slice verification, full verification and quality review; document external integration verification limitation. Both aggregate runs reached 4,658/4,659 tests and failed only on the unchanged `app-config.service.spec.ts` refinement-availability case, which passes in isolation.

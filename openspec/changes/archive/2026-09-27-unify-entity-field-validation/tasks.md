**Note on sequencing.** The code for this change shipped in commit `c373c7b36` (PR #9097)
before the change was written up. This change records the result and corrects the live specs
that described the old behaviour. Tasks are marked complete against that commit.

Slicing strategy: contract-first. The shared limits and lib validators land first; each editor
then wires them end to end.

## 1. Shared contract

- [x] 1.1 Add `ENTITY_*_MAX_LENGTH`, `exceedsMaxLength` and `hasControlCharacters` in
      `libs/chat-shared/src/utils/entity-field-limits.ts`, export them from
      `libs/chat-shared/src/index.ts`, and unit-test them in
      `libs/chat-shared/src/utils/tests/entity-field-limits.spec.ts`.
- [x] 1.2 Pin `PROMPT_*_MAX_LENGTH` (`libs/chat-hooks/src/prompt/prompt.ts`) to the shared
      constants with a test in `libs/chat-hooks/src/prompt/tests/prompt.spec.ts`. Keep them
      literal, because the `./utils` entry must not import `chat-shared` at runtime (commit
      `dae37acdb`).
- [x] 1.3 Add `editor.fieldTooLong` / `editor.nameControlCharacters` to
      `apps/chat/src/i18n/locales/en.json` and `EditorI18nKeys`.

## 2. builder-form, Quick Apps, Custom Apps

- [x] 2.1 Add name length/control-character and description length checks to
      `libs/builder-form/src/utils/validate-deployment-creation-fields.ts`, plus
      `DeploymentCreationFieldErrorCode.ControlCharacters` and the `description` error code.
      Cover them in its spec.
- [x] 2.2 Render `errors.description` in `DeploymentCreationForm`.
- [x] 2.3 Add `apps/chat/src/utils/entity-field-validation.ts`, then wire
      `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` and
      `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx` to it (live and on submit).
- [x] 2.4 Architecture guard: `builder-form` still returns codes only, with no i18n or host
      knowledge.

## 3. Toolsets

- [x] 3.1 Map the new codes to `labels.validation.nameTooLong` / `nameControlCharacters` /
      `descriptionTooLong` in `libs/toolset-editor/src/components/ToolsetEditor/ToolsetEditor.tsx`.
      Add `description` to the dirty-field error set.
- [x] 3.2 Pass the translated labels from `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`.

## 4. Scheduled tasks

- [x] 4.1 Add `validateScheduledTaskTextField` and the `DisplayNameTooLong` /
      `DisplayNameControlCharacters` / `PromptTooLong` codes in
      `libs/scheduled-tasks/src/validation/scheduled-task-validation.ts`, with spec coverage.
- [x] 4.2 Map them, with `count`, in `apps/chat/src/utils/scheduled-task-form-validation.ts`, and
      surface live errors from both `ScheduledTaskCreatePage` and `ScheduledTaskEditPage`. Retire
      `scheduledTasks.create.descriptionMaxLengthError`.

## 5. Skills

- [x] 5.1 Add `getSkillFieldLengthViolations` / `SKILL_TEXT_FIELD_MAX_LENGTHS` in
      `libs/chat-hooks/src/skill/skill.ts`.
- [x] 5.2 Wire live and submit checks plus `messages.tooLong` in
      `libs/chat-hooks/src/skill/useSkillEditorSubmit.ts`, with spec coverage, and pass the
      message from `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`.

## 6. BFF

- [x] 6.1 Add `apps/chat-api/src/common/validators/entity-field-limits.ts`. Change
      `DISPLAY_NAME_PATTERN` to 1-256.
- [x] 6.2 Add `@MaxLength` to `ToolsetBodyDto`, `CreateApplicationBodyDto`,
      `UpdateApplicationBodyDto` and `CreateScheduledTaskBodyDto`. Add the control-character
      rule to `CreateScheduledTaskBodyDto.displayName`. Cover them in DTO specs.
- [x] 6.3 Add name/description length checks to
      `apps/chat-api/src/skills/utils/skill-manifest-frontmatter.util.ts`, with a spec.
- [x] 6.4 Run `npm run openapi` and `npm run openapi:check`.

## 7. Docs and verification

- [x] 7.1 Update the `builder-form`, `chat-shared`, `chat-hooks` and `scheduled-tasks` READMEs.
      Run `npm run validate:docs`.
- [x] 7.2 Run `nx run-many -t typecheck test` for `chat-shared`, `builder-form`,
      `toolset-editor`, `scheduled-tasks`, `chat-hooks`, `chat` and `chat-api`.

## Follow-ups (out of scope)

- Decide whether the scheduled-task description may be raised to 2000. This needs DIAL
      Scheduler's own limit.
- Decide whether `POST/PUT /api/v1/skills` should parse `skillManifest` so the instructions
      limit is enforced server-side as well.

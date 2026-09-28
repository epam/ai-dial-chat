## Why

[Issue #9059](https://github.com/epam/ai-dial-chat/issues/9059): name validation and the way its
errors are shown differed across every entity editor. Only Prompts behaved correctly. The
others failed in different ways:

| Editor | Before |
| --- | --- |
| Skills | No name/description/instructions limit. A ~19,000-character name got as far as the BFF's 1024-character path check |
| Toolsets | The client checked only that the name was present. The DTO message "Must not contain control characters and must be 1-255 characters" came back as a toast (`apps/chat/src/utils/toolsets.ts` `extractToolsetApiErrorMessage`) |
| Quick Apps / Custom Apps | No name length limit on either the client or `CreateApplicationBodyDto` |
| Scheduled tasks | The DTO capped `displayName` at 256, but the client did not. An over-long name fell through to the generic "Failed to create the scheduled task" toast |

No editor except Prompts limited description or instructions length.

## What Changes

- **One set of limits:** name 256, description 2000, instructions 50000 (the Prompt editor's
  existing numbers, `libs/chat-hooks/src/prompt/prompt.ts`). They are exported from
  `@epam/ai-dial-chat-shared` as `ENTITY_NAME_MAX_LENGTH` / `ENTITY_DESCRIPTION_MAX_LENGTH` /
  `ENTITY_INSTRUCTIONS_MAX_LENGTH`, next to `exceedsMaxLength` and `hasControlCharacters`, and
  mirrored in `apps/chat-api/src/common/validators/entity-field-limits.ts`. The scheduled-task
  description stays at its existing 500.
- **One way to show errors:** an over-limit value, or a control character in a name, shows an
  inline field error while the user types, and submit is blocked. Required-field errors keep
  their existing blur/submit timing.
- **Shared messages:** `editor.fieldTooLong` ("Use {{count}} characters or fewer.") and
  `editor.nameControlCharacters` ("Remove line breaks, tabs and other control characters.").
  `scheduledTasks.create.descriptionMaxLengthError` is removed in favour of the shared key.
- **Libs:**
  - `builder-form`'s `validateDeploymentCreationFields` always checks name length, name control
    characters and description length, and returns the new
    `DeploymentCreationFieldErrorCode.ControlCharacters`. `DeploymentCreationForm` renders
    `errors.description`.
  - `toolset-editor` gains the `nameTooLong` / `nameControlCharacters` / `descriptionTooLong`
    labels.
  - `scheduled-tasks/validation` gains `validateScheduledTaskTextField` and the
    `DisplayNameTooLong` / `DisplayNameControlCharacters` / `PromptTooLong` codes.
  - `chat-hooks` gains `getSkillFieldLengthViolations` / `SKILL_TEXT_FIELD_MAX_LENGTHS`, and
    `useSkillEditorSubmit` gains the required `messages.tooLong`.
- **BFF:**
  - `@MaxLength` is added to toolset, application and scheduled-task DTOs.
  - `DISPLAY_NAME_PATTERN` goes from 1-255 to 1-256.
  - The scheduled-task `displayName` rejects control characters.
  - The skill-import manifest parser rejects an over-long `name`/`description`.
  - The OpenAPI spec is regenerated (it gains `maxLength` fields; no operation changes).

## Non-goals

- Quick App instructions (the system prompt) are edited inside the external app-editor iframe,
  which this repo does not render. They are not limited here.
- `POST/PUT /api/v1/skills` still treats `skillManifest` as opaque (size-limited only). The
  instructions limit on a skill is therefore enforced by the editor alone. The import parser
  enforces only name/description.
- The scheduled-task description limit does not move from 500 to 2000. DIAL Scheduler's own
  limit was not verified.

## Alternatives considered

A native `maxLength` on each input would silently truncate a paste with no explanation. The
issue explicitly asks for a clear inline message, and the kit's `Input`/`Textarea` `error` state
already provides one, so an inline error was chosen instead.

## Acceptance criteria

- In every editor, an over-limit name, description or instructions value shows "Use N characters
  or fewer." under the field as soon as it is exceeded, and save does not call the API.
- A name containing a line break or tab shows the control-character message inline.
- The BFF rejects the same values with 400 even when the client is bypassed.

## Backward compatibility / rollback

The change is additive, except for three things a host may notice:

- `SkillEditorSubmitMessages.tooLong` is a new required member.
- Values that the editor or BFF previously accepted beyond the new limits are now rejected. This
  covers application, toolset and skill-import names over 256 or descriptions over 2000, and
  scheduled-task instructions over 50000.
- Toolset and localized display names may now be 256 characters rather than 255.

Revert the change's commit to roll back. No stored data migrates.

## Impact on i18n

Two new keys (`editor.fieldTooLong`, `editor.nameControlCharacters`). One removed key
(`scheduledTasks.create.descriptionMaxLengthError`).

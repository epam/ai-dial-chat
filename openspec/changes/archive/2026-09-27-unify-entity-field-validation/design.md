## Context

Every entity editor renders its own form, and most share the `builder-form` General step. The
limits already existed in three unrelated places: `PROMPT_*_MAX_LENGTH` in
`libs/chat-hooks/src/prompt/prompt.ts`, `DISPLAY_NAME_PATTERN` in
`apps/chat-api/src/common/validators/display-name.pattern.ts`, and `DESCRIPTION_MAX_LENGTH` in
`libs/scheduled-tasks/src/constants/scheduled-task-create-form.ts`. Nothing tied them together.

## Decisions

### D1 — Limits live in `chat-shared`, mirrored once in chat-api

`@epam/ai-dial-chat-shared` is a peer of every editor lib (`builder-form`, `toolset-editor`,
`scheduled-tasks`, `skill-editor`, `prompt-editor`) and of `chat-hooks`, so it is the one module
all of them can import without adding a dependency edge. The backend cannot import a frontend
package, so `apps/chat-api/src/common/validators/entity-field-limits.ts` carries the same three
numbers, with a comment pointing at its frontend twin. The Prompt constants
(`PROMPT_*_MAX_LENGTH`) keep their literal 256/2000/50000 values: `prompt.ts` ships in
`chat-hooks`'s `./utils` entry, which the cold-load probes install without `chat-shared`, so a
runtime import there would break that entry. `libs/chat-hooks/src/prompt/tests/prompt.spec.ts` pins
them to the shared constants instead.

### D2 — Validators return codes; the app translates

Consistent with library isolation (AGENTS.md §Library isolation), no lib renders the new message
text itself:

- `builder-form` returns `DeploymentCreationFieldErrorCode.TooLong` / `ControlCharacters`.
- `scheduled-tasks/validation` returns `ScheduledTaskValidationErrorCode` members.
- `chat-hooks` returns the exceeded limit and calls the host's `messages.tooLong(limit)`.
- `toolset-editor` takes host-translated `labels.validation.*` strings (English defaults).

`apps/chat` maps these onto `editor.fieldTooLong` (interpolating `count`) and
`editor.nameControlCharacters`:

- builder-form hosts through `apps/chat/src/utils/entity-field-validation.ts`
  (`translateDeploymentCreationErrors`, `getLiveDeploymentCreationErrors`)
- scheduled tasks through `apps/chat/src/utils/scheduled-task-form-validation.ts`
  (`getLiveScheduledTaskFieldError`)

### D3 — Live errors only for "too long" and "control characters"

A required-field error shown while typing would flag a field the moment it is focused. So only
the two new codes surface on change; `Required` keeps its existing blur/submit timing. The
submit-time validators still run every check, so a value that never went through a change event
(a prefilled edit, or a host that omits the change callback) is still blocked.

### D4 — Length is measured on the trimmed value where the request trims

Scheduled-task preparation (`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`) and
the skill manifest builder trim before sending, so their checks use the trimmed length. The
builder-form description check uses the raw value, because the host sends it as typed.

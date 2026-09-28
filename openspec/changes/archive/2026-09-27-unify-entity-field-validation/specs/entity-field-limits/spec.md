## ADDED Requirements

### Requirement: One set of entity text-field limits, shared by frontend and BFF

`@epam/ai-dial-chat-shared` SHALL export `ENTITY_NAME_MAX_LENGTH = 256`,
`ENTITY_DESCRIPTION_MAX_LENGTH = 2000` and `ENTITY_INSTRUCTIONS_MAX_LENGTH = 50000`, together
with the pure helpers `exceedsMaxLength(value, maxLength)` and `hasControlCharacters(value)`
(true for any Unicode `Cc` character: line break, tab, NUL, …). Every entity editor (prompts,
skills, toolsets, Quick Apps, Custom Apps, scheduled tasks) SHALL take its name, description and
instructions limits from these constants rather than restating the numbers. The one exception is
the scheduled-task description, which keeps its own 500-character `DESCRIPTION_MAX_LENGTH`.

`apps/chat-api/src/common/validators/entity-field-limits.ts` SHALL declare the same three
numbers for the BFF DTOs, because an app cannot import a frontend package. A change to one side
SHALL be made to both in the same change.

#### Scenario: A limit is enforced identically on both sides

- **WHEN** a toolset, application, scheduled-task or skill name is 257 characters long
- **THEN** the editor shows an inline error and does not call the API, and the BFF rejects the
  same value with `400` if the client check is bypassed

#### Scenario: Printable text is not mistaken for control characters

- **WHEN** a name contains non-Latin letters, punctuation or the letters `p`, `C` and `c`
- **THEN** `hasControlCharacters` returns `false`; only an actual `Cc` character such as `\n` or
  `\t` returns `true`

### Requirement: Over-limit and control-character errors render inline while typing

Every entity editor SHALL render an over-limit value, and a control character in a name, as an
inline error under the field, using the kit field's `error`/`invalid` state, as soon as the
value changes. The error SHALL NOT be a toast or top-of-page notification. It SHALL clear as
soon as the value is back within its rules, and submit SHALL stay blocked while it is shown.
A required-field error SHALL keep the editor's existing blur/submit timing, so an empty field
is not flagged the moment it receives focus.

The app SHALL translate these errors through two shared keys:

| Key | English |
| --- | --- |
| `editor.fieldTooLong` (`EditorI18nKeys.FieldTooLong`) | `Use {{count}} characters or fewer.`, with `count` the exceeded limit |
| `editor.nameControlCharacters` (`EditorI18nKeys.NameControlCharacters`) | `Remove line breaks, tabs and other control characters.` |

Libs SHALL return codes or call host-supplied messages rather than render this text themselves
(AGENTS.md §Library isolation). Direction impact: none; the errors reuse the kit's existing field
error slot. Not feature-gated.

#### Scenario: Pasting an over-long name

- **WHEN** a user pastes 300 characters into any editor's name field
- **THEN** "Use 256 characters or fewer." appears under the field immediately, and Save/Create/Next
  does not call the API

#### Scenario: Shortening clears the error

- **WHEN** the user deletes characters until the name is 256 characters or fewer
- **THEN** the error disappears without another submit attempt

## MODIFIED Requirements

### Requirement: Shared general creation form fields
`libs/builder-form` SHALL export a controlled presentation component (`DeploymentCreationForm`) providing the
field set common to Quick App and Toolset creation: avatar, name, description, version, and
topics. The component SHALL accept the current field values, field-level errors, and an
`onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission. The component SHALL NOT render an Intro field.

`DeploymentCreationFormFieldErrors` SHALL carry optional `name`, `version` and `description`
messages, already translated by the host. Each one SHALL render inline under its field
through the kit field's `error`/`invalid` props.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays the avatar picker plus inputs for name, description, version, and
  topics reflecting those values

#### Scenario: Description error renders under the description field
- **WHEN** the host passes `errors.description`
- **THEN** the Description textarea is marked invalid and shows that message beneath it

### Requirement: Shared field validation function
`libs/builder-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and an options object, and returns field-level errors. It SHALL
return:

- a required-name error when the name is empty;
- a too-long name error (`DeploymentCreationFieldErrorCode.TooLong`) when the trimmed name is
  longer than `ENTITY_NAME_MAX_LENGTH` (256, from `@epam/ai-dial-chat-shared`);
- a name-format error (opt-in via `validateNamePattern`) when the name contains characters
  outside letters, digits, spaces, underscores, dots, and dashes (`NAME_PATTERN`);
- a control-character name error (`DeploymentCreationFieldErrorCode.ControlCharacters`) when the
  name contains a line break, tab or other control character;
- a too-long description error (`description: TooLong`) when the description is longer than
  `ENTITY_DESCRIPTION_MAX_LENGTH` (2000);
- a version-format error (opt-in via `validateVersionPattern`) for a non-empty version that
  fails the applicable version pattern.

The length and control-character checks SHALL always run. For a name, the first failing check
wins, in the order required, too long, pattern, control characters. A non-empty version never
produces a required error. The function SHALL NOT validate an `intro` field. The function SHALL
have no side effects and SHALL NOT depend on i18n, routing, or network state.

`validateVersionPattern` SHALL accept either `true` — checking the non-empty version against the
exported default `VERSION_PATTERN` (letters, digits, dots, underscores, dashes) — or a `RegExp`,
checked instead of the default. The library SHALL also export `SEMVER_VERSION_PATTERN` (one or
more dot-separated numeric segments, e.g. `0.0.1`, `2.0`) as a stricter alternative a host can
pass when it requires a dot-separated numeric version rather than the default permissive
character-set check.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name
- **THEN** it returns no error for name

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

#### Scenario: Name over the shared limit
- **WHEN** the function is called with a 257-character name
- **THEN** it returns a too-long error for name; a 256-character name produces no error

#### Scenario: Name with a control character
- **WHEN** the function is called with a name containing a line break
- **THEN** it returns a control-characters error for name

#### Scenario: Description over the shared limit
- **WHEN** the function is called with a 2001-character description
- **THEN** it returns a too-long error for description

#### Scenario: Default version pattern check
- **WHEN** the function is called with `validateVersionPattern: true` and a non-empty version
  containing a character outside `VERSION_PATTERN`
- **THEN** it returns a version-format error; a version made only of letters, digits, dots,
  underscores, and dashes (e.g. `abc`) produces no error

#### Scenario: Stricter version pattern override
- **WHEN** the function is called with `validateVersionPattern: SEMVER_VERSION_PATTERN` and a
  non-empty version that is not entirely dot-separated numeric segments (e.g. `abc`)
- **THEN** it returns a version-format error; a version such as `0.0.1` or `2.0` produces no error

#### Scenario: Empty version is never flagged
- **WHEN** the function is called with `validateVersionPattern` set (either `true` or a `RegExp`)
  and an empty version
- **THEN** it returns no error for version

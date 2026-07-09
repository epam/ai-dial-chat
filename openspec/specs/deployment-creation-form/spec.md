# deployment-creation-form Specification

## Purpose
TBD - created by archiving change add-intro-field-quick-app-toolset. Update Purpose after archive.

## Requirements

### Requirement: Shared general creation form fields
`libs/deployment-creation-form` SHALL export a controlled presentation component providing the
field set common to Quick App and Toolset creation: name, description, icon URL, version,
topics, and intro. The component SHALL accept the current field values, field-level errors,
and an `onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays inputs for name, description, icon URL, version, topics, and intro
  reflecting those values

#### Scenario: Field edits are reported through onChange
- **WHEN** a user edits any shared field
- **THEN** the component calls `onChange` with a patch containing only the changed field, and
  does not mutate its own internal state

#### Scenario: Passed-in errors are surfaced per field
- **WHEN** a host app passes a field-level error for name, version, or intro
- **THEN** the component displays that error next to the corresponding field without
  performing its own validation pass

### Requirement: Shared field validation function
`libs/deployment-creation-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and returns field-level errors: a required-name error when name
is empty, a name-format error when name contains characters outside letters, digits, spaces,
underscores, dots, and dashes, and a length error when `intro` exceeds 90 characters. The
function SHALL have no side effects and SHALL NOT depend on i18n, routing, or network state.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name and an intro of
  90 characters or fewer
- **THEN** it returns no error for name or intro

#### Scenario: Intro exceeds the character limit
- **WHEN** the function is called with an intro longer than 90 characters
- **THEN** it returns a length-limit error for intro

#### Scenario: Intro is optional
- **WHEN** the function is called with an empty intro
- **THEN** it returns no error for intro

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

### Requirement: Library isolation boundary
`libs/deployment-creation-form` SHALL NOT import `react-i18next`, `@epam/chat-api-client`,
`apps/chat/src/server-api`, routing utilities, browser storage, feature-flag clients, or any
DIAL Core/application-specific integration detail. All display strings SHALL be supplied by
the host app through a `labels` prop; all request-body mapping and network calls SHALL happen
in host app-level containers, not inside the library.

#### Scenario: No generated client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file under `libs/deployment-creation-form/src` imports `@epam/chat-api-client`,
  `react-i18next`, or an application route/path constant

### Requirement: Visual composition without duplicated logic
The library SHALL render its field stack using neutral default layout classes and SHALL
accept an optional `classNames` prop for per-slot style overrides, without requiring host apps
to fork or duplicate the shared field/validation logic to achieve a different visual layout
around the shared fields.

#### Scenario: Host apps compose different surrounding layouts
- **WHEN** two different host containers render the shared component with different
  surrounding layout (e.g. a two-column layout with a preview panel vs. a single-column
  stacked layout)
- **THEN** both containers use the same shared component and validator without either
  reimplementing the field set

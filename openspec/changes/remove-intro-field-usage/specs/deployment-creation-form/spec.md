## MODIFIED Requirements

### Requirement: Shared general creation form fields
`libs/deployment-creation-form` SHALL export a controlled presentation component providing the
field set common to Quick App and Toolset creation: name, description, icon URL, version, and
topics. The component SHALL accept the current field values, field-level errors, and an
`onChange` callback as props, and SHALL NOT hold its own copy of field state, call any
network API, or trigger submission. The component SHALL NOT render an Intro field.

#### Scenario: Component renders all shared fields
- **WHEN** a host app renders the shared component with a set of values
- **THEN** it displays inputs for name, description, icon URL, version, and topics
  reflecting those values

#### Scenario: Field edits are reported through onChange
- **WHEN** a user edits any shared field
- **THEN** the component calls `onChange` with a patch containing only the changed field, and
  does not mutate its own internal state

#### Scenario: Passed-in errors are surfaced per field
- **WHEN** a host app passes a field-level error for name or version
- **THEN** the component displays that error next to the corresponding field without
  performing its own validation pass

### Requirement: Shared field validation function
`libs/deployment-creation-form` SHALL export a pure `validateDeploymentCreationFields` function that
takes the shared field values and returns field-level errors: a required-name error when name
is empty, and a name-format error when name contains characters outside letters, digits, spaces,
underscores, dots, and dashes. The function SHALL NOT validate an `intro` field. The
function SHALL have no side effects and SHALL NOT depend on i18n, routing, or network state.

#### Scenario: Valid values produce no errors
- **WHEN** the function is called with a non-empty, correctly formatted name
- **THEN** it returns no error for name

#### Scenario: Name is required
- **WHEN** the function is called with an empty name
- **THEN** it returns a required-field error for name

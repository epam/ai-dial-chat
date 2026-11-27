# Spec Delta

## MODIFIED Requirements

### Requirement: Validation and dirty-field error surfacing
`ToolsetEditor` SHALL validate the form through the lib's own `isToolsetFormValid`/`isValidEndpointUrl` utils (which delegate the name/version/description checks to `builder-form`'s `validateDeploymentCreationFields` with `validateVersionPattern: true` in create mode, i.e. the default `VERSION_PATTERN`, and `STORED_VERSION_PATTERN` in edit mode, the shared resource version rule (`resource-version-pattern`)), building error messages from the `labels.validation` group. That group SHALL include `nameTooLong`, `nameControlCharacters` and `descriptionTooLong`, which default to `Use 256 characters or fewer.`, `Remove line breaks, tabs and other control characters.` and `Use 2000 characters or fewer.` respectively. Field errors SHALL surface only for fields the user has touched — Metadata fields through `useMetadataForm`'s touched state (`name`/`version` are marked touched on edit, and too-long or control-character codes show at once), Setup fields (`endpoint` and the auth fields) through the editor's own dirty-field set — and SHALL be recomputed on every change, so an over-limit name or description is flagged while the user types. Patches that change `authenticationType`, `withLogin`, or `isLoggedIn` SHALL clear all auth-field errors at once. The Save action SHALL stay disabled until `isToolsetFormValid` passes.

#### Scenario: Untouched invalid fields show no error
- **WHEN** the editor opens with an empty endpoint and the user edits only the name
- **THEN** no endpoint error is shown, because the endpoint field is not dirty

#### Scenario: Over-long name shows inline while typing
- **WHEN** the user types a 257-character name
- **THEN** `labels.validation.nameTooLong` is shown under the Name field and Save is disabled, with no notification raised

#### Scenario: Save is disabled while the form is invalid
- **WHEN** any validation rule fails (missing, over-long or control-character name, over-long description, missing endpoint, invalid version or endpoint URL, incomplete auth configuration)
- **THEN** the Save/Create action is disabled until the failing fields are corrected

#### Scenario: Switching auth type clears auth errors
- **WHEN** the user has a key-header error visible and then switches the authentication type
- **THEN** all auth-field errors are cleared at once

### Requirement: EditorLayout composition
`ToolsetEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell. `EntityEditor` in turn composes `EditorLayout` with a Metadata `EditorSection` and a Setup `EditorSection`. `ToolsetEditor` passes:

- `metadata`: `MetadataForm` from `@epam/ai-dial-builder-form` with every field, the host's `avatarPicker`, and the toolset-flavoured default labels when `labels.general` is omitted.
- `setup`: the internal `SettingsForm`.
- `title` and `submitLabel`: the resolved create/edit title and Create or Save label.
- `onSubmit`, `onCancel`, `onBack`, `isSubmitting` and `isSubmitDisabled`.

The metadata values, touched state and validation codes SHALL come from `useMetadataForm` (with `validateVersionPattern: true` in create mode, i.e. the default `VERSION_PATTERN`, and `STORED_VERSION_PATTERN` in edit mode, the shared resource version rule (`resource-version-pattern`)). The endpoint and auth validation stays in `ToolsetEditor`.

On mobile the two sections SHALL stack vertically (Metadata first). The lib SHALL NOT render a footer button bar, a wizard indicator or a preview pane.

#### Scenario: Both sections visible at desktop width
- **WHEN** the editor renders at desktop width
- **THEN** the Metadata section (left) and Setup section (right) are both visible simultaneously

#### Scenario: Sections stack on mobile
- **WHEN** the editor renders at mobile width
- **THEN** Metadata renders above Setup, both reachable by scrolling, with no tab or step navigation

#### Scenario: Shell comes from EntityEditor
- **WHEN** `libs/toolset-editor/src/**` is searched for direct `EditorLayout` or `EditorSection` usage
- **THEN** none are found, and the shell renders through `EntityEditor`

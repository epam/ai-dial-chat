## MODIFIED Requirements

### Requirement: Validation and dirty-field error surfacing
`ToolsetEditor` SHALL validate the form through the lib's own `isToolsetFormValid`/`isValidEndpointUrl` utils (which delegate the name/version/description checks to `builder-form`'s `validateDeploymentCreationFields` with `validateVersionPattern: true`), building error messages from the `labels.validation` group. That group SHALL include `nameTooLong`, `nameControlCharacters` and `descriptionTooLong`, which default to `Use 256 characters or fewer.`, `Remove line breaks, tabs and other control characters.` and `Use 2000 characters or fewer.` respectively. Field errors SHALL surface only for fields the user has touched (the dirty-field set, which includes `name`, `version` and `description`), and SHALL be recomputed on every change of a touched field, so an over-limit name or description is flagged while the user types. Patches that change `authenticationType`, `withLogin`, or `isLoggedIn` SHALL clear all auth-field errors at once. The Save action SHALL stay disabled until `isToolsetFormValid` passes.

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

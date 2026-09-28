## MODIFIED Requirements

### Requirement: General step validation — name and version
`CustomAppEditor` SHALL validate the General step through `validateDeploymentCreationFields` from `@epam/ai-dial-builder-form`, passing `validateVersionPattern: SEMVER_VERSION_PATTERN`, and translate its codes with `translateDeploymentCreationErrors` (`apps/chat/src/utils/entity-field-validation.ts`). The `name` field is required, at most 256 characters, and free of control characters. The `description` field is at most 2000 characters. The `version` field is checked against the shared `DeploymentCreationForm`'s exported `SEMVER_VERSION_PATTERN`, which is stricter than that library's default character-set-only version pattern: a non-empty version must be one or more dot-separated numeric segments (e.g. `0.0.1`, `2.0`). Each field SHALL be re-validated on blur, independently of the other, so an error shown for one field does not get cleared by fixing the other. A too-long or control-character error SHALL additionally appear as soon as the value changes (see `entity-field-limits`). The Next button SHALL stay disabled while any General field is invalid. The version-invalid error message SHALL be `"Version format is invalid (example: 0.0.1)"` (`appsEditor.generalForm.versionInvalid`).

#### Scenario: Name required error on blur
- **WHEN** the Name field is blank and loses focus
- **THEN** a name-required error is shown under the Name field

#### Scenario: Version format error on blur
- **WHEN** the Version field contains a value that is not entirely dot-separated numeric segments (e.g. contains letters) and loses focus
- **THEN** a version-invalid error ("Version format is invalid (example: 0.0.1)") is shown under the Version field

#### Scenario: Over-long name shows while typing
- **WHEN** the user types a 257th character into the Name field
- **THEN** "Use 256 characters or fewer." (`editor.fieldTooLong`) is shown under the Name field without waiting for blur

#### Scenario: Next disabled while General step invalid
- **WHEN** the Name, Description or Version field currently holds an invalid value
- **THEN** the Next button is disabled

# Spec Delta

## MODIFIED Requirements

### Requirement: General step validation — name and version
`CustomAppEditor` SHALL validate metadata through `useMetadataForm` with `validateVersionPattern: true`, i.e. the shared resource version rule (`resource-version-pattern`), in create mode, and with `STORED_VERSION_PATTERN` in edit mode. `name` is required. A non-empty version must match that rule: 1 to 64 letters, digits, underscores, dots, plus signs or hyphens, not ending with a dot, not containing `__` and not starting with `_` (e.g. `0.0.1`, `beta-2`).

Each field's error SHALL appear once that field has been touched (on blur), independently of the other field. All errors SHALL appear on a submit attempt. The primary button SHALL NOT be disabled for validation reasons. Instead, a submit attempt with invalid metadata SHALL show the errors, focus the first invalid field and send no request.

The version-invalid error message SHALL be `"Version format is invalid (example: 0.0.1)"` (`appsEditor.generalForm.versionInvalid`).

#### Scenario: Name required error on blur
- **WHEN** the Name field is blank and loses focus
- **THEN** a name-required error is shown under the Name field

#### Scenario: Version format error on blur
- **WHEN** the Version field contains a value that breaks the shared rule (e.g. contains a space, ends with a dot, contains `__`, starts with `_`, or is longer than 64 characters) and loses focus
- **THEN** a version-invalid error ("Version format is invalid (example: 0.0.1)") is shown under the Version field

#### Scenario: Submit attempt with invalid metadata
- **WHEN** the Name or Version field holds an invalid value and the user clicks Create
- **THEN** the errors are shown, focus moves to the first invalid field, and no request is sent

### Requirement: `UpdateApplicationBodyDto` — settings fields
`UpdateApplicationBodyDto` (`apps/chat-api/src/applications/dto/update-application.dto.ts`) SHALL accept the following optional settings fields:
- `version` — string matching the shared resource version rule (`resource-version-pattern`)
- `endpoint` — URL string (protocol required, TLD not required, trailing dot allowed)
- `features` — `Record<string, unknown>` object
- `inputAttachmentTypes` — `string[]`, each entry matching a MIME-type pattern such as `image/png`
- `maxInputAttachments` — number ≥ 0

`type` is not a DTO field. `applicationProperties` is an optional object (or `null`) used by schema-based editors: when supplied it fully replaces the stored `application_properties`; omitted or `null`, it leaves them unchanged. The Custom App editor does not send it.

#### Scenario: Settings fields survive validation, excluded fields are rejected
- **WHEN** an update body carries `version`, `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` with valid values
- **THEN** the DTO validates and forwards all five
- **AND** a body that also carries `type` is rejected by the global validation pipe (`forbidNonWhitelisted`)

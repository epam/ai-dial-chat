## MODIFIED Requirements

### Requirement: Metadata section fields
The Metadata section SHALL allow editing the toolset avatar, name, version, description, and topics. The avatar SHALL be picked via the shared `AddAvatar` control (preview box plus "Add avatar" button), which opens the `AvatarPickerModal` file manager restricted to a single image up to a host-configured size, rather than a plain URL text field. The name and description fields SHALL also allow editing translations for additional locales through the shared `DeploymentLocalesField` popup, which is present only while the host supplies a non-empty `availableLocaleOptions` (see `builder-form`). These fields SHALL be rendered through the toolset-editor lib's `GeneralForm` component, which wraps the shared `DeploymentCreationForm` component from `@epam/ai-dial-builder-form`. The Metadata section SHALL NOT contain any connection or authentication fields.

The Version field SHALL be validated against the shared `builder-form` library's default `VERSION_PATTERN` (via `validateDeploymentCreationFields` with `validateVersionPattern: true`) — letters, digits, dots, underscores, and dashes are all allowed, unlike the stricter dot-separated-numeric-only pattern the Quick App and Custom App editors use. A non-empty version that contains any other character SHALL surface a version-invalid error (`toolsetEditor.general.versionInvalid`, "Version may only contain letters, digits, dots, underscores, and dashes") under the Version field and SHALL keep the Save button disabled.

The Name field SHALL be at most 256 characters and SHALL NOT contain control characters. The Description field SHALL be at most 2000 characters (see `entity-field-limits`). The host SHALL pass the translated `editor.fieldTooLong` and `editor.nameControlCharacters` messages as `labels.validation.nameTooLong`, `nameControlCharacters` and `descriptionTooLong`, so these errors appear inline under their fields. The BFF's DTO message SHALL NOT surface as a toast for a rule the client already enforces.

#### Scenario: Version format error
- **WHEN** a user types a version containing a character outside letters, digits, dots, underscores, and dashes (e.g. a space or `/`)
- **THEN** a version-invalid error is shown under the Version field and the Save button stays disabled

#### Scenario: Letters-only version is accepted
- **WHEN** a user types a version made only of letters, digits, dots, underscores, and dashes (e.g. `abc` or `1.0-beta`)
- **THEN** no version error is shown

#### Scenario: Edit metadata fields
- **WHEN** a user picks an avatar image and types a name, version, description, and adds topic tags
- **THEN** those values are held in component state without saving

#### Scenario: Pick an avatar image
- **WHEN** a user clicks "Add avatar" in the Metadata section
- **THEN** the file manager opens restricted to a single allowed image type up to the configured size, and selecting one replaces the placeholder icon with that image while leaving the "Add avatar" button in place so the user can pick a different file

#### Scenario: Edit an additional-locale translation
- **WHEN** a user opens the "Add locale" popup in the Metadata section and adds a translated name and description for another language
- **THEN** that translation is held in component state until the toolset is next saved

#### Scenario: Name is required
- **WHEN** a user clears the name field and attempts to save
- **THEN** the system shows a required-field error for the name and blocks the save

#### Scenario: Name with a line break is flagged inline
- **WHEN** a user pastes a name containing a line break
- **THEN** "Remove line breaks, tabs and other control characters." is shown under the Name field, Save stays disabled, and no top-of-screen notification is raised

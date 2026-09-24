## MODIFIED Requirements

### Requirement: Custom App editor page
The system SHALL render the Custom App editor through the generic `ApplicationEditorPage` with `kind = ApplicationEditorKind.CustomApp` (see `application-editor-registry`), on the unchanged route `ROUTES.CustomAppEditor`.

The editor is a single page with the shared `EntityEditor` layout:

- **Header.** A back arrow and the title `customApp.createTitle` ("Create custom app") or `customApp.editTitle` ("Edit custom app"). Cancel and a Create/Save button sit at the inline end.
- **Metadata section (left).** The shared `MetadataForm`: Avatar, Name*, Version, Description, Locales, Tags. The Name and Description placeholders come from `customApp.general.*`.
- **Setup section (right).** `CustomAppSetup`, with the four fields specified in "CustomAppSettingsForm fields".

The editor SHALL NOT render a step indicator, a Next button or a footer button bar on desktop. The editor supports both **create** and **edit** modes. Edit mode is entered when `ToolsetEditorQuery.Id` is present in the URL.

Clicking Create or Save SHALL open the existing save `ConfirmationPopup` (`customApp.saveConfirm*`) before sending the request (`ApplicationCreateStrategy.AllAtOnce`).

#### Scenario: Navigate to custom app editor (create)
- **WHEN** user clicks "Custom App" in the catalog
- **THEN** the app navigates to the Custom App Editor with no `id` query param (creation mode)

#### Scenario: Navigate to custom app editor (edit)
- **WHEN** user clicks the Edit button on a schema-less custom app in the catalog and `OverlayFeature.CustomApps` is enabled
- **THEN** the app navigates to the Custom App Editor with `id=<applicationId>` (edit mode)

#### Scenario: Metadata and Setup visible together
- **WHEN** the editor opens at desktop width
- **THEN** the "Metadata" section with the shared fields and the "Setup" section with Features data, Attachment types, Max attachments number and Chat completion URL are visible at the same time, with no step navigation

#### Scenario: Sections stack on mobile
- **WHEN** the editor opens at mobile width
- **THEN** Metadata renders above Setup, and Cancel/Create render in the bottom action bar

### Requirement: General step validation — name and version
`CustomAppEditor` SHALL validate metadata through `useMetadataForm` with `validateVersionPattern: SEMVER_VERSION_PATTERN`. `name` is required. A non-empty version must be one or more dot-separated numeric segments (e.g. `0.0.1`, `2.0`).

Each field's error SHALL appear once that field has been touched (on blur), independently of the other field. All errors SHALL appear on a submit attempt. The primary button SHALL NOT be disabled for validation reasons. Instead, a submit attempt with invalid metadata SHALL show the errors, focus the first invalid field and send no request.

The version-invalid error message SHALL be `"Version format is invalid (example: 0.0.1)"` (`appsEditor.generalForm.versionInvalid`).

#### Scenario: Name required error on blur
- **WHEN** the Name field is blank and loses focus
- **THEN** a name-required error is shown under the Name field

#### Scenario: Version format error on blur
- **WHEN** the Version field contains a value that is not entirely dot-separated numeric segments (e.g. contains letters) and loses focus
- **THEN** a version-invalid error ("Version format is invalid (example: 0.0.1)") is shown under the Version field

#### Scenario: Submit attempt with invalid metadata
- **WHEN** the Name or Version field holds an invalid value and the user clicks Create
- **THEN** the errors are shown, focus moves to the first invalid field, and no request is sent

### Requirement: Save validation — name required
The name-required check SHALL be performed once, by `useMetadataForm`, and SHALL NOT be duplicated in the page. Activating Create or Save while `name` is blank SHALL send no request.

#### Scenario: Saving with a blank name
- **WHEN** user clicks Save and `name` is blank
- **THEN** a name-required error is shown under Name, focus moves to Name, and no API call is made

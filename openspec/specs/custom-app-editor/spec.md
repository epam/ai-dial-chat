## ADDED Requirements

### Requirement: Custom App editor page
The system SHALL provide a `CustomAppEditor` page that reuses `ToolsetEditorHeader` and a new `CustomAppEditorView`. The editor has two steps: General and Settings. The General step reuses `GeneralForm`. The Settings step renders `CustomAppSettingsForm`. The editor supports both **create** and **edit** modes; edit mode is entered when `ToolsetEditorQuery.Id` is present in the URL.

#### Scenario: Navigate to custom app editor (create)
- **WHEN** user clicks "Custom App" in the catalog
- **THEN** the app navigates to the Custom App Editor with no `id` query param (creation mode)

#### Scenario: Navigate to custom app editor (edit)
- **WHEN** user clicks the Edit button on a schema-less custom app in the catalog and `OverlayFeature.CustomApps` is enabled
- **THEN** the app navigates to the Custom App Editor with `id=<applicationId>` (edit mode)

#### Scenario: General step shown first
- **WHEN** the editor opens
- **THEN** the General step is active and `GeneralForm` is rendered

#### Scenario: Settings step renders custom form
- **WHEN** user proceeds to the Settings step
- **THEN** `CustomAppSettingsForm` is rendered with four fields: Chat completion URL, Features data, Attachment types, Max attachments number

### Requirement: CustomAppSettingsForm fields
The `CustomAppSettingsForm` SHALL contain exactly four fields rendered in this order:
1. **Chat completion URL** — `<Input>` field, validated as a valid absolute URL; error shown on invalid value
2. **Features data** — `<Textarea>` with description "Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format." and JSON placeholder
3. **Attachment types** — `<TagInput>` for MIME type entries
4. **Max attachments number** — `<Input type="number">` with minimum value 1

#### Scenario: Chat completion URL validation
- **WHEN** user enters an invalid URL in the Chat completion URL field and submits
- **THEN** an error message is shown and the form does not submit

#### Scenario: Features data placeholder
- **WHEN** the Features data textarea is empty
- **THEN** the placeholder shows `{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`

#### Scenario: Max attachments accepts only positive integers
- **WHEN** user enters a value less than 1 in Max attachments number
- **THEN** an error is shown

#### Scenario: Attachment types tag input
- **WHEN** user types a MIME type and confirms
- **THEN** it is added as a tag in the Attachment types field

### Requirement: Create — no type sent
On save in creation mode, `CustomAppEditor` SHALL NOT send `type` in the create payload. Custom apps are plain-endpoint applications with no application-type schema ID; `application_type_schema_id` is omitted from the DIAL Core body.

### Requirement: Save validation — name required
- **WHEN** user clicks Save and `name` is blank
- **THEN** the editor redirects to the General step and shows a name-required error; no API call is made

### Requirement: Edit mode — load settings from backend
When opening the editor in edit mode, `CustomAppEditor` SHALL pre-populate all Settings fields from the deployment details returned by `GET /api/v1/deployments/:id/details`.

The backend (`DeploymentsService.buildApplicationDetails`) SHALL call `getCustomApplication(bucket, path)` for `applications/{bucket}/{path}` IDs to retrieve the full stored config (the model-listing endpoint does not expose `endpoint`). The resolved `endpoint` SHALL prefer `customAppRaw.endpoint`; `features` from `customAppRaw` SHALL be merged into `applicationProperties` so the Settings textarea receives them.

> **Note:** DIAL Core expands stored features with all defaults when returning `getCustomApplication`. The textarea will show the full expanded object, not only what the user originally entered.

#### Scenario: Settings step pre-populated in edit mode
- **WHEN** editor opens in edit mode
- **THEN** Chat completion URL, Features data, Attachment types, and Max attachments are pre-populated from the deployment details

### Requirement: Edit mode — save settings
On save in edit mode, `CustomAppEditor` SHALL call `PATCH /api/v1/applications/:id` with all changed General and Settings fields. The `UpdateApplicationBodyDto` accepts optional `version`, `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` in addition to the existing general fields. `type` and `applicationProperties` remain excluded from the update body.

#### Scenario: Settings fields sent on edit save
- **WHEN** user saves in edit mode
- **THEN** `endpoint`, `features` (parsed JSON), `inputAttachmentTypes`, `maxInputAttachments`, and `version` are included in the PATCH body when non-empty

### Requirement: `UpdateApplicationBodyDto` — settings fields
`UpdateApplicationBodyDto` SHALL accept the following optional settings fields:
- `version` — string matching `/^[a-zA-Z0-9._-]+$/`
- `endpoint` — URL string (protocol required, TLD not required)
- `features` — `Record<string, unknown>` object
- `inputAttachmentTypes` — `string[]`
- `maxInputAttachments` — number ≥ 0

`type` and `applicationProperties` remain excluded.

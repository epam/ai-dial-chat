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
- **THEN** `CustomAppSettingsForm` is rendered with four fields: Features data, Attachment types, Max attachments number, Chat completion URL

### Requirement: CustomAppSettingsForm fields
The `CustomAppSettingsForm` SHALL contain exactly four fields rendered in this order:
1. **Features data** — `<Textarea>` with description "Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format." and JSON placeholder
2. **Attachment types** — `<TagInput>` for MIME type entries
3. **Max attachments number** — `<Input type="number">` with minimum value 0
4. **Chat completion URL** — `<Input>` field, validated on blur as a valid absolute URL; distinct errors are shown for an empty value versus an invalid value

The Save action on the Settings step SHALL stay disabled until the Chat completion URL is a valid absolute URL (`isValidAbsoluteUrl`), not merely non-empty.

#### Scenario: Chat completion URL blur validation — empty
- **WHEN** the Chat completion URL field is empty and loses focus
- **THEN** a "required" error message is shown

#### Scenario: Chat completion URL blur validation — invalid
- **WHEN** user enters a non-absolute-URL value in the Chat completion URL field and the field loses focus
- **THEN** an "invalid URL" error message is shown

#### Scenario: Save disabled until URL is valid
- **WHEN** the Chat completion URL field does not hold a valid absolute URL
- **THEN** the Save button is disabled

#### Scenario: Features data placeholder
- **WHEN** the Features data textarea is empty
- **THEN** the placeholder shows `{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`

#### Scenario: Features data rejects unknown keys
- **WHEN** the Features data textarea contains a JSON object with any key other than `rate_endpoint` or `configuration_endpoint`
- **THEN** the field is treated as invalid, even if it also contains one of the allowed keys

#### Scenario: Max attachments accepts only positive integers
- **WHEN** user enters a value less than 1 in Max attachments number
- **THEN** an error is shown

#### Scenario: Attachment types tag input
- **WHEN** user types a MIME type and confirms
- **THEN** it is added as a tag in the Attachment types field

### Requirement: Create — no type sent
On save in creation mode, `CustomAppEditor` SHALL NOT send `type` in the create payload. Custom apps are plain-endpoint applications with no application-type schema ID; `application_type_schema_id` is omitted from the DIAL Core body.

### Requirement: General step validation — name and version
`CustomAppEditor` SHALL validate the `name` field as required and the `version` field against the shared `DeploymentCreationForm` version pattern (via `validateDeploymentCreationFields` from `@epam/ai-dial-deployment-creation-form`). Each field SHALL be re-validated on blur, independently of the other, so an error shown for one field does not get cleared by fixing the other. The Next button SHALL stay disabled while either field is invalid.

#### Scenario: Name required error on blur
- **WHEN** the Name field is blank and loses focus
- **THEN** a name-required error is shown under the Name field

#### Scenario: Version format error on blur
- **WHEN** the Version field contains a value that does not match the allowed version pattern and loses focus
- **THEN** a version-invalid error is shown under the Version field

#### Scenario: Next disabled while General step invalid
- **WHEN** the Name or Version field currently holds an invalid value
- **THEN** the Next button is disabled

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

### Requirement: Edit mode — deployment resolution waits for shared context
`CustomAppEditor` SHALL populate `generalForm` (name, description, icon, version, topics, other locales) from the matching entry in `useDeployments().items`, and SHALL keep re-resolving that match whenever the deployments list updates until a match is found — not only once at mount. This covers the case where the editor is opened for a just-accepted shared item before `DeploymentsContext` has finished propagating the corrected shared-context entry (`isMy`/`canEdit`/`sharedWithMe`); the editor SHALL NOT get stuck showing empty/placeholder General fields for that item. Once a match is found and applied, it SHALL NOT be re-applied again for the same deployment id, so it never overwrites in-progress user edits. If the deployments list finishes loading (`useDeployments().isLoading` becomes `false`) without ever producing a match, `CustomAppEditor` SHALL stop waiting rather than block indefinitely.

Settings-form fields fetched directly from `GET /api/v1/deployments/:id/details` SHALL be populated as soon as that response arrives, independently of whether the deployment list match has resolved yet.

#### Scenario: Shared item resolves after deployments list updates
- **WHEN** the editor opens in edit mode for an item that is not yet present (or not yet marked as shared) in `useDeployments().items`, and the list is subsequently updated with the resolved shared-context entry
- **THEN** the General step fields (name, description, icon, version, topics) update to reflect that entry without requiring a page refresh

#### Scenario: Resolution gives up once the list finishes loading with no match
- **WHEN** `useDeployments().isLoading` transitions to `false` and no entry in `items` matches the edited deployment id
- **THEN** `CustomAppEditor` stops waiting and does not show the loading overlay indefinitely

### Requirement: Loading overlay while resolving edit-mode context
After the initial `GET /api/v1/deployments/:id/details` request completes, if the matching deployment entry has not yet been resolved from `useDeployments().items`, `CustomAppEditor` SHALL render the same blocking overlay pattern used for saving (spinner plus a translated "Loading…" label) over the editor content and mark the underlying form `inert`, instead of showing the editor with incomplete General-step fields.

#### Scenario: Overlay shown while deployment match is still resolving
- **WHEN** edit mode has finished the initial details fetch but the deployment entry has not yet been resolved from the deployments list
- **THEN** a spinner overlay with an `aria-live` status label and a "Loading…" message is shown, and the editor form beneath it is `inert`

#### Scenario: Overlay hidden once resolved
- **WHEN** the deployment entry is resolved and applied to the General step, or resolution gives up because the deployments list finished loading with no match
- **THEN** the loading overlay is removed and the editor form is interactive again

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

### Requirement: Saving overlay
While a save request is in flight, `CustomAppEditor` SHALL render a blocking overlay (spinner plus a translated "Saving in progress…" label) over the editor content and mark the underlying form `inert` so it cannot be interacted with or reached by keyboard focus.

#### Scenario: Overlay shown during save
- **WHEN** the user triggers Save and the request is pending
- **THEN** a spinner overlay with an `aria-live` status label is shown and the editor form beneath it is `inert`

### Requirement: Save/create failure surfaces API error details
On a failed create/save request, `CustomAppEditor` SHALL extract the error message and trace ID via `getApiErrorDetails` and show them in the error notification (`requestId` set to the trace ID), falling back to the generic create/save-failed translation only when the API did not provide a message.

#### Scenario: API error message shown
- **WHEN** the create or save request fails and the API response includes an error message
- **THEN** the notification shows that message and includes the trace ID as `requestId`

#### Scenario: Generic error fallback
- **WHEN** the create or save request fails and the API response has no error message
- **THEN** the notification falls back to the generic create-failed or save-failed translation

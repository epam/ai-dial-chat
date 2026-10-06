# custom-app-editor Specification

## Purpose

The Custom App editor page: its settings form, create and edit flows, validation, and the loading and saving overlays.
## Requirements
### Requirement: Custom App editor page
The system SHALL render the Custom App editor through the generic `ApplicationEditorPage` with `kind = ApplicationEditorKind.CustomApp` (see `application-editor-registry`), on the unchanged route `ROUTES.CustomAppEditor` (`/custom-app-editor`). There is no dedicated `CustomAppEditor` component: the behaviour below is the shared `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) driven by `customAppDefinition` (`apps/chat/src/pages/ApplicationEditor/definitions/customAppDefinition.tsx`); "`CustomAppEditor`" in this spec names that combination.

The editor is a single page with the shared `EntityEditor` layout:

- **Header.** A back arrow and the title `customApp.createTitle` ("Create custom app") or `customApp.editTitle` ("Edit custom app"). Cancel and a Create/Save button sit at the inline end.
- **Metadata section (left).** The shared `MetadataForm`: Avatar, Name*, Version, Description, Locales, Tags. The Name and Description placeholders come from `customApp.general.*`.
- **Setup section (right).** `CustomAppSetup`, with the four fields specified in "CustomAppSettingsForm fields".

The editor SHALL NOT render a step indicator, a Next button or a footer button bar on desktop. The editor supports both **create** and **edit** modes. Edit mode is entered when `ToolsetEditorQuery.Id` is present in the URL.

Create mode uses `ApplicationCreateStrategy.AllAtOnce`. Clicking Create or Save SHALL open the existing save `ConfirmationPopup` (`customApp.saveConfirm*`, title "Only valid data will be saved") before sending the request only when the definition's `needsConfirmation` holds — i.e. the Features data is not valid (`!isValidFeaturesData`); otherwise the request is sent directly. Blocking setup errors (Chat completion URL, MIME types) are reported before and instead of the confirmation.

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

### Requirement: CustomAppSettingsForm fields
The Setup section, `CustomAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/CustomAppSetup.tsx`), SHALL contain exactly four fields rendered in this order:
1. **Features data** — `<Textarea>` with caption "Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format." and JSON placeholder; an invalid value shows `customApp.settings.featuresDataInvalid` inline
2. **Attachment types** — `<TagInput>` for MIME type entries
3. **Max attachments number** — `<Input type="number">` labelled "Max. input attachments" with `min={0}`
4. **Chat completion URL** — required `<Input>` field, validated on blur as a valid absolute URL; distinct errors are shown for an empty value (`customApp.settings.completionUrlRequired`) versus an invalid value (`customApp.settings.completionUrlInvalid`)

The Create/Save button SHALL NOT be disabled for validation reasons. A submit attempt while the Chat completion URL is not a valid absolute URL (`isValidAbsoluteUrl`), not merely non-empty, SHALL show the field error and send no request.

#### Scenario: Chat completion URL blur validation — empty
- **WHEN** the Chat completion URL field is empty and loses focus
- **THEN** a "required" error message is shown

#### Scenario: Chat completion URL blur validation — invalid
- **WHEN** user enters a non-absolute-URL value in the Chat completion URL field and the field loses focus
- **THEN** an "invalid URL" error message is shown

#### Scenario: Save blocked until URL is valid
- **WHEN** the Chat completion URL field does not hold a valid absolute URL and the user clicks Create or Save
- **THEN** the Chat completion URL error is shown and no request is sent

#### Scenario: Features data placeholder
- **WHEN** the Features data textarea is empty
- **THEN** the placeholder shows `{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`

#### Scenario: Features data rejects unknown keys
- **WHEN** the Features data textarea contains a JSON object with any key other than `rate_endpoint` or `configuration_endpoint`
- **THEN** the field is treated as invalid, even if it also contains one of the allowed keys

#### Scenario: Max attachments accepts non-negative integers
- **WHEN** user enters a number in Max attachments number
- **THEN** it is parsed as an integer and the input enforces a minimum of 0, with no inline error

#### Scenario: Attachment types tag input
- **WHEN** user types a MIME type and confirms
- **THEN** it is added as a tag in the Attachment types field

### Requirement: Attachment types — invalid MIME type blocks save
A non-MIME-type entry MAY still be accepted as a tag in the Attachment types `TagInput` (the field shows an inline error as soon as the tag is added), but `CustomAppEditor` SHALL treat that inline error as blocking, the same way it treats the Chat completion URL error: clicking Save while any tag fails MIME-type validation SHALL set the field error and send no request, instead of routing through the "save anyway" confirmation used for other soft warnings (e.g. Features data). This differs from the Features-data-invalid case specifically because letting an invalid tag reach the create/update request has been observed to also silently drop unrelated Settings fields (e.g. Max attachments number) from what gets persisted; blocking the request is the fix, not merely a stricter opinion on tag content.

#### Scenario: Save blocked by an invalid MIME type tag
- **WHEN** the Attachment types field contains at least one tag that is not a valid MIME type and the user clicks Save
- **THEN** the Attachment types field shows an "invalid MIME type" error and no create/update request is sent

#### Scenario: Unrelated fields are unaffected by a blocked save
- **WHEN** a save attempt is blocked by an invalid MIME type tag
- **THEN** other Settings field values (e.g. Max attachments number) are left exactly as entered, since no request was sent and no reload occurred

### Requirement: Create — no type sent
On save in creation mode, `CustomAppEditor` SHALL NOT send `type` in the create payload. Custom apps are plain-endpoint applications with no application-type schema ID; `application_type_schema_id` is omitted from the DIAL Core body.

#### Scenario: Create payload omits the schema id
- **WHEN** the user saves a new custom app
- **THEN** the create request body carries no `type` field and no `application_type_schema_id`

### Requirement: General step validation — name and version
`CustomAppEditor` SHALL validate metadata through `useMetadataForm` with `validateVersionPattern: SEMVER_VERSION_PATTERN`. `name` is required. A non-empty version must be a SemVer 2.0.0 version (e.g. `1.0.0`, `1.0.0-beta`, `1.0.0+build`), the rule DIAL Admin applies.

Each field's error SHALL appear once that field has been touched (on blur), independently of the other field. All errors SHALL appear on a submit attempt. The primary button SHALL NOT be disabled for validation reasons. Instead, a submit attempt with invalid metadata SHALL show the errors, focus the first invalid field and send no request.

The version-invalid error message SHALL be `"Version must follow semantic versioning (e.g., 1.0.0)"` (`editor.versionInvalid`).

#### Scenario: Name required error on blur
- **WHEN** the Name field is blank and loses focus
- **THEN** a name-required error is shown under the Name field

#### Scenario: Version format error on blur
- **WHEN** the Version field contains a value that is not SemVer 2.0.0 (e.g. `1.2` or `abc`) and loses focus
- **THEN** a version-invalid error ("Version must follow semantic versioning (e.g., 1.0.0)") is shown under the Version field

#### Scenario: Pre-release and build metadata are accepted
- **WHEN** the Version field contains `1.0.0-beta` or `1.0.0+build` and loses focus
- **THEN** no version error is shown

#### Scenario: Submit attempt with invalid metadata
- **WHEN** the Name or Version field holds an invalid value and the user clicks Create
- **THEN** the errors are shown, focus moves to the first invalid field, and no request is sent

### Requirement: Save validation — name required
The name-required check SHALL be performed once, by `useMetadataForm`, and SHALL NOT be duplicated in the page. Activating Create or Save while `name` is blank SHALL send no request.

#### Scenario: Saving with a blank name
- **WHEN** user clicks Save and `name` is blank
- **THEN** a name-required error is shown under Name, focus moves to Name, and no API call is made

### Requirement: Edit mode — load settings from backend
When opening the editor in edit mode, `CustomAppEditor` SHALL pre-populate all Settings fields from the deployment details returned by `GET /api/v1/deployments/:id/details`.

The backend (`buildApplicationDetails` in `apps/chat-api/src/deployments/details/deployments-details.service.ts`) SHALL call `getCustomApplication(bucket, path)` for `applications/{bucket}/{path}` IDs to retrieve the full stored config (the model-listing endpoint does not expose `endpoint`). The resolved `endpoint` SHALL prefer `customAppRaw.endpoint`; the top-level `features` from `customAppRaw` SHALL be returned as `applicationDetails.customAppFeatures` (distinct from `applicationProperties`), which `loadSetup` serialises into the Features data textarea. If the details request fails, the editor shows `customApp.error.loadFailed` and navigates back to the catalog.

> **Note:** DIAL Core expands stored features with all defaults when returning `getCustomApplication`. The textarea will show the full expanded object, not only what the user originally entered.

#### Scenario: Settings step pre-populated in edit mode
- **WHEN** editor opens in edit mode
- **THEN** Chat completion URL, Features data, Attachment types, and Max attachments are pre-populated from the deployment details

### Requirement: Edit mode — deployment resolution waits for shared context
`CustomAppEditor` SHALL populate the metadata form (name, description, icon, version, topics, other locales) from the matching entry in `useDeployments().items`, resolved by `useEditedApplication` (`apps/chat/src/hooks/application-editor/useEditedApplication.ts`), and SHALL keep re-resolving that match whenever the deployments list updates until a match is found — not only once at mount. This covers the case where the editor is opened for a just-accepted shared item before `DeploymentsContext` has finished propagating the corrected shared-context entry (`isMy`/`canEdit`/`sharedWithMe`); the editor SHALL NOT get stuck showing empty/placeholder General fields for that item. Once a match is found and applied, it SHALL NOT be re-applied again for the same deployment id, so it never overwrites in-progress user edits. If the deployments list finishes loading (`useDeployments().isLoading` becomes `false`) without ever producing a match, `CustomAppEditor` SHALL stop waiting rather than block indefinitely.

Settings-form fields fetched directly from `GET /api/v1/deployments/:id/details` SHALL be populated as soon as that response arrives, independently of whether the deployment list match has resolved yet.

#### Scenario: Shared item resolves after deployments list updates
- **WHEN** the editor opens in edit mode for an item that is not yet present (or not yet marked as shared) in `useDeployments().items`, and the list is subsequently updated with the resolved shared-context entry
- **THEN** the General step fields (name, description, icon, version, topics) update to reflect that entry without requiring a page refresh

#### Scenario: Resolution gives up once the list finishes loading with no match
- **WHEN** `useDeployments().isLoading` transitions to `false` and no entry in `items` matches the edited deployment id
- **THEN** `CustomAppEditor` stops waiting and does not show the loading overlay indefinitely

### Requirement: Loading overlay while resolving edit-mode context
While the edit-mode `GET /api/v1/deployments/:id/details` request is pending, or the matching deployment entry has not yet been resolved from `useDeployments().items` (`useEditedApplication().isResolving`), `CustomAppEditor` SHALL render the same blocking overlay pattern used for saving (spinner plus a translated "Loading…" label, `customApp.loadingOverlay`) over the editor content and mark the underlying form `inert`, instead of showing the editor with incomplete fields.

#### Scenario: Overlay shown while deployment match is still resolving
- **WHEN** edit mode is still fetching the details, or has finished it but the deployment entry has not yet been resolved from the deployments list
- **THEN** a spinner overlay with an `aria-live` status label and a "Loading…" message is shown, and the editor form beneath it is `inert`

#### Scenario: Overlay hidden once resolved
- **WHEN** the deployment entry is resolved and applied to the General step, or resolution gives up because the deployments list finished loading with no match
- **THEN** the loading overlay is removed and the editor form is interactive again

### Requirement: Edit mode — save settings
On save in edit mode, `CustomAppEditor` SHALL call `PATCH /api/v1/applications/:id` with the General and Settings fields. The `UpdateApplicationBodyDto` accepts optional `version`, `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` in addition to the existing general fields. The Custom App editor never sends `type` or `applicationProperties` in the update body.

#### Scenario: Settings fields sent on edit save
- **WHEN** user saves in edit mode
- **THEN** `name`, `endpoint` (trimmed), `features` (parsed JSON), `inputAttachmentTypes`, `maxInputAttachments`, `version`, and the locale fields (`locales`/`primaryLocale`) are included in the PATCH body when non-empty

### Requirement: `UpdateApplicationBodyDto` — settings fields
`UpdateApplicationBodyDto` (`apps/chat-api/src/applications/dto/update-application.dto.ts`) SHALL accept the following optional settings fields:
- `version` — a SemVer 2.0.0 string matching `SEMVER_VERSION_PATTERN` (`apps/chat-api/src/common/validators/semver-version.pattern.ts`)
- `endpoint` — URL string (protocol required, TLD not required, trailing dot allowed)
- `features` — `Record<string, unknown>` object
- `inputAttachmentTypes` — `string[]`, each entry matching a MIME-type pattern such as `image/png`
- `maxInputAttachments` — number ≥ 0

`type` is not a DTO field. `applicationProperties` is an optional object (or `null`) used by schema-based editors: when supplied it fully replaces the stored `application_properties`; omitted or `null`, it leaves them unchanged. The Custom App editor does not send it.

#### Scenario: Settings fields survive validation, excluded fields are rejected
- **WHEN** an update body carries `version`, `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` with valid values
- **THEN** the DTO validates and forwards all five
- **AND** a body that also carries `type` is rejected by the global validation pipe (`forbidNonWhitelisted`)

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

### Requirement: Successful create or save confirms itself

`CustomAppEditor` SHALL raise a success notification when a create (`POST /api/v1/applications`) or save (`PATCH /api/v1/applications/:id`) request resolves, before or in the same tick as the navigation to the return URL, through `useOperationNotification` (see `entity-operation-notifications`).

- Create → `NotifiableEntity.CustomApp` + `EntityOperation.Created`, `name` = the application's name.
- Save → `NotifiableEntity.CustomApp` + `EntityOperation.Edited`, same `name`.

The success notification is raised after the deployments list is refetched. The failure path is unchanged (see "Save/create failure surfaces API error details"): the error notification with `requestId` stays exactly as specified, and no success notification is raised.

#### Scenario: Create confirms and returns

- **WHEN** a user creates a custom app and the create request succeeds
- **THEN** a success notification titled `"Custom app created successfully"` naming the app is shown and the editor navigates to the return URL

#### Scenario: Save confirms and returns

- **WHEN** a user saves an existing custom app and the PATCH succeeds
- **THEN** a success notification titled `"Custom app edited successfully"` naming the app is shown and the editor navigates to the return URL

#### Scenario: Failed save raises only the error notification

- **WHEN** the create or save request fails
- **THEN** the existing error notification (with the API message and trace id) is shown, the editor stays open, and no success notification is raised

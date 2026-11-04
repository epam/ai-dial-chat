## MODIFIED Requirements

### Requirement: Create strategies

`ApplicationFormEditor` SHALL persist each kind according to its definition's `createStrategy`. For a kind with a `savePanel` (every registered application kind), Create SHALL first open the Save panel (see the `resource-save-panel` capability); the create below runs on the panel's Save, through `definition.create(values, setup, context, { folderPath })` into the chosen Personal folder, and the panel shows the Created notification.

- **`ApplicationCreateStrategy.AllAtOnce`.** A single `create` or `update` call persists metadata and setup together. Success then follows the shared success path; a created application can be published to an Organization folder from the panel.
- **`ApplicationCreateStrategy.MetadataFirst`.**
  - In create mode the `Setup` component SHALL receive no `appId`, and SHALL render the `applicationEditor.setupPendingCreate` placeholder ("Create the application to configure its setup.").
  - The panel SHALL offer the Personal root only. On its Save the page SHALL call `create` with the metadata only. It SHALL then replace the URL's search params (`replace: true`) to add the new id, which switches the page into edit mode in place, and start a best-effort `refetchDeployments()` that does not block the form.
  - After that switch, the page SHALL NOT navigate away. The title becomes the edit title and the primary button becomes Save.
  - In edit mode, when the definition has no `update`, Save SHALL call the `Setup` handle's `save(metadata)`. After it resolves, the page follows the shared success path with `EntityOperation.Edited`.

#### Scenario: Metadata-first create switches to edit mode in place
- **WHEN** a user fills Name for a quick app, clicks Create, confirms the Save panel, and `createApplication` returns `{ id: "app-1" }`
- **THEN** a "Quick app created successfully" notification shows
- **AND** the URL gains `appId=app-1` without a history entry
- **AND** the header shows the edit title with a Save button
- **AND** the Setup section loads the schema editor for `app-1`

#### Scenario: All-at-once create exits after one request
- **WHEN** a user completes a custom app's Metadata and Setup, clicks Create, confirms the popup and confirms the Save panel with Personal `Design`
- **THEN** exactly one `createApplication` request is sent with metadata, setup fields and `folderPath: "Design"`, a Created notification shows, and the page navigates to `returnUrl`

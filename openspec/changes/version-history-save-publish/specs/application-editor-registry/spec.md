# Spec Delta

## MODIFIED Requirements

### Requirement: Registered kinds

`APPLICATION_EDITOR_DEFINITIONS` SHALL contain exactly these entries:

- **`CustomApp`**:
  - `AllAtOnce` strategy, `idQueryParam: ToolsetEditorQuery.Id`, with `loadSetup` and `update`.
  - Setup: `CustomAppSetup`, which holds the four fields of `custom-app-editor` "CustomAppSettingsForm fields".
  - Validation: `validateVersionPattern: true`, i.e. the shared resource version rule (`resource-version-pattern`); the editor switches it to `STORED_VERSION_PATTERN` in edit mode.
  - Confirmation: `customApp.saveConfirm.*`, shown only when `needsConfirmation` finds the features data invalid.
  - Title: `customApp.createTitle` / `customApp.editTitle`.
- **`QuickApp`** (every schema with an embedded editor):
  - `MetadataFirst` strategy, `idQueryParam: AppsEditorQuery.AppId`, notification target from `resolveSchemaNotificationTarget`.
  - Setup: `QuickAppSetup`, which holds the schema `editorUrl` iframe.
  - Preview: `QuickAppPreview` (hosting `AppPreviewChat`), available only for the Quick Apps schema, behind the `basic.preview` header button.
  - Validation: `validateNamePattern: true` and `validateVersionPattern: true`, i.e. the shared resource version rule (`resource-version-pattern`); the editor switches it to `STORED_VERSION_PATTERN` in edit mode.
  - Title: `getSchemaAppTitle`, interpolating the schema `displayName` into `appsEditor.createTitle` / `appsEditor.editTitle`.
- **`SchemaApp`** (schemas without an embedded editor):
  - `AllAtOnce` strategy, `idQueryParam: AppsEditorQuery.AppId`, notification target from `resolveSchemaNotificationTarget`.
  - Setup: `SchemaAppSetup`, a form rendered from the schema; `loadSetup` reads `applicationProperties` through `getDeploymentDetails`, and `validateSetup` rejects missing required properties with `AppsEditorI18nKeys.SchemaFormRequiredMissing`.
  - Validation and title: as for `QuickApp`.
- **`Toolset`**:
  - Uses `renderPage`, delegating to `ToolsetApplicationEditor`, which renders the `@epam/ai-dial-toolset-editor` `ToolsetEditor` container.
  - That container is wired with the same `useApplicationAvatarPicker` and `useMetadataLabels` results.

#### Scenario: Registry covers all four kinds
- **WHEN** `APPLICATION_EDITOR_DEFINITIONS` is inspected in a unit test
- **THEN** it has entries for `toolset`, `custom-app`, `quick-app` and `schema-app`, and only the toolset entry defines `renderPage`

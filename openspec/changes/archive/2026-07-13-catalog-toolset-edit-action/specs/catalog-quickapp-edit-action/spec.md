## MODIFIED Requirements

### Requirement: apps/chat marks a deployment editable only for QuickApps owned by the current user
`apps/chat`'s `mapDeploymentToCatalogItem` SHALL accept an optional `editableSchemaId` parameter and compute `isEditable` as `true` only when the deployment's `isMy` is `true` AND its `applicationTypeSchemaId` equals `editableSchemaId`. `CatalogView` SHALL resolve `editableSchemaId` by finding the QuickApp schema via the existing `isQuickAppSchema` helper over the schemas already loaded from `DeploymentsContext`, and pass it to every deployment mapped into a `CatalogItem`. Toolset editability is computed separately (see `apps/chat marks a toolset editable when owned by the current user`).

#### Scenario: Own QuickApp is editable
- **WHEN** a deployment has `isMy: true` and `applicationTypeSchemaId` equal to the resolved QuickApp schema id
- **THEN** its mapped `CatalogItem.isEditable` is `true`

#### Scenario: QuickApp owned by another user is not editable
- **WHEN** a deployment has `isMy: false` and `applicationTypeSchemaId` equal to the resolved QuickApp schema id
- **THEN** its mapped `CatalogItem.isEditable` is `false`

#### Scenario: Own application built from a different schema is not editable
- **WHEN** a deployment has `isMy: true` but `applicationTypeSchemaId` does not equal the resolved QuickApp schema id (or is absent)
- **THEN** its mapped `CatalogItem.isEditable` is `false`

#### Scenario: No QuickApp schema available
- **WHEN** no QuickApp schema can be resolved from the loaded schemas (`editableSchemaId` is `undefined`)
- **THEN** every mapped deployment's `isEditable` is `false`

### Requirement: Clicking Edit navigates to the correct editor for the item's entity type
`CatalogView` SHALL wire a single `onEdit` handler that branches on the clicked `CatalogItem`'s `type`. For `CatalogEntityType.Agent` (QuickApp) items it SHALL navigate to the Apps editor (`ROUTES.AppsEditor`) with `AppsEditorQuery.Step=AppsEditorStep.Settings`, `AppsEditorQuery.Schema` set to the resolved QuickApp schema id, `AppsEditorQuery.AppId` set to the item's `id`, and `AppsEditorQuery.ReturnUrl` set to `ROUTES.Catalog`, without setting `AppsEditorQuery.IsCreating`. For `CatalogEntityType.Toolset` items it SHALL navigate to `ROUTES.ToolsetEditor` with `ToolsetEditorQuery.Id` set to the item's `id` and `ToolsetEditorQuery.ReturnUrl` set to `ROUTES.Catalog`. The label passed as `editActionLabel` SHALL remain the existing `ButtonsI18nKeys.Edit` translation for both entity types — no new i18n key is introduced.

#### Scenario: Edit opens the Settings step with the existing app pre-loaded
- **WHEN** the user opens the Catalog, opens the details panel for a QuickApp they own, and clicks "Edit"
- **THEN** the app navigates to the Apps editor with `step=settings`, `schema=<quickAppSchemaId>`, `appId=<item.id>`, and `returnUrl=/catalog`
- **AND** the Apps editor shows that app's Settings step (its existing configuration), not the General step and not the create flow

#### Scenario: Edit opens the Toolset editor with the existing toolset pre-loaded
- **WHEN** the user opens the Catalog, opens the details panel for a toolset they own, and clicks "Edit"
- **THEN** the app navigates to `ROUTES.ToolsetEditor` with `id=<item.id>` and `returnUrl=/catalog`
- **AND** the Toolset editor loads that toolset's existing configuration in edit mode, not the create flow

#### Scenario: Returning from either editor goes back to the Catalog
- **WHEN** the user clicks Edit from the Catalog on either a QuickApp or a toolset, then Cancels or Saves in the corresponding editor
- **THEN** the editor navigates back to `ROUTES.Catalog` (`returnUrl`), exactly as it does for the existing "Create QuickApp" and "Create Toolset" flows

## ADDED Requirements

### Requirement: apps/chat marks a toolset editable when owned by the current user
`apps/chat`'s `mapToolsetToCatalogItem` SHALL compute `isEditable` as `toolset.isMy ?? false` — every toolset owned by the current user is editable, with no schema-type restriction (unlike QuickApps, toolsets have no non-editable variant to exclude).

#### Scenario: Own toolset is editable
- **WHEN** a toolset has `isMy: true`
- **THEN** its mapped `CatalogItem.isEditable` is `true`

#### Scenario: Toolset owned by another user is not editable
- **WHEN** a toolset has `isMy: false` (or `undefined`)
- **THEN** its mapped `CatalogItem.isEditable` is `false`

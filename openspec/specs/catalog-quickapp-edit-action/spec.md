# Spec: catalog-quickapp-edit-action

## Requirements

### Requirement: CatalogItem exposes a generic editability flag
`CatalogItem` (`libs/catalog`) SHALL expose an optional `isEditable?: boolean` field. The lib SHALL NOT itself determine this value from any app-specific or DIAL-specific concept (e.g. "QuickApp schema"); it is supplied entirely by the consuming application.

#### Scenario: Field defaults to falsy when omitted
- **WHEN** a `CatalogItem` is constructed without `isEditable`
- **THEN** the details panel treats it as not editable and does not render the Edit action for that item

### Requirement: Details panel renders an Edit action next to Use in chat
The Catalog details panel (`Header.tsx`) SHALL accept an optional `onEdit?: (item: CatalogItem) => void` prop (threaded through `DetailsPanelProps` and `CatalogProps`) and an optional `editActionLabel` text override (via `ItemDetailsTexts`, default `'Edit'`). When `onEdit` is provided AND the currently displayed item's `isEditable` is `true`, a `NeutralButton` labelled with `editActionLabel` and a leading `IconPencil` SHALL render immediately after the primary action button ("Use in chat"), before "Share". Clicking it SHALL call `onEdit` with the current item.

#### Scenario: Edit hidden when onEdit is not supplied
- **WHEN** the details panel is rendered without an `onEdit` prop, even if the item's `isEditable` is `true`
- **THEN** no "Edit" button is present in the DOM

#### Scenario: Edit hidden when the item is not editable
- **WHEN** `onEdit` is supplied but the displayed item's `isEditable` is `false` or `undefined`
- **THEN** no "Edit" button is present in the DOM

#### Scenario: Edit shown for an editable item
- **WHEN** `onEdit` is supplied and the displayed item's `isEditable` is `true`
- **THEN** an "Edit" button (default label, `IconPencil` leading icon) renders next to "Use in chat"
- **AND** clicking it invokes `onEdit` with the item

#### Scenario: Edit label override
- **WHEN** `editActionLabel` is supplied in `texts`
- **THEN** the Edit button uses that label instead of the default `'Edit'`

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

### Requirement: apps/chat marks a toolset editable when owned by the current user
`apps/chat`'s `mapToolsetToCatalogItem` SHALL compute `isEditable` as `toolset.isMy ?? false` — every toolset owned by the current user is editable, with no schema-type restriction (unlike QuickApps, toolsets have no non-editable variant to exclude).

#### Scenario: Own toolset is editable
- **WHEN** a toolset has `isMy: true`
- **THEN** its mapped `CatalogItem.isEditable` is `true`

#### Scenario: Toolset owned by another user is not editable
- **WHEN** a toolset has `isMy: false` (or `undefined`)
- **THEN** its mapped `CatalogItem.isEditable` is `false`

### Requirement: URL-building for the Apps editor is unified across create and edit
`CatalogView`'s `buildEditorUrl` helper SHALL be a single function accepting `{ schemaId, step, appId?, isCreating? }` and used by both the "Create QuickApp" option (General step, `isCreating: true`, no `appId`) and the Edit action (Settings step, existing `appId`, no `isCreating`), rather than separate ad hoc URL-construction code paths.

#### Scenario: Create QuickApp still works unchanged after unification
- **WHEN** the user clicks "Create" → "QuickApp" in the Catalog
- **THEN** the app navigates to the Apps editor with `step=general`, `schema=<quickAppSchemaId>`, `isCreating=true`, `returnUrl=/catalog`, and no `appId`

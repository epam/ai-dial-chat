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
`apps/chat`'s `mapDeploymentToCatalogItem` SHALL accept an optional `editableSchemaId` parameter and compute `isEditable` as `true` only when the deployment's `isMy` is `true` AND its `applicationTypeSchemaId` equals `editableSchemaId`. `CatalogView` SHALL resolve `editableSchemaId` by finding the QuickApp schema via the existing `isQuickAppSchema` helper over the schemas already loaded from `DeploymentsContext`, and pass it to every deployment mapped into a `CatalogItem`. Toolsets mapped via `mapToolsetToCatalogItem` SHALL NOT be editable through this action (no `isEditable` is set).

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

### Requirement: Clicking Edit navigates to the Apps editor Settings step for the existing app
`CatalogView` SHALL wire `onEdit` to a handler that, given an editable `CatalogItem`, navigates to the Apps editor (`ROUTES.AppsEditor`) with `AppsEditorQuery.Step=AppsEditorStep.Settings`, `AppsEditorQuery.Schema` set to the resolved QuickApp schema id, `AppsEditorQuery.AppId` set to the item's `id`, and `AppsEditorQuery.ReturnUrl` set to `ROUTES.Catalog`. It SHALL NOT set `AppsEditorQuery.IsCreating`. The label passed as `editActionLabel` SHALL be the existing `ButtonsI18nKeys.Edit` translation — no new i18n key is introduced.

#### Scenario: Edit opens the Settings step with the existing app pre-loaded
- **WHEN** the user opens the Catalog, opens the details panel for a QuickApp they own, and clicks "Edit"
- **THEN** the app navigates to the Apps editor with `step=settings`, `schema=<quickAppSchemaId>`, `appId=<item.id>`, and `returnUrl=/catalog`
- **AND** the Apps editor shows that app's Settings step (its existing configuration), not the General step and not the create flow

#### Scenario: Returning from the editor goes back to the Catalog
- **WHEN** the user clicks Edit from the Catalog, then Cancels or Saves in the Apps editor
- **THEN** the editor navigates back to `ROUTES.Catalog` (`returnUrl`), exactly as it does for the existing "Create QuickApp" flow

### Requirement: URL-building for the Apps editor is unified across create and edit
`CatalogView`'s `buildEditorUrl` helper SHALL be a single function accepting `{ schemaId, step, appId?, isCreating? }` and used by both the "Create QuickApp" option (General step, `isCreating: true`, no `appId`) and the Edit action (Settings step, existing `appId`, no `isCreating`), rather than separate ad hoc URL-construction code paths.

#### Scenario: Create QuickApp still works unchanged after unification
- **WHEN** the user clicks "Create" → "QuickApp" in the Catalog
- **THEN** the app navigates to the Apps editor with `step=general`, `schema=<quickAppSchemaId>`, `isCreating=true`, `returnUrl=/catalog`, and no `appId`

# Spec: catalog-quickapp-edit-action

## Purpose

The Edit action in the catalog details panel for items the current user owns, and the editor each entity type routes to.

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

### Requirement: apps/chat marks a deployment editable when it belongs to a runner schema and the current user can edit it
`mapDeploymentToCatalogItem` SHALL accept an optional `editableSchemaIds: string[]` option and compute `isEditable` as `true` when the deployment is `isMy` or `canEdit` AND either its `applicationTypeSchemaId` is one of `editableSchemaIds`, or custom apps are editable (`isCustomAppsEditable`) and the deployment is a schema-less `application`. `useCatalogItems` SHALL pass as `editableSchemaIds` the ids of every runner schema returned by `getRunnerSchemas(schemas)` over the schemas loaded from `DeploymentsContext` — not only the QuickApp schema. Toolset editability is computed separately (see `apps/chat marks a toolset editable when owned by the current user`).

#### Scenario: Own app of any runner is editable
- **WHEN** a deployment has `isMy: true` and `applicationTypeSchemaId` equal to the id of any runner schema (QuickApp, Quick app 2.0, Mind map, …)
- **THEN** its mapped `CatalogItem.isEditable` is `true`

#### Scenario: A runner app the user cannot edit is not editable
- **WHEN** a deployment has `isMy: false` and `canEdit` falsy, whatever its schema
- **THEN** its mapped `CatalogItem.isEditable` is `false`

#### Scenario: An app of the custom-app schema is not a runner app
- **WHEN** a deployment's `applicationTypeSchemaId` is `custom_app`
- **THEN** it is not made editable through `editableSchemaIds`

#### Scenario: No runner schemas loaded
- **WHEN** `schemas` is empty, so `editableSchemaIds` is empty
- **THEN** no schema-based deployment is editable through `editableSchemaIds`

### Requirement: Clicking Edit navigates to the correct editor for the item's entity type
`useCatalogEditNavigation`'s `handleEdit` SHALL branch on the clicked `CatalogItem`'s `type`, in this order, each branch returning early: `Prompt` → `buildPromptEditUrl(id)`, `Skill` → `buildSkillEditUrl(id)`, `Toolset` → `buildToolsetEditUrl(id)`, a schema-less custom app (custom apps enabled, deployment found, no `applicationTypeSchemaId`) → `buildCustomAppEditUrl(id)`. Every other item SHALL open the Apps editor through `buildQuickAppEditUrl(schemaId, id)`, where `schemaId` is the deployment's own `applicationTypeSchemaId` when it names a runner schema, falling back to the QuickApp schema (`isQuickAppSchema`) among the runners; when neither resolves, Edit does nothing. `CatalogView` implements the builders: the toolset URL is `ROUTES.ToolsetEditor?id=<id>` with no `returnUrl`, and the Apps-editor URL carries `schema` and `appId` only. The label passed as `editActionLabel` SHALL remain the existing `ButtonsI18nKeys.Edit` translation for every entity type — no new i18n key is introduced.

#### Scenario: Edit opens the app under its own schema
- **WHEN** the user clicks Edit on an app whose `applicationTypeSchemaId` is `mind-map-schema`, a runner schema
- **THEN** the app navigates to the Apps editor with `schema=mind-map-schema` and `appId=<item.id>`
- **AND** the editor opens that app in edit mode, not the create flow

#### Scenario: Edit falls back to the QuickApp schema
- **WHEN** the clicked item's deployment is not found or names no runner schema, and a QuickApp schema exists
- **THEN** the app navigates to the Apps editor with the QuickApp schema id and `appId=<item.id>`

#### Scenario: Edit opens the Toolset editor with the existing toolset pre-loaded
- **WHEN** the user opens the Catalog, opens the details panel for a toolset they own, and clicks "Edit"
- **THEN** the app navigates to `ROUTES.ToolsetEditor` with `id=<item.id>` and no `returnUrl`
- **AND** the Toolset editor loads that toolset's existing configuration in edit mode, not the create flow

#### Scenario: Returning from either editor goes back to the Catalog
- **WHEN** the user clicks Edit from the Catalog on a runner app or a toolset, then Cancels or Saves in the corresponding editor
- **THEN** the editor navigates back to `ROUTES.Catalog`, its fixed return route

### Requirement: apps/chat marks a toolset editable when owned by the current user
`apps/chat`'s `mapToolsetToCatalogItem` SHALL compute `isEditable` as `toolset.isMy ?? false` — every toolset owned by the current user is editable, with no schema-type restriction (unlike QuickApps, toolsets have no non-editable variant to exclude).

#### Scenario: Own toolset is editable
- **WHEN** a toolset has `isMy: true`
- **THEN** its mapped `CatalogItem.isEditable` is `true`

#### Scenario: Toolset owned by another user is not editable
- **WHEN** a toolset has `isMy: false` (or `undefined`)
- **THEN** its mapped `CatalogItem.isEditable` is `false`

### Requirement: URL-building for the Apps editor is unified across create and edit
`CatalogView` SHALL build both Apps-editor URLs in its `CatalogEditNavigationUrls` object, with one shared `buildUrl(route, params)` helper: `buildQuickAppCreateUrl(schemaId)` for every runner Create option (`schema` only) and `buildQuickAppEditUrl(schemaId, appId)` for the Edit action (`schema` and `appId`), rather than separate ad hoc URL-construction code paths.

#### Scenario: Creating from any runner uses the shared builder
- **WHEN** the user clicks "Create" → a runner option in the Catalog
- **THEN** the app navigates to the Apps editor with `schema=<that runner's schema id>` and no `appId`

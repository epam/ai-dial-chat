## ADDED Requirements

### Requirement: Catalog toolsets are loaded from the dedicated toolsets API

The app SHALL load catalog toolsets through the existing frontend toolsets adapter, `apps/chat/src/server-api/toolsets.ts`, by calling `listToolsets()`.

The app MUST NOT load catalog toolsets by requesting MCP deployments from `GET /api/v1/deployments`.

The backend `GET /api/v1/toolsets` listing SHALL filter out hidden marker entries whose `id` contains `.dial_folder`, matching the existing deployments listing behavior for DIAL folder markers.

The backend `DialToolsetDto` OpenAPI response SHALL document DIAL SDK fields used by the frontend, including `features`, `allowed_tools`, `transport`, `status`, timestamps, and OAuth auth fields such as `code_challenge`.

The backend `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses SHALL include:

- `isInstalled`, computed from `userConfig.toolsets.installed`
- `isMy`, computed by checking whether the current session bucket appears as a path segment in the toolset id/path

The frontend toolsets adapter SHALL normalize snake_case DIAL SDK response fields into generated-client camelCase fields before exposing toolsets to React state.

#### Scenario: Provider loads toolsets in parallel with deployments

- **WHEN** `DeploymentsProvider` starts loading catalog/model data
- **THEN** it calls `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`
- **AND** it calls `getApplicationSchemas()`
- **AND** it calls `listToolsets()`
- **AND** it exposes the returned `DialToolsetDto[]` as `toolsets` on `DeploymentsContextType`

#### Scenario: Toolsets expose user ownership and installation state

- **GIVEN** the user config contains a toolset id in `toolsets.installed`
- **AND** the toolset id/path includes the current session bucket as a path segment
- **WHEN** the authenticated user calls `GET /api/v1/toolsets`
- **THEN** that toolset has `isInstalled: true`
- **AND** `isMy: true`

#### Scenario: Hidden marker toolsets are not returned

- **GIVEN** DIAL Core returns a toolset with an `id` containing `.dial_folder`
- **WHEN** the authenticated user calls `GET /api/v1/toolsets`
- **THEN** the response excludes that marker toolset

#### Scenario: Toolsets fetch failure does not fail deployments

- **WHEN** `listToolsets()` rejects
- **AND** `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])` succeeds
- **THEN** `DeploymentsContextType.items` contains the loaded deployments
- **AND** `DeploymentsContextType.toolsets` is an empty array
- **AND** `DeploymentsContextType.error` remains `null`
- **AND** the provider logs a warning

### Requirement: Catalog combines deployments and toolsets at the app edge

`CatalogView` SHALL build catalog items from both:

- `DeploymentsContextType.items`, mapped with the deployment-to-catalog mapper
- `DeploymentsContextType.toolsets`, mapped with an app-level toolset-to-catalog mapper

The toolset mapper SHALL convert each `DialToolsetDto` to a `CatalogItem` with:

- `id` from `toolset.id`
- `type: CatalogEntityType.Toolset`
- `name` from `displayName`, falling back to `toolset`, then `reference`, then `id`
- `description` from `description`, falling back to empty string
- `iconUrl` resolved through the existing catalog icon resolver
- `version` from `displayVersion`, falling back to empty string
- `updatedAt` and `lastUsed` from `updatedAt`
- `topics` from `descriptionKeywords`, falling back to an empty array
- `folder` from a `toolsets/{bucket}/{path}` id/toolset path when available
- `details.tools.tools` from `allowedTools`, when present
- `isMyApp` from `isMy`
- favorite/starred state from user-config installed ids

The mapper MUST live in `apps/chat` and MUST NOT be added to `libs/catalog`.

#### Scenario: Catalog renders toolset items

- **GIVEN** `DeploymentsContextType.items` contains a model deployment
- **AND** `DeploymentsContextType.toolsets` contains a toolset
- **WHEN** `CatalogView` renders
- **THEN** the `Catalog` component receives one model catalog item
- **AND** one toolset catalog item with `type: CatalogEntityType.Toolset`

#### Scenario: Conversation selector remains deployment-only

- **GIVEN** `DeploymentsContextType.toolsets` contains toolsets
- **WHEN** conversation/model selector surfaces read `DeploymentsContextType.items`
- **THEN** they receive only the chat deployments loaded from `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`

#### Scenario: Installed toolsets appear as catalog favorites

- **GIVEN** user config contains a toolset id in `toolsets.installed`
- **WHEN** `CatalogView` renders that toolset
- **THEN** the toolset catalog item is marked favorite/starred
- **AND** it is included in the catalog favorites list

#### Scenario: Toggling a toolset favorite updates toolset installation config

- **WHEN** the user favorites or unfavorites a toolset catalog item
- **THEN** the frontend calls the user-config toolset installed endpoint
- **AND** it MUST NOT call the deployments installed endpoint for that toolset

### Requirement: Catalog UI labels include Toolsets

`CatalogView` SHALL pass a translated `CatalogEntityType.Toolset` tab label to the catalog component.

#### Scenario: Toolsets tab has app-level i18n label

- **WHEN** `CatalogView` renders catalog titles
- **THEN** `titles.tabLabels[CatalogEntityType.Toolset]` uses the `catalog.tab.toolsets` translation key

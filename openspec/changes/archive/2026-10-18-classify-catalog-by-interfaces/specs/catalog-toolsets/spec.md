## MODIFIED Requirements

### Requirement: Catalog combines deployments and toolsets at the app edge

`CatalogView` SHALL build catalog items through the app-level `useCatalogItems` hook (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`), which combines (alongside prompts and skills):

- `DeploymentsContextType.items`, mapped with the deployment-to-catalog mapper, passing `isToolsetTabEnabled: isToolsetsEnabled` so MCP applications are listed under Toolsets only while the Toolsets UI feature is on (see [catalog-interface-classification](../catalog-interface-classification/spec.md))
- `DeploymentsContextType.toolsets`, mapped with the app-level `mapToolsetToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) — only while the `OverlayFeature.Toolsets` UI feature (`isToolsetsEnabled`) is on

The Toolsets tab therefore lists both toolsets and MCP applications. An MCP application keeps its application entity kind (`type: CatalogEntityType.Agent`) and its application behavior (edit, delete, share, publish, favorites, application MCP URL); it is never mapped through the toolset mapper and never gets toolset credentials, a toolset id, or a `toolsets.installed` favorite.

The toolset mapper SHALL convert each `DialToolsetDto` to a `CatalogItem` with:

- `id` from `toolset.id`
- `type: CatalogEntityType.Toolset`
- `name` from `displayName` resolved for the active locale (`resolveLocalizedText`), falling back to `toolset`, then `reference`, then `id`
- `description` from `description` resolved for the active locale, falling back to empty string
- `iconUrl` resolved through the existing catalog icon resolver
- `version` from `displayVersion`, falling back to empty string
- `updatedAt` from `updatedAt`, `createdAt` from `createdAt`, and `lastUsed` from `formatLastUsed(updatedAt)`
- `topics` from `descriptionKeywords`, falling back to an empty array
- `folder` from the localized ownership/root label and any decoded nested path, following the [deployment-catalog-item-mapping](../deployment-catalog-item-mapping/spec.md) rules; configured toolsets with plain IDs SHALL show the Organization label when neither owned nor shared
- `details.tools.tools` from `allowedTools`, when present
- `isMyApp` from `isMy`, `sharedWithMe` from `sharedWithMe`, and `isEditable` from `isMy || canEdit`
- `credentials` from `authSettings` via `mapDeploymentToolsetCredentials`
- favorite/starred state from user-config installed ids

The app-owned wrapper in `apps/chat` SHALL resolve translations and icon URLs and delegate the DTO mapping to `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`, following [chat-hooks-domain-utilities](../chat-hooks-domain-utilities/spec.md). `libs/catalog` SHALL consume resolved `CatalogItem` values without interpreting DIAL identifiers or ownership metadata.

#### Scenario: Catalog renders toolset items

- **GIVEN** `DeploymentsContextType.items` contains a model deployment
- **AND** `DeploymentsContextType.toolsets` contains a toolset
- **AND** the `OverlayFeature.Toolsets` UI feature is enabled
- **WHEN** `CatalogView` renders
- **THEN** the `Catalog` component receives one model catalog item
- **AND** one toolset catalog item with `type: CatalogEntityType.Toolset`

#### Scenario: MCP application is listed under Toolsets as an application

- **GIVEN** `DeploymentsContextType.items` contains an application with `interfaces: ['mcp']`
- **AND** the `OverlayFeature.Toolsets` UI feature is enabled
- **WHEN** `CatalogView` renders
- **THEN** the `Catalog` component receives one item for it with `type: CatalogEntityType.Agent` and `catalogTabs: [CatalogEntityType.Toolset]`

#### Scenario: Conversation selector remains deployment-only

- **GIVEN** `DeploymentsContextType.toolsets` contains toolsets
- **WHEN** conversation/model selector surfaces read `DeploymentsContextType.items`
- **THEN** they receive only the deployments loaded from `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp, ListDeploymentsInterfaceTypeEnum.CustomUi])`, never `DialToolsetDto` entries

#### Scenario: Installed toolsets appear as catalog favorites

- **GIVEN** user config contains a toolset id in `toolsets.installed`
- **WHEN** `CatalogView` renders that toolset
- **THEN** the toolset catalog item is marked favorite/starred
- **AND** it is included in the catalog favorites list

#### Scenario: Toggling a toolset favorite updates toolset installation config

- **WHEN** the user favorites or unfavorites a toolset catalog item
- **THEN** the frontend calls the user-config toolset installed endpoint
- **AND** it MUST NOT call the deployments installed endpoint for that toolset

#### Scenario: Toggling an MCP application favorite from the Toolsets tab updates deployment installation config

- **WHEN** the user favorites an MCP application from the Toolsets tab
- **THEN** the frontend calls the deployments installed endpoint, as for any application
- **AND** it MUST NOT call the user-config toolset installed endpoint

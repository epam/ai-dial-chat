## MODIFIED Requirements

### Requirement: Use in chat is not available for Toolset items or non-chat deployments

The catalog details panel SHALL NOT render the "Use in chat" primary action button when either:
- the displayed item's `type` is `CatalogEntityType.Toolset`, or
- the displayed item's `type` is `Model` or `Agent` but its `supportsChat` field (a `CatalogItem` boolean derived from `DeploymentItemDto.interfaces`, `true` when `interfaces` is absent or includes `'chat'`) is `false`.

#### Scenario: Toolset details panel has no Use in chat button

- **WHEN** the user opens the catalog, selects the Toolsets tab, and opens a toolset's details panel
- **THEN** the "Use in chat" button is not rendered
- **AND** other actions available for the toolset (e.g. Share) remain rendered and functional

#### Scenario: Model and Application details panels still show Use in chat when chat-capable

- **WHEN** the user opens a details panel for an item of type Model or Application whose `interfaces` includes `'chat'`
- **THEN** the "Use in chat" button is rendered as before

#### Scenario: MCP-only application has no Use in chat button

- **WHEN** the user opens the catalog and opens the details panel for an Application whose `interfaces` is `['mcp']` (no `'chat'`)
- **THEN** the "Use in chat" button is not rendered
- **AND** other actions available for the application (e.g. Share, credentials) remain rendered and functional

#### Scenario: Application supporting both chat and mcp interfaces still shows Use in chat

- **WHEN** the user opens the details panel for an Application whose `interfaces` is `['chat', 'mcp']`
- **THEN** the "Use in chat" button is rendered

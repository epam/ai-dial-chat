# Spec: catalog-use-in-chat

## Purpose

The "Use in chat" action that selects a deployment and starts a new conversation, and the item kinds for which it is unavailable.

## Requirements

### Requirement: Use in chat selects a deployment and starts a new conversation

When the user clicks "Use in chat" in the catalog details panel header for a catalog item of type Model or Application, the system SHALL set that item's `id` as the selected deployment via `DeploymentsContext.setSelectedItemId` and navigate to `ROUTES.Root` (`/`).

The selection SHALL be persisted to user config as part of `setSelectedItemId`'s existing behavior (no additional persistence call is required by the handler).

#### Scenario: Use in chat on a Model navigates to the new-conversation screen with that model selected

- **WHEN** the user opens the catalog, selects the Models tab, opens a model's details panel, and clicks "Use in chat"
- **THEN** the app navigates to `/`
- **AND** the model picker on the new-conversation screen shows that model as the selected deployment
- **AND** the user can send a message using that deployment immediately

#### Scenario: Use in chat on an Application navigates to the new-conversation screen with that application selected

- **WHEN** the user opens the catalog, selects the Applications tab, opens an application's details panel, and clicks "Use in chat"
- **THEN** the app navigates to `/`
- **AND** the model picker on the new-conversation screen shows that application as the selected deployment

#### Scenario: Selecting a different deployment via Use in chat updates the selection

- **WHEN** the user has already selected deployment A via "Use in chat", returns to the catalog, and clicks "Use in chat" on deployment B
- **THEN** the selected deployment becomes B, replacing A

#### Scenario: Selection persists across page reload

- **WHEN** the user selects a deployment via "Use in chat" and then reloads the page
- **THEN** the same deployment remains selected, restored from user config

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

## MODIFIED Requirements

### Requirement: Frontend consumption of deployment configuration schema

The system SHALL expose the deployment configuration schema (`DeploymentConfigurationSchema`) to frontend consumers for:
1. Extracting starter options from `properties.*.oneOf` arrays (existing behavior).
2. Extracting tool toggle metadata from boolean properties whose key matches a configured tool id (new behavior).

The `DeploymentsContext` SHALL continue to expose `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` unchanged. Downstream consumers (hooks, components) are responsible for interpreting specific schema properties.

#### Scenario: Existing starter extraction unchanged
- **WHEN** the deployment configuration schema contains a property with `oneOf` starter options and `dial:widget: "starter"`
- **THEN** `getStartersFromSchema()` continues to extract and render starter buttons as before

#### Scenario: Tool property extraction by configured id
- **WHEN** the deployment configuration schema contains a property key matching the configured `deepResearchToolId` with boolean type
- **THEN** the `useToolsMenu` hook extracts that property's `title` and `default` to construct a `ToolMenuItem`

#### Scenario: Non-matching properties ignored
- **WHEN** the deployment configuration schema contains boolean properties whose keys do NOT match `deepResearchToolId`
- **THEN** those properties are NOT rendered as tool menu items (they are ignored in this slice)

#### Scenario: Schema with both starters and tools
- **WHEN** the schema contains both a starter property (with `oneOf`) and a tool property (boolean matching configured id)
- **THEN** both starter buttons and the Tools menu item render independently without interference

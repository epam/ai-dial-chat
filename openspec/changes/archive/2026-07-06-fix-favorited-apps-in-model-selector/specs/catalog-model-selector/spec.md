## ADDED Requirements

### Requirement: Favorited Applications included in selector's talkable items

`ModelPickerPanel.tsx` (`apps/chat/src/components/ModelPicker/`) SHALL build the `catalogItems` passed into the model selector from the user's favorited catalog items, filtered to conversational entity types only. The talkable-type allowlist SHALL include `CatalogEntityType.Model`, `CatalogEntityType.Agent`, and `CatalogEntityType.Agent`. Non-conversational types (`Toolset`, `Skill`, `Guardrail`, `Mcp`, and any other non-conversational `CatalogEntityType`) SHALL continue to be excluded.

Note: `CatalogEntityType.Agent` is a frontend-only display category (used for catalog tabs/badges); DIAL Core has no "agent" concept, and `mapDeploymentToCatalogItem` never assigns it to real deployment data — only `Model` and `Application` are produced from Core deployments today. The allowlist keeps the `Agent` check for forward compatibility but this requirement's observable behavior change is that `Application` items now pass the filter.

This filter SHALL be memoized (`useMemo`) keyed on the favorites list, consistent with existing behavior.

#### Scenario: Favorited Application appears in the dropdown

- **WHEN** the user has favorited an Application in the Catalog (entity mapped to `CatalogEntityType.Agent`)
- **THEN** `ModelPickerPanel`'s `talkableItems` includes that Application
- **AND** the Application appears as a selectable item in the model selector dropdown alongside favorited Models and Agents

#### Scenario: Favorited Model still appears in the dropdown

- **WHEN** the user has favorited a Model (entity mapped to `CatalogEntityType.Model`)
- **THEN** `ModelPickerPanel`'s `talkableItems` includes that Model

#### Scenario: Favorited non-conversational entity excluded

- **WHEN** the user has favorited an entity mapped to `CatalogEntityType.Toolset`, `Skill`, `Guardrail`, or `Mcp`
- **THEN** `ModelPickerPanel`'s `talkableItems` does NOT include that entity

## MODIFIED Requirements

### Requirement: Browse-state derivations are pure and ordered

The package SHALL export immutable pure functions for selector visible-type
filtering, hide-owned filtering, favorite derivation, available-tab derivation,
and topic reconciliation. They SHALL use current predicates and order:
selector filtering keeps items whose tab membership
(`getCatalogItemTabs(item)` from `@epam/ai-dial-catalog`) includes at least one
visible type and whose `supportsChat` is not `false`, so the conversation picker
omits applications listed only under Toolsets (MCP-only) and deployments without
a chat interface; favorites are
items whose `isUserFavorite` is true and `isHidden` is not, tab ids follow
supplied tab order and include only tabs present in the membership of visible
items, and topics are the intersection of persisted topics with topics present
in those items.

They SHALL NOT read contexts, storage, routes, translations, feature flags, or
network state and SHALL NOT replace `useFavoriteEntitiesState` or app preference
hooks.

The exported names SHALL be `filterCatalogItemsBySelector`,
`filterHiddenOwnedItems`, `deriveFavoriteItems`, `deriveAvailableTabIds`, and
`reconcileFilterTopics`.

#### Scenario: Selector omits applications listed only under Toolsets

- **WHEN** selector filtering with visible types `{Model, Agent}` receives an
  agent with `catalogTabs: [Toolset]`, an agent with `catalogTabs: [Agent, Toolset]`,
  and an agent with no `catalogTabs`
- **THEN** it returns the second and third agents, in order

#### Scenario: Selector omits deployments without a chat interface

- **WHEN** selector filtering receives a visible-type agent with
  `supportsChat: false`, one with `supportsChat: true`, and a visible-type prompt
- **THEN** it returns the chat-capable agent and the prompt, in order

#### Scenario: Available tabs follow membership

- **WHEN** tab derivation receives an agent with `catalogTabs: [Toolset]` and a model
- **THEN** it returns the Model and Toolset tab ids in supplied tab order, without Agent

#### Scenario: Stale topic is removed without mutation

- **WHEN** persisted topics contain one present and one absent topic
- **THEN** reconciliation returns a new set containing only the present topic
  and does not mutate either input

#### Scenario: Favorites retain item order

- **WHEN** favorited and non-favorited items are interleaved
- **THEN** favorite derivation returns only favorited items in original order

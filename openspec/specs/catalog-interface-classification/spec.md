# catalog-interface-classification Specification

## Purpose

Deriving catalog tab membership from DIAL Core deployment interfaces, separately from the entity kind, and filtering, counting and deriving catalog tabs by that membership.

## Requirements

### Requirement: CatalogItem carries an optional tab membership separate from its entity kind

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL gain an optional
`catalogTabs?: readonly CatalogEntityType[]` field: the Browse tabs the item is
listed under. `type` SHALL keep meaning the entity kind and SHALL continue to
drive every entity-specific behavior (actions, details dispatch, edit/delete
routing, publish entity type, favorite section, MCP URL kind, and the type
badge in the details panel and the Favorites strip).

In the Browse grid and list, the type label and the Featured chip SHALL show the
active tab when `getCatalogItemTabs(item)` includes it, and `type` otherwise
(`getCatalogItemDisplayType` in `libs/catalog/src/utils/catalog-tabs.ts`), so an
agent listed under Toolsets is labeled "Toolset" there (issue #9615).

`@epam/ai-dial-catalog` SHALL export
`getCatalogItemTabs(item: CatalogItem): readonly CatalogEntityType[]`, which
returns `item.catalogTabs` when it is a non-empty array and `[item.type]`
otherwise. Every tab decision in `libs/catalog` and `libs/chat-hooks` SHALL go
through this helper, so a producer or host that never sets `catalogTabs` gets
exactly the type-based behavior it has today.

`libs/catalog` SHALL NOT interpret DIAL `interfaces`, identifiers, or feature
flags to decide membership; it only reads the resolved list the host supplies.

State ownership: none — `catalogTabs` is a derived value on each item.
Memoisation: none beyond the callers' existing `useMemo`s.
i18n keys needed: none. RTL/accessibility: none (no new UI). Feature gate: none.
Telemetry: none. Cache: none.

#### Scenario: Absent membership falls back to the entity kind

- **WHEN** `getCatalogItemTabs` receives an item with `type: Agent` and no `catalogTabs`
- **THEN** it returns `[Agent]`

#### Scenario: Empty membership falls back to the entity kind

- **WHEN** `getCatalogItemTabs` receives an item with `type: Model` and `catalogTabs: []`
- **THEN** it returns `[Model]`

#### Scenario: Browse label follows the active tab

- **WHEN** `Catalog` renders an item with `type: Agent` and `catalogTabs: [Agent, Toolset]` and the Toolsets tab is active
- **THEN** its card and list row are labeled Toolset
- **AND** with the Agents tab active they are labeled Agent

#### Scenario: Supplied membership is returned as given

- **WHEN** `getCatalogItemTabs` receives an item with `type: Agent` and `catalogTabs: [Agent, Toolset]`
- **THEN** it returns `[Agent, Toolset]`

### Requirement: Deployment tab membership is derived from DIAL Core interfaces

The deployment mapper SHALL set `catalogTabs` from `DeploymentItemDto.interfaces`, keeping `type` as today (`TYPE_MAP`: `application` → `Agent`, `model` → `Model`). The mapper is `mapDeploymentToCatalogItem` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`:

| `type` | `interfaces` contains | `catalogTabs` |
| --- | --- | --- |
| `application` | `chat` or `custom_ui`, and not `mcp` | `[Agent]` |
| `application` | `mcp`, and neither `chat` nor `custom_ui` | `[Toolset]` |
| `application` | `mcp` and (`chat` or `custom_ui`) | `[Agent, Toolset]`, in that order |
| `application` | none of `chat`, `custom_ui`, `mcp` | omitted (falls back to `[Agent]`) |
| `model` | anything | omitted (falls back to `[Model]`) |
| any | `interfaces` absent | omitted (type-based, as today) |

Membership SHALL be read from `interfaces` only — not from `features.mcp`, which
the backend also sets from a raw `mcp` block or a `features.mcp` flag.

The mapper SHALL accept an `isToolsetTabEnabled?: boolean` option (default
`true`). When it is `false`, `Toolset` SHALL be removed from the derived list,
and an application whose list becomes empty SHALL fall back to `[Agent]`, so an
MCP-only application stays under Agents while the Toolsets tab is unavailable.

This is a DIAL-Core-response-to-display adapter driven entirely by the generated
response's shape and consumed identically by every DIAL-Core host; the host's
feature decision arrives as the `isToolsetTabEnabled` value, and the mapper
SHALL NOT read feature flags, contexts, or configuration itself.

The mapper SHALL continue to return exactly one `CatalogItem` per deployment
with `id` equal to the deployment id.

#### Scenario: MCP-only application is listed under Toolsets

- **WHEN** the mapper receives `{ type: 'application', interfaces: ['mcp'] }`
- **THEN** the item has `type: Agent` and `catalogTabs: [Toolset]`

#### Scenario: Chat and MCP application is listed under both tabs

- **WHEN** the mapper receives `{ type: 'application', interfaces: ['chat', 'mcp'] }`
- **THEN** the item has `type: Agent` and `catalogTabs: [Agent, Toolset]`

#### Scenario: Custom-UI application is listed under Agents

- **WHEN** the mapper receives `{ type: 'application', interfaces: ['custom_ui'] }`
- **THEN** the item has `catalogTabs: [Agent]`

#### Scenario: Deployment without interfaces keeps the type-based tab

- **WHEN** the mapper receives `{ type: 'application' }` with no `interfaces`
- **THEN** the item has `type: Agent` and no `catalogTabs`

#### Scenario: Toolsets tab disabled keeps MCP-only applications under Agents

- **WHEN** the mapper receives `{ type: 'application', interfaces: ['mcp'] }` with `isToolsetTabEnabled: false`
- **THEN** the item has `catalogTabs: [Agent]`

#### Scenario: Toolsets tab disabled drops Toolset from a dual application

- **WHEN** the mapper receives `{ type: 'application', interfaces: ['chat', 'mcp'] }` with `isToolsetTabEnabled: false`
- **THEN** the item has `catalogTabs: [Agent]`

### Requirement: Catalog filters, counts, and derives tabs by membership

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL:

- keep an item in the active tab's Browse grid/list when
  `getCatalogItemTabs(item)` includes the active tab;
- compute each tab's count as the number of filtered items whose membership
  includes that tab, so an item listed under two tabs counts once in each;
- leave the Toolbar total, search, topic, and My-apps filtering unchanged (an
  item is still counted once in the total).

`buildCatalogTabs` (`libs/catalog/src/utils/catalog-tabs.ts`) SHALL include a
tab when any item's membership includes it, in the existing canonical order.

The same item SHALL be the one rendered in every tab it is listed under: one
`id`, one favorite state, one details panel. Opening it from either tab SHALL
open the same details with the same actions.

#### Scenario: Dual application appears once in each tab

- **WHEN** `Catalog` renders an item with `catalogTabs: [Agent, Toolset]`
- **THEN** it appears once in the Agents grid and once in the Toolsets grid
- **AND** the Agents and Toolsets tab counts each include it

#### Scenario: MCP-only application is absent from Agents

- **WHEN** `Catalog` renders an item with `type: Agent` and `catalogTabs: [Toolset]` and the Agents tab is active
- **THEN** the item is not in the Browse grid

#### Scenario: Tabs are derived from membership

- **WHEN** `buildCatalogTabs` receives only an item with `type: Agent` and `catalogTabs: [Toolset]`
- **THEN** it returns only the Toolsets tab

#### Scenario: Details are the same from either tab

- **WHEN** the user opens a dual application from the Toolsets tab
- **THEN** the details panel shows the application's details and actions, identical to opening it from Agents

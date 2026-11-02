## Why

The catalog files every DIAL Core application under **Agents**, because the
only input to the tab is the deployment `type`
(`TYPE_MAP` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`).
DIAL Core describes what a deployment can actually do through its `interfaces`
(`GET /v1/deployments`, `interface_type`: `chat`, `mcp`, `custom_ui`,
`embedding`), and the product owner has asked that Chat NG group deployments by
those interfaces instead. An application that only exposes MCP — for example an
openapi-2-mcp application — is a tool source, not something a user talks to, yet
today it sits in Agents beside real agents and is offered in the "Talk to"
picker (Issue #9408).

## What Changes

- Each deployment catalog item carries the list of catalog tabs it belongs to,
  derived from its `interfaces`:
  - an application exposing `chat` or `custom_ui` is listed under **Agents**;
  - an application exposing `mcp` is listed under **Toolsets**;
  - an application exposing both is listed under **both** tabs;
  - models stay under **Models**;
  - a deployment that reports no `interfaces` (older DIAL Core), or reports none
    of the above, keeps today's `type`-based tab.
- One item still represents one deployment. The item keeps its entity kind
  (`type: Agent` for every application), so edit, delete, share, publish,
  favorites and the application MCP URL keep their application behavior in
  either tab. Only *which tabs list it* changes.
- `Catalog` (`libs/catalog`) filters the Browse grid/list, counts tabs and
  derives the tab row by tab membership instead of by `type`.
- The "Talk to" picker keeps an item when its membership includes a picker tab
  (Model/Agent) **and**, as today, its `supportsChat` is not `false`
  (`filterCatalogItemsBySelector`, PR #9453). MCP-only applications stay out of
  the picker; custom-UI-only applications also stay out of it for now, as PR
  #9453 decided, even though they are listed under Agents.
- While the Toolsets UI feature is off, no item is placed under Toolsets; an
  MCP-only application then stays under Agents, exactly as today.

No backend, API, or generated-client change: `interfaces` already reaches the
frontend on `DeploymentItemDto`.

## Non-goals

- Listing tools of an MCP application. The Tools tab stays data-driven; an
  application has no `allowedTools` in the listing.
- Treating an MCP application as a toolset entity (toolset editor, toolset
  credentials, `toolsets.installed` favorites, toolset publish type).
- Changing "Use in chat" (`supportsChat`) — it still follows the `chat`
  interface only.
- Splitting the favorites strip by tab, or a per-tab deep link.

## Alternatives considered

1. **Retype by interfaces** (`type: Toolset` for MCP-only apps). Smallest diff,
   but every toolset handler then receives an `applications/...` id: the
   toolset editor, `deleteToolset`, the `ToolsetsSharing` flag, publish type
   `toolset`, `toolsets.installed` favorites and the `/v1/toolset/.../mcp` URL
   all break, and a dual app still cannot be in two tabs. Rejected.
2. **Emit a second item** (Agent copy + Toolset copy). Gives both tabs, but
   `CatalogItem.id` is the key everywhere — `Catalog`'s `selectedItem` sync
   swaps the Toolset copy for the Agent copy, the favorites strip renders
   duplicate React keys, starring one copy stars both, `?itemId=` cannot address
   a copy — and the toolset handlers break as in (1). Rejected.
3. **Tab membership separate from entity kind** (chosen). One item per
   deployment, a new optional `catalogTabs` field that only tab filtering reads.
   No id collisions, no handler changes, and an absent field means "the tab of
   `type`", so every existing producer and host keeps working.
4. **Conservative baseline — hide MCP-only applications from Agents** without
   listing them anywhere. Removes them from a place they do not belong but makes
   them undiscoverable; the product owner asked for them under Toolsets.
   Rejected.

## Capabilities

### New Capabilities
- `catalog-interface-classification`: deriving a deployment catalog item's tab
  membership from DIAL Core `interfaces`, the `CatalogItem.catalogTabs`
  contract, and `Catalog` filtering, counting and deriving tabs by membership.

### Modified Capabilities
- `chat-hooks-catalog-orchestration`: "Browse-state derivations are pure and
  ordered" — selector filtering and available-tab derivation use tab membership
  instead of `type`; selector filtering keeps its `supportsChat` check.
- `catalog-toolsets`: "Catalog combines deployments and toolsets at the app
  edge" — the Toolsets tab also lists MCP applications from
  `DeploymentsContextType.items`; the stale `getDeployments([Chat, Mcp])`
  scenario is corrected to `[Chat, Mcp, CustomUi]`.
- `catalog-model-selector`: "Only conversational favorites populate the
  selector" — conversational means membership in Models or Agents, so a
  favorited MCP-only application no longer appears in the dropdown.

## Impact

- **libs/catalog** (shared lib, scope note): `CatalogItem` gains optional
  `catalogTabs`; `Catalog`, `buildCatalogTabs` and a new exported
  `getCatalogItemTabs` read it. Additive and backward compatible — the lib
  still does not interpret DIAL identifiers or interfaces; it only reads the
  resolved tab list the host gives it.
- **libs/chat-hooks**: `mapDeploymentToCatalogItem` computes `catalogTabs` from
  `DeploymentItemDto.interfaces` (an adapter driven purely by the generated
  response's shape, consumed identically by every DIAL-Core host — within the
  existing chat-hooks mapper role); a new `isToolsetTabEnabled` mapper option
  carries the host's feature decision in as a value. `filterCatalogItemsBySelector`
  and `deriveAvailableTabIds` switch to membership.
- **apps/chat**: `useCatalogItems` and the two `DeploymentSelector` overlays pass
  `isToolsetTabEnabled`; `DeploymentSelectorPanel` filters favorites by
  membership. Closest model for the app wiring:
  `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`.
- **i18n:** no new user-visible strings.
- **Backward compatibility / rollback:** not breaking. `catalogTabs` is
  optional; a host that never sets it gets today's behavior. Reverting the
  change restores type-based tabs with no data migration (nothing is persisted;
  favorites keep using deployment ids).
- **Docs:** `libs/catalog/README.md` (`CatalogItem.catalogTabs`,
  `getCatalogItemTabs`), `libs/chat-hooks/README.md` (mapper option),
  `docs/architecture.md` only if it describes tab derivation.

## Acceptance criteria

- An application with `interfaces: ['mcp']` appears only in the Toolsets tab and
  not in the "Talk to" picker.
- An application with `interfaces: ['chat', 'mcp']` appears in both Agents and
  Toolsets, once in each, and opens the same details panel from either tab.
- An application with `interfaces: ['custom_ui']` appears in Agents; the
  "Talk to" picker still omits it (unchanged from PR #9453).
- A deployment without `interfaces` is classified exactly as today.
- With the Toolsets feature off, an MCP-only application stays in Agents.
- Tab counts reflect membership; edit/delete/share/publish/favorite of an MCP
  application behave as for any application.

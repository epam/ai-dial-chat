## Why

MCP-capable applications and toolsets are not selectable anywhere in the app because the frontend only ever requests the `chat` interface from `GET /api/v1/deployments`. Widening the filter to include `mcp` surfaced two defects that must be fixed in the same change: (1) DIAL Core silently only honored the first of several repeated `interface_type` query values, so multi-value filtering never actually reached Core, and (2) DIAL Core's `/v1/deployments` payload for toolset entries omits `auth_settings`/`endpoint`, so passing MCP toolsets through this endpoint would duplicate them (with an incomplete shape) against the already-correct `/v1/toolsets` listing the catalog uses. Additionally, once non-chat-interface deployments (e.g. `mcp`-only or `custom_ui`-only applications) can appear in `items`, UI surfaces that assume every item supports chat (model pickers, the catalog's "Use in chat" action) must gate on the deployment's actual `interfaces` instead of just its `type`.

## What Changes

- Frontend requests `interface_type=chat,mcp` (both interfaces) instead of `chat` only, in both the initial deployments load and `refetchDeployments`.
- Backend forwards multi-value `interface_type` to DIAL Core as a single comma-joined query parameter instead of repeated query keys, fixing a bug where Core only honored the first repeated value.
- **BREAKING** (internal contract only, no external API shape change): `GET /api/v1/deployments` no longer includes toolset-typed entries in its response, for any `interface_type` filter (including no filter / `all`). Toolsets remain available exclusively via the existing `GET /api/v1/toolsets` listing.
- `DeploymentsListingService`'s ownership/installed-state enrichment is simplified to the single `APPLICATION` resource-sharing scope, since toolset entries can no longer reach that code path.
- The catalog's "Use in chat" primary-action visibility rule is extended: in addition to the existing type-based exclusion (never for Toolset items), it is also hidden for Model/Application items whose `interfaces` does not include `'chat'`.
- Unrelated fix found along the way: a stale Vite alias in `apps/chat/vite.config.mts` referencing the pre-rename `@epam/chat-api-client` package name is corrected to `@epam/ai-dial-chat-api-client`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deployments-api`: `GET /api/v1/deployments` SHALL exclude toolset-typed entries from its response regardless of `interface_type` filter; multi-value `interface_type` SHALL be forwarded to DIAL Core as one comma-joined parameter.
- `deployments-context`: the deployments provider SHALL request `[Chat, Mcp]` interfaces (not `[Chat]` only) on both initial load and `refetchDeployments`.
- `catalog-use-in-chat`: the "Use in chat" primary action SHALL also be hidden for Model/Application items that do not support the `chat` interface, not only for Toolset-typed items.

## Impact

- `apps/chat-api/src/deployments/listing/deployments-listing.service.ts` — query serialization fix, toolset exclusion, ownership-enrichment simplification.
- `apps/chat-api/src/deployments/listing/tests/deployments-listing.service.spec.ts` — tests asserting toolset pass-through/ownership need updating to reflect exclusion.
- `apps/chat/src/context/DeploymentsContext.tsx` — interface filter widened to `[Chat, Mcp]` in two call sites.
- `apps/chat/src/components/CatalogView/CatalogView.tsx` — `isPrimaryActionVisible` gains an `interfaces`-based check.
- `libs/catalog/src/models/*` and `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — `CatalogItem` needs an `interfaces` (or equivalent chat-support) field threaded through from `DeploymentItemDto.interfaces` for the above check to work.
- `apps/chat/vite.config.mts` — stale package alias fix (unrelated bug, bundled here since found during this work).
- No DIAL Core, database, or public REST contract changes — `DeploymentItemDto`'s shape is unchanged; only which items appear in the array changes.

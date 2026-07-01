## Why

The unified catalog (`GET /api/v1/catalog`) returns only models and applications, excluding toolsets — MCP-compatible deployment units that end-users need to discover and connect alongside other deployments. Additionally, the existing deployment listing filter (`interface_type` on `GET /api/v1/deployments`) lacks explicit semantic exclusion rules, which means clients cannot safely rely on filter values such as `chat` to guarantee that toolsets are absent, or `embedding` to guarantee that applications are absent.

## What Changes

- The unified catalog endpoint includes toolsets in the merged deployment list alongside models and applications.
- The `GET /api/v1/deployments` endpoint adds explicit per-value semantic exclusion rules for the `interfaceTypes` filter parameter (renamed from `interface_type` for consistency with camelCase query conventions used elsewhere in the API):
  - `chat` — Chat Completions + Responses API; includes models of chat type and applications with `dial:applicationTypeCompletionEndpoint`; **never includes toolsets**
  - `embedding` — embedding endpoints; includes only models of embedding type; **never includes applications or toolsets**
  - `mcp` — MCP/Model Context Protocol; includes toolsets and applications with `dial:applicationTypeMcp`; **never includes models**
  - `custom_ui` — custom viewer UI; includes applications with `dial:applicationTypeViewerUrl`; **never includes models or toolsets**
  - `all` — default when the parameter is omitted; all deployment types returned
- Validation rejects any `interfaceTypes` value not in the allowed enum.

## Capabilities

### New Capabilities

- `deployment-interface-type-filter-semantics`: Documents the per-value inclusion/exclusion contract for the `interfaceTypes` filter on `GET /api/v1/deployments`, covering single-value, multi-value, default (omitted), and invalid-value scenarios. Replaces the generic delegation description currently in `deployments-api`.

### Modified Capabilities

- `unified-catalog`: Add toolsets as a third source merged with models and applications; `ToolsetsService.listToolsets` is fetched in parallel alongside the existing sources; its failure propagates the same way as models and applications failures.
- `deployments-api`: Rename `interface_type` query parameter to `interfaceTypes` (camelCase, array form); add requirement rows for the per-value exclusion rules; update generated client typings accordingly.

## Impact

- **Backend** (`apps/chat-api/src/catalog/`): `CatalogService` fetches toolsets via `ToolsetsService`; `CatalogItemDto` gains a `'toolset'` discriminator; `CatalogFilterService` extends to pass toolsets through (no capability filters apply to them).
- **Backend** (`apps/chat-api/src/deployments/`): `DeploymentsQueryDto` field renamed from `interface_type` to `interfaceTypes`; `DeploymentsService` applies in-process semantic exclusion after cache retrieval instead of relying solely on DIAL Core forwarding.
- **OpenAPI / generated client**: `npm run openapi` regenerates `@epam/chat-api-client` with updated parameter name and new catalog response shape.
- **Frontend** (`apps/chat/src/server-api/`): `catalog.ts` and `deployments.api.ts` wrappers updated to pass toolset data and renamed parameter.
- **Tests**: `catalog.service.spec.ts` gains toolset scenarios; `deployments.service.spec.ts` gains per-value exclusion scenarios.

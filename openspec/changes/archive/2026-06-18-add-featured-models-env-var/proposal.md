## Why

Operators need a way to surface specific models prominently in the Catalog UI without modifying DIAL Core configuration. A single env var (`FEATURED_MODEL_IDS`) lets deployments pin a curated list of model IDs so the frontend can render them with a "featured" badge or section, improving discoverability.

## What Changes

- Add `FEATURED_MODEL_IDS` optional env variable to `EnvironmentVariables` — a comma-separated list of model IDs (e.g. `chat-hub-v2,gpt-4o,dial-rag`).
- Expose `isFeatured?: boolean` field on `DeploymentItemDto`; the field is `true` when the item's `id` appears in the parsed `FEATURED_MODEL_IDS` list, `false` otherwise.
- `DeploymentsService` reads the parsed featured-ID set from config and stamps each `DeploymentItemDto` at mapping time.

## Capabilities

### New Capabilities

- `featured-models-config`: Parse and expose `FEATURED_MODEL_IDS` from environment config as a `Set<string>` for use by deployment mapping.

### Modified Capabilities

- `deployments`: `DeploymentItemDto` gains `isFeatured?: boolean`; `DeploymentsService` stamps the field during mapping using the featured-models config.

## Impact

- **Backend**: `apps/chat-api/src/config/environment.config.ts` (new field), `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` (new field + Swagger), `apps/chat-api/src/deployments/deployments.service.ts` (stamp logic).
- **Frontend**: `CatalogView` continues to use `useDeployments()` — `isFeatured` flows through the existing `DeploymentItemDto → mapDeploymentToCatalogItem → CatalogItem` pipeline with no new endpoints or context providers required.
- **No breaking changes** — `isFeatured` defaults to `false`; existing callers are unaffected. `FEATURED_MODEL_IDS` is optional; omitting it leaves all items with `isFeatured: false`.

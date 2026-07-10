## Why

`GET /api/v1/deployments` (`apps/chat-api/src/deployments/deployments.service.ts:143-232`) maps DIAL Core's list response into `DeploymentItemDto`, but DIAL Core's per-entity endpoints (`getModel`, `getApplication`, `getToolset`) return many additional fields — capabilities, pricing/limits, function metadata, toolset transport/auth settings — that are never forwarded because the list mapping only carries a small, list-appropriate subset (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts:21-117`). The frontend catalog detail panel (`apps/chat/src/components/CatalogView/CatalogView.tsx:66-72`) has a `fetchAboutContent` stub with a `// TODO: replace with a real API call` comment that always resolves `undefined`, and the mapper needed to render structured details (`apps/chat/src/utils/map-entity-details-to-catalog.ts`, `apps/chat/src/types/entity-details.ts`) already exists but is unwired — no caller ever produces an `EntitySpecificDetails` value. Users opening a catalog item today never see capabilities, pricing, API snippets, or toolset tool lists, even though DIAL Core has this data.

## What Changes

- Add a backend detail-by-id endpoint that dispatches to DIAL Core's `getModel` / `getApplication` / `getToolset` SDK calls (via the existing `AppService`/`this.client` pattern in `DeploymentsService`) based on the deployment's type, and maps the richer per-entity response into a new `DeploymentDetailsDto`.
- Extend/introduce DTOs to carry the additional safe fields identified per entity type (capabilities, tokenizer/limits/pricing for models; viewer/editor URL and function metadata for applications; transport/allowed-tools/auth-settings summary for toolsets) — excluding internal/sensitive fields (see Non-goals).
- Regenerate `libs/chat-api-client` so the new operation is available as a typed SDK method, and add a thin `apps/chat/src/server-api` wrapper.
- Extend `libs/catalog`'s `CatalogProps` with a new `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemTabData | undefined>` callback (initially mirroring the `onFetchAboutContent` fetch-on-open pattern already in `libs/catalog/src/components/Catalog/Catalog.tsx`), so the details panel can lazily load structured tab data when it opens, with its own loading state.
- Wire `apps/chat/src/components/CatalogView/CatalogView.tsx` to implement `onFetchDetails` by calling the new server-api wrapper, mapping the raw `DeploymentDetailsDto` into `EntitySpecificDetails` (`apps/chat/src/types/entity-details.ts`) and then into `CatalogItemTabData` via the existing, currently-unwired `mapEntityDetailsToCatalogDetails` (`apps/chat/src/utils/map-entity-details-to-catalog.ts`).
- *(Post-launch revision)* Since `fetchAboutContent` never resolved anything but `undefined`, `onFetchAboutContent`/`aboutContent`/`isAboutLoading` were removed as dead code from `CatalogProps`, `Catalog.tsx`, `DetailsPanelProps`, `Summary`, and `AboutTab`. The Intro section now reads a new static `CatalogItem.intro?: string` field (populated by a future backend field), falling back to `item.description` — `item.intro ?? item.description` — with no async fetch or loading state of its own.

## Capabilities

### New Capabilities
- `deployment-details-api`: Backend `GET /api/v1/deployments/{deployment}/details` endpoint that fetches full per-entity data by id/type and maps it into a frontend-safe `DeploymentDetailsDto`.
- `catalog-item-details-fetch`: Frontend lazy fetch-by-id wiring for the catalog details panel — `libs/catalog`'s new `onFetchDetails` prop, the `apps/chat/src/server-api` wrapper, and the `CatalogView` adapter that maps the DTO into `EntitySpecificDetails` / `CatalogItemTabData`.

### Modified Capabilities
- (none — `deployments-api` and `unified-catalog` list-endpoint behavior is unchanged; this adds a new endpoint and a new frontend callback alongside them)

## Impact

- **Backend**: `apps/chat-api/src/deployments/deployments.controller.ts`, `deployments.service.ts`, new DTO(s) under `apps/chat-api/src/deployments/dto/`, their `tests/` specs, `libs/chat-api-client/openapi.json` (regenerated).
- **Frontend**: `libs/catalog/src/models/catalog-props.ts`, `libs/catalog/src/components/Catalog/Catalog.tsx` (+ tests), `apps/chat/src/server-api/` (new/updated wrapper), `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/utils/map-entity-details-to-catalog.ts` (wired up, not restructured), `apps/chat/src/i18n/locales/en.json` (any new labels beyond what `detailsTexts` already covers).
- **Non-goals**: no changes to the list endpoint's cached payload size (details stay a separate, per-id fetch to avoid inflating the 30s-cached list response); no exposure of internal-only fields (`function.env`, `function.source_folder`/`target_folder`, `auth_settings` client secrets, `editor_url` unless the user already has app-editor access, raw `reference`); no new capability-based access control beyond the existing `SessionGuard` on `/api/v1/deployments/*`.
- **Backward compatibility**: purely additive — new endpoint, new optional prop on `libs/catalog`, new optional callback wiring in `CatalogView`. Existing `GET /api/v1/deployments` list shape is unchanged. `onFetchAboutContent` was removed post-launch (see Post-launch revision above) since it was always a no-op; `CatalogItem.intro` is a new optional field, so this remains additive. Rollback is deleting the new endpoint/DTO/prop; no data migration involved.

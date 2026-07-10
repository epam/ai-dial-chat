Slicing strategy: **vertical** — get one deployment type (model) working end-to-end through the backend endpoint, generated client, and frontend wiring first (slices 1-4), then widen to applications and toolsets (slice 5), then close with tests and docs (slices 6-8). Each slice is independently verifiable with `npm exec nx test/lint/build chat-api` and the frontend equivalents.

## 1. Backend: DTO and detail-by-id service method (model type only)

- [x] 1.1 Add `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` with `DeploymentDetailsDto` (`id`, `type`, `modelDetails?`, `applicationDetails?`, `toolsetDetails?`) and `ModelDetailsDto` (`capabilities`, `lifecycleStatus`, `tokenizerModel`, `limits`, `pricing`), each field `@ApiProperty`/`@ApiPropertyOptional` with class-validator decorators per `apps/chat-api/AGENTS.md` DTO conventions. Leave `applicationDetails`/`toolsetDetails` as `undefined`-typed placeholders for now (populated in slice 5). *(Implemented full `ApplicationDetailsDto`/`ToolsetDetailsDto` here too — see note on slice 6.)*
- [x] 1.2 Add `DeploymentsService.getDeploymentDetails(deployment: string, accessToken: string): Promise<DeploymentDetailsDto>` in `apps/chat-api/src/deployments/deployments.service.ts`: call `this.client.getModel(deployment, { headers })` for `type === 'model'`, map into `ModelDetailsDto` via an explicit allowlist, cache the result under `deployments:details:<deployment>` for 60 000 ms, and follow the existing `mapDialHttpStatus`/`handleDialFetchError` error pattern (404 for unresolved id, 502/503 for upstream failures). *(Superseded the original `listDeployments`-based type resolution: resolves type from the `toolsets/`/`applications/` id-prefix convention instead, since a full-catalog `listDeployments` call was unnecessarily expensive just to classify one id — see design note below and `deployment-details-api` spec.)*
- [x] 1.3 Verify: `npm exec nx lint chat-api && npm exec nx test chat-api`.

## 2. Backend: controller route (model type only)

- [x] 2.1 Add `GET :deployment/details` to `apps/chat-api/src/deployments/deployments.controller.ts`: `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=60')`, `@ApiOperation({ operationId: 'getDeploymentDetails', summary: ... })`, `@ApiResponse` for 200 (`type: DeploymentDetailsDto`), 401, 404, 429, 502, 503, delegating to `DeploymentsService.getDeploymentDetails`.
- [x] 2.2 Add `apps/chat-api/src/deployments/tests/deployments.controller.spec.ts` and `deployments.service.spec.ts` cases for: model detail success, 404 for unknown id, 502/503 mapping, cache-hit skip of the upstream call, 401 without session — following the existing `.overrideProvider`/mocked-`this.client` pattern already used in those spec files.
- [x] 2.3 Add a `deployments.controller.integration.spec.ts` supertest case for `GET /api/v1/deployments/{id}/details` happy path + auth rejection, mirroring the existing integration spec's structure.
- [x] 2.4 Verify: `npm exec nx test chat-api && npm exec nx lint chat-api`.

## 3. OpenAPI generation and generated client

- [x] 3.1 Run `npm run openapi` and `npm run openapi:check`; confirm `getDeploymentDetails` appears on the generated `DeploymentsApi` in `libs/chat-api-client/src/generated/src/apis` with `DeploymentDetailsDto`/`ModelDetailsDto` strongly typed (no `any`).
- [x] 3.2 Build and lint `chat-api-client`: `npm exec nx build chat-api-client && npm exec nx lint chat-api-client`.
- [x] 3.3 Confirm the generated singleton client in `apps/chat/src/server-api/api-client.ts` already exposes `DeploymentsApi` (it does, per existing `getDeploymentConfiguration` usage); no change needed there unless the generator renames the export.

## 4. Frontend: server-api wrapper and lib prop wiring (model type only)

- [x] 4.1 Add `getDeploymentDetails(deploymentId: string)` to `apps/chat/src/server-api/deployments.ts`, calling `deploymentsApi.getDeploymentDetails({ deployment: deploymentId })`, following the same shape as the existing `getDeploymentConfiguration` wrapper in that file. Do not add a `base.ts` helper.
- [x] 4.2 Add `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemTabData | undefined>` to `CatalogProps` in `libs/catalog/src/models/catalog-props.ts` with JSDoc per `libs/*` conventions.
- [x] 4.3 In `libs/catalog/src/components/Catalog/Catalog.tsx`, add `isDetailsLoading`/fetched-details local state and an effect (initially mirroring the `aboutContent`/`isAboutLoading` effect shape) that calls `onFetchDetails(item)` when the details panel opens and `onFetchDetails` is provided; fetched data takes precedence over `item.details` for the open item. *(Also added `isDetailsLoading` to `DetailsPanelProps` and a small spinner next to the tab row, per design.md's loading-state mitigation. Post-launch: `aboutContent`/`isAboutLoading`/`onFetchAboutContent` were removed as dead code — see task 9.)*
- [x] 4.4 Add/update `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx` cases: fetch triggered on open, loading state shown while pending, fetched data overrides static `item.details`, `undefined` resolution falls back to `item.details`, no-op when `onFetchDetails` is absent.
- [x] 4.5 Verify: `npm exec nx test catalog && npm exec nx lint catalog`.

## 5. Frontend: `CatalogView` wiring and DTO→domain mapping (model type only)

- [x] 5.1 In `apps/chat/src/utils/map-entity-details-to-catalog.ts`'s call site (or a new small mapper co-located in `apps/chat/src/utils/`, per file-naming conventions grouped by domain concept rather than one-function-per-file), add a `mapDeploymentDetailsDtoToEntityDetails(dto: DeploymentDetailsDto): EntitySpecificDetails` conversion for `type: 'model'` → `{ type: 'MODEL', data: ModelEntityDetails }`, populating `capabilities`/`specification`/`pricing`/`api` from `dto.modelDetails`. *(Superseded: the mapper switches on `dto.type` — the backend-resolved discriminator already present on `DeploymentDetailsDto` — rather than taking a separate `itemType: CatalogEntityType` parameter; the caller never needs to pass the catalog item's own type, since the server has already classified the id. Separately, `DeploymentDetailsDto`'s `features` (DIAL Core's runtime feature-flag payload — `tools`/`mcp`/`seed`/`parallel_tool_calls`/`reasoning_efforts`/etc., see `mapDeploymentFeatures` in `deployments.service.ts`) turned out to be the honest source for `ModelCapabilities`. The shared `mapFeaturesToCapabilities` helper in `map-entity-details-to-catalog.ts` maps it into `hasTools`/`hasMcp`/`hasCaching`/`hasParallelToolCalls`/`hasUrlAttachments`/`hasFolderAttachments`/`hasSeed`/`hasSystemPrompt`/`hasResume`/`reasoningEfforts`; `specification`, `pricing`, and `api.modelId` remain populated as originally planned.)*
- [x] 5.2 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, implement `onFetchDetails` (wrapped in `useCallback`): call `getDeploymentDetails(item.id)`, convert via `mapDeploymentDetailsDtoToEntityDetails`, then `mapEntityDetailsToCatalogDetails`; catch failures and resolve `undefined` without throwing. Pass `onFetchDetails` to `<Catalog />`. *(Initially kept `onFetchAboutContent` as-is since no free-text description field is populated by the new endpoint. Post-launch: removed entirely as dead code — see task 9.)*
- [x] 5.3 Add `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` cases: `onFetchDetails` calls the wrapper and maps a model DTO correctly; a rejected/erroring fetch resolves `undefined` and does not throw.
- [x] 5.4 Verify: `npm exec nx test chat && npm exec nx lint chat`.

## 6. Widen to applications and toolsets

- [x] 6.1 Extend `DeploymentDetailsDto` with `ApplicationDetailsDto` (`applicationProperties`, `functionRuntime`, `functionStatus`, `routes`) and `ToolsetDetailsDto` (`transport`, `allowedTools`, `authSettings: { authenticationType }`) per the spec's allowlist, explicitly excluding `function.env`, `function.source_folder`, `function.target_folder`, `editor_url`, and raw `auth_settings` credentials. *(Done together with 1.1 for efficiency.)*
- [x] 6.2 In `DeploymentsService.getDeploymentDetails`, add the `application` branch (`this.client.getApplication`) and `toolset` branch (`this.client.getToolset`), each mapping into their DTO via explicit allowlist. *(Done together with 1.2/2.1.)*
- [x] 6.3 Add service/controller/integration test cases for application and toolset detail success, and a case asserting excluded fields never appear in the serialized response (`JSON.stringify` does not contain `function.env`/`client_secret`-shaped values). *(Done together with 2.2/2.3.)*
- [x] 6.4 Extend `mapDeploymentDetailsDtoToEntityDetails` (5.1) with `application` → `{ type: 'AGENT', data: AgentEntityDetails }` and `toolset` → `{ type: 'TOOLSET', data: ToolsetEntityDetails }` branches. *(Note: `AgentEntityDetails`'s fields — domain/useCase/maturity/baseModelId/inputAttachmentTypes — don't fit DIAL Core's application function/route metadata. `capabilityLinks` was tried for `routes` but produced visually duplicated label/value text in the generic "References" section renderer (same string in both fields); superseded by a single `Routes` row inside `AgentSpecification` (`routes: string[]`), rendered as a joined string alongside the other spec rows. `ToolsetEntityDetails.specification.permissions` is populated from `allowedTools` — the closest existing field, since there is no dedicated tools-list field on the domain type.)*
- [x] 6.5 Add `CatalogView.spec.tsx` cases for application and toolset detail mapping (mirrors 5.3).
- [x] 6.6 Verify: `npm exec nx test chat-api chat catalog && npm exec nx lint chat-api chat catalog`.

## 7. Docs

- [x] 7.1 Add a row for `GET /api/v1/deployments/{deployment}/details` to the "Models & Deployments" endpoint table in `docs/architecture.md` (~line 317-322).

## 8. Final verification

- [x] 8.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0`, `--target=test`, and `--target=build` over the full affected set (`chat-api`, `chat`, `catalog`, `chat-api-client`).
- [x] 8.2 Confirm `npm run openapi:check` is clean (no drift between `deployments.controller.ts` Swagger annotations and `libs/chat-api-client/openapi.json`).

## 9. Post-launch: Intro/About simplification

- [x] 9.1 Requirements changed: the Intro section's content stops being an async-fetched "About" value and becomes a genuinely new, still-backend-pending field. Added `intro?: string` to `CatalogItem` (`libs/catalog/src/models/catalog-item.ts`), distinct from the existing `description: string`.
- [x] 9.2 Removed `onFetchAboutContent`/`aboutContent`/`isAboutLoading` as dead code (the `CatalogView.tsx` implementation always resolved `undefined`, so it never fetched real data): deleted from `CatalogProps`, `Catalog.tsx` state/effect, `DetailsPanelProps`, `Summary`, and `AboutTab`. `AboutTab` now reads `item.intro ?? item.description` directly and synchronously.
- [x] 9.3 Updated `proposal.md`, `design.md`, and both `specs/*/spec.md` files to describe the final `item.intro ?? item.description` behavior instead of the removed async fetch.
- [x] 9.4 Verify: `npm exec nx build/lint/test catalog` and `npm exec nx build/lint/test chat`.

## 10. Post-launch: restore the About tab

- [x] 10.1 Requirements changed again: re-added `About = 'about'` to `CatalogDetailsTab` (`libs/catalog/src/types/detail-tab.ts`), as the first enum member.
- [x] 10.2 In `DetailsPanel.tsx`'s `tabs` memo, unconditionally prepend an `About` entry (label `texts?.tabAboutLabel ?? 'About'`) ahead of the existing conditional Overview/Pricing/API/Tools entries — unlike those, About does not depend on `item.details` being populated. Added `tabAboutLabel?: string` to `ItemDetailsTexts`.
- [x] 10.3 Rendered the shared `AboutTab` component (already used by `Summary` for the Intro section) as the tab body when `activeTab === CatalogDetailsTab.About`, so both surfaces stay in sync with one implementation of `item.intro ?? item.description` parsing/rendering.
- [x] 10.4 Updated `DetailsPanel.spec.tsx`: replaced the two tests asserting no About entry existed with tests asserting About is present and first in the tab row (including when no other tabs are available), and relaxed the "about content" assertion to `getAllByText` since it now renders in two places (Intro section + About tab).
- [x] 10.5 Updated `design.md` and `specs/catalog-item-details-fetch/spec.md` to describe the restored About tab and the intentional same-content-in-two-places layout.
- [x] 10.6 Verify: `npm exec nx build/lint/test catalog`.

## 11. Post-launch: About tab always shows `description`, not `intro`

- [x] 11.1 Requirements changed again: for items where both `intro` and `description` are populated (e.g. a toolset), showing the same `intro` text in both the Intro section and the About tab was reported as a bug, not the intended UX — the About tab must always show the full `description`, while the Intro section keeps its `intro ?? description` teaser behavior.
- [x] 11.2 `AboutTab` (`libs/catalog/src/components/Details/TabsContent/About.tsx`) no longer derives its own `intro ?? description` fallback; it now takes an explicit `content: string` prop. `Summary.tsx` passes `item.intro ?? item.description`; `DetailsPanel.tsx`'s About tab body passes `item.description` unconditionally.
- [x] 11.3 Updated `design.md` (Decision 4, third post-launch revision) and `specs/catalog-item-details-fetch/spec.md`'s Intro/About requirement and scenarios to describe this as the final, intended behavior.
- [x] 11.4 Verify: `npm exec nx test @epam/ai-dial-catalog` (56/56 passing) and `npm exec nx typecheck @epam/ai-dial-catalog`.

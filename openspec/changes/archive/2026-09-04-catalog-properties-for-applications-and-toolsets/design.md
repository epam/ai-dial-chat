## Context

`GET /api/v1/deployments/{deployment}/details` (`apps/chat-api/src/deployments/details/deployments-details.service.ts`) has three sibling builder methods — `buildModelDetails`, `buildApplicationDetails`, `buildToolsetDetails` — each mapping one DIAL Core SDK response shape into the matching branch of `DeploymentDetailsDto`. Only `buildModelDetails` currently reads `raw.catalog_properties` and allow-lists it into `ModelCatalogPropertiesDto` (`deployment-details.dto.ts:55-76`); `buildApplicationDetails` and `buildToolsetDetails` never look at the field. The `@epam/ai-dial-typescript-sdk` response types confirm `catalog_properties?: MapStringObject` is present identically on the model, application, and toolset schemas (`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts:3036,4301,4816`), so this is a pure mapping gap, not a DIAL Core data-availability gap.

The same split repeats on the frontend: `ModelSpecification` (`libs/chat-hooks/src/catalog/entity-details.ts:33-44`) carries the five catalog fields; `AgentSpecification` (lines 76-80) and `ToolsetSpecification` (lines 130-138) don't. `mapModelDetailsDto`/`mapModelDetails` (`map-entity-details-to-catalog.ts:449-492` and `84-123`) copy the DTO fields and turn them into Overview → Specification rows; `mapApplicationDetailsDto`/`mapAgentDetails` and `mapToolsetDetailsDto`/`mapToolsetDetails` don't. The `Overview` component itself (`libs/catalog/src/components/Details/TabsContent/Overview.tsx`) is generic over `OverviewSection[]` and needs no changes — it already renders whatever rows it's given.

## Goals / Non-Goals

**Goals:**

- Applications and Toolsets expose the same five allow-listed catalog properties (provider, vendor, license, knowledge cutoff date, parameters) as Models, through the same response field name and Overview → Specification row order, so behavior is consistent across all three entity types.
- Reuse the existing allow-list/omit-empty semantics exactly (unknown keys dropped, non-string values dropped, field omitted entirely when nothing recognized remains) rather than defining a second variant of that logic.

**Non-Goals:**

- No change to the Model path's request/response shape, DTO, or mapping — it already works and is out of scope.
- No new catalog-property keys beyond the five already supported for Models.
- No change to `Overview.tsx` or any other generic Overview rendering component — the gap is entirely in the data pipeline feeding it.

## Decisions

- **Extract one shared allow-list helper instead of copying the IIFE three times.** `buildModelDetails` currently inlines the allow-list/omit-empty logic as a local IIFE (`deployments-details.service.ts:294-311`). Copying that block verbatim into `buildApplicationDetails` and `buildToolsetDetails` would triple the duplication for logic that must stay byte-identical (same five keys, same omit-when-empty rule). Instead, extract a private method (or module-level function) `mapCatalogProperties(raw: unknown): ModelCatalogPropertiesDto | undefined` on the service and call it from all three builders. Alternative considered: leave three separate inline copies — rejected because any future key addition would need three synchronized edits, and the existing `isRecord`/`getString` helpers already live at module scope in this file making extraction low-risk.
- **Reuse `ModelCatalogPropertiesDto` for `ApplicationDetailsDto.catalogProperties` and `ToolsetDetailsDto.catalogProperties` rather than defining `ApplicationCatalogPropertiesDto`/`ToolsetCatalogPropertiesDto`.** The five fields and their Swagger metadata are identical across all three entity types; DIAL Core's `catalog_properties` is schema-driven by `catalogSchemaId`, not entity-type-driven, so there is no type-specific shape to encode. A generic name (`ModelCatalogPropertiesDto`) is slightly misleading once shared by Application/Toolset DTOs, but renaming it would touch the already-shipped Model contract and OpenAPI client for a cosmetic reason; keeping the name is the smaller, safer diff. (If a future change gives entity types materially different catalog-property shapes, splitting the DTO becomes worth it then.)
- **Mirror the frontend mapping symmetrically**: add the same five optional fields to `AgentSpecification`/`ToolsetSpecification`, map them in `mapApplicationDetailsDto`/`mapToolsetDetailsDto` the same way `mapModelDetailsDto` does, and push the same five labeled rows (in the same order: Provider, Vendor, License, Knowledge cutoff date, Parameters) from `mapAgentDetails`/`mapToolsetDetails` using the same row-building/date-formatting helper `mapModelDetails` already calls, rather than writing new formatting logic for the two other entity types.

## Risks / Trade-offs

- [Risk] Missing the extraction and instead copy-pasting the IIFE would reintroduce the same three-copies-to-keep-in-sync problem this change is meant to close for the model path already has, only now across three call sites. → Mitigation: the shared helper is a required part of this change, not optional cleanup; tests assert model, application, and toolset all route through identical allow-list behavior.
- [Risk] `@epam/ai-dial-chat-api-client` regeneration (`npm run openapi`) after the DTO change could pick up unrelated upstream Swagger drift if the OpenAPI spec has changed since the client was last generated. → Mitigation: run `npm run openapi:check` immediately after regenerating and diff-review the generated client changes are scoped to the new `catalogProperties` fields before committing.
- [Risk] Silent regression if `Object.values(properties).some(...)` omit-when-empty check diverges between the extracted helper and the two new call sites (e.g. one passes `raw.catalog_properties` while another accidentally passes `raw` itself). → Mitigation: the helper takes the already-narrowed `raw.catalog_properties` value (or the full `raw` record with an internal `.catalog_properties` access — settled during implementation) as its only input and is unit-tested directly, independent of which builder calls it.

## Migration Plan

No data migration. This is an additive, optional-field change to an existing GET endpoint response and its frontend mapping:

1. Backend: extract the shared helper, wire it into all three builders, add the DTO field to `ApplicationDetailsDto`/`ToolsetDetailsDto`, extend `deployments-details.service.spec.ts`.
2. Regenerate `@epam/ai-dial-chat-api-client` (`npm run openapi`, `npm run openapi:check`) so the new optional DTO fields are typed on the frontend.
3. Frontend: extend `AgentSpecification`/`ToolsetSpecification`, the two DTO-to-domain mappers, and the two domain-to-Overview-section mappers; extend `map-entity-details-to-catalog.spec.ts`.
4. Manual verification: reproduce the exact repro steps from GitHub issue #8624 against a local DIAL Core / mocked deployment-details response for an Application and a Toolset with `catalogSchemaId`/`catalogProperties` set, confirm the five rows render on the Overview tab.

Rollback is a plain revert — the new field is optional and additive on both the wire format and the domain types, so no consumer needs a coordinated rollback.

## Open Questions

None — the Model path's existing behavior fully specifies what "supported the same way" means for Application and Toolset.

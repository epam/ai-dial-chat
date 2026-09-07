## Why

`catalog-item-details-fetch` already surfaces `catalogSchemaId`/`catalog_properties` (provider, vendor, license, knowledge cutoff date, parameters) for **models** on the Overview tab, but the same DIAL Core data is silently dropped for **Applications** and **Toolsets** — even though admins set it identically via the same `catalogSchemaId`/`catalogProperties` JSON on any entity type. This is tracked as [GitHub issue #8624](https://github.com/epam/ai-dial-chat/issues/8624): admins configure catalog properties on an Application or Toolset in AI DIAL Admin, but DIAL Chat 2.0's Overview tab shows nothing for them.

## What Changes

- Backend: add `catalogProperties` (`ModelCatalogPropertiesDto`, same five allow-listed string fields) to `ApplicationDetailsDto` and `ToolsetDetailsDto`, and populate it in `buildApplicationDetails`/`buildToolsetDetails` the same way `buildModelDetails` already does — reading `raw.catalog_properties`, allow-listing `provider`/`vendor`/`license`/`knowledgeCutoffDate`/`parameters`, omitting unknown or non-string keys, and omitting the field entirely when no recognized value remains.
- Frontend: add the same five optional fields to `AgentSpecification` and `ToolsetSpecification` (`libs/chat-hooks/src/catalog/entity-details.ts`), map `catalogProperties` in `mapApplicationDetailsDto`/`mapToolsetDetailsDto`, and render them as Overview → Specification rows (Provider, Vendor, License, Knowledge cutoff date, Parameters) in `mapAgentDetails`/`mapToolsetDetails`, reusing the existing row-building and date-formatting logic already used for models — missing values still do not create empty rows.
- No change to the model path, response shape for existing fields, OpenAPI `operationId`s, auth, rate limits, or caching behavior — this is an additive DTO field on two existing response branches.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `catalog-item-details-fetch`: extends the existing "Model catalog properties are exposed in Overview Specification" requirement so Application and Toolset detail responses and their Overview → Specification rendering also expose `catalogProperties`, not just Model.

## Impact

- `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` — add `catalogProperties?: ModelCatalogPropertiesDto` to `ApplicationDetailsDto` and `ToolsetDetailsDto`.
- `apps/chat-api/src/deployments/details/deployments-details.service.ts` — extend `buildApplicationDetails`/`buildToolsetDetails` to read and allow-list `raw.catalog_properties`, mirroring `buildModelDetails`.
- `libs/chat-hooks/src/catalog/entity-details.ts` — add the five optional catalog-property fields to `AgentSpecification` and `ToolsetSpecification`.
- `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` — extend `mapApplicationDetailsDto`/`mapToolsetDetailsDto` (DTO → domain) and `mapAgentDetails`/`mapToolsetDetails` (domain → Overview section rows).
- Tests: `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` and `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts` gain Application/Toolset catalog-properties coverage mirroring the existing Model coverage.
- Regenerating `@epam/ai-dial-chat-api-client` after the DTO change (`npm run openapi`) to pick up the new optional fields on `ApplicationDetailsDto`/`ToolsetDetailsDto`.

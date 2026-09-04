## 1. Backend DTO and mapping

- [x] 1.1 In `apps/chat-api/src/deployments/dto/deployment-details.dto.ts`, add `catalogProperties?: ModelCatalogPropertiesDto` (with `@ApiPropertyOptional`) to `ApplicationDetailsDto` and `ToolsetDetailsDto`.
- [x] 1.2 In `apps/chat-api/src/deployments/details/deployments-details.service.ts`, extract the inline catalog-properties IIFE currently in `buildModelDetails` (lines ~294-311) into a shared private method, e.g. `mapCatalogProperties(catalogProperties: unknown): ModelCatalogPropertiesDto | undefined`, using the existing `isRecord`/`getString` helpers and preserving the exact allow-list/omit-when-empty behavior.
- [x] 1.3 Call `this.mapCatalogProperties(raw.catalog_properties)` from `buildModelDetails` (replacing the inline IIFE), `buildApplicationDetails`, and `buildToolsetDetails`, assigning the result to `catalogProperties` on each respective details object.
- [x] 1.4 Extend `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` with Application and Toolset cases mirroring the existing Model cases: all five recognized values present, unknown/non-string keys ignored, and `catalogProperties` omitted entirely when no recognized string value remains.
- [x] 1.5 Run `npm exec nx test chat-api -- deployments-details.service` and `npm exec nx lint chat-api` to confirm the backend slice is green.

## 2. OpenAPI regeneration

- [x] 2.1 Run `npm run openapi` to regenerate `@epam/ai-dial-chat-api-client` from the updated DTOs.
- [x] 2.2 Run `npm run openapi:check` and review the generated client diff to confirm only `ApplicationDetailsDto.catalogProperties` and `ToolsetDetailsDto.catalogProperties` were added, with no unrelated drift.
- [x] 2.3 Build/lint the regenerated client: `npm exec nx build chat-api-client && npm exec nx lint chat-api-client`.

## 3. Frontend domain types

- [x] 3.1 In `libs/chat-hooks/src/catalog/entity-details.ts`, add the five optional fields (`provider`, `vendor`, `license`, `knowledgeCutoffDate`, `parameters`) to `AgentSpecification` and `ToolsetSpecification`, matching `ModelSpecification`'s existing field names and types.

## 4. Frontend mapping (DTO → domain → Overview sections)

- [x] 4.1 In `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`, extend `mapApplicationDetailsDto` to copy `applicationDetails.catalogProperties` fields into the returned `AgentSpecification`, mirroring `mapModelDetailsDto`.
- [x] 4.2 Extend `mapToolsetDetailsDto` to copy `toolsetDetails.catalogProperties` fields into the returned `ToolsetSpecification`, mirroring `mapModelDetailsDto`.
- [x] 4.3 Extend `mapAgentDetails` to push the same five labeled Specification rows (Provider, Vendor, License, Knowledge cutoff date, Parameters, in that order) that `mapModelDetails` pushes, reusing the same row-building/date-formatting logic (including the local-date, non-UTC parsing for `knowledgeCutoffDate`) — omitting rows for missing values.
- [x] 4.4 Extend `mapToolsetDetails` the same way as 4.3, for the toolset Specification rows.
- [x] 4.5 Extend `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts` with Application and Toolset cases mirroring the existing Model cases: all five rows render in order, unknown/non-string properties produce no extra rows, missing properties produce no empty rows, and the knowledge-cutoff-date scenario (local-date formatting, no timezone shift) is covered for both entity types.
- [x] 4.6 Run `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts` and `npm exec nx lint chat-hooks`.

## 5. Manual verification and docs

- [x] 5.1 Start the app (`npm run start:all`) and, using a mocked or local DIAL Core response with `catalogSchemaId`/`catalogProperties` set on an Application and a Toolset (reproducing the exact repro steps from GitHub issue #8624), confirm the Overview tab renders Provider, Vendor, License, Knowledge cutoff date, and Parameters for both entity types.
- [x] 5.2 Run `npm run validate:docs` if any README or `docs/**` content referencing `DeploymentDetailsDto`, `ApplicationDetailsDto`, `ToolsetDetailsDto`, `AgentSpecification`, or `ToolsetSpecification` needs updating for the new fields. (Passed — no README/docs content documents these DTO fields, so nothing needed updating.)
- [x] 5.3 Run `npm run verify:changed` for the full affected-slice verification before requesting review. (`lint:affected` passed; `test:changed` passed except two pre-existing, unrelated failures reproduced identically on a clean `development` checkout — `create-files-api.spec.ts`'s `Response`/`Blob.stream` Node-environment flake and `@epam/chat-api`'s stale-build-cache `typecheck` (808 pre-existing errors unrelated to this change); `test:file` on both touched spec files passes cleanly.)

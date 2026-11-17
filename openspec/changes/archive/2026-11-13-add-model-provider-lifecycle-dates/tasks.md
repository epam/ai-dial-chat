Slicing strategy: **contract-first, then vertical**. Slices 1–3 settle the BFF contract and publish it through OpenAPI and the generated client, because the `chat-hooks` mapper consumes the generated `DeploymentDetailsDto` type. Slice 4 is the UI path, from the DTO to the translated Overview rows. Slice 5 updates the docs. Each slice is green before the next starts. Read `apps/chat-api/AGENTS.md` before slices 1–3, and `.claude/rules/libs.md` before slice 4.

## 0. SDK bump (done on this branch)

- [x] 0.1 Pin `@epam/ai-dial-typescript-sdk` at `0.3.0-dev.3` in `apps/chat-api/package.json` and update `package-lock.json` with `npm install`. Confirm that `ModelData` declares `provider`, `deprecation_date` and `end_of_service` in `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`.

  **Verification:** `npm exec nx run-many -- -t typecheck lint -p chat-api` passes. `npm exec nx test chat-api` passes except `src/config/tests/explicit-environment.spec.ts`, which fails only because a local `apps/chat-api/.env.local` leaks into the run. It passes with `npm run test:file -- apps/chat-api/src/config/tests/explicit-environment.spec.ts` and with `NX_LOAD_DOT_ENV_FILES=false`.

## 1. Model details expose provider and lifecycle dates; `provider` leaves the catalog-properties allowlist (chat-api)

- [x] 1.1 In `apps/chat-api/src/deployments/dto/deployment-details.dto.ts`:
  - remove `provider` from `ModelCatalogPropertiesDto`, so it has four fields: `vendor`, `license`, `knowledgeCutoffDate` and `parameters`. Add no new DTO;
  - add `provider?`, `deprecationDate?` and `endOfService?` (strings) to `ModelDetailsDto`, with `@ApiPropertyOptional` descriptions and examples (`'Azure'`, `'2026-12-31'`, `'2027-03-31'`). Each description says that the value is forwarded from DIAL Core unvalidated.
- [x] 1.2 In `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), stop reading `provider` and update the JSDoc from "five" to "four" fields. Models, applications and toolsets share this change.
- [x] 1.3 In `buildModelDetails` (`apps/chat-api/src/deployments/details/deployments-details.service.ts`), set `provider: raw.provider`, `deprecationDate: raw.deprecation_date` and `endOfService: raw.end_of_service` from the typed SDK result, with no cast.
- [x] 1.4 Unit tests:
  - `apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts`. `mapCatalogProperties` keeps the four fields and drops `provider`. It returns `undefined` for a provider-only object, for `undefined`, and for a non-object.
  - `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`:
    - model details forward `provider`, `deprecationDate` and `endOfService` when Core sends them;
    - model details have none of the three keys in the JSON body when Core omits them;
    - model, application and toolset `catalogProperties` never contain `provider`, and a model's `catalogProperties` is absent when `provider` was its only key.

  **Verification:** `npm run test:file -- apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts`, `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`, and `npm run test:file -- apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts`. All three pass.

## 2. Model catalog copies provider and lifecycle dates (chat-api)

- [x] 2.1 In `apps/chat-api/src/openapi/openapi-response.dto.ts`, add `provider?`, `deprecation_date?` and `end_of_service?` (strings) to `DialModelDto`, each with `@ApiPropertyOptional({ description, example })`, next to `lifecycle_status`. Do not touch `ModelsService`: `/models` already forwards them at runtime.
- [x] 2.2 In `apps/chat-api/src/models/dto/model-catalog-response.dto.ts`, add `'provider'`, `'deprecation_date'` and `'end_of_service'` to `MODEL_CATALOG_ENTRY_FIELDS`. `ModelCatalogEntryDto.catalog_properties` keeps `ModelCatalogPropertiesDto`, which now has no `provider`.
- [x] 2.3 `toCatalogEntry` (`apps/chat-api/src/models/catalog/model-catalog.service.ts`) keeps `mapCatalogProperties`, so its result no longer carries `provider`. No code change is needed.
- [x] 2.4 Unit tests in `apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`:
  - `listCatalog` copies `provider`, `deprecation_date` and `end_of_service` as sent, including a non-ISO date string;
  - an entry has none of the three keys when Core omits them;
  - `catalog_properties` drops `provider`, and is omitted for `{ provider: 'Google' }` alone;
  - `getCatalogEntry` returns the three fields and the provider-less `catalog_properties`.

  **Verification:** `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`, `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.controller.spec.ts`, and `npm run test:file -- apps/chat-api/src/models/tests/models.service.spec.ts`. All three pass.

## 3. OpenAPI contract and generated client

- [x] 3.1 Run `npm run openapi`, which regenerates `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/**`. Never hand-edit generated files. The diff touches only `openapi.json` and `src/generated/src/models/index.ts`:
  - `DialModelDto`, `ModelCatalogEntryDto` and `ModelDetailsDto` gain `provider`, `deprecationDate` and `endOfService`;
  - `ModelCatalogPropertiesDto` loses `provider`;
  - operation names are unchanged.
- [x] 3.2 Run `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`. All three exit 0. `apps/chat/src/server-api/api-client.ts` and the `server-api` wrappers need no change.

## 4. Catalog Overview: model provider and lifecycle dates; no Provider for applications and toolsets (chat-hooks + app)

- [x] 4.1 In `libs/chat-hooks/src/catalog/entity-details.ts`:
  - add `deprecationDate?: string` and `endOfService?: string` to `ModelSpecification`, each with an inline JSDoc;
  - document `ModelSpecification.provider` as the model's top-level DIAL Core provider;
  - remove `provider` from `AgentSpecification` and `ToolsetSpecification`.
- [x] 4.2 In `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`:
  - `EntityDetailsLabels` and `DEFAULT_ENTITY_DETAILS_LABELS` gain `deprecationDate` ('Deprecation date') and `endOfService` ('End of service');
  - `mapModelDetailsDto` reads `provider`, `deprecationDate` and `endOfService` from `dto.modelDetails` and adds the three fields to `hasSpecification`;
  - `mapModelDetails` pushes Deprecation date and End of service after Release date, both through `formatCatalogDate`;
  - `mapApplicationDetailsDto`, `mapToolsetDetailsDto`, `mapAgentDetails` and `mapToolsetDetails` no longer read `provider` and no longer render the Provider row.
- [x] 4.3 Architecture guard. The `chat-hooks` diff adds no import, endpoint path, i18n or locale access, env, flag or storage, and `libs/catalog` is unchanged. `npm exec nx lint @epam/ai-dial-chat-hooks` passes.
- [x] 4.4 Unit tests in `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`:
  - the model Provider row comes from the top-level `provider`;
  - Deprecation date and End of service render after Release date and before Context window, as local calendar dates;
  - absent dates render no rows;
  - `endOfService` alone builds a Specification section;
  - a non-ISO `deprecationDate` is shown verbatim;
  - host labels replace only those two rows;
  - application and toolset Overviews have no Provider row;
  - `DEFAULT_ENTITY_DETAILS_LABELS` has 26 keys.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts` passes.
- [x] 4.5 i18n. Add `catalog.entityDetails.deprecationDate` ("Deprecation date") and `catalog.entityDetails.endOfService` ("End of service") to `apps/chat/src/i18n/locales/en.json`, after `releaseDate`. Neither English string existed before. Add `CatalogI18nKeys.EntityDetailsDeprecationDate` and `CatalogI18nKeys.EntityDetailsEndOfService` to `apps/chat/src/constants/translation-keys.ts`, and fill both in `buildEntityDetailsLabels` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`).

  **Verification:** `npm run test:file -- apps/chat/src/utils/tests/map-deployment-to-catalog-item.spec.ts` passes, including a new `buildEntityDetailsLabels` assertion.
- [x] 4.6 RTL. `libs/catalog` is unchanged, and the two rows reuse the existing Overview row markup in `libs/catalog/src/components/Details/TabsContent/Overview.tsx`. That file has no physical-direction class and the rows add no icon. There is no existing RTL test for Overview, so the check was by inspection. Adding one would mean editing `libs/catalog`, which is outside this change.

  **Verification:** `npm exec nx run-many -- -t typecheck lint -p @epam/ai-dial-chat-hooks @epam/chat @epam/chat-api` passes. `npm run verify:changed`: typecheck and lint pass. `test:changed` reported two failures:
  - `@epam/chat:test` passes on its own (287 files, 4300 tests), so the failure came from parallel load;
  - `attachment-canvas-consumer-fixture:pack-lib` fails with `ETARGET` on `@epam/pdf-highlighter-kit@^0.0.22`, the same unrelated failure the archived `add-catalog-properties-to-model-catalog` change records.

## 5. Documentation

- [x] 5.1 In the `apps/chat-api/README.md` "Model catalog" section:
  - say that entries also copy `provider`, `deprecation_date` and `end_of_service` as Core sends them;
  - say that the `catalog_properties` allowlist no longer includes `provider`;
  - add an operator note: set Core's model `provider` instead of `catalog_properties.provider`.
- [x] 5.2 In `libs/chat-hooks/README.md` (the Overview labels section), mention the two new `EntityDetailsLabels` fields if the section lists the fields or shows an example that should include them. Otherwise leave it unchanged.
- [x] 5.3 Check `docs/architecture.md` for a catalog or deployment-details field list. Expected result: no edit.

  **Verification:** `npm run validate:docs` and `npm run validate:specs`.

## 6. Close the change

- [x] 6.1 Run `npm run spec:impact`. Confirm that `deployment-details-api`, `model-catalog` and `catalog-item-details-fetch` are covered by this change's delta specs.

  **Result:** "no spec references a changed file without its spec changing". `validate:docs` and `validate:specs` pass with 0 errors.
- [x] 6.2 Run `npm run verify:full` once, with `NX_LOAD_DOT_ENV_FILES=false` if a local `apps/chat-api/.env.local` exists. Record any failure that also occurs on a clean `development` tree as unrelated.

  **Result:** `typecheck:full`, `lint:check` and `format:check` pass. `test:full` ran 87 tasks: 83 succeeded, 3 were skipped, and 1 failed. The one failure is `attachment-canvas-consumer-fixture:pack-lib`, with `ETARGET` on `@epam/pdf-highlighter-kit@^0.0.22`. It is the same unrelated failure the archived `add-catalog-properties-to-model-catalog` change records on a clean `development` tree. All project test suites pass.

## Follow-ups (out of scope)

- Move the orphaned `mapDeploymentFeatures` JSDoc, which sits above `mapCatalogProperties` in `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`, back onto `mapDeploymentFeatures`.
- Move the SDK pin from `0.3.0-dev.3` to `0.3.0` once it is published on `latest`.
- Ask the Models Garden owners to read the top-level `provider` instead of `catalog_properties.provider`.
- Deprecation and end-of-service warnings, badges or blocking, which need design.
- Optionally move all catalog date formatting (Release date, Knowledge cutoff date and the two new rows) to a host callback. Today it stays in `chat-hooks` (design, Decision 5).
- An RTL test for the catalog Overview tab in `libs/catalog`.

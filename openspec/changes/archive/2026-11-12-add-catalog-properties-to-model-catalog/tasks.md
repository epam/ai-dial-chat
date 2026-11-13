Slicing strategy: **vertical**. Slice 1 makes the field reach the catalog body end to end inside `chat-api` (DTOs, projection, tests). Slice 2 publishes the contract through OpenAPI and the generated client. Slice 3 updates the docs. Each slice is green before the next one starts.

## 1. Catalog entries carry allowlisted `catalog_properties` (chat-api)

- [x] 1.1 In `apps/chat-api/src/openapi/openapi-response.dto.ts`, add `catalog_properties?: Record<string, unknown>` to `DialModelDto` with `@ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Curated catalog display metadata from DIAL Core, forwarded as sent' })`, next to `defaults`/`responses_defaults`. Do not touch `ModelsService`, because `GET /api/v1/models` already forwards the field.
- [x] 1.2 In `apps/chat-api/src/models/dto/model-catalog-response.dto.ts`, declare `catalog_properties?: ModelCatalogPropertiesDto` on `ModelCatalogEntryDto` with `@ApiPropertyOptional({ type: () => ModelCatalogPropertiesDto })`. Import the class extensionless from `../../deployments/dto/deployment-details.dto`. Do not add `'catalog_properties'` (or `'catalog_schema_id'`) to `MODEL_CATALOG_ENTRY_FIELDS`. Rewrite the doc comment on `MODEL_CATALOG_ENTRY_FIELDS` so it says the list holds the fields copied as Core sends them, and that `catalog_properties` is the one field projected through `mapCatalogProperties`.
- [x] 1.3 In `apps/chat-api/src/models/catalog/model-catalog.service.ts`, extend `toCatalogEntry`: after the copy loop, call `mapCatalogProperties(model.catalog_properties)` (imported from `../../deployments/utils/deployment-mapper.util`) and set `entry.catalog_properties` only when the result is defined. Update the function's comment. Do not add a Nest module import between `ModelsModule` and `DeploymentsModule`.
- [x] 1.4 Unit tests in `apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`, named by observable behaviour:
  - `listCatalog` keeps only the recognised string catalog properties. Core sends `provider`, `vendor`, `knowledgeCutoffDate`, an object-valued `license` and an unknown `internalNote`. The entry carries the three strings only.
  - `listCatalog` omits `catalog_properties` when Core sends none, a non-object, or only unrecognised keys. Assert with `not.toHaveProperty('catalog_properties')`, not `toEqual`, because `toEqual` ignores `undefined`.
  - Extend the existing "drops invocation settings and unknown fields" case so that Core also sends `catalog_schema_id`, and assert it is dropped.
  - `getCatalogEntry` returns the entry with its allowlisted `catalog_properties`.

  **Verification:** `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts` and `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.controller.spec.ts` (unchanged, must stay green). Also run `npm run test:file -- apps/chat-api/src/models/tests/models.service.spec.ts` to show `/models` is unaffected. Then run `npm run verify:changed` once for the slice.

## 2. OpenAPI contract and generated client

- [x] 2.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/**`. Do not hand-edit generated files. Inspect the output. `DialModelDto` should gain `catalogProperties?: { [key: string]: unknown }`. `ModelCatalogEntryDto` should gain `catalogProperties?: ModelCatalogPropertiesDto`, referencing the existing `ModelCatalogPropertiesDto` schema rather than a duplicate. The `ModelsApi.listModelCatalog` / `getModelCatalogEntry` method names should be unchanged.
- [x] 2.2 Run `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`. No `apps/chat/src/server-api` wrapper or `api-client.ts` change is needed: no frontend caller in this repo uses the catalog routes (spec: "Model catalog has no UI, strings or telemetry of its own").

  **Verification:** the commands in 2.1 and 2.2 pass, and `git diff libs/chat-api-client` shows only the two added properties.

## 3. Documentation

- [x] 3.1 In the `apps/chat-api/README.md` "Model catalog" section ("Display data only" bullet), state that each entry also carries `catalog_properties`, reduced by the same allowlist as `/deployments/details` (`provider`, `vendor`, `license`, `knowledgeCutoffDate`, `parameters`, strings only, omitted when empty), and that `catalog_schema_id` is dropped.
- [x] 3.2 Check whether `docs/architecture.md` (the `/api/v1/model-catalog` rows) or any other doc lists the catalog's fields. Expected result: no edit, because it says "display data only". Edit only if a field list is found.

  **Verification:** `npm run validate:docs` and `npm run validate:specs`.

## 4. Close the change

- [x] 4.1 Run `npm run spec:impact` and confirm that `model-catalog` is covered by this change's delta spec. Leave `deployment-details-api` and `catalog-item-details-fetch` unchanged, because their behaviour does not change.
- [x] 4.2 Run `npm run verify:full` once.

  **Result:** typecheck, lint, format and every test project pass. This includes all 7829 `chat-api` tests and `libs/catalog`, run with `NX_LOAD_DOT_ENV_FILES=false` so that a local `apps/chat-api/.env.local` does not leak into `explicit-environment.spec.ts`. The only failure is `attachment-canvas-consumer-fixture:pack-lib`, which fails with `ETARGET` on `@epam/pdf-highlighter-kit@^0.0.22`. It fails the same way on a clean `development` tree, so it is unrelated to this change.

## Follow-ups (out of scope)

- If a third consumer of `mapCatalogProperties` / `ModelCatalogPropertiesDto` appears, move both from `apps/chat-api/src/deployments/` to `apps/chat-api/src/common/` (design, Decision 2).

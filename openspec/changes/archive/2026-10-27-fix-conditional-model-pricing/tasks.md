Slicing strategy: contract-first — fix the OpenAPI description of the pricing branches, then the `chat-hooks` adapter that consumes them. Each slice is verified on its own.

## 1. BFF contract

- [x] 1.1 In `apps/chat-api/src/deployments/dto/deployment-details.dto.ts`, declare `ModelPricingRateDto.ifTrue`/`ifFalse` as `string | ModelPricingRateDto` with a `oneOf` Swagger schema (`getSchemaPath('ModelPricingRateDto')`) and descriptions
- [x] 1.2 Regenerate the client with `npm run openapi`; confirm `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/src/models/index.ts` gain `ModelPricingRateDtoIfTrue`/`ModelPricingRateDtoIfFalse`; do not hand-edit generated files
  - Verification: `npm run openapi:check`; `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`

## 2. Pricing adapter in `libs/chat-hooks`

- [x] 2.1 Add `condition?: string` with JSDoc to `ModelPriceRow` in `libs/chat-hooks/src/catalog/entity-details.ts`
- [x] 2.2 In `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`, add `flattenPricingRate` (recursive, type-guarded walk over string / `{ rate }` / `{ test, ifTrue, ifFalse }`) and `formatPricingCondition` (humanized field, operator symbol and its negation, `K`/`M` value, lower-tier-first flag); make `mapPricingDto` emit one row per leaf with the joined conditions
- [x] 2.3 In `mapModelPricing`, suffix a row's label with ` (<condition>)` when `condition` is set
- [x] 2.4 Architecture guard: confirm the change adds no generated-client calls, `/api` paths, app contexts, i18n or env access to `libs/chat-hooks`, and leaves `libs/catalog` untouched
- [x] 2.5 Update `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`: replace the test that asserted conditional prices are ignored; cover a `{ rate }` price, the reported three-key tiered model, nested conditions, a model priced only conditionally, and an unreadable test
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`

## 3. Close-out

- [x] 3.1 Run `npm run verify:changed` once for the completed slices
- [x] 3.2 Run `npm run validate:docs` and `npm run validate:specs` (on Node 22, which `globSync` requires)
- [ ] 3.3 Run `npm run verify:full` once before merge

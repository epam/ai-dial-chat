## Why

A model whose DIAL Core pricing is tiered — e.g. a higher rate once a prompt exceeds 200K tokens — shows no prices at all on the catalog details panel. DIAL Core quotes such a price as a conditional tree (`{ test: { field, operator, value }, ifTrue, ifFalse }`, see `PricingRate` in `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts:4924`), and `mapPricingDto` (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts:701`) dropped every non-string value. When all of a model's prices are conditional, the price list is empty and the Pricing tab disappears; users reported this for a model whose `prompt`, `completion` and `cache_read` were all tiered by `promptTokens > 200000`.

The BFF contract was also inaccurate: `ModelPricingRateDto.ifTrue`/`ifFalse` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts:60`) were typed as nested `ModelPricingRateDto` only, while DIAL Core sends a per-unit price string there as often as a nested tree.

## What Changes

- The catalog Pricing tab renders every price DIAL Core reports, including `{ rate }` objects and conditional trees. A conditional price yields one row per tier, its label suffixed with the conditions on that tier's path — `Input tokens (prompt tokens ≤ 200K)` / `Input tokens (prompt tokens > 200K)` — lower tier first. Nested trees join their conditions with `, `.
- A conditional price whose `test` cannot be read (missing `field`, unknown `operator`) contributes its `rate` when present and otherwise no row; it never fails the mapping.
- `ModelPriceRow` (`libs/chat-hooks/src/catalog/entity-details.ts`) gains an optional `condition?: string`. Additive, non-breaking.
- `ModelPricingRateDto.ifTrue`/`ifFalse` are documented in OpenAPI as `string | ModelPricingRateDto`; the generated client gains `ModelPricingRateDtoIfTrue`/`ModelPricingRateDtoIfFalse` union aliases. The JSON on the wire is unchanged — the BFF still forwards `pricing` verbatim (`apps/chat-api/src/deployments/details/deployments-details.service.ts:336`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `catalog-item-details-fetch`: adds a requirement fixing how a model's DIAL Core pricing map becomes Pricing-tab rows, including conditional (tiered) prices.
- `deployment-details-api`: the `pricing` field description states that a conditional branch is a price string or a nested tree.

## Impact

- **Code:** `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` (`mapPricingDto`, new `flattenPricingRate`/`formatPricingCondition`, `mapModelPricing` label suffix), `libs/chat-hooks/src/catalog/entity-details.ts`, `apps/chat-api/src/deployments/dto/deployment-details.dto.ts`, regenerated `libs/chat-api-client`.
- **Libs boundary:** the adaptation lives in `libs/chat-hooks`, where the existing pricing adapter already is, and is driven entirely by the generated response's shape (AGENTS.md §Library isolation, fourth exception). `libs/catalog` is untouched: it still receives preformatted `label`/`price` strings.
- **i18n:** no new keys. Condition text (`prompt tokens > 200K`) is English, like the existing hardcoded pricing-key labels (`Input tokens`); translating pricing labels remains the follow-up the `catalog-item-details-fetch` spec already records.
- **Non-goals:** evaluating which tier applies to the current conversation; a dedicated tier-table UI in `libs/catalog`; translated condition labels.
- **Alternatives considered:** one row per key with all tiers packed into the value string — rejected, `TableView` values are single-line text and the label/value pairing would no longer read as "what costs how much". Showing only the `ifFalse` (base) rate — rejected, it silently hides the tier users asked about.
- **Rollback:** revert the commit; the API payload is unchanged, so no client/server ordering constraint.
- **Acceptance criteria:** the reported model's details panel shows a Pricing tab with six tiered rows; existing flat-price fixtures render unchanged; `npm run openapi:check` passes.

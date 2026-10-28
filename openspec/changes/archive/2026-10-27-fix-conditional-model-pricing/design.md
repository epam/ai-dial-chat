## Context

DIAL Core's `PricingRate` (`@epam/ai-dial-typescript-sdk`) is `{ rate?, test?: { field, operator, value }, ifTrue?, ifFalse? }`, with operators `== != > < >= <=`; on the wire a branch is serialized as a plain price string or as a nested `PricingRate`. The BFF (`DeploymentsDetailsService.buildModelDetails`) forwards `pricing` verbatim, so the only place that can lose a price is the frontend adapter `mapPricingDto` in `libs/chat-hooks`, which kept string values only. `libs/catalog`'s `Pricing` tab renders `TableView` rows of preformatted `label`/`value` strings and hides itself when there are none.

## Goals / Non-Goals

**Goals:**

- Show every DIAL Core price on the Pricing tab, tiered ones as one row per tier.
- Make the OpenAPI contract describe string branches, so generated types match the payload.

**Non-Goals:**

- Working out which tier applies to a given conversation.
- New `libs/catalog` UI (tier tables, grouping headers) or new props there.
- Translating pricing labels or condition text.

## Decisions

**Flatten in the `chat-hooks` DTO adapter, not in `libs/catalog`.** `mapPricingDto` already turns the generated DTO into `ModelPricing`, and AGENTS.md §Library isolation (fourth exception) covers this kind of shape-driven DIAL Core adapter. `libs/catalog` stays host-agnostic and keeps receiving strings. Alternative — passing the tree to `libs/catalog` and rendering it there — rejected: the catalog lib would have to know DIAL Core's pricing schema.

**One row per tier, condition in the label.** This fits `TableView`'s label/value pairs without any lib change, and every row still reads as "what costs how much". Alternative — packing all tiers into one value string — rejected: values are single-line, and the condition would be split from the price it describes.

**Lower tier first for `>`/`>=` tests.** Pricing pages list the base tier before the surcharge tier. For other operators the `ifTrue` branch comes first, which keeps the rule small and deterministic.

**Fail soft.** Pricing input is untyped at runtime (`value: unknown`, open-ended keys), so the walker type-guards every node. An unreadable test falls back to `rate`, otherwise the node is dropped. One bad key never hides the other prices or the tab.

**`ModelPriceRow.condition` as a preformatted string.** The single consumer only appends it to the label; a structured condition type would be public API with no reader (`.claude/rules/libs.md`, "Every declared prop must be read").

**OpenAPI `oneOf` for the branches.** `getSchemaPath('ModelPricingRateDto')` is passed as a string so the self-reference does not depend on decorator evaluation order. The generated client adds `ModelPricingRateDtoIfTrue`/`IfFalse` aliases. No endpoint, operationId, auth or cache key changes, and the 60 s `deployments:details:*` cache is unaffected.

## Risks / Trade-offs

- [DIAL Core adds a condition field the humanizer renders awkwardly] → generic camelCase/snake_case humanizing (`promptTokens` → `prompt tokens`) keeps it readable without a field allowlist; a known-field label map can be added later.
- [Deep trees produce long labels] → no observed config goes beyond one level; conditions are joined compactly with `, `.
- [Condition text is English in a translated UI] → same as the existing pricing-key labels; tracked by the existing label-translation follow-up.

## Migration Plan

No data or API migration: the payload is unchanged and `ModelPriceRow.condition` is additive. Rollback is a plain revert.

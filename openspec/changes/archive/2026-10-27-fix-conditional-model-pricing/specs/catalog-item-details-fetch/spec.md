## ADDED Requirements

### Requirement: Model pricing renders every DIAL Core price, including conditional tiers

`mapDeploymentDetailsDtoToEntityDetails` and `mapEntityDetailsToCatalogDetails` (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`) SHALL turn `modelDetails.pricing` into `CatalogItemPricing.prices` rows as follows. The state is owned by `useCatalogItemDetails`, which already returns the mapped tab data; no new context or hook is introduced.

- Every key except `unit` yields rows. A value SHALL be read in any of DIAL Core's three shapes: a per-unit price string, `{ rate }`, or a conditional tree `{ test: { field, operator, value }, ifTrue, ifFalse }` whose branches are themselves any of the three shapes, to any depth.
- A conditional tree SHALL yield one row per leaf price. The row's `label` is the key's existing label (`Input tokens`, `Output tokens`, `Cached input`, a humanized unknown key) followed by ` (<conditions>)`, where `<conditions>` lists the condition on each step of the path from the root, joined with `, `.
- A condition reads `<field> <operator> <value>`: `field` humanized to lower-case words (`promptTokens` → `prompt tokens`), `operator` shown as `=`, `≠`, `>`, `<`, `≥`, `≤`, and a numeric `value` of at least 1 000 shortened to `K`/`M` (`200000` → `200K`). The `ifFalse` branch shows the negated operator (`>` ↔ `≤`, `<` ↔ `≥`, `=` ↔ `≠`).
- When a test's operator is `>` or `>=`, the `ifFalse` (lower) tier SHALL be listed before the `ifTrue` tier; otherwise `ifTrue` comes first. Rows of one key stay together, and keys keep the existing order (`prompt`, `completion`, `cache_read`/`cacheRead`, `cache_write`/`cacheWrite`, then the rest).
- Every leaf price is formatted with `formatUnitPrice` (`libs/chat-shared/src/utils/format-price.ts`) exactly as a flat price is.
- A tree whose `test` lacks a non-empty string `field` or a recognized `operator` SHALL contribute its `rate` when present and otherwise no row; a missing branch contributes no row. Neither case throws.
- `ModelPriceRow` (`libs/chat-hooks/src/catalog/entity-details.ts`) carries the joined conditions as an optional `condition?: string`; a flat price leaves it unset and its label unchanged.

`libs/catalog` is unchanged: it still receives preformatted `label`/`price` strings. Condition text is English, like the pricing-key labels, and introduces no i18n key; translating pricing labels stays the follow-up recorded under "Entity-details Overview labels are host-supplied". No new UI surface is added, so RTL, accessibility, feature-flag and caching behavior are those of the existing Pricing tab.

#### Scenario: A model priced only by tiers shows its Pricing tab

- **WHEN** a model's `pricing` is `{ unit: 'token', prompt: { test: { field: 'promptTokens', operator: '>', value: '200000' }, ifTrue: '0.000004', ifFalse: '0.000002' } }`
- **THEN** the Pricing tab is present with the rows `Input tokens (prompt tokens ≤ 200K)` — `$2/M tokens`, then `Input tokens (prompt tokens > 200K)` — `$4/M tokens`

#### Scenario: Several tiered keys keep their key order

- **WHEN** `prompt`, `completion` and `cache_read` are all tiered on `promptTokens > 200000`, with `cache_read` branches `'4.000000000000003e-7'` and `'2.0000000000000002e-7'`
- **THEN** the six rows are both `Input tokens` tiers, then both `Output tokens` tiers, then `Cached input (prompt tokens ≤ 200K)` — `$0.2/M tokens` and `Cached input (prompt tokens > 200K)` — `$0.4/M tokens`

#### Scenario: Nested conditions join along the path

- **WHEN** `prompt` is `{ test: { field: 'promptTokens', operator: '<=', value: 128000 }, ifTrue: '0.000001', ifFalse: { test: { field: 'completionTokens', operator: '==', value: 0 }, ifTrue: { rate: '0.000002' }, ifFalse: '0.000003' } }`
- **THEN** the rows are `Input tokens (prompt tokens ≤ 128K)`, `Input tokens (prompt tokens > 128K, completion tokens = 0)` and `Input tokens (prompt tokens > 128K, completion tokens ≠ 0)`, priced `$1`, `$2` and `$3` per 1M tokens

#### Scenario: A `{ rate }` price renders as a flat row

- **WHEN** `cache_read` is `{ rate: '0.000001' }`
- **THEN** a `Cached input` row with `$1/M tokens` and no condition suffix is shown

#### Scenario: An unreadable test is skipped without failing the mapping

- **WHEN** `prompt` is `'0.000003'` and `completion` is `{ test: { field: 'promptTokens', operator: '~' }, ifTrue: '0.000004' }`
- **THEN** only the `Input tokens` — `$3/M tokens` row is shown

#### Scenario: Flat prices are unchanged

- **WHEN** a model's `pricing` holds only price strings
- **THEN** the rows and labels equal the output before this requirement, with no condition suffix

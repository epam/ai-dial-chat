## Why

The catalog details panel's `Limits` tab disagreed with Settings → Usage for the same model. Debug
logging of DIAL Core's `GET /v1/deployments/{id}/limits` showed that the response's
`day/week/monthCostStats` are the caller's **account-wide** budget (`total` 100/200/500, matching the
Usage cards) and account-wide spend: for `gemini-3.5-flash`, `weekCostStats.used = 0.56228508`
equals Terra `0.53333` + gemini `0.028953` + embedding `0.00000208`, while
`GET /v1/user/usage` → `deployments["gemini-3.5-flash"].weekCostStats.used` was `0.028953`. The
panel rendered that account-wide figure as a "$X spent" caption under the model's own token row, so
a model that had spent $0.03 read as having spent $0.56. The token rows were also labelled
"Last 24 hours / 7 days / 30 days" although DIAL Core reports current UTC calendar periods, and
they showed no reset time while the Usage page and the conversation-input popover do.

## What Changes

- Remove the "$X spent" caption from every token row of the catalog details `Limits` tab; the
  deployment-limits cost stats are no longer read by the catalog mapper at all.
- Label the three token rows as the current UTC calendar day / week / month, reusing the Usage
  page's `usage.todayTitle` / `usage.thisWeekTitle` / `usage.thisMonthTitle` strings.
- Show each row's reset line ("Resets …") from its own `resetsAt`, formatted at the app edge by the
  same `formatUsageResetTime` the Usage page and popover use.
- **BREAKING** (`@epam/ai-dial-chat-hooks` public type): `DeploymentLimitsLabels.formatSpentCaption`
  is removed; an optional `DeploymentLimitsLabels.formatResetTime?: FormatResetTime` is added.
- Remove the now-unused `catalog.details.limits.spentLabel` and
  `catalog.details.limits.tokensPer{Day,Week,Month}` strings and their `CatalogI18nKeys` members.

**Non-goals**

- Showing per-deployment spend in the panel (it exists only in `GET /v1/user/usage`; fetching it
  was considered and rejected below).
- Showing the account-wide budget as its own group in the panel (the conversation-input popover
  already does this).
- Any BFF, DIAL Core, or `libs/catalog` change.

**Alternatives considered**

1. Fetch `GET /v1/user/usage` alongside the limits and caption each row with
   `deployments[id].*CostStats.used` — correct figures, but a second request per details open and a
   join keyed on deployment id; rejected by the product owner in favour of removing the caption.
2. Re-label the cost as an account-budget group (as `mapDeploymentLimitsToInput` does,
   `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts:65`) — truthful but duplicates the
   popover and the Usage cards inside a model-scoped panel.
3. **Chosen:** drop the caption (conservative baseline) and align labels and reset lines with the
   existing Usage/popover pattern.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `chat-hooks-deployment-limits-mapping`: the spec still describes a superseded ten-field,
  cost-row mapper; it is rewritten to the current token-only, calendar-period contract, with no
  cost reading, no spend caption, and an optional `formatResetTime`.
- `catalog-item-details-fetch`: the catalog adapter now sets the reset trio, so the "catalog details
  panel is unaffected by reset fields" requirement and scenario are replaced.
- `usage-period-reset-times`: reset times are now also displayed in the catalog details panel, and
  the app-edge formatting requirement covers that call site.

## Impact

- `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts` — mapper and
  `DeploymentLimitsLabels` (public type), README section.
- `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts:129` — `buildResetFields` exported
  for reuse (module-internal; not added to the package index).
- `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts:175` — labels object now supplies
  `formatResetTime` and Usage period strings; follows the `UsageLimitsControl` /
  `UsageTab` pattern (`apps/chat/src/utils/usage-reset-time.ts:37`).
- `apps/chat/src/i18n/locales/en.json`, `apps/chat/src/constants/translation-keys.ts` — four keys
  removed, none added (existing `UsageI18nKeys` reused).
- Library isolation: `libs/chat-hooks` still receives reset formatting only as a caller-supplied
  `FormatResetTime` callback; all `Date`/`Intl` work stays in `apps/chat`. `libs/catalog` is
  unchanged and already renders `resetLabel`.
- Rollback: revert the change; no data, API, or persisted-state migration is involved. Hosts that
  passed `formatSpentCaption` must drop it (type error until they do).

**Acceptance criteria**

- No token row in the catalog details `Limits` tab carries a `captionLabel`; the panel never shows a
  cost figure.
- Rows are labelled Today / This week / This month and each shows its reset line when `resetsAt`
  formats successfully, on capped and unlimited rows alike.
- `@epam/ai-dial-chat-hooks` tests and lint, `@epam/chat` typecheck and lint, and
  `npm run validate:docs` pass.

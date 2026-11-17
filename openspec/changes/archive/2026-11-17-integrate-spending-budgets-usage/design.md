# Design

## Context

How DIAL Core behaves (`origin/development` of `ai-dial-core`, after #2283 and #2284):

- `GET /v1/user/limits|usage` returns `budgets[]` (`BudgetStats`: `costObject`, `policy`,
  `displayName`, `priority`, `object`, `day`, `month`) and a top-level `costObject`.
  `BudgetEnforcer.collectStats` lists only `COST` budgets that are not expired and whose subject
  rules match the caller. It does so in `shadow` and in `enforce`, and returns `[]` in `off`. The
  counter is keyed by cost object, budget instance and user id, so `used` is the caller's own spend.
- `RateLimiter`:
  - `enforce`: a JWT call to a **model** skips the role `costLimit` (`isLegacyCostSkipped`) and is
    checked against budgets.
  - `shadow`: the role `costLimit` still decides, and budgets are only checked and charged.
  - Calls to **applications** keep the role `costLimit` in every mode.
  - The legacy cost counter is charged in every mode.
- A rejection is a `429` with `"You have no budget for this model"` or `"You've exceeded your budget"`,
  plus `Retry-After`.
- Budget windows follow `rateLimitSchedule.timezone`, which is not necessarily UTC.

How the chat works today:

- The BFF forwards the body verbatim (`DeploymentsDetailsService.getUserUsage`). `costObject` and
  `object` already reach the browser but are missing from `UserLimitStatsResponseDto` and
  `BudgetStatsDto`.
- `UsageTab` maps the `/user/usage` response with three adapters:
  - `mapUsageDataToDashboard` for the aggregate cards;
  - `mapUserUsageToModelLimits` for the model table;
  - `mapOverallCostLimitsToPeriodStatuses` for the period header indicators.
- The banner (`useUsageLimitBanner`) and the dial (`UsageLimitsControl` → `useDeploymentUsageLimits`
  → `mapDeploymentLimitsToInput`) read account cost from `sources.account`, which is typed
  `AccountUsage` (a `Pick` of the three `*CostStats`).
- User Profile (`ai-dial-user-profile/src/budget/bff-budget-source.ts`) already consumes the same
  BFF route. It lists every budget, uses `displayName ?? policy`, maps the sentinel to `Infinity`,
  and ignores `costObject` and `object`. Its rules for the name and the sentinel are reused here, so
  the two UIs agree.
- `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` is the reference for a client-visible usage setting that
  is both an environment variable and a managed key.

## Goals / Non-Goals

**Goals:**

- Every mode-dependent decision goes through one pure resolution (`resolveSpendingLimitsMode`) and
  one pure transformation (`omitAccountCostStats`), both in `libs/chat-hooks/src/usage`. Each call
  site applies them at **mapping** time, not fetch time.
- No change to any lib's existing behaviour when the mode is `off`.

**Non-Goals:**

- Changing `useUsageData` or `useDeploymentUsageLimits` fetching, or adding a request.
- Predicting the payer budget for the selected model.

## Decisions

**D1. The mode is a client-config setting, not a payload field.** It is set by `SPENDING_LIMITS_MODE`
and the managed key `usageLimits.spendingLimitsMode`, and reaches the client as
`config.spendingLimitsMode`. This follows the warning-threshold entry: an env class field with
`@IsEnum`, a registry entry with `managedConfigKey({ value: { type: String, enum: [...] } })`, a
`defineMapping` with a fallback to `off`, and a DTO property with `enum` and
`enumName: 'SpendingLimitsMode'`. The env field goes on `FeatureFlagsEnv`, next to
`USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`.
*Alternatives:* a BFF-added field on `/user/usage`, which breaks that route's verbatim-proxy
contract; and environment-only, without a managed key, which is simpler (no schema bump) but leaves
the one setting operators would change alongside Core's `spendingLimits` outside Config Studio.

**D2. The effective mode is downgraded on missing evidence.**
`resolveSpendingLimitsMode(configured, usage)` returns `Off` unless `usage?.budgets` is an array and
`usage.costObject` is a non-empty string. DIAL Core omits `costObject` exactly when its mode is `off`
or the caller is an API key; the chat always calls as a JWT user. A chat set to `enforce` against a
Core with spending limits off, or against a Core older than #2284, therefore falls back to today's
page instead of hiding a role limit that is still enforced. The function cannot detect the reverse
mismatch (chat `shadow`, Core `enforce`). That case is documented as an operator error.

**D3. Charged budgets only.** `mapBudgetsToDashboard` keeps the entries whose
`costObject === usage.costObject`, in response order. A model call can be charged only to those
(`BudgetEnforcer.resolveCostObject`). Budgets in other cost objects are User Profile's concern.
React keys are `${costObject}\u0000${policy}\u0000${occurrence}`, so a repeated policy keeps its key
stable.
*Alternative:* list all budgets grouped by cost object, as User Profile does. Rejected for the chat:
the page answers "what limits my requests here", and a budget from another project that can never
pay would read as available headroom.

**D4. Withhold the legacy cost at mapping time.** `omitAccountCostStats(usage)` returns a copy
without `minuteCostStats`, `dayCostStats`, `weekCostStats` and `monthCostStats`. Each existing mapper
already treats an absent stat as "no card", "Unavailable header" or "no candidate row", so no mapper
changes:

- `UsageTab` calls `mapOverallCostLimitsToPeriodStatuses(effective === Enforce ? omitAccountCostStats(usage) : usage, …)`.
- `useUsageLimitBanner` gains an optional `spendingLimitsMode` option (default `Off`) and applies the
  helper to `sources.account` before `selectUsageBannerSource`.
- `UsageLimitsControl` applies it to `sources.account` before `mapDeploymentLimitsToInput`, inside
  its existing `useMemo`.

`AccountUsage` widens to `Pick<…, '*CostStats' | 'costObject' | 'budgets'>`, which is additive, so
the effective mode can be resolved from the same response.
*Alternative:* wrap `getAccountUsage` in the app so it returns stripped data. Rejected: the hook
documents that `api` identity does not trigger a re-fetch. A config change, or the initial
`off` → configured transition, would then apply only on the next fetch, and the module-level
`USAGE_LIMITS_API` constant would have to move into a hook.

**D5. In `enforce` the page shows only the budgets.** The legacy aggregate cards are not rendered
in `enforce`, even when the role `costLimit` has a finite window. DIAL Core still applies that
limit to application calls, but the product decision is that the Usage page reports budgets only in
this mode. `mapUsageDataToDashboard` is unchanged; `UsageTab` decides what to render.
*Alternative:* keeping the role cost cards under an "Applications" heading when a window is finite.
This was implemented first and rejected on review as noise next to the budgets.

**D6. Card data is shared with the aggregate cards.** The private `mapStatsToCardData` in
`map-usage-data-to-dashboard.ts` becomes a module-internal export reused by `mapBudgetsToDashboard`.
The status thresholds, the sentinel, the zero total and the reset trio therefore stay identical
(`usage-model-limits` "Aggregate period cost cards"). Budget cards reuse the `usage.todayTitle` and
`usage.thisMonthTitle` keys and their period descriptions. Coverage needs a
`resolveModelName(id) => string | undefined` callback. `UsageTab` builds it from `useDeployments()`
items and `resolveLocalizedText`, the same join `mapUserUsageToModelLimits` uses, so the lib never
sees deployments. This falls under the existing "DIAL-Core response-to-display adapters in
`chat-hooks`" exception:
- (a) The filtering is driven by the response's own fields (`costObject` equality, the sentinel,
  `object === '*'`).
- (b) The card logic is the already-characterized `mapStatsToCardData` suite.
- (c) Every host passes its own translate, reset-time and name callbacks.

**D7. `SpendingBudgetsSection` is presentational.** It lives in
`libs/usage-dashboard/src/components/SpendingBudgetsSection/`. Its props are listed in the
`usage-dashboard-lib` delta. It renders the cards through `UsageLimitCard`, inside the same grid
class that `UsageLimitCardGroup` uses. The notice is a kit `Notification` (info variant) with an
explicit static `role="note"`, because it is page content rather than an update. The page's
existing `LiveRegion` stays the only announcer. Colors follow the `ModelLimitsColors` pattern
(`--dial-usage-budgets-*` variables), and typography defaults are verified against the kit scale
with `getEntityDetails("typography")` at implementation time. The lib already ships a stylesheet,
so the `./styles.css` export is unchanged.

**D8. `object` is typed as a `oneOf` in Swagger.** It is declared with
`@ApiPropertyOptional({ oneOf: [{ type: 'string', enum: ['*'] }, { type: 'array', items: { type: 'string' } }] })`.
If the generator emits an unusable type (an empty interface or an `any` wrapper), the fallback is
`type: 'string' | string[]` through `@ApiPropertyOptional({ type: () => Object })` with a
description, and the adapter narrows it with `Array.isArray`. The generated result is checked in the
first slice, before any consumer is written.

**D9. Reset refresh.** `UsageTab`'s `resetBoundariesMs` concatenates the `resetIsoValue` of every
budget card with that of the aggregate cards. The timer logic is unchanged.

**D10. Enum ownership.** `SpendingLimitsMode` (`Off = 'off'`, `Shadow = 'shadow'`,
`Enforce = 'enforce'`) is declared in `libs/chat-hooks/src/usage/spending-limits-mode.ts` and
exported from the `./usage` entry. `chat-api` declares its own enum with the same values, because
the backend cannot import `type:hooks` and `validate:lib-duplicates` skips `apps/chat-api`.
`AppConfigContext` parses the generated string with a guard that falls back to `Off`. `apps/chat`
declares no enum.

## Risks / Trade-offs

- [Operator sets chat `shadow` while Core runs `enforce`] → the role cost cards keep showing a limit
  that no longer gates model calls. Mitigation: the README row says the value must equal Core's
  `spendingLimits.mode`. A follow-up asks Core to report the mode.
- [The managed schema version bump (1.0.0 → 1.1.0) collides with another change that bumps it] → the
  bump lands in its own slice with the regenerated artifact and pin, and is rebased last. The open
  change `consume-managed-app-config-snapshots` is checked for a concurrent bump before the slice
  starts.
- [In `enforce`, the role cost limit that DIAL Core still applies to application calls is shown
  nowhere: not on the Usage page, the banner or the dial] → accepted by product decision. Token
  warnings remain; a budget-aware banner is a follow-up.
- [`object` names models the caller cannot access (Core design decision 7)] → those ids render as
  the raw id. Nothing is linked or selectable.
- [Budget day windows reset in Core's schedule time zone, while the aggregate card titles say
  "Today"] → reset times are rendered from `resetsAt`, so the instant shown is exact whatever the
  time zone.

## Migration Plan

1. Ship with the default `off`. No visible change.
2. When DIAL Core moves to `shadow`, the operator sets `SPENDING_LIMITS_MODE=shadow` to preview
   budgets on the Usage page.
3. When Core moves to `enforce`, the operator sets `enforce`.
4. Rollback at any step: set the previous value, or unset it. No redeploy is needed for the managed
   key, and a restart is needed for the env var.

## Open Questions

- Wording of the `enforce` empty state. Product copy can change the English string without changing
  the key or behaviour.

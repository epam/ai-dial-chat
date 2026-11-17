## Why

DIAL Core now limits model spend with **budgets**: policies assigned in a cost object, reported to the
caller as `budgets[]` and `costObject` on `GET /v1/user/limits` and `GET /v1/user/usage`
(epam/ai-dial-core#2188, #2283, #2284). The BFF already forwards `budgets[]`
(change `2026-11-13-add-user-budgets-contract`), but Settings → Usage still shows only the legacy
role `costLimit` (`*CostStats`), and nothing in the chat reads a budget.

When DIAL Core runs `spendingLimits.mode: enforce`, model calls from a JWT user skip the role
`costLimit` and are limited by budgets instead. The legacy cards, the Overall Cost header indicators,
the composer usage banner and the usage dial then report a limit that no longer gates model calls,
and the budget that actually rejects the call (`429 You've exceeded your budget`) is shown nowhere.

DIAL Core does not report its mode in the response. `costObject` is present only when the mode is not
`off`, so `shadow` and `enforce` cannot be told apart from the payload. The chat therefore needs an
operator setting that tells it which mode to present.

## What Changes

- **Operator setting `SPENDING_LIMITS_MODE`** (`off` | `shadow` | `enforce`, default `off`): a
  client-visible config-registry key `usageLimits.spendingLimitsMode`, set from an environment
  variable and from managed config (Config Studio), exposed as `config.spendingLimitsMode` on
  `GET /api/v1/client-config` and in `AppConfigContext`. The operator sets it to the
  `spendingLimits.mode` that DIAL Core runs. The model is `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`
  (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, the `usageLimits.warningThresholdPercent`
  entry).
- **Effective mode**: the configured mode, downgraded to `off` when the usage response has no
  `budgets` array or no `costObject`. That happens when DIAL Core has spending limits off or is
  older than #2284, and it protects a misconfigured chat from hiding the legacy limits that still
  apply.
- **BFF contract** (`apps/chat-api/src/openapi/openapi-response.dto.ts`): add the top-level
  `costObject?: string` to `UserLimitStatsResponseDto` and `object?: '*' | string[]` to
  `BudgetStatsDto`. Both are already forwarded at runtime (the service returns the body verbatim),
  so only the contract and the regenerated client change. Correct the budget window descriptions
  from "current UTC day/month" to DIAL Core's rate-limit schedule time zone.
- **Usage page budgets section**: a new `SpendingBudgetsSection` in `libs/usage-dashboard`, fed by a
  new `mapBudgetsToDashboard` adapter in `libs/chat-hooks/src/usage`. It lists the budgets charged
  for the caller's model calls (`budget.costObject === usage.costObject`) in DIAL Core's order. Each
  budget shows its name, the models it covers, and a Today card and a This month card that reuse
  `UsageLimitCard`.
  - `shadow`: the page stays as it is today, and the budgets section is added below the aggregate
    cards with a "not enforced yet" notice.
  - `enforce`: the budgets section replaces the legacy aggregate cards. An empty list shows an
    explicit "no budget, model requests are rejected" state.
- **Legacy account cost in `enforce`**: the Overall Cost period header indicators, the composer
  usage banner and the usage dial stop reading the top-level `*CostStats`. One pure helper in
  `libs/chat-hooks` removes those fields from the account usage before the existing mappers see it.
  Token stats are not affected.
- The Usage page also refreshes at a budget window's `resetsAt`.

## Capabilities

### New Capabilities

- `usage-spending-budgets`: the operator mode setting, effective-mode resolution, the Usage page
  budgets section and its states, and how the legacy account cost is presented per mode across the
  Usage page, the usage banner and the usage dial.

### Modified Capabilities

- `user-usage-limits-api`: the user limits and usage contract gains `costObject` and
  `BudgetStatsDto.object`, and the budget window descriptions say the schedule time zone instead of
  UTC.
- `usage-dashboard-lib`: adds the public `SpendingBudgetsSection` component and its
  `*Labels`/`*Colors`/`*Typography` contract.

## Impact

- **Backend (`apps/chat-api`)**: `openapi-response.dto.ts` (two properties, description fixes),
  `config/env/feature-flags.env.ts` (new validated env var), `app-config/config-registry/config-registry.constants.ts`
  (registry entry with an enum managed schema), `app-config/client-config.mapper.ts`,
  `app-config/dto/client-config-response.dto.ts`, `.env.template`, `README.md`, the env composition
  snapshot, and the regenerated managed-config schema artifact. No new endpoint and no controller or
  service change.
- **Generated client (`libs/chat-api-client`)**: regenerated only.
- **`libs/chat-hooks`** (shared lib, under the existing "DIAL-Core response-to-display adapter"
  exception in `.claude/rules/libs.md`): a new `SpendingLimitsMode` enum, `resolveSpendingLimitsMode`,
  `omitAccountCostStats` and `mapBudgetsToDashboard`. All host details arrive as parameters: the
  configured mode, the translate callback, `formatResetTime`, and the model display-name resolver.
- **`libs/usage-dashboard`** (shared lib): the new `SpendingBudgetsSection`. It is presentational and
  knows nothing about DIAL modes. The host passes the notice and empty-state strings, and decides
  whether to render the section at all.
- **`apps/chat`**: `AppConfigContext.tsx`, `pages/SettingsPage/UsageTab/UsageTab.tsx`,
  `components/UsageLimitBanner/UsageLimitBanner.tsx`, `components/UsageLimitsControl/UsageLimitsControl.tsx`
  (wrapping `getAccountUsage`), translation keys and `en.json`.
- **i18n**: new user-visible strings under `usage.budgets.*` (heading, description, shadow notice,
  enforce empty state, model coverage).
- **DIAL Core version**: the budgets section needs DIAL Core with #2283 and #2284 (`displayName`,
  `object`, `costObject`). Older Cores downgrade to `off` and keep today's page.
- **Docs**: `apps/chat-api/README.md`, `libs/usage-dashboard/README.md`, `libs/chat-hooks/README.md`,
  `docs/architecture.md` (the endpoint row descriptions).

## Non-goals

- A budget-aware composer banner or dial, which would mean predicting which budget pays for the
  selected model. DIAL Core lists "who pays next" as a non-goal, and in this change the banner and
  dial only stop showing the legacy cost in `enforce`. This is a follow-up.
- Special handling of the budget `429` responses (`no_budget`, `budget_exhausted`) in the
  conversation. They keep rendering as today's generic model error.
- Budgets in cost objects that do not pay for the caller's chat requests. User Profile lists them;
  the chat Usage page does not.
- Week windows for budgets (DIAL Core budgets have only day and month), forecasts, per-day spend
  series, CSV export.
- Detecting the mode automatically. That needs DIAL Core to report `spendingLimits.mode`, which can
  be a follow-up request to the Core team. The setting stays useful as an override after that.

## Acceptance criteria

- With `SPENDING_LIMITS_MODE` unset (`off`), the Usage page, banner and dial render the same as
  before this change, whatever DIAL Core returns.
- With `shadow` and a Core response that has `costObject` and charged budgets, the Usage page shows
  today's cards and model table plus a budgets section with the "not enforced yet" notice. The banner
  and dial are unchanged.
- With `enforce`:
  - the budgets section is first;
  - the Overall Cost header indicators, banner and dial show no legacy cost figure;
  - no legacy aggregate card renders;
  - zero charged budgets render the "no budget" state.
- With `shadow` or `enforce` and a response without `costObject`, the page behaves as `off`.
- A budget whose window `total` is the sentinel renders its spend only (`isUnlimited`). The budget
  name falls back from `displayName` to `policy`, and `object: "*"` reads as "All models".
- `npm run openapi:check`, `npm run validate:docs`, `npm run validate:specs`,
  `npm run validate:lib-duplicates` and `npm run verify:changed` pass.

## Alternatives considered

1. **Use DIAL Core's payload only (no setting).** This is the conservative baseline. It cannot tell
   `shadow` from `enforce`, so in one of the two modes the page lies: it hides an enforced legacy
   limit, or it shows a legacy limit that no longer applies. Rejected.
2. **The BFF reads DIAL Core's config to learn the mode.** The chat has no admin access to Core's
   config, and reading it would add a privileged call to a user endpoint. Rejected.
3. **A BFF-owned `spendingLimitsMode` field on the usage response.** This keeps the data and the mode
   together, but the BFF would add a field to a response its spec says it forwards verbatim, and the
   setting would bypass the client-config channel and Config Studio that operators already use.
   Rejected in favour of client config.
4. **Ask DIAL Core to report the mode.** This is the right long-term source and is recorded as a
   follow-up. It does not unblock this release.

**Pick:** the client-config setting with effective-mode downgrade (this proposal). It is correct for
all three modes, uses an existing operator channel, and defaults to today's behaviour.

## Rollback

The change is not breaking. `off` is the default and keeps today's rendering, so operators roll back
by unsetting `SPENDING_LIMITS_MODE` with no deploy. A code rollback reverts the commit and runs
`npm run openapi` and `npm run managed-config-schema` again. Both DTO fields are optional and
additive, and no data is persisted.

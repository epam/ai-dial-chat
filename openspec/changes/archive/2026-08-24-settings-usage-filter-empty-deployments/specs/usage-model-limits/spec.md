## MODIFIED Requirements

### Requirement: UsageTab renders Model limits below the aggregate cards

The `Usage` tab SHALL render `@epam/ai-dial-usage-dashboard`'s `ModelLimitsSection` below
`UsageLimitCardGroup`, sourced from `useUsageData()`'s already-fetched `usage.deployments` (no
additional API call), unconditionally passing whatever rows the adapter produces (including zero
rows) — the `Usage` tab SHALL NOT branch on row count itself. The section SHALL be omitted (not
rendered) while `isLoading` is `true`, matching the existing cards' loading behavior. Whenever,
after loading completes, the adapter produces zero rows for the currently selected period —
whether because `usage` is `undefined`, `usage.deployments` is absent/empty, or every entry in
`usage.deployments` was filtered out for having no usage in that period (see "Rows with no usage in
the selected period are excluded" below) — `ModelLimitsSection` itself SHALL render its shared
empty state in place of the table body, while still rendering its heading and period selector (see
`ModelLimitsSectionProps.emptyStateLabel` in the "usage-dashboard-lib" spec), so the period
selector remains available for the user to pick a different period from an empty result.

#### Scenario: Model limits section renders alongside the cards
- **WHEN** the Usage tab finishes loading and `usage.deployments` contains at least one model with
  usage in the selected period
- **THEN** `ModelLimitsSection` renders below `UsageLimitCardGroup` with one row per such model

#### Scenario: Empty deployments map renders the section's own empty state, with the selector still usable
- **WHEN** the Usage tab finishes loading and `usage.deployments` is an empty object
- **THEN** `ModelLimitsSection` still renders (with its heading, row count of `0`, and period
  selector), showing its internal empty state in place of the row table, rather than the `Usage`
  tab omitting the section or rendering a separate empty-state element outside it

#### Scenario: All deployments filtered out for the selected period renders the same empty state, with the selector still usable
- **WHEN** the Usage tab finishes loading, `usage.deployments` is non-empty, but every entry has no
  usage in the currently selected period
- **THEN** `ModelLimitsSection` still renders (with its heading, row count of `0`, and period
  selector) showing the same internal empty state as the empty-deployments-map case, and the user
  can select a different period from the still-visible selector to see whether that period has data

#### Scenario: Usage fetch failure leaves the rest of the page visible
- **WHEN** `useUsageData()` reports a `usageError`
- **THEN** the Model limits section renders its own unavailable state (no stale/zeroed rows), the
  aggregate cards region reflects the same existing partial/full failure behavior, and no additional
  notification is emitted beyond the one already produced by the existing `usage-data-hook`
  "Deduplicated error notifications" behavior

---

### Requirement: `usage.deployments` join with model metadata

The adapter SHALL build candidate rows from exactly the entries present in `usage.deployments` —
every entry present, and no entry not present — regardless of what `useDeployments().items`
contains: an accessible model with no entry in `usage.deployments` SHALL NOT produce a row, and
every entry in `usage.deployments` SHALL produce a candidate row even if no matching `items` entry
exists. Candidate rows are then subject to the period-scoped usage filter defined in "Rows with no
usage in the selected period are excluded" before being returned. Among the rows that survive that
filter, order SHALL follow `Object.keys(usage.deployments)` order (the order the API returns),
independent of `items`' content, order, or load state — `items` is consulted only to enrich a
matched row's display name/version/avatar, never to determine which rows exist or their order. The
join against `items` SHALL be filtered to `type === DeploymentItemDtoTypeEnum.Model`.

When a deployment ID has no matching entry in `items`, the adapter SHALL still produce a candidate
row for it, using the deployment ID as the display name and no `avatarSrc` (so `ModelLimitsSection`
falls back to its initials avatar), rather than omitting the row outright (it is still subject to
the usage filter like any other row).

#### Scenario: Row count matches the number of deployments with usage in the selected period
- **WHEN** `usage.deployments` has 12 entries, all resolvable against `items`, and 9 of them have
  nonzero usage for the currently selected period
- **THEN** `ModelLimitsSection` receives exactly 9 rows and its heading reports a count of 9

#### Scenario: A deployment with all-zero used values for the selected period does not appear
- **WHEN** a deployment in `usage.deployments` has all-zero (or unusable) `used` values across
  every stat field mapped for the selected period, even though it has nonzero usage recorded under
  a different period's fields
- **THEN** it does not produce a row while that period is selected (see "Rows with no usage in the
  selected period are excluded"); selecting the period under which it has usage makes it reappear

#### Scenario: A model never used in the trailing 30 days does not appear at all
- **WHEN** an accessible model has no entry in `usage.deployments` at all (never used in the
  trailing 30 days, per `openspec/specs/user-usage-limits-api/spec.md:80`)
- **THEN** the adapter produces no row for it — this is the accepted trade-off of reading
  `usage.deployments` instead of `limits.deployments` (see design.md's data-source correction), not
  a defect

#### Scenario: Unresolvable deployment ID still renders a fallback row when it has usage
- **WHEN** a deployment ID in `usage.deployments` has no matching entry in
  `useDeployments().items`, and it has nonzero usage in the selected period
- **THEN** the adapter produces a row for it with `name` equal to the deployment ID and
  `avatarSrc: undefined`, and this row does not cause other rows to be dropped

#### Scenario: Non-model deployment items are never joined in
- **WHEN** `useDeployments().items` contains an application or toolset whose `id` happens to match a
  key in `usage.deployments`
- **THEN** the adapter does not use that non-model item's metadata for the row (join is restricted
  to `type === DeploymentItemDtoTypeEnum.Model`)

#### Scenario: Row order follows `usage.deployments` key order, not `items`' order
- **WHEN** `items` lists models in one order (e.g. `['b', 'a']`) but `usage.deployments` has keys
  in a different order (e.g. `{ a: ..., b: ... }`), and both have usage in the selected period
- **THEN** the resulting rows are ordered `['a', 'b']` — `Object.keys(usage.deployments)` order —
  regardless of `items`' order

#### Scenario: Row order does not depend on whether `items` has finished loading
- **WHEN** `useDeployments().items` is still empty (not yet loaded) while `usage.deployments`
  already has data with usage in the selected period
- **THEN** the rows render immediately in `usage.deployments` key order, with the deployment ID as
  each row's name; once `items` loads, matched rows are enriched with name/version/avatar but the
  row set and order do not change or re-shuffle

## ADDED Requirements

### Requirement: Rows with no usage in the selected period are excluded

For each candidate row, the adapter SHALL inspect the raw `LimitStatsDto` entries backing that
row's Cost, Tokens, and Requests cells for the currently selected period (per the existing
period-to-field mapping) and SHALL include the row in the returned `ModelLimitRow[]` only if at
least one of those entries is usable (`Number.isFinite(total)` and `Number.isFinite(used)`) and has
`used > 0`. A row whose every mapped entry for the selected period is either absent/unusable or has
`used <= 0` SHALL be excluded from the result. This filter SHALL be re-evaluated from the
already-fetched `usage` value whenever the selected period changes, without an additional API call,
and SHALL NOT alter the per-metric `finite`/`unlimited`/`unavailable` classification, status
derivation, or formatting of any row that is included.

#### Scenario: Row with nonzero tokens but zero cost and unavailable requests is kept
- **WHEN** the selected period is `Last24Hours` and a deployment's `dayTokenStats` is `{ total:
  10000, used: 250 }`, `dayCostStats.used` is `0`, and `dayRequestStats` is absent
- **THEN** the row is included, because at least one mapped entry (`dayTokenStats`) has `used > 0`

#### Scenario: Row with all-zero mapped entries for the period is excluded
- **WHEN** the selected period is `Last7Days` and a deployment's `weekCostStats.used` and
  `weekTokenStats.used` are both `0` (Requests is unavailable for `Last7Days`)
- **THEN** the row is excluded from the returned rows for that period

#### Scenario: Row with only unavailable mapped entries for the period is excluded
- **WHEN** the selected period is `LastHour` and a deployment's `hourRequestStats` is missing from
  the DTO entirely (Cost and Tokens are always unavailable for `LastHour`)
- **THEN** the row is excluded — an unusable entry never counts as "has usage"

#### Scenario: Switching periods changes which rows are included
- **WHEN** a deployment has `used > 0` in `monthTokenStats` but `used === 0` in every field mapped
  for `Last24Hours`
- **THEN** the row appears while `Last30Days` is selected and disappears while `Last24Hours` is
  selected, with no refetch triggered by the period change

#### Scenario: Filtering does not change included rows' metric classification or formatting
- **WHEN** a row is included because `dayTokenStats.used > 0`, and that same row's `dayCostStats`
  is a well-formed unlimited-sentinel entry
- **THEN** the row's Cost cell is still classified `kind: ModelLimitMetricKind.Unlimited` exactly
  as it would be without this filter — the filter only affects row inclusion, never cell content

## MODIFIED Requirements

### Requirement: `usage.deployments` join with model metadata

The adapter SHALL build candidates from exactly the entries in `usage.deployments`, in
`Object.keys(usage.deployments)` order, regardless of `useDeployments().items` content, order, or
loading state. `items` SHALL only enrich candidates with display name, version, avatar, and the
deployment kind, and the join SHALL be restricted to items whose `type` is
`DeploymentItemDtoTypeEnum.Model` or `DeploymentItemDtoTypeEnum.Application`. Toolset items SHALL
NOT enrich any row.

Ids SHALL be compared in their normalized form: both the `usage.deployments` key and each item's
`id` SHALL pass through `normalizeDeploymentId` (from `libs/chat-hooks` `deployment-id.ts`) before
matching, so a custom application whose id contains spaces or other reserved characters matches
whether either side is raw or percent-encoded. The row's `id` SHALL remain the original
`usage.deployments` key.

A deployment ID without a matching item SHALL use the ID as its name and no avatar URL, and SHALL be
treated as a model row. Candidates SHALL then be subject to the all-period usage filter defined
below.

#### Scenario: Row order remains API deployment order
- **WHEN** items and `usage.deployments` provide the same deployments in different orders
- **THEN** included rows follow `Object.keys(usage.deployments)` order

#### Scenario: Unresolved deployment remains eligible
- **WHEN** a deployment ID has qualifying day/week/month usage but no matching model or application
  item
- **THEN** it renders using its ID, the section-wide type caption, and initials-avatar fallback
  without dropping other rows

#### Scenario: Application item enriches its row
- **WHEN** `usage.deployments` has key `router` and items contain
  `{ id: 'router', type: 'application', displayName: 'LLM Router', iconUrl: 'r.svg' }`
- **THEN** the row's `name` is `LLM Router` and `avatarSrc` is `resolveIconUrl('r.svg')`

#### Scenario: Custom application id with spaces matches across encodings
- **WHEN** the usage key is `applications/abc/My App__1.0` and the item id is
  `applications/abc/My%20App__1.0` (or vice versa)
- **THEN** the item enriches the row and the row's `id` equals the usage key

#### Scenario: Toolset item is not used for enrichment
- **WHEN** a toolset item has the same ID as a usage deployment
- **THEN** its metadata is not applied to the row

## ADDED Requirements

### Requirement: Application rows

A row enriched from a `DeploymentItemDtoTypeEnum.Application` item SHALL be an application row. For
an application row the adapter SHALL:

- produce a `ModelLimitMetricKind.Unavailable` Tokens cell for day, week, and month, regardless of
  the Tokens stats in the payload — DIAL Core writes no token counters for applications, and the
  `total` it reports there is the role's token budget, not the application's;
- build Cost cells with the same sentinel detection as model rows, and set the Cost cell's
  `supportingLabel` to `t(USAGE_MODEL_LIMITS_I18N_KEYS.includesCalledModelsLabel)` whenever the
  cell is `Unlimited`, so the value reads as "Spent $X · Includes cost of models it called" (rendered
  by the `usage-dashboard-lib` Cost value, see that capability);
- set `typeLabel` to `t(USAGE_MODEL_LIMITS_I18N_KEYS.applicationTypeLabel)`;
- apply the all-period usage filter to Cost stats only (Tokens stats are ignored for the filter);
- derive row Status with the existing `getRowStatus`, whose three Tokens inputs are all
  `Unavailable`, so Status is driven by any finite Cost cell and the three overall Cost statuses.

A model row SHALL leave `typeLabel` unset so the section-wide `labels.modelTypeLabel` applies, and
SHALL be built exactly as before this change.

Application rows SHALL NOT be summed with model rows anywhere: their cost includes the cost of the
models they called, which already appear as their own rows. The aggregate top cards and the
period-header statuses SHALL continue to read only top-level `*CostStats` and SHALL be unaffected by
the presence of application rows.

New i18n keys (defined in `apps/chat/src/i18n/locales/en.json`, mirrored in `UsageI18nKeys`, and
listed in `USAGE_MODEL_LIMITS_I18N_KEYS`):

| Key                               | English value                        |
| --------------------------------- | ------------------------------------ |
| `usage.applicationTypeLabel`      | `Agent`                              |
| `usage.includesCalledModelsLabel` | `Includes cost of models it called`  |

The mapping remains a pure function memoized by `UsageTab` on
`[usage, deploymentItems, activeLocale, t]`; no dependency is added. The feature is not gated behind
`ENABLED_FEATURES`. No new telemetry is emitted. No client cache is introduced (the endpoint is
`no-store`).

#### Scenario: Router row renders spend with unavailable tokens
- **WHEN** `usage.deployments.router` has `dayCostStats: { total: 9223372036854775807, used: 1.5 }`
  and `dayTokenStats: { total: 10000000, used: 0 }`, and `router` is an application item
- **THEN** its day Tokens cell is `Unavailable`, its day Cost cell is `Unlimited` with the spent
  label for `1.5` and `supportingLabel` `Includes cost of models it called`, and `typeLabel` is
  `Agent`

#### Scenario: Application with only token noise is excluded
- **WHEN** an application row's day/week/month Cost stats all have `used: 0` while a Tokens stat has
  `used > 0`
- **THEN** the row is excluded

#### Scenario: Application row status follows the overall budget
- **WHEN** the top-level day Cost limit is `RunningLow` and an application row's Cost cells are
  `Unlimited`
- **THEN** the application row's Status is `RunningLow`

#### Scenario: Model rows are unchanged
- **WHEN** a usage payload contains only model deployments
- **THEN** the produced rows are deep-equal to the rows produced before this change, with no
  `typeLabel`

#### Scenario: Top cards ignore application rows
- **WHEN** application rows are added to a payload whose top-level `dayCostStats` is unchanged
- **THEN** `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses` return identical
  results

#### Scenario: Accessible cost label carries the aggregation note
- **WHEN** assistive technology reads an application row's Unlimited Cost cell
- **THEN** it announces the spent value and the "Includes cost of models it called" supporting text

## MODIFIED Requirements

### Requirement: Banner severity and source row

The app-owned `UsageLimitBanner` SHALL read its data through `useUsageLimitBanner`. The component
file is `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`, and the hook is
`libs/chat-hooks/src/usage/useUsageLimitBanner/useUsageLimitBanner.ts`.
That hook SHALL get it from `useDeploymentUsageLimits`
(`libs/chat-hooks/src/usage/useDeploymentUsageLimits/useDeploymentUsageLimits.ts`) as a
`UsageLimitsSources` pair (capability `conversation-input-usage-limits`):

- `sources.deployment`: the selected deployment's own stats from
  `GET /api/v1/deployments/{deployment}/usage`;
- `sources.account`: the account budget and spend, the top level of `GET /api/v1/user/usage`.

`useUsageLimitBanner`'s options SHALL take `getDeploymentUsage` and `getAccountUsage` in place of
the former `getDeploymentLimits`. The app SHALL pass `getDeploymentUsage` from
`apps/chat/src/server-api/deployment-limits.ts` and `getUserUsage` from
`apps/chat/src/server-api/user-limits.ts`, and SHALL NOT pass `getDeploymentLimits`.

The banner SHALL consider the day, week, and month rows of:

- the token stats `dayTokenStats`, `weekTokenStats`, `monthTokenStats`, read from
  `sources.deployment` only;
- the cost stats `dayCostStats`, `weekCostStats`, `monthCostStats`, read from `sources.account`
  only.

The minute stats are excluded. No cost stat SHALL be read from `sources.deployment`. A
deployment-limits response (`GET /deployments/{id}/limits`) SHALL NOT be used as either source:
for an agent, its cost `used` counts the agent's spend twice (issue #9361).

A row is **capped** when its `total` is finite, greater than `0`, and below the
upstream unlimited sentinel (`Number.MAX_SAFE_INTEGER`). For each capped row,
`usedPercent = round(max(used, 0) / total × 100)`, clamped to 0–100.

The **source row** is the capped row with the highest ratio. A tie SHALL go to
the longer period (month > week > day), and an equal period to the token row.

Severity SHALL be:
- **Reached** when the source row's ratio is ≥ 1.
- **Warning** when its `usedPercent` is ≥ `config.usageLimitsWarningThresholdPercent` and its ratio is < 1.
- **None** otherwise. The banner then renders nothing.

The selection SHALL be the pure helper
`selectUsageBannerSource(sources: UsageLimitsSources, thresholdPercent: number)` in
`libs/chat-hooks/src/usage/usage-banner-source.ts`. It SHALL NOT go through
`mapDeploymentLimitsToInput`, which drops rows below its fixed 75% ratio.

#### Scenario: Warning at the default threshold

- **WHEN** `sources.deployment.dayTokenStats` is `{ used: 80, total: 100 }`, every other row is below 75%, and the threshold is 75
- **THEN** the banner shows the Warning severity for the Daily period at 80%

#### Scenario: Below threshold

- **WHEN** the worst capped row is at 70% and the threshold is 75
- **THEN** the banner renders nothing

#### Scenario: Custom threshold raises the bar

- **WHEN** the threshold is 90 and the worst row is at 80%
- **THEN** the banner renders nothing

#### Scenario: Reached outranks warning

- **WHEN** `sources.account.weekCostStats` is at 100% and `sources.deployment.dayTokenStats` is at 95%
- **THEN** the banner shows the Reached severity for the Weekly period

#### Scenario: Tie goes to the longer period

- **WHEN** `dayTokenStats` and `monthTokenStats` are both at 100%
- **THEN** the source row is the Monthly one

#### Scenario: Unlimited rows ignored

- **WHEN** every row has `total ≥ Number.MAX_SAFE_INTEGER` or `total ≤ 0`
- **THEN** the banner renders nothing

#### Scenario: An agent's spend is not counted twice

- **WHEN** an agent is selected, the threshold is 75, `sources.account.weekCostStats` is
  `{ used: 132.24, total: 200 }`, every token row is below 75%, and the agent's `/limits` would
  report `{ used: 263.22, total: 200 }`
- **THEN** the banner renders nothing

#### Scenario: Deployment cost stats are ignored

- **WHEN** `sources.account` is `undefined` and `sources.deployment.monthCostStats` is
  `{ used: 100, total: 100 }`
- **THEN** that row is not a candidate and the banner renders nothing on its account

---

### Requirement: Data freshness, loading, and error states

The banner SHALL fetch both sources through `useDeploymentUsageLimits` when it mounts and
whenever `deploymentId` changes. It SHALL refresh both once after a response finishes
streaming (`isGenerationInProgress` `true` → `false`). That effect is
`useRefreshUsageAfterGeneration`
(`libs/chat-hooks/src/usage/useRefreshUsageAfterGeneration/useRefreshUsageAfterGeneration.ts`),
which both `UsageLimitBanner` (through `useUsageLimitBanner`) and `UsageLimitsControl` call, so
their behaviour cannot drift. `ConversationView` SHALL pass
`isGenerationInProgress={isAssistantTyping}` to the banner.

- **Before the first response, or with no `deploymentId`:** the banner renders nothing. There is no skeleton, so the layout does not jump on every page load.
- **Fetch failure:** each source keeps its last successful value. The banner renders from whatever
  candidates the available sources provide, or renders nothing if neither has loaded. It shows no
  error text; the Usage page owns error reporting.
- **Deployment change:** the previous deployment's token candidates are dropped at once, and the
  account cost candidates stay until the next account response replaces them.
- **Caching:** none beyond the hook's in-memory last value per source. There is no cache key or TTL.

#### Scenario: Refresh after a response

- **WHEN** a response finishes streaming in a conversation
- **THEN** the deployment usage and the account usage are each fetched once more and the banner's severity updates

#### Scenario: Failure keeps last value

- **WHEN** a refresh rejects after a successful fetch showing a warning
- **THEN** the warning stays visible unchanged

#### Scenario: Account cost still warns when deployment usage fails

- **WHEN** `getDeploymentUsage` rejects (for example, a DIAL Core older than 0.49.0 answers `404`)
  and `sources.account.dayCostStats` is at 90% with the threshold at 75
- **THEN** the banner shows the Daily Warning from the cost row

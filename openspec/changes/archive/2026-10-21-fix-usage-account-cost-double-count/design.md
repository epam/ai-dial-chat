## Context

The usage dial / popover (`UsageLimitsControl`) and the composer banner (`UsageLimitBanner`) are
two mutually exclusive surfaces: `features.usageLimitsControl` picks exactly one of them. Both get
their data from `useDeploymentUsageLimits(deploymentId, getDeploymentLimits)` in
`libs/chat-hooks/src/usage/useDeploymentUsageLimits/useDeploymentUsageLimits.ts`. That hook calls
`GET /api/v1/deployments/{id}/limits`, and the result is mapped by `mapDeploymentLimitsToInput`
(popover) or `selectUsageBannerSource` (banner).

The `/limits` response mixes scopes. Its token and request stats belong to the queried deployment.
Its cost stats carry the account budget as `total` and, since DIAL Core #2032, the account spend
**plus** the deployment's `{name}/aggregated-costs` as `used`. For a model the aggregated part is
`0`. For an application it is the cost of the models it called, which the account spend already
contains. The dev measurement in the proposal confirms `/limits = /user/usage (top level) +
/deployments/{id}/usage` to the last digit in every period.

Two sources have a single scope each:

- `GET /api/v1/user/usage` (top level): the account budget and spend. The Usage page already uses
  it through `getUserUsage` in `apps/chat/src/server-api/user-limits.ts`.
- `GET /api/v1/deployments/{id}/usage`: the deployment's own token and request stats against its
  real `Limit`, and its own cost against the unlimited sentinel. Available since DIAL Core 0.49.0
  (#2073). The BFF endpoint and the SDK bump (`@epam/ai-dial-typescript-sdk` `0.2.0-dev.15`) are
  already on this branch.

`@epam/ai-dial-chat-hooks` is workspace-private (`0.0.1`). The two app components above are its
only callers of these hooks, so its API can change in this change.

## Goals / Non-Goals

**Goals:**

- Cost rows and cost banner candidates show the account spend against the account budget,
  identical to the Usage page and independent of the selected deployment.
- Token rows show the selected deployment's own stats from the deployment-scoped endpoint.
- Every input of the popover and banner mappers has a single scope, so this class of bug cannot
  recur through the mapper.
- No `TEMP(#9361)` diagnostics remain.

**Non-Goals:**

- An informational "this agent: $X" row (open product question).
- The catalog Limits tab and the Usage page. Both are correct today and stay unchanged.
- Changing DIAL Core's `/limits` (an upstream ticket is drafted separately).

## Decisions

### D1. Two single-scope inputs replace one mixed-scope DTO

`libs/chat-hooks` gains, next to the hook:

```ts
/** The caller's account-wide cost budget and spend: the top level of a user-usage response. */
export type AccountUsage = Pick<
  UserLimitStatsResponseDto,
  'dayCostStats' | 'weekCostStats' | 'monthCostStats'
>;

/** What the usage dial and banner are mapped from; each field has a single scope. */
export interface UsageLimitsSources {
  /** The selected deployment's own stats (`GET /deployments/{id}/usage`). Token stats only are read. */
  deployment: DeploymentLimitsResponseDto | undefined;
  /** The account budget and spend. Cost stats only are read. */
  account: AccountUsage | undefined;
}
```

`mapDeploymentLimitsToInput(sources, labels, formatResetTime?)` builds the token group from
`sources.deployment` and the cost group from `sources.account`. It never reads cost from
`deployment` or tokens from `account`. `selectUsageBannerSource(sources, thresholdPercent)` takes
its candidates the same way.

The names `mapDeploymentLimitsToInput` and `useDeploymentUsageLimits` stay, to keep the diff and
the README churn small. Each JSDoc states the two sources.

*Alternative:* two positional parameters (`deployment`, `account`). Rejected: the object names the
scope at every call site, and a future source can be added without reordering.

### D2. The hook fetches both sources together, through host-supplied calls

```ts
export interface UsageLimitsApi {
  getDeploymentUsage: (deploymentId: string) => Promise<DeploymentLimitsResponseDto>;
  getAccountUsage: () => Promise<AccountUsage>;
}

useDeploymentUsageLimits(deploymentId, api): {
  sources: UsageLimitsSources; isLoading: boolean; hasError: boolean; refresh: () => void;
}
```

- **One effect, one monotonic request id, and a `cancelled` flag**, as today. Each run issues both
  calls with `Promise.allSettled`, so the existing guards cover both: a slow response for an
  earlier deployment never overwrites the current one, and `isLoading` stays `true` until both
  settle.
- **Per-source last-known value.** A fulfilled call replaces its own source. A rejected call keeps
  its source's previous value and sets `hasError`.
- **On a deployment change** `deployment` is cleared, because it belongs to the previous deployment,
  but `account` is kept, because it does not depend on the selection. The cost rows then stay on
  screen while the new deployment loads.
- **With no `deploymentId`** nothing is fetched and `deployment` is cleared, as today. The control
  and the banner render nothing without a deployment anyway.
- `api` identity is not a re-fetch trigger, as `getDeploymentLimits` was not: it is held in a ref.

The host passes `getAccountUsage: getUserUsage`. `UserLimitStatsResponseDto` is assignable to
`AccountUsage`, so no adapter is needed. The lib never constructs a client and never learns a path,
which is the second exception in `AGENTS.md` §Library isolation, unchanged in shape.

`useUsageLimitBanner` replaces its `getDeploymentLimits` option with `getDeploymentUsage` and
`getAccountUsage`, and forwards them to the hook.

*Alternatives:*

- A separate `useAccountUsage` hook. Rejected: popover-open and after-generation refreshes would
  have to be wired twice and could drift.
- Reusing `useUsageData`. Rejected: it is driven by a `refreshToken` counter, has no imperative
  `refresh`, and has no last-value-on-failure behaviour.

### D3. Account figures come from `/user/usage`, not `/user/limits`

Both endpoints carry the same top-level cost stats. `/user/usage` lists only the deployments used
in the current periods, while `/user/limits` lists every visible deployment, so `/user/usage` is
the smaller payload. It is also exactly what the Usage cards show, which makes "equal to the Usage
page" true by construction. `deploymentTypes` is not sent: it filters `deployments` only, not the
top level.

### D4. No sharing between the two surfaces

The control and the banner are never mounted together, so per-mount fetching sends no duplicate
requests. No module-level cache is introduced, which keeps the spec's "no cache" stance.

### D5. Remove the diagnostics, keep the endpoint

Deleted:

- `logRawDialBody`;
- the three `parseAs: 'text'` options in `DeploymentsDetailsService` (`getDeploymentLimits`,
  `getDeploymentUsage`, `getUserUsage`). `getUserUsage` returns to its previous debug log of
  `result.data`;
- the `Promise.allSettled` probe in `getDeploymentLimits`.

Kept:

- `getDeploymentUsage` (BFF service, controller, generated client, frontend helper);
- the SDK bump.

`getDeploymentUsage` gets no raw-body log, matching `getDeploymentLimits`.

The endpoint is authorized like `/limits`: `SessionGuard` plus the caller's own bearer token
forwarded to DIAL Core, which answers `403`/`404` for a deployment the caller cannot see. No role
gate and no `ENABLED_FEATURES` entry apply.

### D6. Error and empty states

| State | Dial / popover | Banner |
|---|---|---|
| Both sources loaded | rows of both groups that reach 75% | worst capped candidate of both |
| `/usage` fails, account loaded | cost group only; `aria-live` error line in the open popover | cost candidates only; no error text |
| Account fails, `/usage` loaded | token group only; error line | token candidates only |
| Both fail, no earlier value | no trigger | no banner |
| Refresh fails after a success | last values of the failed source stay | same |

`/limits` is never used as a fallback for cost, because that would reintroduce the double count.

## Risks / Trade-offs

- [Two requests per refresh instead of one] → Both are small reads against Redis-backed counters
  on DIAL Core, issued in parallel, so latency is the slower of the two. Refreshes stay at popover
  open, generation end and deployment change. No polling is added.
- [DIAL Core older than 0.49.0 returns `404` for `/usage`] → Token rows disappear and the popover
  shows its error line. Cost rows, which this bug is about, still work. Dev runs a Core with
  `/usage` (verified 2026-10-21). The minimum Core version is called out in the PR.
- [The account response carries the `deployments` map the popover ignores] → Accepted for now. If
  it becomes heavy, `GET /user/limits?deploymentTypes=` cannot shrink it either. A dedicated
  account-only endpoint would be an upstream request.
- [Names no longer describe the data (`mapDeploymentLimitsToInput` maps two sources)] → JSDoc
  states both sources. A rename is possible later and is out of scope here.
- [An agent's token group is almost always empty] → Its own `*TokenStats.used` is `0`, because
  tokens are charged to the models it calls. This is the same as with `/limits` today, not a
  regression.

## Migration Plan

No data, flag or configuration migration. Ship as one PR together with the already-present SDK
bump and BFF endpoint. Rollback is a revert of the PR: the hooks fall back to `/limits` and the
bug returns. There is no state to clean up.

## Open Questions

- Should the popover show the selected agent's own spend (from `sources.deployment.*CostStats.used`)
  as an informational row without a bar? This is left to product and is not part of this change.
- Will DIAL Core drop the aggregated part from `/limits` (draft ticket)? This change does not
  depend on the answer.

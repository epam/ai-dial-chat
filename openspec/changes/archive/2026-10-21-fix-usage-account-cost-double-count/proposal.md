## Why

With an agent (application / router) selected, the conversation-input usage dial and popover
(`UsageLimitsControl`) and the composer usage banner (`UsageLimitBanner`) count the agent's spend
twice, so they report the account cost budget as reached at about half the real figure while
DIAL Core keeps accepting messages (issue #9361). Both read `*CostStats` from
`GET /deployments/{selected}/limits`
(`apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx:60`,
`libs/chat-hooks/src/usage/useUsageLimitBanner/useUsageLimitBanner.ts:98`). Since DIAL Core #2032
that endpoint returns the account spend **plus** the queried deployment's aggregated callee cost,
which is already inside the account spend. DIAL Core has not changed this, and the fix is entirely
in Chat's hands.

Measured on dev on 2026-10-21, same user, same second (`dial-rag` is an application):

| Source | day | week | month |
|---|---|---|---|
| `GET /v1/user/usage`, top level (account) | 0.13596895 / 100 | 0.14450095 / 200 | 0.24774745 / 500 |
| `GET /v1/deployments/dial-rag/usage` (application's own) | 0.0419752 | 0.0419752 | 0.0419752 |
| `GET /v1/deployments/dial-rag/limits` (read today) | **0.17794415** / 100 | **0.18647615** / 200 | **0.28972265** / 500 |

## What Changes

- The popover's **Cost limits · all agents** group and the banner's cost candidates read the
  account budget and the account spend from the top level of `GET /api/v1/user/usage`, the same
  figures the Settings → Usage cards show
  (`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:56`). They no longer depend on which
  deployment is selected.
- The popover's **Token limits** group and the banner's token candidates read the selected
  deployment's own stats from the new `GET /api/v1/deployments/{deployment}/usage` (DIAL Core
  0.49.0+, #2073), where every field is scoped to that deployment.
- The popover and the banner stop reading `GET /deployments/{id}/limits`. The catalog keeps
  using it for its token rows, and it never reads cost (`chat-hooks-deployment-limits-mapping`).
- `libs/chat-hooks`:
  - **BREAKING (lib API, workspace-private package `0.0.1`)**: `useDeploymentUsageLimits` takes
    both host-supplied calls (`getDeploymentUsage`, `getAccountUsage`) and returns both responses.
  - **BREAKING**: `mapDeploymentLimitsToInput` and `selectUsageBannerSource` take that pair
    instead of one `DeploymentLimitsResponseDto`.
  - **BREAKING**: `useUsageLimitBanner`'s `getDeploymentLimits` option is replaced by the same two
    calls.
- BFF: `GET /api/v1/deployments/{deployment}/usage` is specified. It is already implemented on this
  branch together with the `@epam/ai-dial-typescript-sdk` bump to `0.2.0-dev.15`. The frontend
  helper `getDeploymentUsage` joins `getDeploymentLimits` in `apps/chat/src/server-api/deployment-limits.ts`.
- The `TEMP(#9361)` diagnostics are removed: `parseAs: 'text'` and `logRawDialBody` in
  `apps/chat-api/src/deployments/details/deployments-details.service.ts:555`, and the
  `Promise.allSettled` probe in `apps/chat/src/server-api/deployment-limits.ts:12`.

Alternatives considered:

- **Keep tokens on `/limits` and take only cost from `/user/usage`.** Fixes the bug with no Core
  version requirement. Rejected: it keeps a response whose fields have mixed scopes in the popover
  path, which is how this bug arose. The user asked to adopt the deployment-scoped endpoint.
- **Overwrite the cost stats in the BFF's `/limits` with `/user/usage`.** One client request, but
  the BFF would silently diverge from Core's contract and make two hidden upstream calls. Rejected.
- **Subtract `/usage` from `/limits`.** That yields global minus the deployment's direct cost,
  which is wrong for every model. Rejected.
- **Wait for DIAL Core.** No upstream change is tracked, and the bug is visible now. Rejected. An
  upstream ticket is drafted separately.

## Non-goals

- Showing the agent's own spend ("this agent: $X") in the popover. `/usage` carries it, but it has
  no cap and the popover lists only rows near a cap. This is an open product question and a
  separate change.
- The catalog Limits tab, the Usage page, and `GET /deployments/{id}/limits` itself, which stay
  unchanged.
- Fixing `/limits` in DIAL Core.

## Acceptance criteria

- With the issue's figures (agent `/limits` week cost `263.22 / 200`, account `132.24 / 200`), the
  dial, the popover, and the banner report the week cost at `66%`: no cost row is listed, the
  status is not `LimitReached`, and no banner is shown.
- For any selected deployment, the popover's cost rows equal the Usage page's cost cards.
- Token rows equal the selected deployment's `/usage` token stats.
- If one of the two requests fails, rows from the other still render. A failed refresh keeps the
  last values of the failed source, and the popover announces the error as today.
- No caller of the popover/banner path imports or calls `getDeploymentLimits`.
- The lib boundary holds: `libs/chat-hooks` receives both calls as parameters and never constructs
  a client.
- No `TEMP(#9361)` marker remains.
- The lib's tests, the affected app tests, typecheck, lint, `npm run openapi:check`,
  `npm run validate:docs`, and `npm run validate:specs` pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-input-usage-limits`: the token group's source becomes the deployment-usage
  response and the cost group's source becomes the account usage. The mapper signature changes,
  and the ban on a new endpoint is lifted for the deployment-usage endpoint.
- `conversation-input-usage-limit-banner`: source-row candidates come from the deployment-usage
  response (token) and the account usage (cost), and the freshness rules cover both requests.
- `deployment-limits-api`: adds the `GET /api/v1/deployments/:deployment/usage` endpoint and its
  frontend helper.

## Impact

- **Code:** in `libs/chat-hooks`, `useDeploymentUsageLimits`, `useUsageLimitBanner`,
  `map-deployment-limits-to-input.ts`, `usage-banner-source.ts`, and their tests. In `apps/chat`,
  `UsageLimitsControl`, `UsageLimitBanner`, and `server-api/deployment-limits.ts`. In
  `apps/chat-api`, removal of the `TEMP(#9361)` code (the `/usage` endpoint stays).
- **Lib isolation:** host knowledge (generated client, `/api` paths) stays in
  `apps/chat/src/server-api`. The hook receives two typed callbacks, as it receives one today
  (second exception in `AGENTS.md`).
- **Network:** each refresh (popover open, generation end, deployment change) sends two requests
  instead of one. `/user/usage` lists only the deployments used in the current periods.
- **Compatibility:** `/usage` needs DIAL Core 0.49.0 or later. On an older Core it returns `404`,
  the token group is missing, and the popover shows its error line. Cost rows still render.
- **Docs:** the `libs/chat-hooks` README (the `useUsageLimitBanner`, `useDeploymentUsageLimits`,
  `mapDeploymentLimitsToInput`, and `selectUsageBannerSource` signatures).
  `docs/architecture.md` already lists the endpoint.
- **i18n:** no new user-visible strings. "Cost limits · all agents" is now accurate.
- **Rollback:** revert the change. Nothing is persisted and no flag or migration is involved.

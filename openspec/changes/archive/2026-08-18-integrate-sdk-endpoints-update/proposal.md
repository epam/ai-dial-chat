## Why

`@epam/ai-dial-typescript-sdk` PR [#35](https://github.com/epam/ai-dial-typescript-sdk/pull/35) adds `GET /v1/user/limits` and `GET /v1/user/usage`, which return rate-limit and rolling cost/usage statistics for **every deployment** available to the caller in a single response, plus global cost-budget figures that no existing endpoint exposes. Today the BFF only exposes the legacy per-deployment `GET /v1/deployments/{deployment_name}/limits` (`deployment-limits-api`), used by `useDeploymentUsageLimits`/`UsageLimitsControl` to show the monthly token limit for the single currently-selected deployment. Pulling in the new SDK version and endpoints makes multi-deployment and global-budget usage data available to the BFF for the first time, without disturbing that existing single-deployment flow.

## What Changes

- Bump `@epam/ai-dial-typescript-sdk` to `0.1.0-dev.39` in the root and `apps/chat-api` `package.json`, and update the lockfile.
- Regenerate `libs/chat-api-client` (via `npm run openapi`) after adding the two new BFF endpoints below, so the generated client includes them; verify with `npm run openapi:check` and a clean build.
- Add two new BFF endpoints in `apps/chat-api/src/deployments/` (or a `user` domain, TBD in design) proxying the new SDK methods:
  - `GET /api/v1/user/limits` → SDK `getUserLimits()`
  - `GET /api/v1/user/usage` → SDK `getUserUsage()`
- Add response DTOs for the `UserLimitStats` shape (per-deployment `LimitStatsDto` map + top-level `*CostStats`), following the existing `DeploymentLimitsResponseDto` pattern.
- Add a thin frontend server-api wrapper (`apps/chat/src/server-api/`) over the regenerated generated-client methods, so the new endpoints are consumable by future frontend features without a raw-fetch workaround.
- No removal of the existing per-deployment `getDeploymentLimits` endpoint, `useDeploymentUsageLimits` hook, or `UsageLimitsControl` — they remain unchanged for the single-selected-deployment display; the new endpoints are additive. There is no existing temporary/workaround implementation of aggregate or global usage/limits to replace.

## Capabilities

### New Capabilities

- `user-usage-limits-api`: authenticated BFF endpoints `GET /api/v1/user/limits` and `GET /api/v1/user/usage`, proxying the SDK's `getUserLimits`/`getUserUsage`, their DTOs, error mapping, and the frontend server-api integration that consumes them.

### Modified Capabilities

(none — `deployment-limits-api` behavior is unchanged; the new endpoints are additive)

## Impact

- **Dependency**: `@epam/ai-dial-typescript-sdk` 0.1.0-dev.38 → 0.1.0-dev.39 (root `package.json`, `apps/chat-api/package.json`, lockfile).
- **Generated client**: `libs/chat-api-client` regenerated from the updated OpenAPI spec; new operations `getUserLimits`/`getUserUsage` become available to `apps/chat/src/server-api/`.
- **Backend**: new controller route(s) + service methods in `apps/chat-api/src/deployments/` (or new `user` domain), new DTOs in `apps/chat-api/src/openapi/openapi-response.dto.ts`, new/updated Swagger annotations, new unit + integration tests following `deployments.controller.integration.spec.ts` conventions.
- **Frontend**: `apps/chat/src/server-api/` gains wrappers for the two new endpoints; no existing component is migrated to them in this change (see design.md for the rationale and future-consumer candidates).
- **No breaking changes** to existing endpoints or DTOs.

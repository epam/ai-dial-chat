## Context

`@epam/ai-dial-typescript-sdk` is pinned at `0.1.0-dev.38` (root and `apps/chat-api/package.json`). SDK PR [#35](https://github.com/epam/ai-dial-typescript-sdk/pull/35) (target version `0.1.0-dev.39`) adds:

- `getUserLimits()` → `GET /v1/user/limits` — limits + rolling usage for **every** deployment visible to the caller (unused deployments included, reported against zeros).
- `getUserUsage()` → `GET /v1/user/usage` — the same shape, filtered to deployments actually used in the trailing 30 days.

Both return `UserLimitStats`:

```ts
UserLimitStats: {
  deployments?: { [deploymentName: string]: LimitStats }; // MapStringLimitStats
  minuteCostStats?: CostItemLimitStats;
  dayCostStats?: CostItemLimitStats;
  weekCostStats?: CostItemLimitStats;
  monthCostStats?: CostItemLimitStats;
}
```

The existing BFF endpoint `GET /api/v1/deployments/:deployment/limits` (`deployment-limits-api`, `apps/chat-api/src/deployments/deployments.controller.ts` → `deployments.service.ts` → `deployments-details.service.ts:483`) proxies the *legacy* `GET /v1/deployments/{deployment_name}/limits` for a single deployment, and its `*CostStats` fields mean something different (global cost figures nested under a per-deployment response — the SDK PR's own doc comment calls this out explicitly). The frontend consumes it only through `useDeploymentUsageLimits` → `getDeploymentLimits` (`apps/chat/src/server-api/deployment-limits.ts`) to show the monthly token limit for the single currently-selected deployment in `UsageLimitsControl` (used from `NewConversationComposer` and `CatalogView`). There is no existing code that fetches limits for multiple deployments at once, and no existing handling of global cost budgets — both are new capabilities the SDK now exposes.

## Goals / Non-Goals

**Goals:**
- Bump the SDK to `0.1.0-dev.39` and regenerate `libs/chat-api-client` so `getUserLimits`/`getUserUsage` exist end-to-end (SDK → BFF → generated client).
- Add two new authenticated, thin BFF endpoints that proxy the new SDK methods, following the exact `getDeploymentLimits` controller/service/DTO/error-mapping pattern already established.
- Make the endpoints available to the frontend via a server-api wrapper, so future features (a "where is my budget going" panel, an aggregate model-picker usage view) can consume them without inventing a new access pattern.

**Non-Goals:**
- Redesigning or migrating `UsageLimitsControl` / `useDeploymentUsageLimits` to the aggregate endpoint. That component only ever needs one deployment's limits at a time; switching it to `/v1/user/limits` would mean fetching and caching data for every deployment just to read one entry, which is a net-worse trade-off for its current use case. It stays on `getDeploymentLimits`.
- Building any new UI surface that visualizes global cost budgets or per-deployment usage history — no such UI is requested, and inventing one is out of scope for an SDK-integration task.
- Changing the legacy `/v1/deployments/{deployment_name}/limits` endpoint or its DTO.
- Caching the new endpoints server-side — like the legacy limits endpoint, usage/limit data is real-time and must not be cached (`Cache-Control: private, no-store`).

## Decisions

### Where the new endpoints live: a new `UserLimitsController` inside `apps/chat-api/src/deployments/`, not a new `user` domain folder

The routes must resolve to `/api/v1/user/limits` and `/api/v1/user/usage`, which a NestJS controller cannot produce as a second path prefix on `DeploymentsController` (`@Controller({ path: 'deployments', version: '1' })` — every route on that class is prefixed `deployments/`, so a `@Get('user/limits')` there would actually resolve to `/api/v1/deployments/user/limits`). The fix is a second, small controller class, `UserLimitsController` (`@Controller({ path: 'user', version: '1' })`), placed in the same `apps/chat-api/src/deployments/` folder and registered in `DeploymentsModule` alongside `DeploymentsController`. It injects the same `DeploymentsService` facade, so it still reuses `DeploymentsDetailsService`'s `DialClientService` wiring, `mapDialHttpStatus`/`handleDialFetchError` helpers, and test scaffolding — the original rationale for keeping this in the `deployments` domain rather than inventing a new one. A separate `user` domain folder was considered and rejected for the same reason as before: it would duplicate the SDK-call/error-mapping boilerplate for two endpoints and split "limits" concepts across two domains for no isolation benefit.

Routes: `GET /api/v1/user/limits` (operationId `getUserLimits`), `GET /api/v1/user/usage` (operationId `getUserUsage`) — matching the SDK method names 1:1, consistent with the `operationIdFactory` convention (`apps/chat-api/AGENTS.md`).

### DTO shape: two thin DTOs over one shared nested shape

Add `UserLimitStatsResponseDto` (used by both endpoints, since the SDK response shape is identical) with:
- `deployments?: Record<string, LimitStatsMapDto>` where each deployment's value reuses the existing per-field `LimitStatsDto { total: number; used: number }` already defined for `DeploymentLimitsResponseDto`, but only across the fields the new endpoint actually returns for the per-deployment entry (`LimitStats`, not the top-level `CostItemLimitStats`).
- `minuteCostStats?, dayCostStats?, weekCostStats?, monthCostStats?: LimitStatsDto`

Both controller methods return the same DTO type since the SDK's `getUserLimits`/`getUserUsage` share one response schema (`UserLimitStats`) — the only difference is which deployments the server includes, not the shape.

### `total` at `Number.MAX_SAFE_INTEGER`-exceeding sentinel is passed through, not reinterpreted

The SDK doc for `UserLimitStats` calls out that an unlimited `total` is `Long.MAX_VALUE` (`9223372036854775807`), which exceeds `Number.MAX_SAFE_INTEGER`. `class-validator`/`class-transformer` DTOs and JSON serialization round-trip this as a `number` with precision loss (JS doubles), same as the legacy `DeploymentLimitsResponseDto` already does for its own `total` fields today — this is an existing, accepted precision characteristic of the codebase, not a new problem to solve. No BFF-side clamping or "unlimited" flag is introduced; a future frontend consumer applies the `>= 2^53 ⇒ unlimited` rule from the SDK docs when rendering, as noted in the spec.

### Frontend integration: server-api wrapper only, no new hook/component in this change

Add `apps/chat/src/server-api/user-limits.ts` exporting `getUserLimits()` / `getUserUsage()` thin wrappers over the regenerated `deploymentsApi`-equivalent (or new `userApi`) generated client methods, mirroring `deployment-limits.ts`. This satisfies "new endpoints are integrated and used in the application where appropriate" at the infrastructure level without speculatively building unrequested UI. Considered building a new hook eagerly, but the ticket's acceptance criteria only requires availability and no regression — a UI feature would need its own product decision (what to render, where) that is outside this ticket's scope.

## Risks / Trade-offs

- **[Risk]** SDK PR #35's diff (viewed via `gh api` against the SDK repo's default branch) also shows unrelated removed types (`Attachment`, `Usage`, `UsagePerModel`, `ToolChoice`) in `src/schema.ts` — likely diff noise from the base branch being ahead of the PR's target, not part of PR #35's actual intent. → **Mitigation**: after bumping to `0.1.0-dev.39`, diff the *installed* `node_modules/@epam/ai-dial-typescript-sdk` against the previous version rather than trusting the PR file view, and confirm no other DIAL Core response types used elsewhere in `apps/chat-api` changed shape.
- **[Risk]** Regenerating `libs/chat-api-client` from a new OpenAPI bundle can shift unrelated generated files (formatting, ordering) beyond the two new endpoints. → **Mitigation**: run `npm run openapi:check` and review the full generated diff before committing; keep the SDK bump and regeneration in a commit separate from the new BFF endpoint code so an unexpected regen diff is easy to isolate.
- **[Risk]** Precision loss on `total: 9223372036854775807` could silently render as a nonsensical number if a future consumer forgets the `>= 2^53` sentinel check. → **Mitigation**: document the sentinel behavior in the DTO's `@ApiProperty` description and in the spec's scenario for "unlimited limit", so any future frontend consumer sees it in the OpenAPI-generated types' doc comments.

## Migration Plan

1. Bump `@epam/ai-dial-typescript-sdk` to `0.1.0-dev.39` in root + `apps/chat-api` `package.json`; `npm install` to update the lockfile.
2. Add the two controller/service methods + DTOs in `apps/chat-api/src/deployments/`; add unit + integration tests following `deployments.controller.integration.spec.ts` conventions.
3. Run `npm run openapi` to regenerate `libs/chat-api-client`, then `npm run openapi:check`.
4. Add the frontend server-api wrapper.
5. Verify: `nx test chat-api`, `nx lint chat-api`, `nx build chat-api`, `nx affected --target=build` for the frontend/lib, manual check of `GET /api/v1/user/limits` and `GET /api/v1/user/usage` against a running DIAL Core, and a smoke check that `GET /api/v1/deployments/:deployment/limits` still works unchanged.

No rollback complexity: the change is purely additive (new routes, new DTOs, new generated-client methods); reverting the SDK bump and generated-client regen is a standard `git revert`.

## Open Questions

None outstanding — `UserLimitsController` uses `@ApiTags('user')` (matching its own route prefix), so the OpenAPI generator produces a separate `userApi` generated-client class distinct from `deploymentsApi`.

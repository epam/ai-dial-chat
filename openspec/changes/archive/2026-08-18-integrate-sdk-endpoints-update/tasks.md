## 1. Dependency bump

- [x] 1.1 Bump `@epam/ai-dial-typescript-sdk` to `0.1.0-dev.39` in root `package.json` and `apps/chat-api/package.json`
- [x] 1.2 Run `npm install` to update the lockfile; verify no unrelated dependency drift
- [x] 1.3 Diff the installed `node_modules/@epam/ai-dial-typescript-sdk` `src`/`dist` against the previous `0.1.0-dev.38` to confirm only the documented `getUserLimits`/`getUserUsage` additions landed (no unexpected removed/changed types affecting existing `apps/chat-api` usage)

## 2. Backend: DTOs

- [x] 2.1 Add `UserLimitStatsResponseDto` to `apps/chat-api/src/openapi/openapi-response.dto.ts` (or a new `dto/user-limit-stats.dto.ts` in `apps/chat-api/src/deployments/dto/`), with `deployments: Record<string, ...>` per-deployment stats and top-level `minuteCostStats`/`dayCostStats`/`weekCostStats`/`monthCostStats`, reusing/extending the existing `LimitStatsDto`
- [x] 2.2 Document the `total >= 2^53 ⇒ unlimited` sentinel behavior in the DTO's `@ApiProperty` description

## 3. Backend: service methods

- [x] 3.1 Add `getUserLimits(accessToken)` to `apps/chat-api/src/deployments/details/deployments-details.service.ts`, calling `this.dialClient.client.getUserLimits({ headers: getBearerAuthHeaders(accessToken) })`, following the exact `getDeploymentLimits` pattern (error handling via `mapDialHttpStatus`/`handleDialFetchError`)
- [x] 3.2 Add `getUserUsage(accessToken)` the same way, calling `getUserUsage(...)`
- [x] 3.3 Add passthrough bindings in `apps/chat-api/src/deployments/deployments.service.ts` (`getUserLimits = this.detailsService.getUserLimits.bind(...)`, same for usage)

## 4. Backend: controller routes

- [x] 4.1 Add `GET limits` handler to a new `UserLimitsController` (`apps/chat-api/src/deployments/user-limits.controller.ts`, `@Controller({ path: 'user', version: '1' })`, registered in `DeploymentsModule`) — `operationId: 'getUserLimits'`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, no-store')`, `@ApiResponse` for 200/401/500/502/503, extracts `at` from `req.user as SessionUser` (a route on `DeploymentsController` itself would resolve under `/deployments/*`, not `/user/*`, since the controller path prefix applies to every route on the class)
- [x] 4.2 Add `GET usage` handler the same way on `UserLimitsController`, with `operationId: 'getUserUsage'`
- [x] 4.3 Confirm route resolution is `/api/v1/user/limits` and `/api/v1/user/usage` (URI-versioned business endpoints, verified via integration test) — no collision with `:deployment/limits` since the two controllers mount at disjoint path prefixes

## 5. Backend: tests

- [x] 5.1 Add unit tests for `getUserLimits`/`getUserUsage` in `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` (success, 401, 500/502/503 mapping)
- [x] 5.2 Add unit tests for the service passthrough bindings in `apps/chat-api/src/deployments/tests/deployments.service.spec.ts`
- [x] 5.3 Add integration tests in a new `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts` (targeting `UserLimitsController` directly, since it is a separate controller from `DeploymentsController`) for both routes: authenticated success, unauthenticated 401, upstream error mapping, and `Cache-Control: private, no-store` header assertion
- [x] 5.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 6. Regenerate chat-api-client

- [x] 6.1 Run `npm run openapi` (regenerates `libs/chat-api-client` from the updated OpenAPI spec including the two new routes)
- [x] 6.2 Run `npm run openapi:check` and resolve any drift
- [x] 6.3 Review the full generated diff in `libs/chat-api-client/src/generated/` to confirm only the expected new operations/models were added, with no unrelated regeneration noise left uncommitted
- [x] 6.4 Build `chat-api-client`: `npm exec nx build chat-api-client` (or the lib's build target) to confirm it compiles

## 7. Frontend: server-api wrapper

- [x] 7.1 Add `apps/chat/src/server-api/user-limits.ts` exporting `getUserLimits()` and `getUserUsage()` thin wrappers over the regenerated generated-client methods, mirroring `deployment-limits.ts`
- [x] 7.2 Confirm no raw `fetch`/`base.ts` calls were introduced for these endpoints

## 8. Verification

- [x] 8.1 `npm exec nx build chat-api` — backend builds cleanly
- [x] 8.2 `npm exec nx affected --target=build --base=origin/development-1.0` — no regressions in affected projects
- [ ] 8.3 Manually start the app (`npm run start:all`) and call `GET /api/v1/user/limits` and `GET /api/v1/user/usage` against a running DIAL Core with a valid session cookie; confirm response shape matches the spec
- [ ] 8.4 Manually verify `GET /api/v1/deployments/:deployment/limits` and the existing `UsageLimitsControl` UI (model picker / catalog) still work unchanged
- [x] 8.5 Update `docs/` if any documented API surface (e.g. an API reference doc) needs the two new endpoints listed

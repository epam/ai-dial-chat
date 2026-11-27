# Tasks

Slicing strategy: **risk-first**. Slice 1 pins down today's race behaviour, including the gaps, before anything changes. Slice 2 swaps the metadata policy behind those tests. Slice 3 proves the real write paths end to end. Slice 4 lands the spec text. Every slice is chat-api only. No OpenAPI, generated-client, UI, i18n, RTL or feature-flag work is expected. If any of that becomes necessary, stop and widen the proposal first.

Conventions: specs stay in their existing `tests/` folders. Test names describe observable behaviour. Relative imports carry no extension. Deferred promises and a store-backed `cacheManager` mock follow the existing `makeService` helper in `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`.

## 1. Characterize invalidation races (tests only, no service change)

- [x] 1.1 In `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`, add a `describe('getDeploymentDetails invalidation races')` block with deferred `getToolset`/`getModel` mocks. Cover these timelines from design.md, all passing on current code:
  - T1 (old fetch, invalidation, new fetch, old settles first);
  - the reverse order (new settles first, old second);
  - an old fetch that rejects after invalidation (its caller gets the mapped error, nothing is cached, the new fetch caches);
  - a new fetch that rejects while the old one resolves (nothing is cached);
  - repeated invalidation during one live fetch (T6, cache empty afterwards);
  - old `finally` vs new pending (T9: a caller arriving after the old fetch settles still joins the new fetch, so `getToolset` is called exactly twice).

  Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` passes.

- [x] 1.2 In the same file, add the three gap timelines as `it.fails(...)`, each with a comment naming its design.md timeline:
  - T2: make `cacheManager.del` for the details key return a deferred; resolve the old fetch before releasing it; assert the cache does **not** hold the stale value.
  - T3: a caller arriving during that deferred `del` must start its own upstream call.
  - T5: make the mock `set` defer its store write while `del` applies immediately (reordering the API permits); assert the cache does not end with the fenced fetch's value.

  Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` passes, and the three `it.fails` cases are reported as expected failures.

- [x] 1.3 Slice check. Verification: `npm run verify:changed`.

## 2. Introduce identity-fenced pending records and remove `cacheGenerations`

- [x] 2.1 In `apps/chat-api/src/deployments/details/deployments-details.service.ts`:
  - change `pendingDetailsRequests` to `Map<string, PendingDetailsRequest>` (a private `interface PendingDetailsRequest { fence: object; promise: Promise<DeploymentDetailsDto> }`, with a fresh `fence` per fetch; see design.md D1);
  - pass the record into `fetchDeploymentDetails`;
  - fence the cache `set` on `pendingDetailsRequests.get(cacheKey) === record` (D1);
  - after the `set`, re-check and issue one compensating `cacheManager.del` that is logged and swallowed (D3);
  - keep the `finally` identity guard, comparing records;
  - delete `cacheGenerations` and its reads.

  Response mapping, `handleDialFetchError` usage, the 60 000 ms TTL, log lines and the public signatures do not change. Update the JSDoc on the field and on `invalidateDetailsCache` to describe the record fence instead of generations.

  Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`; every slice-1 `it` still passes.

- [x] 2.2 In `invalidateDetailsCache`, move `pendingDetailsRequests.delete(cacheKey)` before the first `await` (D2). Keep the order: `del(details)`, then `del(deployments:interfaces:<userSub>:<deployment>)`. Verification: in `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`, flip the three `it.fails` cases from 1.2 to `it` and confirm they pass. The existing `'is invalidated together with the deployment details'` test still passes.

- [x] 2.3 Add reclamation and ownership tests to `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`. Read state through `service['pendingDetailsRequests'].size` and, for the idle case, assert that every `Map`/`Set` field on the service is empty:
  - 1 000 distinct `invalidateDetailsCache(user, deployment)` calls with nothing in flight leave size 0;
  - repeated invalidation during one live fetch leaves size 0 after it settles;
  - size 0 after a resolved fetch and after a rejected fetch;
  - three coalesced callers make one upstream call and leave size 1 while pending, then 0;
  - a hung current fetch keeps size 1, invalidation drops it to 0, and the next caller starts a new upstream call;
  - a hung invalidated fetch contributes no entry while a newer fetch's record is size 1;
  - different `userSub` values for the same deployment never share a record or a cached value.

  Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`.

- [x] 2.4 Confirm the facade still binds the unchanged method. Verification: `npm run test:file -- apps/chat-api/src/deployments/tests/deployments.service.spec.ts` passes unchanged.

- [x] 2.5 Slice check. Verification: `npm run verify:changed`, then `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 3. Verify login/logout and application-write invalidation with the real service

- [x] 3.1 In `apps/chat-api/src/toolsets/auth/tests/toolsets-auth.service.spec.ts`, add a `describe('loginToolset/logoutToolset + GET .../details cache interaction (regression)')` suite. It wires a real `ToolsetsListingService` and a real `DeploymentsDetailsService` over one store-backed `cacheManager` (modelled on `makeIntegrationDeps` in `apps/chat-api/src/applications/tests/applications.service.spec.ts`), with mocked SDK clients and `UserConfigService`. Cover:
  - (a) details cached as `SIGNED_IN`, then `logoutToolset`, then the next `getDeploymentDetails` returns `SIGNED_OUT` from a fresh upstream call;
  - (b) a details fetch started before `loginToolset` settles after it, and neither the response of a request made after login nor the cache carries the pre-login status;
  - (c) after the round trip the details service's pending map is empty.

  Verification: `npm run test:file -- apps/chat-api/src/toolsets/auth/tests/toolsets-auth.service.spec.ts`.

- [x] 3.2 Extend the existing `describe('updateApplication + GET .../details cache interaction (regression)')` suite in `apps/chat-api/src/applications/tests/applications.service.spec.ts` with one case: a details fetch is in flight when `updateApplication` succeeds; after it settles, the next `getDeploymentDetails` returns the post-update `application_properties`, and the shared cache never holds the pre-update DTO. Add one `invalidateAfterWrite` case with two ids: both keys are fenced and nothing is retained. Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts`.

- [x] 3.3 Run the toolset HTTP contract suite unchanged. It mocks `ToolsetsService`, so it proves only that the routes, statuses and the "invalidates on success" wiring did not move. Verification: `npm run test:file -- apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` and `npm run test:file -- apps/chat-api/src/toolsets/listing/tests/toolsets-listing.service.spec.ts` pass with no edits.

- [x] 3.4 Slice check. Verification: `npm run verify:changed`.

## 4. Spec and documentation

- [x] 4.1 Re-read `openspec/changes/bound-deployment-details-invalidation-state/specs/deployment-details-api/spec.md` against the implemented behaviour. Adjust any scenario that the slice-2/3 tests do not exercise, or that the code does not do. Confirm the `pendingDetailsRequests` name still matches `openspec/specs/deployments-toolsets-service-decomposition/spec.md`. Verification: `openspec validate bound-deployment-details-invalidation-state --strict` and `npm run validate:specs` pass. `npm run spec:impact` lists no unaddressed spec.

- [x] 4.2 Confirm that no doc describes the generation counter: `docs/architecture.md`, `apps/chat-api/README.md` and `apps/chat-api/AGENTS.md`. At planning time the grep found none; the `architecture.md` "generation counter" line concerns providers and is unrelated. Edit nothing unless a hit appears. Verification: a grep for `cacheGenerations` and for `generation counter` scoped to details caching returns no doc hits. Run `npm run validate:docs` only if a doc was edited.

- [x] 4.3 Confirm that the endpoint contract has not moved. Verification: `npm run openapi && npm run openapi:check` reports no diff. The command is run because the service file sits under an endpoint, not because a change is expected.

## 5. Final integration check

- [x] 5.1 Verification: exactly one `npm run verify:full` passes. Closed by explicit user decision with recorded exceptions: `verify:full` stopped at `format:check` on git-ignored `celebrations-prompts/` and `analytics-sdk-prompts/` files, and the 211 `app-config`/`config` test failures also occur on clean `development`. Typecheck and lint (full) and every changed spec pass. `npm run build:quiet` is not needed, because Nest module wiring and bundling do not change.

## Workflow follow-up

- Archive the change after review, using `/opsx:archive`.

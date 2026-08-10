## 1. Pre-flight

- [x] 1.1 Check PR #8226 (`fix/deployment-accept-ownership-enrichment`) merge status. If merged, plan to have `DeploymentsListingService`/`ToolsetsListingService` consume `computeItemOwnershipFlags`/`splitResourcesByPermission` from `common/utils/resource-ownership.ts` instead of the current inline/duplicated ownership checks; if not merged, carry the existing checks forward unchanged. **Result: PR #8226 is still OPEN (not merged) as of this implementation — carrying the existing inline/duplicated ownership checks forward unchanged.**

## 2. Extract pure mapping helpers

- [x] 2.1 Create `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`; move `mapToDeploymentItem`, `mapDeploymentFeatures`, `mapToolsetAuthSettings`, `mapConversationStarters`, `redactToolsetAuthSettings`, and the generic `isRecord`/`getBoolean`/`getNumber`/`getString`/`getStringArray`/`toAdditionalProperties` helpers there verbatim; update `deployments.service.ts` to import from it.
- [x] 2.2 Create `apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`; move `toDialCredentialsLevel`, `parseDialToolsetResource`, `toDialAuthSettings`, `preserveHiddenAuthSettings`, `toDialToolsetBody`, `resolveToolsetLoginUrl`, `toDialToolsetSigninBody`, `toDialToolsetSignoutBody`, `isVisibleToolset`, `isMyToolset`, `getRawAuthSettings`, `mapAuthSettings`, `mapToolsetFeatures`, `mapDialToolsetToDto`, `mergeCustomToolsetDetails`, and the generic record helpers there verbatim; update `toolsets.service.ts` to import from it.
- [x] 2.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` — pure move, must be a no-op behaviorally. **Note:** `nx build` (webpack) does not fully type-check and did not catch two dropped imports (`safeDecodeURIComponent`, `ToolsetAuthType`) left dangling in `toolsets.service.ts` after the extraction — caught by running the actual test suite (12 failures) and `npx tsc --noEmit -p apps/chat-api/tsconfig.app.json`. Fixed; all 152 deployments+toolsets tests pass. Using `tsc --noEmit` as an additional check at each subsequent slice, not just `nx build`.

## 3. Split ToolsetsService

- [x] 3.1 Create `toolsets/listing/toolsets-listing.service.ts`: move `listToolsets`, `getToolset`, `resolveToolsetItem`, `enrichToolsetWithOwnership`, `enrichToolsetsOwnership`, `getSharedToolsetResources`, `toWritableAndSharedUrls`, `getOpenAiToolset`, `tryGetOpenAiToolset`, `getCustomToolset`, `getUserBucket`, `resolveToolsetResource`, and `invalidateCaches`/`invalidateListCache`. (`tryGetCustomToolsetAuthSettings` moved to Mutation instead — see 3.2 note.)
- [x] 3.2 Create `toolsets/mutation/toolsets-mutation.service.ts`: move `createToolset`, `updateToolset`, `deleteToolset`. **Deviation from the plan:** also moved `tryGetCustomToolsetAuthSettings` here (not to Listing) since it is only ever called from `updateToolset` — keeping it in Listing would have made Listing depend on a mutation-only concern for no read-path benefit.
- [x] 3.3 Create `toolsets/auth/toolsets-auth.service.ts`: move `loginToolset`, `logoutToolset`.
- [x] 3.4 Decided: `ToolsetsListingService` owns the shared `invalidateCaches`/`invalidateListCache` helpers (public methods now, since Mutation and Auth call them cross-service) and keeps the (stubbed, for now) `DeploymentsService` dependency for `invalidateDetailsCache`; `ToolsetsMutationService`/`ToolsetsAuthService` inject `ToolsetsListingService` (also reused for `getUserBucket`/`resolveToolsetResource` in Mutation, and `getToolset` in Auth's `logoutToolset`). Revisited in section 5.
- [x] 3.5 Update `toolsets.module.ts` to register `ToolsetsListingService`, `ToolsetsMutationService`, `ToolsetsAuthService`.
- [x] 3.6 Reduce `ToolsetsService` to a facade delegating to the three new services (bound-property pattern for pure 1:1 forwards, matching `ConversationService`'s facade).
- [x] 3.7 Relocate `toolsets.service.spec.ts`'s `describe` blocks verbatim into `listing/tests/toolsets-listing.service.spec.ts`, `mutation/tests/toolsets-mutation.service.spec.ts`, `auth/tests/toolsets-auth.service.spec.ts`.
- [x] 3.8 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. **Note:** also ran `npx tsc --noEmit -p apps/chat-api/tsconfig.spec.json` per the lesson from 2.3 — caught 2 real errors (missing `mutationSdkOk`/`ToolsetAuthType` in the relocated auth spec, 3 leftover `new ToolsetsService(...)` instantiations in the relocated listing spec that should have been `ToolsetsListingService`) among the expected TS6305 project-reference noise. Fixed; all 115 toolsets tests pass, lint clean, build succeeds.

## 4. Split DeploymentsService

- [x] 4.1 Create `deployments/listing/deployments-listing.service.ts`: move `listDeployments`, `getSharedApplicationResources`, and `invalidateListCache`.
- [x] 4.2 Create `deployments/lookup/deployments-lookup.service.ts`: move `resolveDeploymentItem`, `tryGetRawModel`, `tryGetRawApplication`. (Keeps its own `featuredIds`/`hiddenTags`, computed from `ConfigService` same as Listing — both need them for `mapToDeploymentItem`.)
- [x] 4.3 Create `deployments/details/deployments-details.service.ts`: move `getDeploymentDetails`, `invalidateDetailsCache`, `fetchDeploymentDetails`, `buildUnprefixedDeploymentDetails`, `buildModelDetails`, `buildApplicationDetails`, `buildToolsetDetails`, `getAllToolSetToolNames`, `getDeploymentConfiguration`, `getDeploymentLimits`, and the `pendingDetailsRequests` map.
- [x] 4.4 Update `deployments.module.ts` to register `DeploymentsListingService`, `DeploymentsLookupService`, `DeploymentsDetailsService`; also export `DeploymentsDetailsService` alongside the facade, in preparation for section 5's rewire.
- [x] 4.5 Reduce `DeploymentsService` to a facade delegating to the three new services (bound-property pattern).
- [x] 4.6 Relocate `deployments.service.spec.ts`'s `describe` blocks verbatim into `listing/tests/deployments-listing.service.spec.ts`, `lookup/tests/deployments-lookup.service.spec.ts`, `details/tests/deployments-details.service.spec.ts` (the latter combines the original `getDeploymentConfiguration`/`getDeploymentLimits`/`getDeploymentDetails` describe blocks, since all three map to `DeploymentsDetailsService`).
- [x] 4.7 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`; fix regressions before continuing. All 1898 chat-api tests pass (131 deployments-specific), lint clean, build succeeds.

## 5. Rewire the cross-domain dependency

- [x] 5.1 In `toolsets.module.ts`, inject `DeploymentsDetailsService` (from step 4.3/4.4) into whichever toolsets sub-service owns `invalidateCaches` (from step 3.4), replacing the stubbed dependency on `DeploymentsService`. Done in `toolsets-listing.service.ts` (constructor param renamed `deploymentsDetailsService`, `invalidateCaches` now calls `this.deploymentsDetailsService.invalidateDetailsCache(...)`).
- [x] 5.2 Remove the now-unused `DeploymentsService` import/injection from that toolsets sub-service if nothing else in it needs the facade. Confirmed: `toolsets-listing.service.ts` imports `DeploymentsDetailsService` directly, no lingering `DeploymentsService` import/injection anywhere in `toolsets/`.
- [x] 5.3 Run `npm exec nx build chat-api` to confirm DI wiring resolves with no circular-dependency errors between the two domains' new providers. Webpack build succeeds; import graph is one-directional (`ToolsetsListingService → DeploymentsDetailsService`, no cycle).
- [x] 5.4 Run `npm exec nx test chat-api`. All 123 test files / 1898 tests pass. (One earlier run reported a truncated "Failed tasks" banner with no visible failing test name; re-run confirmed 1898/1898 passing — transient/flaky, not a real regression.) Lint clean (2 pre-existing unrelated warnings in `files`/`share`). `tsc --noEmit` shows only the same pre-existing project-reference/TS7006 noise already documented at 4.7, unrelated to this rewire.

## 6. Facade cleanup and dead code removal

- [x] 6.1 Remove all now-unused private helpers/imports left behind in `deployments.service.ts` and `toolsets.service.ts` after all extractions. Both files contain only the `Injectable` import, the three sub-service imports, the constructor, and bound-property delegates — no leftover private helpers. Fixed one stale doc comment in `deployments.service.ts` that referenced the now-removed direct `toolsets → DeploymentsService` dependency (superseded by the section 5 rewire).
- [x] 6.2 Confirm both `deployments.service.ts` and `toolsets.service.ts` are pure delegation facades under ~200 lines each. Confirmed (46 / 39 lines).
- [x] 6.3 Reduce `deployments.service.spec.ts`/`toolsets.service.spec.ts` to only cross-service delegation assertions (slim facade specs); remove relocated blocks. Already done during sections 3/4 — both specs contain only one `describe('X facade', ...)` block with one delegation assertion per method.
- [x] 6.4 Run `wc -l apps/chat-api/src/deployments/deployments.service.ts apps/chat-api/src/toolsets/toolsets.service.ts` and confirm both are under 200 lines. 46 + 39 = 85 lines total, both well under 200.

## 7. Documentation and spec deltas

- [x] 7.1 Update implementation-detail bullets in existing capability specs that reference the monolithic `DeploymentsService`/`ToolsetsService` by method name. Grepped all 13 listed specs for `DeploymentsService.`/`ToolsetsService.`/`deployments.service.ts`/`toolsets.service.ts`. Only `deployments-api`, `deployment-details-api`, and `deployments-is-my-flag` had stale references (all `toolset-*`/`catalog-toolset*` specs already referenced methods generically, no monolithic file path). Updated: `deployments-api` domain-structure bullet now names the facade + `DeploymentsListingService`; `deployments-is-my-flag` points `listDeployments` at `listing/deployments-listing.service.ts`; `deployment-details-api`'s `mapToolsetAuthSettings`/`mapDeploymentFeatures` bullets now point at `deployments/utils/deployment-mapper.util.ts`. No scenario-level behavior changes. `deployment-limits-api`/`deployment-configuration` only reference frontend/generated-client method names, not the backend monolith — left untouched.

## 8. Final verification

- [x] 8.1 Run `npm exec nx test chat-api`. 123 test files / 1898 tests pass.
- [x] 8.2 Run `npm exec nx lint chat-api`. 0 errors, 2 pre-existing warnings unrelated to this change (`files-listing.service.ts`, `share.service.ts`).
- [x] 8.3 Run `npm exec nx build chat-api`. Webpack compiles successfully.
- [x] 8.4 Manually exercise list/details/config/limits deployments endpoints and list/create/update/delete/login/logout toolsets endpoints against a running `apps/chat-api` instance to confirm REST contracts are unchanged end-to-end. **User confirmed manual testing performed.**

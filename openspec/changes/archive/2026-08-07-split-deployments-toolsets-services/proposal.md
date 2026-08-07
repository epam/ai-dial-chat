## Why

`apps/chat-api/src/deployments/deployments.service.ts` (1038 lines) and `apps/chat-api/src/toolsets/toolsets.service.ts` (1107 lines) are both god services, flagged in the local refactoring audit as "never split (Phase 2.4)". `ToolsetsService` also injects `DeploymentsService` directly (for `invalidateDetailsCache`), so splitting them together in one change avoids one change referencing methods that moved out from under it in another, not-yet-applied change. This follows the same facade + focused-sub-services pattern already used for `ConversationService` (archived `2026-08-07-split-conversation-service`) and `FilesService` (archived `2026-07-16-split-files-service`).

## What Changes

- Split `DeploymentsService` into `DeploymentsListingService` (bulk `listDeployments`, list-cache invalidation), `DeploymentsLookupService` (single-item `resolveDeploymentItem` used by the share-accept flow), and `DeploymentsDetailsService` (`getDeploymentDetails`, `getDeploymentConfiguration`, `getDeploymentLimits`, details-cache invalidation, the `pendingDetailsRequests` in-flight dedup map), plus a thin `DeploymentsService` facade.
- Split `ToolsetsService` into `ToolsetsListingService` (`listToolsets`, `getToolset`, `resolveToolsetItem`, ownership enrichment, cache invalidation, raw-resolution helpers), `ToolsetsMutationService` (`createToolset`, `updateToolset`, `deleteToolset`), and `ToolsetsAuthService` (`loginToolset`, `logoutToolset`), plus a thin `ToolsetsService` facade.
- Extract each domain's module-level pure mapping/DTO-conversion helpers (~300 lines in deployments, ~480 lines in toolsets) into dedicated `utils/deployment-mapper.util.ts` and `utils/toolset-mapper.util.ts` files, shared by whichever sub-service needs them.
- Rewire the `ToolsetsService → DeploymentsService.invalidateDetailsCache` cross-domain call to the new `DeploymentsDetailsService` directly, skipping the deployments facade for this internal service-to-service call.
- Split `deployments.service.spec.ts` and `toolsets.service.spec.ts` into per-sub-service spec files, plus a slim facade spec per service for cross-service delegation assertions.
- **Not BREAKING**: REST contracts, request/response shapes, status codes, cache key naming, TTLs, and structured logging are unchanged — this is an internal refactor only. No frontend changes, no OpenAPI regeneration.
- Out of scope: this change does **not** fix the `isMyToolset`/`listDeployments` ownership-check duplication — that is tracked separately on the still-open PR #8226 (`fix/deployment-accept-ownership-enrichment`), which extracts a shared `apps/chat-api/src/common/utils/resource-ownership.ts`. If that PR has merged by the time this change is implemented, the new `DeploymentsListingService`/`ToolsetsListingService` should consume it rather than re-inlining the ownership check.

## Capabilities

### New Capabilities
- `deployments-toolsets-service-decomposition`: ownership map of which service owns which deployments/toolsets responsibility (listing, lookup, details, mutation, auth, facade) and the equivalence contract guaranteeing behavior is preserved across the split.

### Modified Capabilities
- None. This is an implementation-detail refactor; existing capability specs referencing `DeploymentsService`/`ToolsetsService` by method name (`deployments-api`, `deployment-details-api`, `deployment-limits-api`, `deployment-configuration`, `deployments-is-my-flag`, `toolset-listing`, `toolset-lookup`, `toolset-authoring`, `toolset-authentication`, `toolset-signin-interrupt`, `toolset-write-api`, `catalog-toolsets`, `catalog-toolset-credentials`) keep their current scenario-level requirements unchanged. Any implementation-detail bullets in those specs naming the monolithic service will be updated for accuracy as part of `tasks.md`, without changing behavior.

## Impact

- **Code**: `apps/chat-api/src/deployments/` and `apps/chat-api/src/toolsets/` — new `listing/`, `lookup/`, `details/`, `mutation/`, `auth/`, `utils/` sub-folders per domain; both `*.service.ts` files shrink to facades; both `*.module.ts` files register the new providers.
- **Tests**: `deployments.service.spec.ts` (as of this writing, mirrors the current 1038-line service) and `toolsets.service.spec.ts` are each split into per-sub-service spec files under matching `tests/` sub-folders; a slim facade spec remains per service for delegation checks.
- **Dependents**: `ToolsetsService`'s internal dependency on `DeploymentsService.invalidateDetailsCache` is rewired to `DeploymentsDetailsService`; no signature changes. `ToolsetsController`/`DeploymentsController` keep calling their respective facades unchanged.
- **No impact**: frontend (`apps/chat`), OpenAPI spec/generated client, REST contracts, external callers.

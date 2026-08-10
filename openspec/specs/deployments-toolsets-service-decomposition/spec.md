# Spec: deployments-toolsets-service-decomposition

## Purpose

Backend decomposition of the monolithic `DeploymentsService` (`apps/chat-api/src/deployments/deployments.service.ts`) and `ToolsetsService` (`apps/chat-api/src/toolsets/toolsets.service.ts`) into focused injectable services plus thin facades, mirroring the earlier `ConversationService` and `FilesService` splits, so listing, lookup, details, mutation, and auth concerns each live in their own testable service while the observable REST contract and cross-domain cache-invalidation behavior stay unchanged.

## Requirements

### Requirement: Deployments domain service ownership map
The deployments domain SHALL be decomposed into three focused injectable services plus a facade, each owning a disjoint set of responsibilities.

- `DeploymentsListingService` SHALL own bulk `listDeployments` and its list-cache invalidation.
- `DeploymentsLookupService` SHALL own single-item `resolveDeploymentItem` resolution (the post-share-accept lookup path).
- `DeploymentsDetailsService` SHALL own `getDeploymentDetails`, `getDeploymentConfiguration`, `getDeploymentLimits`, details-cache invalidation, and the in-flight-request dedup map for details fetches.
- `DeploymentsService` SHALL act as a facade that delegates every public method to exactly one of the three services above, and SHALL NOT contain business logic beyond delegation.

#### Scenario: Facade delegates a listing call
- **WHEN** `DeploymentsController` calls `DeploymentsService.listDeployments(...)`
- **THEN** the facade delegates to `DeploymentsListingService.listDeployments(...)` and returns its result unchanged

#### Scenario: Facade delegates a lookup call
- **WHEN** `DeploymentsService.resolveDeploymentItem(...)` is called
- **THEN** the facade delegates to `DeploymentsLookupService.resolveDeploymentItem(...)` and returns its result unchanged

#### Scenario: Facade delegates a details call
- **WHEN** `DeploymentsController` calls `DeploymentsService.getDeploymentDetails(...)`
- **THEN** the facade delegates to `DeploymentsDetailsService.getDeploymentDetails(...)` and returns its result unchanged

### Requirement: Toolsets domain service ownership map
The toolsets domain SHALL be decomposed into three focused injectable services plus a facade, each owning a disjoint set of responsibilities.

- `ToolsetsListingService` SHALL own `listToolsets`, `getToolset`, `resolveToolsetItem`, ownership enrichment, and list/single-item cache invalidation.
- `ToolsetsMutationService` SHALL own `createToolset`, `updateToolset`, `deleteToolset`.
- `ToolsetsAuthService` SHALL own `loginToolset`, `logoutToolset`.
- `ToolsetsService` SHALL act as a facade that delegates every public method to exactly one of the three services above, and SHALL NOT contain business logic beyond delegation.
- Whichever toolsets sub-service invalidates the deployments details cache after a mutation or auth change SHALL depend on `DeploymentsDetailsService` directly, not on the `DeploymentsService` facade.

#### Scenario: Facade delegates a listing call
- **WHEN** `ToolsetsController` calls `ToolsetsService.listToolsets(...)`
- **THEN** the facade delegates to `ToolsetsListingService.listToolsets(...)` and returns its result unchanged

#### Scenario: Facade delegates a mutation call
- **WHEN** `ToolsetsController` calls `ToolsetsService.createToolset(...)`
- **THEN** the facade delegates to `ToolsetsMutationService.createToolset(...)` and returns its result unchanged

#### Scenario: Facade delegates an auth call
- **WHEN** `ToolsetsController` calls `ToolsetsService.loginToolset(...)`
- **THEN** the facade delegates to `ToolsetsAuthService.loginToolset(...)` and returns its result unchanged

#### Scenario: Cross-domain cache invalidation bypasses the deployments facade
- **WHEN** a toolset login, logout, create, update, or delete completes and the deployments details cache for that toolset must be invalidated
- **THEN** the call is made directly against `DeploymentsDetailsService.invalidateDetailsCache`, not against the `DeploymentsService` facade

### Requirement: Behavior equivalence across the split
The decomposition SHALL NOT change any observable REST contract: request/response shapes, status codes, error mapping, cache key naming, cache TTLs, and structured log fields SHALL remain identical to the pre-split `DeploymentsService`/`ToolsetsService` behavior.

#### Scenario: Identical REST response after extraction
- **WHEN** a client calls `GET /api/v1/deployments` or `GET /api/v1/toolsets` before and after the service split
- **THEN** the response body, status code, and headers are identical for the same underlying data

#### Scenario: Cache key and TTL preserved
- **WHEN** `DeploymentsListingService`/`DeploymentsDetailsService`/`ToolsetsListingService` (post-split) serve a cached response
- **THEN** each uses the same cache key naming and TTL that the corresponding pre-split service used, and invalidates on the same triggering events

#### Scenario: In-flight request dedup preserved
- **WHEN** two concurrent requests for the same deployment's details arrive before the first upstream call resolves
- **THEN** `DeploymentsDetailsService` serves both from the single in-flight request, matching pre-split behavior

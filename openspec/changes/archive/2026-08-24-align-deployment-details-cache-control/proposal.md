## Why

GitHub issue #7632's automation expects `GET /api/v1/deployments/{deployment}/details` to return `Cache-Control: private, max-age=60`, but PR #7839 deliberately removed browser freshness caching after the endpoint became user-scoped and started exposing mutable toolset authentication status. The implementation and the main `deployment-details-api` spec now disagree about the response header, cache key, and invalidation behavior.

## What Changes

- Return `Cache-Control: private, no-store` from the deployment-details endpoint so browsers and intermediaries cannot reuse a stale user-specific response while the existing BFF cache continues to shield DIAL Core.
- Correct the deployment-details specification to describe the existing `deployments:details:<userSub>:<deployment>` cache key and toolset write/auth invalidation.
- Add an integration regression assertion for the response header and update the generated OpenAPI description.
- No frontend or user-visible behavior changes; no i18n strings are introduced.

Alternatives considered: restoring `private, max-age=60` would reintroduce the stale cross-session/credential window fixed by #7839; leaving the header absent would match today's code but would not explicitly prohibit heuristic HTTP caching. Explicit `private, no-store` is selected because it states the intended cache boundary unambiguously.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment-details-api`: align the HTTP cache-control contract and document the existing user-scoped server cache and invalidation triggers.

## Impact

- `apps/chat-api/src/deployments/deployments.controller.ts`: explicit response header and matching Swagger description.
- `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts`: cache-control regression coverage.
- `libs/chat-api-client/openapi.json`: regenerated description only; `DeploymentsApi.getDeploymentDetails({ deployment })`, DTOs, and frontend wrappers remain unchanged.
- `openspec/specs/deployment-details-api/spec.md`: updated when this completed change is archived.
- Backward compatibility: response body, status codes, authentication, rate limit, and generated SDK signature are unchanged. Rollback is the removal of the header decorator and the matching spec/test clauses.

## Acceptance Criteria

- A successful deployment-details response includes `Cache-Control: private, no-store`.
- The OpenSpec describes a 60-second BFF cache keyed by user and deployment, plus invalidation after successful toolset mutation or authentication changes.
- The controller integration test, OpenSpec validation, OpenAPI drift check, and affected Nx verification pass.

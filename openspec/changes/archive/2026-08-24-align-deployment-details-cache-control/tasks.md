Slicing strategy: contract-first — correct the cache contract, apply the one-endpoint implementation and test, then regenerate and verify the unchanged SDK surface.

## 1. Contract

- [x] 1.1 Update the `deployment-details-api` requirement with `Cache-Control: private, no-store`, the `deployments:details:<userSub>:<deployment>` key, and toolset mutation/auth invalidation scenarios.

## 2. Backend

- [x] 2.1 Add `@Header('Cache-Control', 'private, no-store')` and matching Swagger wording to `apps/chat-api/src/deployments/deployments.controller.ts`.
- [x] 2.2 Add a successful-response header assertion to `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts`.
- [x] 2.3 Run the deployment controller integration test, then `npm exec nx test @epam/chat-api`, `npm exec nx lint @epam/chat-api`, and `npm exec nx build @epam/chat-api`.

## 3. OpenAPI and final verification

- [x] 3.1 Run `npm run openapi` and `npm run openapi:check`; confirm `DeploymentsApi.getDeploymentDetails({ deployment })` remains strongly typed and unchanged.
- [x] 3.2 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`.
- [x] 3.3 Validate `align-deployment-details-cache-control` and run affected lint, test, and build checks against `origin/development`.

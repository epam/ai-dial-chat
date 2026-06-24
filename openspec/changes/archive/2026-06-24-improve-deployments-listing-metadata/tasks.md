## 1. Backend DTO — extend raw and response shapes

- [x] 1.1 In `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, add `owner?: string` to `RawDeploymentDto` (after `description_keywords?: string[]`).

- [x] 1.2 In `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, add three new `@ApiPropertyOptional` fields to `DeploymentItemDto`:
  - `owner?: string` — "Owner of the deployment as reported by DIAL Core"
  - `isMy?: boolean` — "True when the deployment owner matches the current session user (computed post-cache)"
  - `applicationFolder?: string` — "Parent folder path for application-type deployments (absent for root-level or non-application items)"

- [x] 1.3 Verify: `npm exec nx build chat-api` passes with no TypeScript errors introduced by the DTO changes.

## 2. Backend service — mapping and `isMy` computation

- [x] 2.1 Update `mapToDeploymentItem` signature in `apps/chat-api/src/deployments/deployments.service.ts` to accept a third parameter `sessionBucket: string`.

- [x] 2.2 Inside `mapToDeploymentItem`, add the following field assignments to the returned object:
  - `owner: raw.owner` (passthrough; will be `undefined` when absent)
  - `applicationFolder`: when `type === 'application'` and `raw.id` contains `/`, compute `raw.id.substring(0, raw.id.lastIndexOf('/'))`, otherwise `undefined`
  - Do **not** set `isMy` here — it is computed post-cache (handled in task 2.3).

- [x] 2.3 In `listDeployments` (`deployments.service.ts:107–188`), update the post-cache overlay loop (currently lines 168–174 for `isInstalled`) to also set:
  - `isMy: item.owner != null ? item.owner === bucket : false`
  - The `bucket` parameter is already passed into `listDeployments`; pass it through to the overlay step.

- [x] 2.4 Update the `mapToDeploymentItem` call sites inside `listDeployments` to pass `bucket` (currently `this.userSub` is not passed; the new parameter is `bucket`).

- [x] 2.5 Verify: `npm exec nx test chat-api` — all existing tests pass (no changes to test files yet).

## 3. Backend tests — unit coverage for new fields

- [x] 3.1 In `apps/chat-api/src/deployments/tests/deployments.service.spec.ts`, add unit test cases for `mapToDeploymentItem` covering:
  - `owner` forwarded when present in raw payload
  - `owner` absent (`undefined`) when not in raw payload
  - `applicationFolder` set correctly for nested application: `id: "folder1/my-app"` → `applicationFolder: "folder1"`
  - `applicationFolder` set correctly for deeply nested application: `id: "a/b/my-app"` → `applicationFolder: "a/b"`
  - `applicationFolder` absent for root-level application: `id: "my-app"` (no `/`)
  - `applicationFolder` absent for model and toolset items (regardless of `id`)

- [x] 3.2 In the same spec file, add test cases for `listDeployments` `isMy` computation:
  - `isMy: true` when `owner === bucket`
  - `isMy: false` when `owner` differs from `bucket`
  - `isMy: false` when `owner` is absent
  - `isMy` re-evaluated on cache hit (not read from cache)

- [x] 3.3 Verify: `npm exec nx test chat-api` — all new and existing tests pass.

## 4. Backend tests — integration coverage

- [x] 4.1 In `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts`, add assertions to the existing 200 response test that new fields appear in the response body when the mocked DIAL Core payload includes `owner`.

- [x] 4.2 Add an integration test case: when DIAL Core returns an application deployment with `id: "folder1/my-app"`, the response item has `applicationFolder: "folder1"`.

- [x] 4.3 Verify: `npm exec nx test chat-api` — all integration tests pass.

## 5. OpenAPI generation and generated client

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/` from the updated Swagger annotations.

- [x] 5.2 Run `npm run openapi:check` to confirm the generated output is clean (no diff drift, no `any` in success response shapes).

- [x] 5.3 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — both must pass.

- [x] 5.4 Inspect `libs/chat-api-client/src/generated/src/models/DeploymentItemDto.ts` (or the models index) to confirm the three new optional fields (`owner`, `isMy`, `applicationFolder`) are present in the generated TypeScript type with correct optionality.

## 6. Frontend server-api and context — verify no changes required

- [x] 6.1 Confirm `apps/chat/src/server-api/deployments.api.ts` requires no changes — the `getDeployments()` wrapper calls `deploymentsApi.listDeployments()` and returns the generated `DeploymentsResponseDto` directly; the new fields flow through automatically.

- [x] 6.2 Confirm `apps/chat/src/context/DeploymentsContext.tsx` requires no changes — `items: DeploymentItemDto[]` already holds the full DTO; the new fields are accessible to any consumer.

- [x] 6.3 Run `npm exec nx typecheck chat` (or `npm exec nx build chat`) to confirm the frontend compiles cleanly with the regenerated client.

## 7. Final verification — affected set

- [x] 7.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no lint errors in affected projects.

- [x] 7.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all tests pass.

- [x] 7.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all affected builds succeed.

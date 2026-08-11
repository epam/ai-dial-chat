## 1. Backend: DIAL Core query serialization fix

- [x] 1.1 In `apps/chat-api/src/deployments/listing/deployments-listing.service.ts`, pass `querySerializer: { array: { style: 'form', explode: false } }` on the `listDeployments` call so multi-value `interface_type` reaches DIAL Core as one comma-joined parameter instead of repeated query keys.
- [x] 1.2 Add debug logging around the requested/normalized `interfaceType`, the DIAL Core request URL, and the local post-filter item counts (kept as ongoing operational debug logging, not removed after diagnosis).

## 2. Backend: exclude toolsets from deployments listing

- [x] 2.1 In `mapToDeploymentItem`/`listDeployments`, filter out `DeploymentItemType.Toolset`-typed items from `allItems` immediately after mapping, before caching.
- [x] 2.2 Simplify the ownership/`isInstalled` enrichment block to only handle the `APPLICATION` resource-sharing scope (drop the now-unreachable `TOOL_SET`-scoped `getSharedResourceUrlSets` call, `toolsetsSet`, and `toolsetUrlSets`); narrow `getSharedResources`/`getSharedResourceUrlSets` to no longer take a `resourceType` parameter.
- [x] 2.3 Update `apps/chat-api/src/deployments/listing/tests/deployments-listing.service.spec.ts`: remove or rewrite the tests that assert toolset pass-through (`maps model, application, and toolset correctly`, `sets isInstalled=true for installed toolset`, `leaves applicationFolder absent for toolset deployments`, the `TOOL_SET`-scoped `sharedWithMe` tests, and the `getSharedResources` call-count assertion expecting 2 calls) so they instead assert toolsets are absent from `result.deployments` and only one `getSharedResources` call (`APPLICATION`) is made.
- [x] 2.4 Run `npm exec nx test chat-api` and confirm all tests pass with zero failures.

## 3. Frontend: widen the interface filter

- [x] 3.1 In `apps/chat/src/context/DeploymentsContext.tsx`, change the initial `loadDeployments` call and `refetchDeployments` to request `[ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp]` instead of `[ListDeploymentsInterfaceTypeEnum.Chat]` only.
- [x] 3.2 Update `openspec/specs/deployments-context/spec.md`-equivalent expectations are covered by this change's delta spec — no additional code task, confirmed via `openspec/changes/deployments-mcp-interface-filter/specs/deployments-context/spec.md`.

## 4. Frontend: gate "Use in chat" on the `chat` interface

- [x] 4.1 Add a `supportsChat?: boolean` field to `CatalogItem` (`libs/catalog/src/models/catalog-item.ts`), following the existing `supportsMcp` pattern, documented per `libs.md` JSDoc rules. (Design updated from the original `interfaces: string[]` plan to match this established codebase convention — see `design.md` decision 3.)
- [x] 4.2 Populate `supportsChat` in `mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) as `deployment.interfaces == null || deployment.interfaces.includes('chat')`; add unit tests in `map-deployment-to-catalog-item.spec.ts`.
- [x] 4.3 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, extend `isPrimaryActionVisible` to require `item.supportsChat !== false` in addition to the existing `Model`/`Agent` type check.
- [x] 4.4 Add component tests for `CatalogView` covering: MCP-only Application does not show "Use in chat"; Application supporting both `chat` and `mcp` still shows it; existing Toolset-hides-button and Model/Application-shows-button tests still pass.

## 5. Cleanup

- [x] 5.1 Fix the stale Vite alias in `apps/chat/vite.config.mts` (`@epam/chat-api-client` → `@epam/ai-dial-chat-api-client`), found while debugging this change.
- [x] 5.2 Confirm no leftover redundant toolset-filtering code remains in `apps/chat/src/server-api/deployments.api.ts` or `apps/chat/src/components/CatalogView/CatalogView.tsx` (both were tried and reverted once the backend-side exclusion was settled on — verify current state matches design decision #2). Found and removed a leftover frontend filter in `deployments.api.ts` that had not been reverted.

## 6. Verification

- [x] 6.1 `npm exec nx lint chat-api` and `npm exec nx lint chat` — zero errors.
- [x] 6.2 `npm exec nx typecheck chat-api` and `npm exec nx typecheck chat` — no new errors introduced by this change (pre-existing `TS6305` stale-dist-cache errors in unrelated test files are a pre-existing baseline issue, not caused by this change).
- [x] 6.3 `npm exec nx test chat-api` and `npm exec nx test chat` — all green (one unrelated flaky timeout in `conversation.controller.integration.spec.ts` on first run, passed clean on re-run; confirmed unrelated to this change's files).
- [x] 6.4 Manual smoke test: with the dev server running, confirm the chat-api debug log shows `DIAL Core request URL: .../v1/deployments?interface_type=chat,mcp`, confirm MCP-capable applications appear in the deployment/model picker, confirm toolsets do not appear twice (once via picker/catalog "Applications", once via catalog "Toolsets"), and confirm the "Use in chat" button is absent for an MCP-only application's catalog details panel.

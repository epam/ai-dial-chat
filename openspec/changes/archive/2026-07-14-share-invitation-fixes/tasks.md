## 1. Diagnose the 502 on accept-invitation

- [x] 1.1 Add debug logging to `mapDialHttpStatus` (DIAL Core error body) and `ShareService.createShareLink`/`acceptInvitation` (request payload, response status/body) to observe real DIAL Core traffic
- [x] 1.2 Confirm via logs that `GET /v1/invitations/{id}?accept=true` returns `status=200` with an empty body (`data: undefined`, no `error`), contradicting the SDK's declared `Invitation` response schema

## 2. Fix `acceptInvitation` to peek before accepting

- [x] 2.1 Split `ShareService.acceptInvitation` into a non-accepting peek call (resolves `itemId` from `resources[0].url`) followed by a separate `accept=true` call (grant only, response body unused)
- [x] 2.2 Map errors from each call with a distinct context string (`'peek invitation'` / `'accept invitation'`)
- [x] 2.3 Update `share.service.spec.ts` to assert both calls (`toHaveBeenNthCalledWith`) instead of a single accepting call

## 3. Invalidate deployments/toolsets caches on accept

- [x] 3.1 Add `DeploymentsService.invalidateListCache(userSub)` (deletes the base + per-interface-filter cache keys) and export `DeploymentsService` from `DeploymentsModule`
- [x] 3.2 Add `ToolsetsService.invalidateListCache(userSub)` (thin wrapper over the existing private `invalidateCaches`)
- [x] 3.3 Inject `DeploymentsService`/`ToolsetsService` into `ShareService`; import `DeploymentsModule`/`ToolsetsModule` in `ShareModule`
- [x] 3.4 Call both invalidations (`Promise.all`) after a successful accept; thread `userSub` from `ShareController.acceptInvitation` (session `sub`) through `ShareService.acceptInvitation`
- [x] 3.5 Update `share.service.spec.ts`/`share.controller.spec.ts` for the new `userSub` parameter and invalidation calls

## 4. Frontend: refetch lists and open the details panel reliably

- [x] 4.1 `SharedInvitationPage` awaits `Promise.all([refetchDeployments(), refetchToolsets()])` after a successful accept, before `navigate(...)`
- [x] 4.2 Update `SharedInvitation.spec.tsx`/`ConversationSharedInvitation.spec.tsx` to mock `useDeployments()`
- [x] 4.3 Add `deploymentsRequestIdRef`/`toolsetsRequestIdRef` monotonic counters in `DeploymentsContext`; guard `loadDeployments`, `refetchDeployments`, `refetchToolsets` so a stale response can never overwrite a fresher one
- [x] 4.4 Add regression tests in `DeploymentsContext.spec.tsx` simulating a slow initial load resolving after a faster explicit refetch

## 5. Surface WRITE-permission share grants as `canEdit`

- [x] 5.1 Add `canEdit?: boolean` to `DeploymentItemDto` (`deployment-item.dto.ts`) and `can_edit?: boolean` to `DialToolsetDto` (`openapi-response.dto.ts`)
- [x] 5.2 Implement `DeploymentsService.getWritableApplicationUrls` (`getSharedResources({ resourceTypes: ['APPLICATION'], with: 'me' })`) and merge into `listDeployments`'s per-item `canEdit`
- [x] 5.3 Implement `ToolsetsService.getWritableToolsetUrls` (`resourceTypes: ['TOOL_SET']`) and merge into `listToolsets`/`getToolset`'s per-item `can_edit`
- [x] 5.4 Regenerate the OpenAPI client (`npm run openapi`, `npm run openapi:check`) and build/lint `chat-api-client`
- [x] 5.5 Update `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) so `isEditable` is `(isMy OR canEdit) AND <existing schema-match condition for apps>`
- [x] 5.6 Add/extend tests: `deployments.service.spec.ts`, `toolsets.service.spec.ts`, `map-deployment-to-catalog-item.spec.ts`

## 6. Verification

- [x] 6.1 `npm exec nx test chat-api` (share, deployments, toolsets suites) — all passing
- [x] 6.2 `npm exec nx lint chat-api` / `npm exec nx build chat-api` — clean
- [x] 6.3 `npm exec nx test chat` (SharedInvitation, ConversationSharedInvitation, DeploymentsContext, map-deployment-to-catalog-item) — all passing
- [x] 6.4 `npm exec nx lint chat` (includes typecheck) — clean
- [x] 6.5 `npm exec nx build chat-api-client` / `npm exec nx lint chat-api-client` — clean

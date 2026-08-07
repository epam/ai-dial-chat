## 1. Backend enrichment

- [x] 1.1 Factor `listDeployments`'s ownership-computation into `getSharedApplicationUrlSets` and `computeOwnershipFlags` private helpers on `DeploymentsService`.
- [x] 1.2 Add a required `bucket` parameter to `resolveDeploymentItem` and apply `computeOwnershipFlags` to its result.
- [x] 1.3 Thread `bucket` through `ShareService.acceptInvitation` and `resolveSharedItemSummary` into `resolveDeploymentItem`.
- [x] 1.4 Pass `req.user.bucket` from `ShareController.acceptInvitation` into `ShareService.acceptInvitation`.

## 2. Tests

- [x] 2.1 Update `deployments.service.spec.ts` call sites for the new `resolveDeploymentItem` signature.
- [x] 2.2 Add `resolveDeploymentItem` tests covering `sharedWithMe: true` (shared item) and `isMy: true` (own item) cases.
- [x] 2.3 Update `share.service.spec.ts` and `share.controller.spec.ts` for the new `bucket` parameter/argument.

## 3. Verification

- [x] 3.1 `npm exec nx test chat-api`
- [x] 3.2 `npm exec nx lint chat-api`
- [x] 3.3 `npm exec nx build chat-api`

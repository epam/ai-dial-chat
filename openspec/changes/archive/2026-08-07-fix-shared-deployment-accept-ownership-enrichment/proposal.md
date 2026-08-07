## Why

Issue #7962 (Quick App shared-details bucket-id leak) was partially fixed by having `resolveDeploymentFolder` render a "Shared with me" label instead of the raw owner bucket path, driven by `DeploymentItemDto.sharedWithMe`. QA re-tested and found the raw bucket ID still shows immediately after a user accepts/opens a shared deployment, until a manual page refresh. `resolveDeploymentItem` — the single-item lookup `ShareService.acceptInvitation` uses to return the just-accepted item without waiting for a bulk list refresh — never computed `isMy`/`canEdit`/`sharedWithMe` at all, so the accept response always carried those fields as `undefined` and the UI fell back to the raw bucket path until the next full `listDeployments` call recomputed them correctly.

## What Changes

- `DeploymentsService.resolveDeploymentItem` now accepts the caller's `bucket` and enriches its result with `isMy`/`canEdit`/`sharedWithMe`, computed by the same logic `listDeployments` uses (factored into shared private helpers `getSharedApplicationUrlSets`/`computeOwnershipFlags`), instead of leaving those fields `undefined`.
- `ShareService.acceptInvitation` and its private `resolveSharedItemSummary` now thread `bucket` through to `resolveDeploymentItem`, sourced from `req.user.bucket` (`SessionUser`) in `ShareController.acceptInvitation`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `catalog-shared-with-me`: the existing requirement that `DeploymentsService` resolve `isMy`/`canEdit`/`sharedWithMe` for deployments is extended to cover the single-item `resolveDeploymentItem` path (used right after accepting a share invitation), not just the bulk `listDeployments` path — both SHALL produce the same ownership flags for the same item, reusing the same enrichment logic.

## Impact

- `apps/chat-api/src/deployments/deployments.service.ts` — `resolveDeploymentItem` signature change (new required `bucket` param); enrichment logic factored into `getSharedApplicationUrlSets`/`computeOwnershipFlags`, reused by `listDeployments`.
- `apps/chat-api/src/share/share.service.ts` — `acceptInvitation`/`resolveSharedItemSummary` gain a `bucket` parameter.
- `apps/chat-api/src/share/share.controller.ts` — passes `req.user.bucket` through to `acceptInvitation`.
- Fix is already implemented and covered by unit tests in `deployments.service.spec.ts`, `share.service.spec.ts`, and `share.controller.spec.ts`; this change documents the corrected behavior in the `catalog-shared-with-me` spec.

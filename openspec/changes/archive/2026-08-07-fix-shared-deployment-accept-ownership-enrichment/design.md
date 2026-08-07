## Context

`DeploymentsService.listDeployments` already computes `isMy`/`canEdit`/`sharedWithMe` per item from a single `getSharedResources` call. `resolveDeploymentItem`, used only by `ShareService.acceptInvitation` to return a just-accepted item's summary without waiting for the bulk list, never applied that enrichment — the accept response always had those three fields `undefined`, so the frontend's `resolveDeploymentFolder` fell back to showing the raw owner bucket path until the next full `listDeployments` call. This is a small, single-service bug fix (no new endpoints, no data model change); implementation is already done and tested.

## Goals / Non-Goals

**Goals:**
- `resolveDeploymentItem` reports the same `isMy`/`canEdit`/`sharedWithMe` a subsequent `listDeployments` call would for the same item.
- No duplicated ownership-computation logic between the bulk and single-item paths.

**Non-Goals:**
- No change to the toolset accept path (`ToolsetsService.resolveToolsetItem` already enriches ownership via `getToolset`).
- No change to caching strategy, endpoint shapes, or DTOs.

## Decisions

- **Factor enrichment into `getSharedApplicationUrlSets` + `computeOwnershipFlags` private helpers on `DeploymentsService`**, reused by both `listDeployments` and `resolveDeploymentItem`, rather than duplicating the URL-set-building and flag logic in `resolveDeploymentItem`. Alternative considered: have `resolveDeploymentItem` call `listDeployments` and pick the one item out — rejected because it re-issues the full upstream list call (defeats the purpose of the single-item resolver, which exists specifically to avoid depending on the bulk list finding the just-granted share, per its existing docstring).
- **Thread `bucket` as an explicit parameter** through `resolveDeploymentItem` → `resolveSharedItemSummary` → `acceptInvitation`, sourced from `req.user.bucket` (`SessionUser`) in the controller — consistent with how `listDeployments` already receives `bucket` from the controller layer, and avoids adding a second upstream `getUserBucket` call (unlike `ToolsetsService.resolveToolsetItem`, which does need one because toolsets' `getToolset` didn't already have a bucket-accepting single-item path).

## Risks / Trade-offs

- [`resolveDeploymentItem` now issues one extra `getSharedResources` call it previously skipped] → Acceptable: this only runs on the low-frequency accept-invitation path, and mirrors the same call `listDeployments` already makes per request.

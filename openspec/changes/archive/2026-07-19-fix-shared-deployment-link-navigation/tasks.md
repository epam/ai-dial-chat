## 1. Lib fix: `libs/catalog`

- [x] 1.1 In `libs/catalog/src/components/Catalog/Catalog.tsx`, update the `initialDetailsItemId`-applied effect so that when `initialDetailsItemId` is falsy, it resets `appliedInitialDetailsItemIdRef.current` to `null` before returning (instead of just returning).
- [x] 1.2 Add/update a test in `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx` covering: the panel opens for `initialDetailsItemId`, then closes to a falsy value, then reopens for the same id — asserting `onFetchDetails`/open-details is called twice.
- [x] 1.3 Add/confirm a test asserting the existing protection still holds: a re-render with the same non-empty `initialDetailsItemId` (e.g. triggered by an `items` array identity change) does not call open-details a second time.

## 2. App fix: `apps/chat` CatalogView

- [x] 2.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, add a `useEffect` keyed on the raw `itemId` search param value that, when the param is present, clears it via `setSearchParams` (from `useSearchParams`) with `{ replace: true }`, preserving any other existing search params.
- [x] 2.2 Confirm `initialDetailsItemId` passed to `Catalog` is still computed from the param's value as read during the render that triggers the clear (no dropped first-open).
- [x] 2.3 Add/update a test in `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` (or equivalent) asserting that after mounting with `?itemId=<id>` in the URL, the param is removed from the URL once `Catalog` has received it.

## 3. Verification of the stale-ref/URL-clearing fix

- [x] 3.1 Run `npm exec nx test catalog` and `npm exec nx test chat` (or the affected equivalents) and confirm the new/updated tests pass.
- [x] 3.2 Run `npm exec nx lint catalog` and `npm exec nx lint chat`.
- [x] 3.3 Manually verified in the running app: `itemId` does appear in the address bar after redirect, confirming the stale-ref/URL-clearing fix is not itself broken. **However this alone did not open the panel** — the repro is a full-page navigation, not an in-tab SPA transition, so it doesn't exercise the ref-guard bug at all. Root cause of the still-open failure is tracked in sections 4-6 below (item missing from the deployments/toolsets list).
- [x] 3.4 Manually verified no regression: opening a shared-deployment invitation link in a brand-new tab opens the details panel as expected, including for the already-owned-resource case fixed in task 8.

## 4. Backend: extract single-item resolution

- [x] 4.1 In `apps/chat-api/src/deployments/deployments.service.ts`, extract a new public `resolveDeploymentItem(id: string, accessToken: string): Promise<DeploymentItemDto | null>` that reuses `fetchDeploymentDetails`'s prefix-dispatch/ambiguous-fallback logic (`toolsets/` / `applications/` / try model → application → toolset) but maps the resolved raw DIAL Core response through the existing `mapToDeploymentItem` instead of building a `DeploymentDetailsDto`. Returns `null` (not a thrown exception) on a 404/no-match from every branch of the fallback chain.
- [x] 4.2 In `apps/chat-api/src/toolsets/toolsets.service.ts`, add a new `resolveToolsetItem(id: string, accessToken: string): Promise<DialToolsetDto | null>` that calls the toolset SDK getter for a single id and returns `null` on a 404/no-match.
- [x] 4.3 Add unit tests for both new methods: prefixed ids dispatch directly to the right resolver; ambiguous ids fall through model → application → toolset; a full miss across all branches resolves `null` rather than throwing; an upstream 5xx/timeout still propagates as an exception (only a resolved "not found" maps to `null`).

## 5. Backend: return the resolved item from acceptInvitation

- [x] 5.1 Add `sharedDeployment?: DeploymentItemDto` and `sharedToolset?: DialToolsetDto` (each `@ApiPropertyOptional`) to `AcceptInvitationResponseDto` (`apps/chat-api/src/share/dto/accept-invitation-response.dto.ts`).
- [x] 5.2 In `ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`), after the existing cache-invalidation step, call `resolveToolsetItem` for a `toolsets/`-prefixed `itemId` or `resolveDeploymentItem` otherwise, and set the corresponding response field. Wrap the resolution so any thrown error is caught and logged (not rethrown) — the accept call must still succeed with `itemId` set even if resolution fails.
- [x] 5.3 Add/update tests in `apps/chat-api/src/share/tests/share.service.spec.ts` covering: toolset id → `sharedToolset` populated; application/model id → `sharedDeployment` populated; resolution throwing/returning null → response still 200 with `itemId` set and both fields omitted.
- [x] 5.4 Run `npm run openapi` and `npm run openapi:check`; rebuild `chat-api-client` (per AGENTS.md's OpenAPI workflow) so the new optional fields are available to the frontend.

## 6. Frontend: merge the resolved item before navigating

- [x] 6.1 In `apps/chat/src/context/DeploymentsContext.tsx`, add a `mergeSharedItem(item: DeploymentItemDto | DialToolsetDto)` method to the context value that upserts into `rawDeployments` or `toolsets` (by shape/discriminator) via the existing setters, without touching `deploymentsRequestIdRef`/`toolsetsRequestIdRef` or issuing any request.
- [x] 6.2 In `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`, after a successful `acceptInvitation`, call `mergeSharedItem` with `sharedDeployment`/`sharedToolset` (whichever is present) before `refetchDeployments()`/`refetchToolsets()` and before `navigate(...)`. When neither field is present, proceed exactly as today.
- [x] 6.3 Add/update tests: `DeploymentsContext` unit tests for `mergeSharedItem` (new item added, existing item replaced, no request issued, doesn't disturb an in-flight refetch's request-id check); `SharedInvitationPage` tests for both the merge-then-navigate path and the fallback-to-refetch-only path.
- [x] 6.4 **Fix found during manual testing:** 6.2's original ordering (merge, then refetch) let the refetch — a full `setToolsets`/`setRawDeployments` replace, not a merge — silently overwrite the just-merged item whenever DIAL Core's bulk list hadn't propagated the grant yet, i.e. exactly the case `mergeSharedItem` exists to cover. Reordered `SharedInvitationPage` to call `refetchDeployments()`/`refetchToolsets()` first, then `mergeSharedItem`, then `navigate(...)`, so the backend-resolved item always wins over a stale refetch. Updated the delta spec's "Frontend refetches deployment/toolset lists..." requirement and added a covering scenario; existing `SharedInvitationPage` tests (which don't assert call order) still pass unchanged.

## 8. Fix found during manual testing: accepting your own share link

- [x] 8.1 Reproduced: opening a share link for a resource the user already owns (or an already-accepted link) makes DIAL Core's accepting call (`getInvitation(id, { accept: true })`) return `400` with a body like `"Resource <id> already belong to you"`. Before this fix, `acceptInvitation` mapped that straight to `BadRequestException`, so the frontend showed a generic error notification and navigated to the error fallback route instead of opening the resource's details panel.
- [x] 8.2 In `ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`), added an `isAlreadyOwnedError` substring check (case-insensitive `"already belong"`) and skip the `mapDialHttpStatus` throw for a `400` accept response matching it — proceeding with cache invalidation, summary resolution, and a normal `{ itemId, ... }` return using the `itemId` already resolved from the peek call.
- [x] 8.3 Added tests in `apps/chat-api/src/share/tests/share.service.spec.ts`: a `400` "already belong to you" accept response resolves successfully with `itemId` set; a `400` accept response with unrelated error text still throws `BadRequestException`.
- [x] 8.4 Updated the delta spec's "Accepting an invitation peeks the shared resource before accepting it" requirement (now also a `MODIFIED Requirements` entry) with the already-owned carve-out and two new scenarios.
- [x] 8.5 Ran `npm exec nx test chat-api -- share.service` (24 tests pass) and `npm exec nx lint chat-api`.

## 7. Final verification

- [x] 7.1 Run `npm exec nx test chat-api`, `npm exec nx test chat`, `npm exec nx test catalog` and confirm all pass.
- [x] 7.2 Run `npm exec nx lint chat-api`, `npm exec nx lint chat`, `npm exec nx lint catalog`.
- [x] 7.3 Manually verify against a running instance: accept a fresh shared-deployment invitation via full-page navigation to `/catalog/shared/:invitationId` and confirm the details panel opens on the very first redirect (the originally-reported #7860 repro).
- [x] 7.4 Re-run task 3.3's repeat-of-the-same-link scenario and 3.4's new-tab scenario to confirm no regression from the merge change.

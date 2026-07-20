## MODIFIED Requirements

### Requirement: Accepting an invitation peeks the shared resource before accepting it

`ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) SHALL resolve the shared resource's `itemId` from a **peek** call to DIAL Core's `getInvitation(invitationId)` **without** the `accept` query parameter, before issuing a **separate** call with `accept=true` to perform the actual grant. The accepting call's response body SHALL NOT be relied upon for `itemId` resolution — DIAL Core returns an empty body (`Content-Length: 0`, no `error`) for the accepting call once the grant succeeds, even though its documented schema for `GET /v1/invitations/{id}` claims a full `Invitation` payload on any `200`.

Both calls SHALL forward the caller's DIAL Core access token via `Authorization: Bearer <token>`. An `error` response or thrown network/timeout error from either call SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` machinery with a call-specific context string (`'peek invitation'` / `'accept invitation'`) for diagnosability — **except** when the accepting call returns `400` with a body indicating the caller already owns the resource (DIAL Core's own wording: a string containing `"already belong"`, e.g. `"Resource <id> already belong to you"`). DIAL Core returns this when the invited user opens their own share link, or re-opens a link they already accepted; the resource is already accessible to them, so `acceptInvitation` SHALL treat this specific case as a successful accept rather than throwing — proceeding to cache invalidation and summary resolution exactly as it does for a genuine `200`, using the `itemId` already resolved from the peek call. If the peek call succeeds but returns no `resources[0].url`, `acceptInvitation` SHALL throw `BadGatewayException('DIAL Core returned an invitation with no shared resource')` without attempting the accepting call.

#### Scenario: Peek call resolves itemId, accept call grants access

- **WHEN** `acceptInvitation(accessToken, invitationId, userSub)` is called for a valid, unexpired invitation
- **THEN** DIAL Core's `getInvitation` is called first without `accept`, and its `resources[0].url` becomes the returned `itemId`
- **AND** DIAL Core's `getInvitation` is called a second time with `accept=true`
- **AND** the accepting call's response body (or absence of one) does not affect the returned `itemId`

#### Scenario: Empty-bodied accept response no longer produces a 502

- **WHEN** the accepting call (`accept=true`) returns `200` with an empty body
- **THEN** `acceptInvitation` still resolves successfully with the `itemId` obtained from the earlier peek call

#### Scenario: Invitation with no shared resource fails at the peek step

- **WHEN** the peek call succeeds but its `resources` array is empty
- **THEN** `acceptInvitation` throws `BadGatewayException` and the accepting call is never issued

#### Scenario: Upstream error on either call maps to the correct HTTP status

- **WHEN** either the peek or the accept call returns a DIAL Core error status (e.g. 404) other than the already-owned `400` case
- **THEN** the corresponding Nest exception is thrown (e.g. `NotFoundException` for 404), tagged with which call failed in the log message

#### Scenario: Opening your own share link (or re-accepting an already-accepted one) succeeds instead of erroring

- **WHEN** the accepting call returns `400` with an error body containing `"already belong"` (case-insensitive)
- **THEN** `acceptInvitation` does not throw, logs that the resource is already owned by the user, and returns normally with `itemId` (and, when resolvable, `sharedDeployment`/`sharedToolset`) exactly as it would for a fresh accept — so the frontend still opens the item's details panel instead of showing an error notification

#### Scenario: A different 400 accept error still fails the call

- **WHEN** the accepting call returns `400` with an error body that does not indicate the resource is already owned (e.g. an expired invitation)
- **THEN** `acceptInvitation` throws `BadRequestException`, matching pre-existing behavior for other `400` responses

### Requirement: Frontend refetches deployment/toolset lists before navigating past an accepted invitation

`SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) SHALL call `useDeployments()`'s `refetchDeployments()` and `refetchToolsets()` (via `Promise.all`, awaited) after a successful `acceptInvitation` and before calling `navigate(getTargetRoute(itemId), { replace: true })`. These calls remain a consistency backstop; they are no longer the mechanism the details panel depends on to find the newly-shared item (see "Accepting an invitation resolves and returns the shared item's summary" below).

`SharedInvitationPage` SHALL call `useDeployments()`'s `mergeSharedItem(item)` with the `sharedDeployment`/`sharedToolset` value from `acceptInvitation`'s response, **after** the `refetchDeployments()`/`refetchToolsets()` call above has resolved and **before** calling `navigate(...)`, whenever that field is present. This order is required, not incidental: `refetchDeployments`/`refetchToolsets` fully replace `DeploymentsContext`'s `rawDeployments`/`toolsets` arrays with whatever DIAL Core's bulk list returns, so merging before (or in parallel with) the refetch lets a stale bulk-list response — one that has not yet propagated the just-granted share — silently overwrite the merged item and remove it again. Running the merge after the refetch guarantees the backend-resolved item always wins. When neither field is present (the backend could not resolve the item, e.g. an upstream propagation gap — see the new requirement below), `SharedInvitationPage` SHALL still proceed with the existing refetch-then-navigate behavior unchanged.

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL treat the `itemId` search param (`CatalogQuery.ItemId`) it reads into `initialDetailsItemId` as a one-shot signal: after reading a non-empty value for a render, it SHALL clear that param from the URL via `setSearchParams` with `{ replace: true }`, so the param does not linger in the address bar once consumed.

`Catalog`'s (`libs/catalog/src/components/Catalog/Catalog.tsx`) `initialDetailsItemId`-applied guard (`appliedInitialDetailsItemIdRef`) SHALL reset to `null` whenever the incoming `initialDetailsItemId` prop is falsy, so that a later non-empty value — including a repeat of an id that was already applied earlier in the same component's lifetime — is treated as a fresh open request rather than being silently suppressed.

#### Scenario: Catalog details panel opens for the newly shared item on a fresh full-page navigation

- **WHEN** a user accepts a share invitation for an application or toolset via a full-page navigation to `/catalog/shared/:invitationId`, and `acceptInvitation`'s response includes a resolved `sharedDeployment`/`sharedToolset`
- **THEN** `SharedInvitationPage` merges that item into `DeploymentsContext` via `mergeSharedItem` before navigating to `${ROUTES.Catalog}?itemId=<id>`, so `DeploymentsContext`'s `items`/`toolsets` already include the shared resource by the time `CatalogView` mounts — independent of whether `GET /api/v1/deployments`/`GET /api/v1/toolsets` themselves reflect the grant yet — and `Catalog`'s `initialDetailsItemId` effect finds a match and opens the details panel

#### Scenario: Merge survives a refetch response that still lacks the newly-shared item

- **WHEN** `refetchDeployments()`/`refetchToolsets()` resolves with a bulk list that does not yet include the just-accepted item (DIAL Core has not propagated the grant yet), and `acceptInvitation`'s response included a resolved `sharedDeployment`/`sharedToolset`
- **THEN** `mergeSharedItem` still runs, after the refetch, and the shared item is present in `DeploymentsContext`'s `items`/`toolsets` — the stale refetch result does not silently remove it

#### Scenario: Falls back to refetch-only behavior when the backend can't resolve the item

- **WHEN** `acceptInvitation`'s response has neither `sharedDeployment` nor `sharedToolset` set
- **THEN** `SharedInvitationPage` does not call `mergeSharedItem` and proceeds exactly as before: `refetchDeployments()`/`refetchToolsets()` then `navigate(...)`

#### Scenario: itemId query param is cleared after being consumed

- **WHEN** `CatalogView` reads a non-empty `itemId` param and passes it to `Catalog` as `initialDetailsItemId`
- **THEN** `CatalogView` removes `itemId` from the URL's search params via a replace navigation, so the address bar no longer shows `?itemId=<id>` once the details panel has picked it up

#### Scenario: Details panel reopens for a deployment already viewed earlier in the same tab

- **WHEN** a user accepts a second share invitation, within the same open tab, for a deployment whose details were already opened earlier in that tab's session (e.g. the same shared link opened twice, or a repeat share of the same item)
- **THEN** the details panel opens again for that deployment — the earlier open does not permanently suppress a later one

#### Scenario: Background refetch of the same open item does not reopen the panel

- **WHEN** `initialDetailsItemId` stays set to the same id across a re-render caused only by an unrelated `items`/`toolsets` background refetch (no new navigation occurred)
- **THEN** `Catalog`'s guard still prevents a duplicate `handleOpenDetails` call for that id, matching existing behavior

### Requirement: Accepting an invitation resolves and returns the shared item's summary

`ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) SHALL, after successfully accepting the invitation and invalidating the list caches, resolve the shared `itemId`'s type and summary using the same prefix convention already used by `DeploymentsService.getDeploymentDetails` (`toolsets/` prefix → toolset; `applications/` prefix → application; otherwise ambiguous — try `getModel` → `getApplication` → `getToolset` in turn, falling through to the next on a 404).

For a `toolsets/`-prefixed id, `ShareService` SHALL call a new `ToolsetsService.resolveToolsetItem(id, accessToken): Promise<DialToolsetDto | null>` and set `AcceptInvitationResponseDto.sharedToolset` to its result. For every other id, `ShareService` SHALL call a new `DeploymentsService.resolveDeploymentItem(id, accessToken): Promise<DeploymentItemDto | null>` (extracted from, and reusing, `fetchDeploymentDetails`'s existing prefix-dispatch/ambiguous-fallback logic, mapped through the existing `mapToDeploymentItem`) and set `AcceptInvitationResponseDto.sharedDeployment` to its result.

`AcceptInvitationResponseDto` (`apps/chat-api/src/share/dto/accept-invitation-response.dto.ts`) SHALL gain two new optional fields: `sharedDeployment?: DeploymentItemDto` and `sharedToolset?: DialToolsetDto`, each documented with `@ApiPropertyOptional`. The existing required `itemId` field is unchanged.

This resolution SHALL be best-effort: if the underlying DIAL Core call(s) fail, time out, or return no match, `resolveDeploymentItem`/`resolveToolsetItem` SHALL resolve `null` rather than throwing, and `acceptInvitation` SHALL still respond 200 with `itemId` set and both `sharedDeployment`/`sharedToolset` omitted — a resolution failure here MUST NOT fail the whole accept-invitation call, since the invitation was already successfully accepted upstream.

This change requires regenerating the OpenAPI spec (`npm run openapi`, `npm run openapi:check`) and rebuilding `chat-api-client` so the new optional response fields are available to the frontend.

#### Scenario: Accepted toolset invitation returns the toolset summary

- **WHEN** `acceptInvitation` succeeds for an invitation whose `itemId` starts with `toolsets/`
- **THEN** the response includes `sharedToolset` populated from `ToolsetsService.resolveToolsetItem`, and `sharedDeployment` is omitted

#### Scenario: Accepted application/model invitation returns the deployment summary

- **WHEN** `acceptInvitation` succeeds for an invitation whose `itemId` starts with `applications/`, or is an unprefixed model/application id
- **THEN** the response includes `sharedDeployment` populated from `DeploymentsService.resolveDeploymentItem`, and `sharedToolset` is omitted

#### Scenario: Resolution failure does not fail the accept call

- **WHEN** the underlying DIAL Core call(s) used to resolve the item's summary fail or return no match
- **THEN** `acceptInvitation` still responds 200 with `itemId` set, and both `sharedDeployment` and `sharedToolset` are omitted from the response

### Requirement: DeploymentsContext exposes a synchronous merge for a freshly-shared item

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) SHALL expose a new `mergeSharedItem(item: DeploymentItemDto | DialToolsetDto): void` method on its context value. Calling it with a `DeploymentItemDto` SHALL upsert that item into `rawDeployments` (replacing any existing entry with the same `id`, or prepending a new entry) via the existing `setRawDeployments` setter. Calling it with a `DialToolsetDto` SHALL upsert into `toolsets` the same way via `setToolsets`. `mergeSharedItem` SHALL NOT issue any network request itself and SHALL NOT interact with `deploymentsRequestIdRef`/`toolsetsRequestIdRef` — it is a synchronous local-state write, independent of `refetchDeployments`/`refetchToolsets`.

#### Scenario: Merging a new deployment item makes it immediately visible

- **WHEN** `mergeSharedItem` is called with a `DeploymentItemDto` whose `id` is not already in `rawDeployments`
- **THEN** the item appears in `DeploymentsContext`'s `items` on the very next render, with no network request issued

#### Scenario: Merging replaces an existing entry with the same id

- **WHEN** `mergeSharedItem` is called with a `DeploymentItemDto`/`DialToolsetDto` whose `id` already exists in `rawDeployments`/`toolsets`
- **THEN** the existing entry is replaced by the merged one rather than duplicated

#### Scenario: Merge does not disturb in-flight refetch sequencing

- **WHEN** `mergeSharedItem` is called while a `refetchDeployments()`/`refetchToolsets()` call is in flight
- **THEN** the in-flight refetch's eventual result is still applied or discarded solely based on `deploymentsRequestIdRef`/`toolsetsRequestIdRef`, unaffected by the merge

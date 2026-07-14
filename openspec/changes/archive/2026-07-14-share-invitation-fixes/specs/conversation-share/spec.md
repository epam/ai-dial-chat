## ADDED Requirements

### Requirement: Accepting an invitation peeks the shared resource before accepting it

`ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) SHALL resolve the shared resource's `itemId` from a **peek** call to DIAL Core's `getInvitation(invitationId)` **without** the `accept` query parameter, before issuing a **separate** call with `accept=true` to perform the actual grant. The accepting call's response body SHALL NOT be relied upon for `itemId` resolution — DIAL Core returns an empty body (`Content-Length: 0`, no `error`) for the accepting call once the grant succeeds, even though its documented schema for `GET /v1/invitations/{id}` claims a full `Invitation` payload on any `200`.

Both calls SHALL forward the caller's DIAL Core access token via `Authorization: Bearer <token>`. An `error` response or thrown network/timeout error from either call SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` machinery with a call-specific context string (`'peek invitation'` / `'accept invitation'`) for diagnosability. If the peek call succeeds but returns no `resources[0].url`, `acceptInvitation` SHALL throw `BadGatewayException('DIAL Core returned an invitation with no shared resource')` without attempting the accepting call.

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

- **WHEN** either the peek or the accept call returns a DIAL Core error status (e.g. 404)
- **THEN** the corresponding Nest exception is thrown (e.g. `NotFoundException` for 404), tagged with which call failed in the log message

### Requirement: Accepting an invitation invalidates the user's deployments and toolsets list caches

After `acceptInvitation` resolves the shared `itemId` and successfully performs the accepting call, `ShareService` SHALL invalidate the accepting user's cached deployments list (`DeploymentsService.invalidateListCache(userSub)`) and cached toolsets list (`ToolsetsService.invalidateListCache(userSub)`) before returning. Both calls SHALL run concurrently (`Promise.all`). `ShareController.acceptInvitation` SHALL pass the session's `sub` (in addition to the existing access token and invitation id) so `ShareService` can key the invalidation per user.

Cache keys invalidated: `deployments:list:<userSub>` and `deployments:list:<userSub>:interface:<type>` for every non-`all` `DeploymentInterfaceType` (deployments, 30s TTL, normally invalidated only by this event or natural expiry); `toolsets:list:<userSub>` (toolsets, 30s TTL, same).

#### Scenario: Successful accept invalidates both list caches

- **WHEN** `acceptInvitation` completes successfully
- **THEN** `DeploymentsService.invalidateListCache` and `ToolsetsService.invalidateListCache` are both called with the accepting user's `sub`

#### Scenario: Cache invalidation runs before the response is returned

- **WHEN** the frontend calls `refetchDeployments()`/`refetchToolsets()` immediately after `acceptInvitation` resolves
- **THEN** the next `GET /api/v1/deployments` / `GET /api/v1/toolsets` request is a cache miss and reflects the newly shared resource

### Requirement: Frontend refetches deployment/toolset lists before navigating past an accepted invitation

`SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) SHALL call `useDeployments()`'s `refetchDeployments()` and `refetchToolsets()` (via `Promise.all`, awaited) after a successful `acceptInvitation` and before calling `navigate(getTargetRoute(itemId), { replace: true })`.

#### Scenario: Catalog details panel opens for the newly shared item

- **WHEN** a user accepts a share invitation for an application or toolset and is redirected to `${ROUTES.Catalog}?itemId=<id>`
- **THEN** `DeploymentsContext`'s `items`/`toolsets` already include the shared resource by the time `CatalogView` mounts, so `Catalog`'s `initialDetailsItemId` effect finds a match and opens the details panel

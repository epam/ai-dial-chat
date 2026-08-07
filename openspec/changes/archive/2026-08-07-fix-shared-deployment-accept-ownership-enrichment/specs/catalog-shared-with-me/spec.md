## MODIFIED Requirements

### Requirement: Deployments expose an unfiltered `sharedWithMe` flag

`DeploymentItemDto` (`apps/chat-api/src/deployments/`) SHALL include an optional `sharedWithMe?: boolean` field, `true` when the requesting user holds ANY DIAL Core share grant (`READ` or `WRITE`) on the application and the application is not owned by the user (`isMy === false`), `false` otherwise.

`DeploymentsService` SHALL resolve this from a single unfiltered `getSharedResources({ resourceTypes: ['APPLICATION'], with: 'me' })` call per request, factored into shared private helpers (`getSharedApplicationUrlSets` for the URL sets, `computeOwnershipFlags` for the per-item `isMy`/`canEdit`/`sharedWithMe` computation) reused by both `listDeployments` and the single-item `resolveDeploymentItem` — neither path SHALL issue two separate `getSharedResources` calls per request. `sharedWithMe` SHALL NOT be cached independently of this per-request resolution (the underlying deployments list is cached 30s per `deployments:list:<userSub>`; `sharedWithMe`, like `isMy`/`canEdit`, is recomputed on every response derived from that cache entry, and on every `resolveDeploymentItem` call).

`resolveDeploymentItem` SHALL accept the requesting user's `bucket` and apply the same `computeOwnershipFlags` enrichment as `listDeployments`, so a deployment resolved through it (e.g. right after `ShareService.acceptInvitation` accepts a share) reports the same `isMy`/`canEdit`/`sharedWithMe` values a subsequent `listDeployments` call would produce for the same item — the frontend's post-accept summary SHALL NOT depend on a page refresh to see the correct ownership flags.

A failure resolving shared resources SHALL degrade to `sharedWithMe: false` for every item in the response (never fail the whole deployments list, and never fail `resolveDeploymentItem`) and SHALL be logged at `warn` level.

`sharedWithMe` and `isMy` SHALL be mutually exclusive: when `isMy` is `true`, `sharedWithMe` SHALL be `false` regardless of any share grant returned by DIAL Core (a user cannot be sharing a resource with themself).

#### Scenario: Owned application never reports sharedWithMe

- **WHEN** an application's `id` bucket segment matches the requesting user's bucket (`isMy: true`)
- **THEN** `sharedWithMe` is `false`, even if DIAL Core's shared-resources lookup also returns a grant for that url

#### Scenario: READ-only shared application reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this application's url with `permissions: ['READ']`
- **THEN** `sharedWithMe` is `true`

#### Scenario: WRITE-shared application reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this application's url with `permissions` including `WRITE`
- **THEN** `sharedWithMe` is `true` (in addition to `canEdit: true`, unchanged from the existing `share-invitation-permissions` behavior)

#### Scenario: Public or organization application is neither owned nor shared

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup does not include this application's url at all (it is visible via public/organization visibility, not an individual share grant)
- **THEN** `sharedWithMe` is `false`

#### Scenario: Shared-resources lookup failure degrades gracefully

- **WHEN** DIAL Core's shared-resources lookup throws or errors
- **THEN** `sharedWithMe` falls back to `false` for every item in the response, a `warn`-level log is emitted, and the deployments list request still succeeds

#### Scenario: Single upstream call serves both canEdit and sharedWithMe

- **WHEN** `GET /api/v1/deployments` is served for a user with mixed owned/shared/public applications
- **THEN** exactly one `getSharedResources({ resourceTypes: ['APPLICATION'], with: 'me' })` call is made for the whole response, and both `canEdit` and `sharedWithMe` are derived from its result

#### Scenario: Just-accepted shared application resolves with correct ownership flags immediately

- **GIVEN** a user has just accepted a share invitation for an application owned by another bucket
- **WHEN** `ShareService.acceptInvitation` calls `resolveDeploymentItem` with the requesting user's `bucket` to build the accept response's `sharedDeployment`
- **THEN** the returned item has `isMy: false`, `sharedWithMe: true`, and `canEdit` matching the grant's permissions — without requiring a subsequent `listDeployments` call or a page refresh

#### Scenario: Just-accepted own application resolves as owned, not shared

- **GIVEN** a user accepts an invitation for an item already inside their own bucket (e.g. re-accepting ownership)
- **WHEN** `resolveDeploymentItem` resolves it with that user's `bucket`
- **THEN** the returned item has `isMy: true`, `canEdit: true`, and `sharedWithMe: false`

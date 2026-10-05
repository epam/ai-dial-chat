# deployments-is-my-flag Specification

## Purpose

The `isMy` boolean flag computed for deployments at the BFF layer.

## Requirements

### Requirement: `isMy` boolean flag computed at the BFF layer

The `DeploymentItemDto` SHALL include an optional `isMy: boolean` field indicating whether the deployment belongs to the currently authenticated user.

The backend SHALL:
- Add `isMy?: boolean` to `DeploymentItemDto` with `@ApiPropertyOptional({ description: 'True when the deployment owner matches the current session user (computed post-cache)' })`.
- Compute `isMy` **post-cache** in `listDeployments` (`apps/chat-api/src/deployments/listing/deployments-listing.service.ts`), in the same map pass as `isInstalled`, by spreading the result of the shared `computeItemOwnershipFlags(item.id, bucket, urlSets)` util (`apps/chat-api/src/common/utils/resource-ownership.ts`). That util also returns `canEdit` (`isMy` or the id is in the WRITE-permission shared-resource URL set) and `sharedWithMe` (not `isMy` and the id is in the shared-resource URL set).
- Use the `bucket` value from the authenticated session (`req.user.bucket` via `SessionUser`) as the identity comparator.
- Set `isMy = Boolean(bucket) && getOwnerBucketSegment(item.id) === bucket`, where the owner bucket segment is segment `[1]` of `item.id.split('/')` when segment `[0]` is `applications` or `toolsets`, and segment `[0]` otherwise (a prefix-less `{bucket}/{name}` id).
- Set `isMy = false` when the owner bucket segment differs from the bucket (a bucket appearing at any other position does not match) or when the session bucket is empty.
- Apply `isMy` to every item `GET /api/v1/deployments` returns (models and applications). `listDeployments` drops `DeploymentItemType.Toolset` items before caching, so the response carries no toolsets; toolset `isMy` is computed by `ToolsetsListingService` through the same `computeItemOwnershipFlags` util.
- NOT cache `isMy` — it must be re-evaluated per request using the current session identity.

**Rationale for id-based comparison**: DIAL Core's `owner` field is a human-readable display name (e.g. `"Test User"`), not a machine-comparable identifier. For user-created applications, the bucket is embedded in the deployment `id` as a path segment: `applications/{bucket}/{app-name}`. Comparing the owner bucket segment of the `id` with the session bucket reliably identifies ownership without depending on the `owner` string format.

Authorization: `isMy` is visible to authenticated users only (the endpoint already requires a valid session). No additional role check is required; the value is computed from data the user is already allowed to see.

#### Scenario: Session bucket appears in deployment id — `isMy` is true

- **WHEN** `GET /api/v1/deployments` is called with a session whose `bucket` is `"BUCKET_HASH"`
- **AND** DIAL Core returns a deployment with `id: "applications/BUCKET_HASH/my-app"`
- **THEN** the corresponding item in the response has `isMy: true`

#### Scenario: Session bucket does not appear in deployment id — `isMy` is false

- **WHEN** `GET /api/v1/deployments` is called with a session whose `bucket` is `"BUCKET_HASH"`
- **AND** DIAL Core returns a deployment with `id: "applications/OTHER_BUCKET/their-app"`
- **THEN** the corresponding item in the response has `isMy: false`

#### Scenario: Deployment id contains no path segments matching bucket — `isMy` is false

- **WHEN** DIAL Core returns a root-level model or system deployment whose `id` does not contain the session bucket as a segment
- **THEN** the corresponding item in the response has `isMy: false`

#### Scenario: Bucket outside the owner segment — `isMy` is false

- **WHEN** the session `bucket` is `"BUCKET_HASH"`
- **AND** DIAL Core returns a deployment with `id: "applications/OTHER_BUCKET/BUCKET_HASH"`
- **THEN** the corresponding item has `isMy: false`, because only segment `[1]` of an `applications/`-prefixed id is compared

#### Scenario: Empty session bucket — `isMy` is false

- **WHEN** the session `bucket` is an empty string
- **THEN** every item in the response has `isMy: false`

#### Scenario: Toolsets are not returned by the deployments listing

- **WHEN** DIAL Core's `/v1/deployments` payload includes toolset entries
- **THEN** `GET /api/v1/deployments` omits them, and toolset `isMy` is served by the toolsets listing instead

#### Scenario: `isMy` is re-evaluated per request and not read from cache

- **WHEN** the deployment list is served from the `deployments:list:<userSub>` cache entry
- **THEN** `isMy` is still computed fresh from the current session `bucket`, not from the cached DTO

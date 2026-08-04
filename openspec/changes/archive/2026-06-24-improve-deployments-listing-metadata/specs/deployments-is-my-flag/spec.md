## ADDED Requirements

### Requirement: `isMy` boolean flag computed at the BFF layer

The `DeploymentItemDto` SHALL include an optional `isMy: boolean` field indicating whether the deployment belongs to the currently authenticated user.

The backend SHALL:
- Add `isMy?: boolean` to `DeploymentItemDto` with `@ApiPropertyOptional({ description: 'True when the deployment owner matches the current session user' })`.
- Compute `isMy` **post-cache** in `listDeployments` (`apps/chat-api/src/deployments/deployments.service.ts`), in the same pass as `isInstalled`.
- Use the `bucket` value from the authenticated session (`req.user.bucket` via `SessionUser`) as the identity comparator.
- Set `isMy = item.id.split('/').includes(bucket)` — `true` when the session bucket appears as a path segment of the deployment `id`.
- Set `isMy = false` when the deployment `id` contains no segment matching the bucket.
- Apply `isMy` to all deployment types (model, application, toolset).
- NOT cache `isMy` — it must be re-evaluated per request using the current session identity.

**Rationale for id-based comparison**: DIAL Core's `owner` field is a human-readable display name (e.g. `"Test User"`), not a machine-comparable identifier. For user-created applications, the bucket is embedded in the deployment `id` as a path segment: `applications/{bucket}/{app-name}`. Checking `id.split('/').includes(bucket)` reliably identifies ownership without depending on the `owner` string format.

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

#### Scenario: `isMy` is re-evaluated per request and not read from cache

- **WHEN** the deployment list is served from the `deployments:list:<userSub>` cache entry
- **THEN** `isMy` is still computed fresh from the current session `bucket`, not from the cached DTO

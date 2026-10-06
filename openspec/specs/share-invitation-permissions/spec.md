# share-invitation-permissions Specification

## Purpose
TBD - created by archiving change share-invitation-fixes. Update Purpose after archive.
## Requirements
### Requirement: Shared applications expose WRITE-permission as `canEdit`

`GET /api/v1/deployments` responses SHALL include a `canEdit?: boolean` field on each `DeploymentItemDto` entry, computed as `isMy OR <the requesting user has a DIAL Core WRITE-permission share grant on this application's resource path>`.

`DeploymentsListingService.listDeployments` (`apps/chat-api/src/deployments/listing/deployments-listing.service.ts`) SHALL resolve write-permission grants by calling DIAL Core's `getSharedResources` with `resourceTypes: ['APPLICATION']` and `with: 'me'` on every request (not cached — the underlying list is cached for 30s per user, but permission grants are resolved fresh each time, matching the existing `isMy`/`isInstalled` enrichment pattern). The flags are computed by the shared `computeItemOwnershipFlags` / `splitResourcesByPermission` helpers in `apps/chat-api/src/common/utils/resource-ownership.ts`, which also set `sharedWithMe`. A failure resolving shared resources (an error response or a thrown error) SHALL degrade to `canEdit: isMy` (i.e. no shared write access) rather than failing the whole deployments list; the failure SHALL be logged at `warn` level.

Generated-client impact: `DeploymentItemDto.canEdit?: boolean` is an additive optional field on the existing `@epam/ai-dial-chat-api-client` model (no new operationId, no new endpoint).

#### Scenario: Owner sees canEdit=true regardless of share grants

- **WHEN** a deployment's `id` bucket segment matches the requesting user's bucket (`isMy: true`)
- **THEN** `canEdit` is `true`

#### Scenario: Shared application with WRITE permission is editable

- **WHEN** the requesting user is not the owner (`isMy: false`) but DIAL Core's shared-resources lookup returns this application's url with `permissions` including `WRITE`
- **THEN** `canEdit` is `true`

#### Scenario: Shared application with only READ permission is not editable

- **WHEN** the requesting user is not the owner and the shared-resources lookup returns this application's url with `permissions: ['READ']` only (no `WRITE`)
- **THEN** `canEdit` is `false`

#### Scenario: Shared-resources lookup failure degrades gracefully

- **WHEN** DIAL Core's shared-resources lookup throws or errors
- **THEN** `canEdit` falls back to `isMy` for every item in the response (the deployments list itself still succeeds)

### Requirement: Shared toolsets expose WRITE-permission as `canEdit`

`GET /api/v1/toolsets` (list) and `GET /api/v1/toolsets/:toolsetName` (single) responses SHALL include a `canEdit?: boolean` field on each `DialToolsetDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`), computed as `isMy OR <the requesting user has a DIAL Core WRITE-permission share grant on this toolset's resource path>`.

`ToolsetsListingService` (`apps/chat-api/src/toolsets/listing/toolsets-listing.service.ts`) SHALL resolve write-permission grants by calling DIAL Core's `getSharedResources` with `resourceTypes: ['TOOL_SET']` and `with: 'me'` on every list/get request (not cached, same rationale as `DeploymentsListingService`), using the same shared `resource-ownership` helpers. A failure resolving shared resources SHALL degrade to `canEdit: isMy` and SHALL be logged at `warn` level, without failing the toolset list/get request.

Generated-client impact: `DialToolsetDto.canEdit?: boolean` (the wire field is already camelCase `canEdit`) is an additive optional field (no new operationId, no new endpoint).

#### Scenario: Owner sees canEdit=true regardless of share grants

- **WHEN** a toolset's `id` bucket segment matches the requesting user's bucket (`isMy: true`)
- **THEN** `canEdit` is `true`

#### Scenario: Shared toolset with WRITE permission is editable

- **WHEN** the requesting user is not the owner (`isMy: false`) but DIAL Core's shared-resources lookup returns this toolset's url with `permissions` including `WRITE`
- **THEN** `canEdit` is `true`

#### Scenario: Shared toolset with only READ permission is not editable

- **WHEN** the requesting user is not the owner and the shared-resources lookup returns this toolset's url with `permissions: ['READ']` only
- **THEN** `canEdit` is `false`

### Requirement: Catalog Edit action reflects ownership OR write-permission share grant

`mapDeploymentToCatalogItem` and `mapToolsetToCatalogItem` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts` (wrapped by the app-level adapters of the same names in `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, which inject icon-URL resolution, locale and translated folder labels) SHALL compute `CatalogItem.isEditable` from `(isMy OR canEdit)` (deployments) / `(isMy OR canEdit)` (toolsets). For deployments this is combined with the schema condition: `editableSchemaIds` must include the deployment's `applicationTypeSchemaId`, or `isCustomAppsEditable` is set and the deployment is a schema-less `application`. The Edit action (`Header.tsx`'s `shouldShowEditAction`) already gates purely on `item.isEditable`, so no lib-level change is required beyond the corrected boolean.

No new endpoint call is made to save an edit; the existing update endpoints (toolset `saveToolSet`, application quick-app update) already proxy the requesting user's own DIAL Core access token, so DIAL Core's own ACL enforces the WRITE grant server-side at save time.

#### Scenario: Shared-with-write-access application shows the Edit action

- **WHEN** a `DeploymentItemDto` has `isMy: false`, `canEdit: true`, and an `applicationTypeSchemaId` included in `editableSchemaIds`
- **THEN** the mapped `CatalogItem.isEditable` is `true`

#### Scenario: Shared-with-read-only application does not show the Edit action

- **WHEN** a `DeploymentItemDto` has `isMy: false` and `canEdit: false`
- **THEN** the mapped `CatalogItem.isEditable` is `false`

#### Scenario: Shared-with-write-access toolset shows the Edit action

- **WHEN** a `DialToolsetDto` has `isMy: false` and `canEdit: true`
- **THEN** the mapped `CatalogItem.isEditable` is `true`


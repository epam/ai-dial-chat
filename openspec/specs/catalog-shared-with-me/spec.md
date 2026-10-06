# catalog-shared-with-me Specification

## Purpose
TBD - created by archiving change add-catalog-unshare. Update Purpose after archive.
## Requirements
### Requirement: Deployments expose an unfiltered `sharedWithMe` flag

`DeploymentItemDto` (`apps/chat-api/src/deployments/`) SHALL include an optional `sharedWithMe?: boolean` field, `true` when the requesting user holds ANY DIAL Core share grant (`READ` or `WRITE`) on the application and the application is not owned by the user (`isMy === false`), `false` otherwise.

`DeploymentsService` (a facade over `DeploymentsListingService` and `DeploymentsLookupService`) SHALL resolve this from a single unfiltered `getSharedResources({ resourceTypes: ['APPLICATION'], with: 'me' })` call per request. Each sub-service has its own private `getSharedResourceUrlSets` helper, and both use the shared `splitResourcesByPermission` (URL sets) and `computeItemOwnershipFlags` (per-item `isMy`/`canEdit`/`sharedWithMe`) utilities in `apps/chat-api/src/common/utils/resource-ownership.ts`, for `listDeployments` and the single-item `resolveDeploymentItem` alike — neither path SHALL issue two separate `getSharedResources` calls per request. `resolveDeploymentItem` skips the call entirely for a model item, which can never appear in an APPLICATION-scoped share list. `sharedWithMe` SHALL NOT be cached independently of this per-request resolution (the underlying deployments list is cached 30s per `deployments:list:<userSub>`; `sharedWithMe`, like `isMy`/`canEdit`, is recomputed on every response derived from that cache entry, and on every `resolveDeploymentItem` call).

`resolveDeploymentItem` SHALL accept the requesting user's `bucket` and apply the same `computeItemOwnershipFlags` enrichment as `listDeployments`, so a deployment resolved through it (e.g. right after `ShareInvitationService.acceptInvitation` accepts a share) reports the same `isMy`/`canEdit`/`sharedWithMe` values a subsequent `listDeployments` call would produce for the same item — the frontend's post-accept summary SHALL NOT depend on a page refresh to see the correct ownership flags.

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
- **WHEN** `ShareInvitationService.acceptInvitation` calls `resolveDeploymentItem` with the requesting user's `bucket` to build the accept response's `sharedDeployment`
- **THEN** the returned item has `isMy: false`, `sharedWithMe: true`, and `canEdit` matching the grant's permissions — without requiring a subsequent `listDeployments` call or a page refresh

#### Scenario: Just-accepted own application resolves as owned, not shared

- **GIVEN** a user accepts an invitation for an item already inside their own bucket (e.g. re-accepting ownership)
- **WHEN** `resolveDeploymentItem` resolves it with that user's `bucket`
- **THEN** the returned item has `isMy: true`, `canEdit: true`, and `sharedWithMe: false`

### Requirement: Toolsets expose an unfiltered `sharedWithMe` flag

`DialToolsetDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) SHALL include an optional `sharedWithMe?: boolean`, sent as `sharedWithMe` on the wire alongside the camelCase `isMy`/`canEdit` fields, computed with the same rules as the deployments requirement above, scoped to `resourceTypes: ['TOOL_SET']`. Because the BFF already emits camelCase, `apps/chat/src/server-api/toolsets.ts` SHALL pass `listToolsets`/`getToolset` responses through unchanged, with no property-name normalization.

`ToolsetsService` (through `ToolsetsListingService.getSharedToolsetResources`) SHALL resolve `sharedWithMe` from the same single unfiltered `getSharedResources` call used to compute the existing `canEdit`/`isMy` fields, for both `listToolsets` and `getToolset`.

#### Scenario: Owned toolset never reports sharedWithMe

- **WHEN** a toolset's `id` bucket segment matches the requesting user's bucket (`isMy: true`)
- **THEN** `sharedWithMe` is `false`

#### Scenario: READ-only shared toolset reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this toolset's url with `permissions: ['READ']`
- **THEN** `sharedWithMe` is `true`

#### Scenario: WRITE-shared toolset reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this toolset's url with `permissions` including `WRITE`
- **THEN** `sharedWithMe` is `true`

#### Scenario: Frontend adapter passes toolset sharing fields through

- **WHEN** the BFF toolsets response contains `sharedWithMe: true` and `canEdit: true`
- **THEN** `listToolsets` and `getToolset` return them unchanged, allowing the catalog mapper to render the recipient-side Delete action

#### Scenario: Public or organization toolset is neither owned nor shared

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup does not include this toolset's url
- **THEN** `sharedWithMe` is `false`

#### Scenario: Shared-resources lookup failure degrades gracefully

- **WHEN** DIAL Core's shared-resources lookup throws or errors during a toolset list or get request
- **THEN** `sharedWithMe` falls back to `false` for the affected item(s), a `warn`-level log is emitted, and the request still succeeds

### Requirement: `CatalogItem.sharedWithMe` mirrors the BFF flag

`libs/catalog/src/models/catalog-item.ts`'s `CatalogItem` SHALL gain an optional `sharedWithMe?: boolean` field, documented with JSDoc per `libs/*` conventions, alongside the existing `isMyApp`/`isEditable` fields.

`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`'s `mapDeploymentToCatalogItem` and `mapToolsetToCatalogItem` (wrapped by the same-named app adapters in `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, which supply `resolveIconUrl` and the translated `folderLabels`) SHALL set `CatalogItem.sharedWithMe` directly from `DeploymentItemDto.sharedWithMe ?? false` / `DialToolsetDto.sharedWithMe ?? false` respectively, with no additional inference (no bucket parsing, no folder-label heuristics).

`libs/catalog` MUST NOT import the generated API client, server-api wrappers, or app contexts to compute this field — it is a plain boolean prop on `CatalogItem`, populated entirely by the mapper.

**Generated-client impact**: `DeploymentItemDto.sharedWithMe?: boolean` and `DialToolsetDto.sharedWithMe?: boolean` are additive optional fields on existing `@epam/ai-dial-chat-api-client` models — no new operationId, no new endpoint, no breaking change to either response shape.

**i18n impact**: none (a boolean data field, not user-visible text on its own).

**RTL / UI impact**: none (data field only; the `catalog-unshare` capability covers the UI that reads it).

#### Scenario: Mapper carries sharedWithMe through for applications

- **WHEN** `mapDeploymentToCatalogItem` is called with a `DeploymentItemDto` where `sharedWithMe: true`
- **THEN** the resulting `CatalogItem.sharedWithMe` is `true`

#### Scenario: Mapper carries sharedWithMe through for toolsets

- **WHEN** `mapToolsetToCatalogItem` is called with a `DialToolsetDto` where `sharedWithMe: true`
- **THEN** the resulting `CatalogItem.sharedWithMe` is `true`

#### Scenario: Missing field defaults to false

- **WHEN** the source DTO omits `sharedWithMe` entirely (e.g. an older cached response shape during rollout)
- **THEN** the resulting `CatalogItem.sharedWithMe` is `false`, not `undefined`

### Requirement: Shared application folders hide internal bucket identifiers

`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`'s `resolveDeploymentFolder` SHALL use the authoritative `DeploymentItemDto.sharedWithMe` flag to replace a shared application's first `applicationFolder` segment (the owner's internal bucket identifier) with the `DeploymentFolderLabels.shared` label, which the app adapter `buildDeploymentFolderLabels` fills from the localized `catalog.folder.shared` key (`CatalogI18nKeys.FolderShared`). Shared toolsets get the same treatment in the lib's internal `resolveToolsetFolder`. Any readable nested folder segments after the owner bucket SHALL be preserved.

Owned applications SHALL continue to resolve to `catalog.folder.personal`, and public applications SHALL continue to replace the `public` segment with `catalog.folder.public`. `libs/catalog` SHALL remain unaware of DIAL bucket and sharing semantics and SHALL render only the resolved `CatalogItem.folder` supplied by the mapper.

**i18n impact**: `catalog.folder.shared` with the English value `Shared with me`.

**RTL / direction impact**: none; the change replaces one text segment and does not introduce directional layout or icons.

**Accessibility impact**: none; the existing non-interactive folder path remains unchanged.

**Feature flag, memoisation, and telemetry impact**: none.

#### Scenario: Root-level shared application hides the owner bucket

- **GIVEN** a deployment has `sharedWithMe: true` and `applicationFolder: applications/<owner-bucket>`
- **WHEN** it is mapped to a `CatalogItem`
- **THEN** its folder is `[catalog.folder.shared]`, and `<owner-bucket>` is not exposed

#### Scenario: Nested shared application preserves readable folders

- **GIVEN** a deployment has `sharedWithMe: true` and `applicationFolder: applications/<owner-bucket>/team`
- **WHEN** it is mapped to a `CatalogItem`
- **THEN** its folder is `[catalog.folder.shared, team]`, and `<owner-bucket>` is not exposed

#### Scenario: Existing owned and public folder labels are unchanged

- **WHEN** owned and public applications are mapped to catalog items
- **THEN** their first folder segment remains `catalog.folder.personal` and `catalog.folder.public` respectively

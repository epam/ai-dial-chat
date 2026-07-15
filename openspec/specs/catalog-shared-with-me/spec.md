# catalog-shared-with-me Specification

## Purpose
TBD - created by archiving change add-catalog-unshare. Update Purpose after archive.
## Requirements
### Requirement: Deployments expose an unfiltered `sharedWithMe` flag

`DeploymentItemDto` (`apps/chat-api/src/deployments/`) SHALL include an optional `sharedWithMe?: boolean` field, `true` when the requesting user holds ANY DIAL Core share grant (`READ` or `WRITE`) on the application and the application is not owned by the user (`isMy === false`), `false` otherwise.

`DeploymentsService` SHALL resolve this from a single unfiltered `getSharedResources({ resourceTypes: ['APPLICATION'], with: 'me' })` call per list request, factored into a shared private helper reused by the existing `WRITE`-only-filtered check that computes `canEdit` (`share-invitation-permissions` capability) — the endpoint SHALL NOT issue two separate `getSharedResources` calls per request. `sharedWithMe` SHALL NOT be cached independently of this per-request resolution (the underlying deployments list is cached 30s per `deployments:list:<userSub>`; `sharedWithMe`, like `isMy`/`canEdit`, is recomputed on every response derived from that cache entry).

A failure resolving shared resources SHALL degrade to `sharedWithMe: false` for every item in the response (never fail the whole deployments list) and SHALL be logged at `warn` level.

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

### Requirement: Toolsets expose an unfiltered `sharedWithMe` flag

`DialToolsetDto` (`apps/chat-api/src/toolsets/`) SHALL include an optional `sharedWithMe?: boolean` (wire field `shared_with_me`, camelCased by the generated TypeScript client), computed with the same rules as the deployments requirement above, scoped to `resourceTypes: ['TOOL_SET']` (exact DIAL Core `ResourceTypes` enum literal to be confirmed against the installed `@epam/ai-dial-typescript-sdk` version at implementation time — see design.md Open Questions).

`ToolsetsService` SHALL resolve `sharedWithMe` from the same single unfiltered `getSharedResources` call already used (or newly factored, per the deployments requirement) to compute the existing `canEdit`/`is_my` fields, for both `listToolsets` and `getToolset`.

#### Scenario: Owned toolset never reports sharedWithMe

- **WHEN** a toolset's `id` bucket segment matches the requesting user's bucket (`is_my: true`)
- **THEN** `shared_with_me` is `false`

#### Scenario: READ-only shared toolset reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this toolset's url with `permissions: ['READ']`
- **THEN** `shared_with_me` is `true`

#### Scenario: WRITE-shared toolset reports sharedWithMe=true

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup returns this toolset's url with `permissions` including `WRITE`
- **THEN** `shared_with_me` is `true`

#### Scenario: Public or organization toolset is neither owned nor shared

- **WHEN** the requesting user is not the owner and the unfiltered shared-resources lookup does not include this toolset's url
- **THEN** `shared_with_me` is `false`

#### Scenario: Shared-resources lookup failure degrades gracefully

- **WHEN** DIAL Core's shared-resources lookup throws or errors during a toolset list or get request
- **THEN** `shared_with_me` falls back to `false` for the affected item(s), a `warn`-level log is emitted, and the request still succeeds

### Requirement: `CatalogItem.sharedWithMe` mirrors the BFF flag

`libs/catalog/src/models/catalog-item.ts`'s `CatalogItem` SHALL gain an optional `sharedWithMe?: boolean` field, documented with JSDoc per `libs/*` conventions, alongside the existing `isMyApp`/`isEditable` fields.

`apps/chat/src/utils/map-deployment-to-catalog-item.ts`'s `mapDeploymentToCatalogItem` and `mapToolsetToCatalogItem` SHALL set `CatalogItem.sharedWithMe` directly from `DeploymentItemDto.sharedWithMe ?? false` / `DialToolsetDto.sharedWithMe ?? false` respectively, with no additional inference (no bucket parsing, no folder-label heuristics).

`libs/catalog` MUST NOT import the generated API client, server-api wrappers, or app contexts to compute this field — it is a plain boolean prop on `CatalogItem`, populated entirely by the app-level mapper.

**Generated-client impact**: `DeploymentItemDto.sharedWithMe?: boolean` and `DialToolsetDto.sharedWithMe?: boolean` are additive optional fields on existing `@epam/chat-api-client` models — no new operationId, no new endpoint, no breaking change to either response shape.

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

## ADDED Requirements

### Requirement: Unpublish endpoint submits a DELETE-action publication to DIAL Core

The backend SHALL expose `POST /api/v1/catalog/{entityType}/{entityId}/unpublish` in the existing `apps/chat-api/src/publish/` domain (`publish.controller.ts`, `publish.service.ts`, new `dto/unpublish-catalog-entity.dto.ts` and `dto/unpublish-result.dto.ts`), following `apps/chat-api/AGENTS.md` — thin controller, `@ApiOperation` plus one `@ApiResponse` per status code, `Logger` in the service, validated DTOs, typed HTTP exceptions.

The service SHALL NOT persist anything. It calls DIAL Core's `createPublication` through `DialClientService`, exactly as the publish endpoint does, with a single resource whose `action` is `DELETE`:

Request:
```
POST /api/v1/catalog/toolset/toolsets%2Fbucket-123%2Ftool-abc123__1.2.0/unpublish
Content-Type: application/json

{
  "folderPath": "Organization/Data Science/Published models",
  "version": "1.2.0"
}
```

Core call:
```json
{
  "name": "tool-abc123 1.2.0",
  "targetFolder": "public/Organization/Data Science/Published models/",
  "resources": [
    {
      "action": "DELETE",
      "sourceUrl": "toolsets/bucket-123/tool-abc123__1.2.0",
      "targetUrl": "toolsets/public/Organization/Data Science/Published models/tool-abc123__1.2.0"
    }
  ],
  "displayAuthor": "Test User"
}
```

`sourceUrl`, `targetFolder`, and `targetUrl` SHALL be derived server-side with the same helpers the publish endpoint uses (`toSourceUrl`, `getPublicTargetFolder`, and the shared `getPublishedTargetUrl` required by `conversation-publish-api`), never taken from the request body. `name` and `displayAuthor` are built exactly as publish builds them, so a DELETE request is legible in Core's admin queue next to the ADD request it reverses.

`rules` SHALL NOT be sent. Access rules govern who may see a published resource; a removal request grants nobody anything, and forwarding a rules array would imply otherwise.

Response (200):
```json
{
  "entityId": "toolsets/bucket-123/tool-abc123__1.2.0",
  "entityType": "toolset",
  "folderPath": "Organization/Data Science/Published models",
  "version": "1.2.0",
  "requestedAt": "2026-08-13T10:00:00.000Z",
  "requestedBy": "user@example.com"
}
```

`requestedAt`/`requestedBy` are read back from Core's `Publication` response (`createdAt`/`author` → `displayAuthor`), never generated locally. The field names deliberately differ from publish's `publishedAt`/`publishedBy`: this response describes a submitted request, not a completed removal.

Generated-client impact: OpenAPI `operationId: unpublishCatalogEntity`; request DTO `UnpublishCatalogEntityDto`; response DTO `UnpublishResultDto`. Frontend caller: a thin wrapper in `apps/chat/src/server-api/publish.api.ts` using the normal (non-`Raw`) generated method.

Rate limiting: `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the publish endpoint's write profile.

#### Scenario: Successful unpublish request
- **WHEN** an authenticated user submits a valid unpublish request for a folder the entity is published to
- **THEN** the service calls Core's `createPublication` with one `DELETE` resource and returns 200 with `UnpublishResultDto`

#### Scenario: targetUrl matches exactly what publish sent
- **GIVEN** the entity was published to `Organization/Data Science` by the publish endpoint
- **WHEN** it is unpublished from that same `folderPath`
- **THEN** the `targetUrl` in the DELETE resource is character-for-character the `targetUrl` the publish call sent, including percent-encoding of each folder segment

#### Scenario: Unpublishing from the public root
- **WHEN** `folderPath` is empty
- **THEN** `targetFolder` sent to Core is `public/` and `targetUrl` is `{resourceTypePrefix}/public/{name}`

#### Scenario: Access rules are never forwarded
- **WHEN** any unpublish request is submitted
- **THEN** the Core request body contains no `rules` field, regardless of what rules the original publication carried

### Requirement: Unpublish is a request, not a completed removal

The endpoint SHALL NOT represent the resource as removed. Core returns a `PENDING` publication that an administrator approves; until then the published copy remains visible to everyone who could already see it.

The response SHALL NOT include any field asserting removal (no `unpublishedAt`, no `status: "removed"`), the log line SHALL read as a submitted request, and the `@ApiOperation` `summary`/`description` SHALL state the approval step so it reaches the generated client's documentation and any consumer reading the OpenAPI spec.

#### Scenario: Response describes a request
- **WHEN** an unpublish request succeeds
- **THEN** the response contains `requestedAt`/`requestedBy` and no field claiming the entity is no longer published

#### Scenario: OpenAPI documents the approval step
- **WHEN** the OpenAPI spec is generated
- **THEN** the `unpublishCatalogEntity` operation's description states that the removal takes effect only after an administrator approves the request

### Requirement: Unpublish request DTO validates its inputs

`UnpublishCatalogEntityDto` SHALL declare `folderPath` and `version` with `class-validator` decorators and `@ApiProperty` metadata:

- `folderPath`: string, required, MAY be empty (the public root), validated with the existing `IsValidFilePath` decorator (`apps/chat-api/src/files/dto/file-path.validator.ts`) so `..` and absolute-path escapes are rejected before the value reaches Core.
- `version`: string, required. It is not used to address the resource — `entityId` already does that — but it is echoed in the response and used in Core's request `name`, so the admin queue shows which version's publication is being reversed.

`entityType` and `entityId` reuse the existing `CatalogEntityParamsDto`, unchanged, so the unpublish route accepts exactly the entity kinds the publish route accepts.

#### Scenario: Path traversal is rejected
- **WHEN** `folderPath` contains `..`
- **THEN** the global `ValidationPipe` rejects the request with 400 before the service or Core is reached

#### Scenario: Empty folderPath is accepted
- **WHEN** `folderPath` is the empty string
- **THEN** validation passes and the request targets the public root

#### Scenario: Unknown entityType is rejected
- **WHEN** `entityType` is not a `CatalogEntityType` member
- **THEN** the request is rejected with 400 by `CatalogEntityParamsDto`'s `@IsEnum` validation

### Requirement: Unpublish authorization and error mapping match publish

The caller SHALL be authenticated by the existing session guard. No additional role is required, and the service SHALL NOT attempt a local ownership or write-access check: DIAL Core enforces access when `createPublication` runs, and `apps/chat-api` has no store against which to form a second opinion.

Core failures SHALL be mapped through the same helpers publish uses — `mapDialHttpStatus` with `extractDialErrorMessage(result.error)` for structured error responses, so the client sees Core's own reason; a thrown SDK/network error SHALL be logged (stack only, never the request body) and surfaced as `BadGatewayException`.

| Core outcome | Thrown exception |
|---|---|
| 403 (no write access to the target folder) | `ForbiddenException` |
| 404 (unknown entity or target) | `NotFoundException` |
| other 4xx/5xx with a structured body | per `mapDialHttpStatus`, carrying Core's message |
| unreachable / timeout | `ServiceUnavailableException` |
| unexpected thrown error | `BadGatewayException` |

#### Scenario: Unauthenticated caller
- **WHEN** a request arrives without a valid session cookie
- **THEN** the session guard rejects it with 401 and no Core call is made

#### Scenario: Caller lacks write access to the folder
- **WHEN** Core returns 403 for the `createPublication` call
- **THEN** the service throws `ForbiddenException` and the response carries Core's own message

#### Scenario: Core returns a structured error
- **WHEN** `createPublication` resolves with `result.error`
- **THEN** `mapDialHttpStatus` is called with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's message is Core's reason rather than a placeholder

#### Scenario: Failure logging omits the request body
- **WHEN** the Core call throws
- **THEN** the logged message names the entity and the error stack, and contains no access token and no request body

### Requirement: A successful unpublish request invalidates the publish-history cache

On success the service SHALL synchronously delete the cache entry `publish-history:{entityType}:{entityId}` — the same key the publish endpoint invalidates — so the next history read re-queries Core rather than serving a snapshot taken before the DELETE publication existed.

#### Scenario: Next history read bypasses the stale cache
- **WHEN** an unpublish request for `{entityType}/{entityId}` succeeds
- **THEN** the next publish-history request for the same pair re-reads Core

#### Scenario: A failed unpublish leaves the cache intact
- **WHEN** the Core call fails
- **THEN** the cache entry is not deleted, since nothing about the entity's publication state changed

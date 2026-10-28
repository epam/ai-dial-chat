# projects-api Specification

## Purpose

The `GET /api/v1/projects` BFF endpoint: aggregation of the personal, organization and shared project sources from DIAL Core, mapping and de-duplication, bounded Core paging, partial-failure behavior, the `features.projectsEnabled` guard and the OpenAPI contract.

## Requirements

### Requirement: GET /api/v1/projects lists the projects available to the session user

The BFF SHALL expose `GET /api/v1/projects`, served by `ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`, `@Controller({ path: 'projects', version: '1' })`). The handler is `listProjects` and its OpenAPI `operationId` is `listProjects`. It delegates to `ProjectsService.listProjects(bucket, accessToken)` (`apps/chat-api/src/projects/projects.service.ts`). `bucket` and the access token are read from `req.user` (`SessionUser.bucket` / `SessionUser.at`).

The endpoint takes no request body and no query parameters. A client can never supply a bucket or a path, so the listing can only address the caller's own bucket, `PUBLIC_BUCKET`, and the resources Core reports as shared with the caller.

The response SHALL carry `Cache-Control: private, no-store`. No server-side cache is introduced: there is no cache key and no TTL, and every request reads DIAL Core.

Generated-client impact: `npm run openapi` emits a `ProjectsApi` class with a `listProjects()` method returning `ListProjectsResponseDto`. Frontend callers use the normal method, not the `Raw` variant.

Example request:

```http
GET /api/v1/projects HTTP/1.1
Cookie: <session cookie>
```

Example `200` response:

```json
{
  "items": [
    {
      "id": "projects/a1b2c3/marketing/q4-launch",
      "name": "q4-launch",
      "bucket": "a1b2c3",
      "path": "marketing/q4-launch",
      "parentPath": "marketing",
      "source": "personal",
      "author": "jane.doe",
      "createdAt": 1790000000000,
      "updatedAt": 1791234567000
    },
    {
      "id": "projects/public/handbook",
      "name": "handbook",
      "bucket": "public",
      "path": "handbook",
      "source": "organization",
      "updatedAt": 1789000000000
    },
    {
      "id": "projects/z9y8x7/shared-research",
      "name": "shared-research",
      "bucket": "z9y8x7",
      "path": "shared-research",
      "source": "shared"
    }
  ],
  "incompleteSources": []
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | At least one of the personal or organization listings succeeded (see the partial-failure requirement). |
| `401` | The request carries no valid session. |
| `403` | `features.projectsEnabled` is off for this user (`FeatureGuard`), or DIAL Core rejected the call with 403. |
| `429` / `502` / `503` | Both Core listings failed. The status is the one `handleDialSdkError` derives from the personal listing's failure: 429 for rate limiting, 502 for an upstream error or invalid cursor, 503 for a timeout or network failure. |

**Feature flag:** `features.projectsEnabled` (env `PROJECTS_ENABLED`, roles `PROJECTS_ENABLED_ROLES`). **Authorization:** any authenticated session for which the flag resolves to `true`. No further role is required. **RTL impact:** none, this is a backend surface. **i18n impact:** none.

#### Scenario: Authenticated user with the flag on receives the merged list

- **WHEN** an authenticated user for whom `features.projectsEnabled` resolves to `true` calls `GET /api/v1/projects`
- **THEN** the response is `200` with a `ListProjectsResponseDto` whose `items` merge the personal, organization and shared sources
- **AND** the response carries `Cache-Control: private, no-store`

#### Scenario: Bucket comes only from the session

- **WHEN** a client calls `GET /api/v1/projects?bucket=other-user&path=../../x`
- **THEN** `ProjectsService.listProjects` is invoked with the session user's `bucket`, and the query string is ignored

### Requirement: The projects endpoint is gated by FeatureGuard

`ProjectsController` SHALL carry class-level `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.ProjectsEnabled)`, the same form `ScheduledTasksController` uses (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`). The flag SHALL be declared in `CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) with:

- `key: 'features.projectsEnabled'`
- `type: 'feature'`
- `valueType: 'boolean'`
- `visibility: 'client'`
- `defaultValue: false`
- `critical: false`
- `owner: 'chat-team'`
- `envVar: 'PROJECTS_ENABLED'`
- `allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES'`

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare `PROJECTS_ENABLED?: boolean = false` and `PROJECTS_ENABLED_ROLES?: string[] = []`. They use the same `@Transform` parsing as `SCHEDULED_TASKS_ENABLED` / `SCHEDULED_TASKS_ENABLED_ROLES`. Both variables SHALL be documented in `apps/chat-api/README.md` and as commented entries in `apps/chat-api/.env.template`.

#### Scenario: Flag off by default rejects the request

- **WHEN** `PROJECTS_ENABLED` is unset and an authenticated user calls `GET /api/v1/projects`
- **THEN** `FeatureGuard` rejects the request with `403`, and no DIAL Core call is made

#### Scenario: Role restriction excludes a user outside the allowed roles

- **WHEN** `PROJECTS_ENABLED=true`, `PROJECTS_ENABLED_ROLES=projects-beta`, and the session user does not hold `projects-beta`
- **THEN** `GET /api/v1/projects` is rejected with `403`

#### Scenario: Flag is exposed to the client config

- **WHEN** `PROJECTS_ENABLED=true` and the user is within the allowed roles
- **THEN** `GET /api/v1/client-config` reports `features.projectsEnabled: true`

### Requirement: Projects are aggregated from personal, organization and shared sources

`ProjectsService.listProjects` SHALL gather three sources concurrently:

1. **personal**: `DialClientService.client.listProjectMetadata(bucket, encodeDialResourcePath(''), …)` with `recursive: true`;
2. **organization**: the same call against `PUBLIC_BUCKET` (`apps/chat-api/src/constants/dial.constants.ts`);
3. **shared**: `DialClientService.client.getSharedResources({ body: { resourceTypes: ['PROJECT'], with: 'me' } })`.

Every call sends `getBearerAuthHeaders(accessToken)`. All Core calls of one listing share a single `AbortSignal.timeout(PROJECTS_LISTING_TIMEOUT_MS)` (a 30 000 ms module constant) created once per `listProjects` call, so the whole listing, every page of every source included, is bounded by that deadline rather than each call separately. The call shape mirrors `listSkillPage` and `listSharedSkills` in `apps/chat-api/src/skills/listing/skills-listing.service.ts`.

The response SHALL be one flat `items` array with each item's `source` set to `personal`, `organization` or `shared`. Items SHALL be de-duplicated by `id`. Precedence is personal, then organization, then shared, so a project that is both owned and shared appears once, as `personal`. The order of `items` is unspecified, because the client sorts.

#### Scenario: Three sources are merged with their source tag

- **WHEN** the personal listing returns project `a`, the organization listing returns project `b`, and the shared listing returns project `c`
- **THEN** `items` contains `a` with `source: 'personal'`, `b` with `source: 'organization'` and `c` with `source: 'shared'`

#### Scenario: A project listed as both owned and shared appears once

- **WHEN** the personal listing and the shared listing both return a project with id `projects/a1b2c3/x`
- **THEN** `items` contains exactly one entry with that id, and its `source` is `personal`

### Requirement: The BFF follows DIAL Core's cursor to completion within a bound

For each `listProjectMetadata` source, the service SHALL request pages of `limit: 1000`, forwarding each `nextToken` until Core returns none. It SHALL stop after `MAX_UPSTREAM_PAGES_PER_SOURCE` (20) pages. When it stops at the cap while a `nextToken` remains, it SHALL log one warning naming the source kind (`personal` / `organization`) and the page count, return the items collected so far, and report that source in `incompleteSources`. A `nextToken` that repeats one already seen SHALL fail that source with `BadGatewayException('DIAL Core returned an invalid project listing page')`. The log names only the source kind and page count, never the cursor or the bucket, as in `listAllSkillItems`. The response DTO carries no `nextToken`.

#### Scenario: Multi-page listing is fully consumed

- **WHEN** the personal listing returns three pages, chained by `nextToken`, the last with no `nextToken`
- **THEN** all items from the three pages are in the response, and `listProjectMetadata` was called three times for the personal bucket, the 2nd and 3rd calls carrying the previous `nextToken`

#### Scenario: Page cap stops the walk with a warning

- **WHEN** every personal page returns a `nextToken`
- **THEN** the service stops after 20 personal pages, logs one warning naming `personal` and the page count, and still answers `200` with the collected items and `incompleteSources: ['personal']`

#### Scenario: Repeated cursor fails that source

- **WHEN** the organization listing returns the same `nextToken` twice
- **THEN** the organization source fails with `BadGatewayException`, and the partial-failure rules decide the response

### Requirement: Core metadata is mapped to ProjectDto

`apps/chat-api/src/projects/projects.mapper.ts` SHALL map each Core metadata entry to `ProjectDto`.

For the personal and organization listings:

- Entries whose `nodeType` is not `ITEM` (grouping folders) are dropped.
- Entries missing `bucket` or `name` are dropped. One malformed entry never fails the listing.
- `path` is `parentPath` and `name` joined with `/`, with trailing slashes stripped.
- `id` is `projects/{bucket}/{path}` with no trailing `/`.
- `parentPath`, `author`, `createdAt` and `updatedAt` are copied when present.

For the shared listing, the mapper:

- keeps only `nodeType === 'ITEM'`;
- decodes `url` with `safeDecodeURIComponent` and strips trailing slashes;
- requires the `projects/{bucket}/{path…}` shape (other prefixes, a missing bucket or an empty path are dropped);
- derives `bucket`, `path`, `name` (the last segment) and `parentPath`.

`ProjectDto` SHALL be a class with `@ApiProperty` / `@ApiPropertyOptional` on every field:

- `id: string`
- `name: string`
- `bucket: string`
- `path: string`
- `parentPath?: string`
- `source: ProjectSource`
- `author?: string`
- `createdAt?: number`: epoch ms
- `updatedAt?: number`: epoch ms

`ProjectSource` SHALL be a string enum (`Personal = 'personal'`, `Shared = 'shared'`, `Organization = 'organization'`) exposed to Swagger with `enumName: 'ProjectSource'`. `ListProjectsResponseDto` SHALL be a class with `items: ProjectDto[]` (`@ApiProperty({ type: [ProjectDto] })`) and `incompleteSources: ProjectSource[]` (`@ApiProperty({ enum: ProjectSource, enumName: 'ProjectSource', isArray: true })`): the sources that failed or were truncated at the page cap, empty when every source answered in full.

#### Scenario: Grouping folders are excluded

- **WHEN** a recursive personal listing returns a `FOLDER` entry `marketing/` and an `ITEM` entry `marketing/q4-launch`
- **THEN** `items` contains only `q4-launch`, with `path: 'marketing/q4-launch'` and `parentPath: 'marketing'`

#### Scenario: Malformed entries are skipped

- **WHEN** a listing returns an `ITEM` with no `name`
- **THEN** that entry is omitted, and the remaining entries are returned with `200`

#### Scenario: Shared URL with a foreign prefix is dropped

- **WHEN** `getSharedResources` returns an item whose decoded url is `files/z9y8x7/doc.txt`
- **THEN** that item is not in `items`

### Requirement: Source failures degrade instead of failing the whole listing

The service SHALL settle the personal and organization listings independently, using `Promise.allSettled`.

- **Empty bucket**: a `404` from `listProjectMetadata` for a bucket root means "no projects folder yet". It SHALL yield an empty list for that source, not a failure.
- **One listing fails**: the response is `200` with the remaining sources, the failed source is listed in `incompleteSources`, and a warning names the failed source kind.
- **Both listings fail**: the personal listing's error is rethrown. SDK errors go through `handleDialSdkError(error, 'projects.listProjects', logger, response)`, so the status follows `mapDialHttpStatus`.
- **Shared listing fails**: the shared listing never fails the request. An error or exception yields an empty shared list, `shared` is listed in `incompleteSources`, and the warning carries the upstream status or the error name (never a body or token).

#### Scenario: Organization failure still returns personal and shared projects

- **WHEN** the organization listing rejects with a 500 from Core and the other sources succeed
- **THEN** the response is `200` with the personal and shared items, `incompleteSources` is `['organization']`, and a warning names `organization`

#### Scenario: Both bucket listings failing surfaces the personal error

- **WHEN** the personal listing times out and the organization listing returns 500
- **THEN** the response is `503`, derived from the personal listing's timeout

#### Scenario: Empty personal bucket is not an error

- **WHEN** `listProjectMetadata` for the personal bucket answers `404`
- **THEN** the personal source contributes no items, the response is `200` with the organization and shared items, and `incompleteSources` is empty

#### Scenario: Shared listing error yields no shared items

- **WHEN** `getSharedResources` returns an error
- **THEN** the response is `200`, it contains no `shared` items, `incompleteSources` is `['shared']`, and the warning names the upstream status

#### Scenario: One deadline bounds the whole listing

- **WHEN** a listing walks several pages of a source and lists shared projects
- **THEN** every `listProjectMetadata` and `getSharedResources` call of that request receives the same `AbortSignal`

### Requirement: The projects endpoint documents every status code in OpenAPI

`listProjects` SHALL declare `@ApiOperation` (with `operationId: 'listProjects'`) and `@ApiResponse` for `200` (`type: ListProjectsResponseDto`), `401` and `403`. It SHALL declare the DIAL Core pass-through statuses through `@ApiDialCoreErrors()` (`apps/chat-api/src/common/dial/api-dial-core-errors.decorator.ts`). After the endpoint is added, `npm run openapi` and `npm run openapi:check` SHALL pass, and the regenerated `libs/chat-api-client` SHALL build and lint.

Observability: no new metric is introduced. The request is covered by the existing HTTP metrics (`MetricsInterceptor`). Partial-failure and page-cap warnings go through the domain `Logger`, which never logs tokens, cursors or bucket ids.

#### Scenario: Generated client exposes listProjects

- **WHEN** `npm run openapi` runs after the endpoint is added
- **THEN** `@epam/ai-dial-chat-api-client` exports `ProjectsApi` with `listProjects()` returning `ListProjectsResponseDto`, and exports the `ProjectSource` enum

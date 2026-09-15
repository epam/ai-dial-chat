# skills-bff-api Delta

## MODIFIED Requirements

### Requirement: List skills and grouping folders

The system SHALL expose `GET /api/v1/skills` accepting `bucket` (required), `path` (optional, default `""`), `token` (optional), `limit` (optional, 0-1000), and `recursive` (optional, default `false`) query parameters, validate all inputs, and proxy to DIAL Core `listSkillMetadata` (`GET /v2/metadata/skills/{bucket}/{path}`) under the authenticated user's session. The endpoint SHALL return `200 OK` with a `SkillListResponseDto`.

- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- **operationId**: `listSkills`.
- **Response DTO**: `SkillListResponseDto { bucket, path, items: SkillMetadataItemDto[], nextToken? }`, mapping DIAL Core's `MetadataBase` (`ResourceFolderMetadata | ResourceItemMetadata | ComplexResourceItemMetadata`, discriminated by `nodeType: 'FOLDER' | 'ITEM'`) into lowercased `nodeType: 'folder' | 'item'`, mirroring `ListFilesItemDto`'s existing normalization convention (`apps/chat-api/src/files/dto/list-files.dto.ts`).

Each mapped `SkillMetadataItemDto` for `nodeType: 'item'` SHALL carry `description?: string`, sourced from the upstream item metadata's `attributes` map (DIAL Core PR #1970 — manifest-derived attributes on complex resource items, including recursive listing children). The `attributes` field SHALL be read defensively off the raw upstream item (`'attributes' in item`), since the installed `@epam/ai-dial-typescript-sdk`'s `MetadataBase` schema may not declare it; an absent `attributes` map, or a `description` value that is not a string, SHALL map to `description: undefined` — never throw. Folder entries SHALL NOT carry `description`.

#### Scenario: List skills at bucket root

- **WHEN** an authenticated user calls `GET /api/v1/skills?bucket=my-bucket`
- **THEN** the system calls DIAL Core `listSkillMetadata` with an empty path and returns `200 OK` with the root-level grouping folders and skills

#### Scenario: Item description is forwarded from attributes

- **WHEN** DIAL Core returns a skill item whose `attributes` contains `"description": "Summarizes documents"`
- **THEN** the mapped `SkillMetadataItemDto` in the response carries `description: "Summarizes documents"`

#### Scenario: Item without attributes has no description

- **WHEN** DIAL Core returns a skill item with no `attributes` map (older Core, or an entry Core populates without it)
- **THEN** the mapped item omits `description` (it serializes as absent) and the endpoint still returns `200 OK`

#### Scenario: Non-string description is ignored

- **WHEN** DIAL Core returns a skill item whose `attributes.description` is a number or object
- **THEN** the mapped item omits `description` rather than forwarding the non-string value

#### Scenario: Folder entries never carry a description

- **WHEN** DIAL Core returns a `nodeType: 'FOLDER'` entry that happens to include an `attributes` map
- **THEN** the mapped folder entry omits `description`

#### Scenario: List skills recursively

- **WHEN** `GET /api/v1/skills?bucket=my-bucket&path=team-a/&recursive=true` is called
- **THEN** the system forwards `recursive=true` to DIAL Core and returns the whole subtree under `team-a/`, with each skill item's `description` populated from its `attributes` where Core provides one

#### Scenario: Pagination token round-trip

- **WHEN** a first page response includes a non-empty `nextToken`
- **AND** the caller repeats the request with `token=<nextToken>`
- **THEN** the response contains the next page of items

#### Scenario: Invalid limit rejected

- **WHEN** `limit` is negative or exceeds `1000`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Grouping folder not found

- **WHEN** the given `path` holds no grouping folder or skill
- **THEN** the system returns `404 Not Found`

#### Scenario: Unauthenticated request

- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before calling DIAL Core

### Requirement: Aggregate catalog skills

The system SHALL expose authenticated `GET /api/v1/skills/catalog` with `operationId: listCatalogSkills`. The endpoint accepts no bucket query: it obtains the caller's bucket and access token from the session. It returns `SkillCatalogListResponseDto`:

```json
{
  "skills": [],
  "sharedWithMe": [],
  "publicSkills": []
}
```

`SkillsListingService` SHALL recursively follow every `nextToken` for the caller and `public` buckets, reject a repeated token rather than loop forever, filter grouping folders from the arrays, and fetch resources shared with the caller through `getSharedResources({ resourceTypes: ['SKILL'], with: 'me' })`.

Each `SkillMetadataItemDto` SHALL expose optional `isMy`, `canEdit`, and `sharedWithMe` flags. Personal skills are owned and editable. Shared skills are editable only when their shared-resource permissions include `WRITE`; their full `skills/{ownerBucket}/{path}` URL SHALL be preserved. For `nodeType: ITEM`, the BFF SHALL canonicalize that URL from `bucket`, `parentPath`, and `name` without a trailing slash, rather than trusting a folder-shaped upstream `url`. Joining `parentPath` and `name` SHALL insert exactly one `/` whether or not Core includes a trailing separator in `parentPath`. Organisation skills are always `isMy: false`, `canEdit: false`, and `sharedWithMe: false`, regardless of upstream metadata. Shared items already present in the personal or organisation arrays SHALL be deduplicated by canonical full URL.

Each skill item SHALL carry `description?: string` sourced from the upstream item's `attributes.description` under the same defensive rules as the bucket listing: absent map or non-string value → omitted; folders never carry it; a namespace whose upstream payload lacks `attributes` (notably the shared-with-me path, whose `getSharedResources` coverage for `attributes` is unverified) degrades to items with no description rather than failing.

Personal and organisation listings SHALL settle independently. If one rejects, the endpoint returns the other namespace and logs a warning; if both reject, it propagates the upstream error. Shared-resource failure degrades to an empty `sharedWithMe` array. The endpoint carries `@Throttle({ default: { limit: 60, ttl: 60000 } })`, returns `401` without a session, and maps upstream failures through the existing skills error mapper.

#### Scenario: One request returns personal, shared, and public skills

- **WHEN** an authenticated caller requests `GET /api/v1/skills/catalog`
- **THEN** the response contains all three arrays and the browser needs no bucket-specific list request

#### Scenario: Catalog item descriptions come from the listing

- **WHEN** a personal skill's upstream metadata carries `attributes.description`
- **THEN** the corresponding item in the response's `skills` array carries that `description`, with no per-skill file download involved

#### Scenario: Shared skills without attributes degrade silently

- **WHEN** the shared-resources upstream payload carries no `attributes` maps
- **THEN** the `sharedWithMe` items simply omit `description` and the endpoint returns `200 OK`

#### Scenario: Writable shared skill keeps its owner URL

- **WHEN** a shared resource is `skills/owner-bucket/team-a/docs-helper` with `READ` and `WRITE`
- **THEN** it appears in `sharedWithMe` with `canEdit: true`, `sharedWithMe: true`, and that full URL

#### Scenario: Folder-shaped item URL is canonicalized before editing

- **WHEN** Core returns an item named `docs-helper` under `team-a/` with upstream URL `skills/owner-bucket/team-a/docs-helper/`
- **THEN** the aggregate DTO contains `path: 'team-a/docs-helper'` and `url: 'skills/owner-bucket/team-a/docs-helper'`
- **AND** opening Edit never calls the skill download endpoint with a path ending in `/`

#### Scenario: File metadata parent path has no trailing separator

- **WHEN** Core returns `parentPath: 'docs-helper/files'` and `name: 'SKILL.md'`
- **THEN** the BFF returns `path: 'docs-helper/files/SKILL.md'`, not `docs-helper/filesSKILL.md`

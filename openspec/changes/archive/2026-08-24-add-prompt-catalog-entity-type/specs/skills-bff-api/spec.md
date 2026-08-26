## ADDED Requirements

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

Personal and organisation listings SHALL settle independently. If one rejects, the endpoint returns the other namespace and logs a warning; if both reject, it propagates the upstream error. Shared-resource failure degrades to an empty `sharedWithMe` array. The endpoint carries `@Throttle({ default: { limit: 60, ttl: 60000 } })`, returns `401` without a session, and maps upstream failures through the existing skills error mapper.

#### Scenario: One request returns personal, shared, and public skills

- **WHEN** an authenticated caller requests `GET /api/v1/skills/catalog`
- **THEN** the response contains all three arrays and the browser needs no bucket-specific list request

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

#### Scenario: Skill streams use downstream-safe HTTP framing

- **WHEN** DIAL Core supplies `Content-Length` together with a whole-skill or single-file response stream
- **THEN** the BFF does not copy that upstream wire length to its downstream response
- **AND** Node frames the bytes actually emitted by the BFF while `Content-Type`, `Content-Disposition`, and `ETag` remain eligible for forwarding

#### Scenario: Public skill is always read-only

- **WHEN** organisation metadata unexpectedly carries `WRITE`
- **THEN** its aggregate DTO still contains `canEdit: false`

#### Scenario: Public namespace failure preserves personal skills

- **WHEN** the caller-bucket listing succeeds and the public listing rejects
- **THEN** the endpoint returns 200 with `skills` populated and `publicSkills` empty

#### Scenario: Generated client exposes the aggregate method

- **WHEN** `npm run openapi && npm run openapi:check` completes
- **THEN** the normal generated `SkillsApi.listCatalogSkills()` method returns `SkillCatalogListResponseDto`

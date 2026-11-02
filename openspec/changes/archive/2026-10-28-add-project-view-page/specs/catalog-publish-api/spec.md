## ADDED Requirements

### Requirement: Project publication uses the whole-project resource URL

`CatalogEntityType` in `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts` SHALL gain `Project = 'project'`, so every `/api/v1/catalog/{entityType}/{entityId}/…` publish route accepts `entityType: project`.

- **Resource URL.** A project SHALL be published as its whole `projects/{bucket}/{path}` resource URL, never as an individual file URL, exactly as a Skill is.
- **Target.** The target is derived from the id's prefix by the existing `getResourceTypePrefix` / `getPublishedTargetUrl` (`apps/chat-api/src/publish/publish-target.util.ts`). Projects are not in `VERSIONED_RESOURCE_PREFIXES`.
- **Version.** An omitted version and every project publish-history entry use an empty string.
- **Core support.** DIAL Core's `PublicationService` accepts the `PROJECT` resource type.

Validation, status codes, the history cache key `publish-history:{entityType}:{entityId}` (60 s TTL, invalidated on publish and unpublish) and authorization are unchanged.

**Generated-client impact:** `PublishCatalogEntityEntityTypeEnum.Project = 'project'` after `npm run openapi`. `CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts` gains `'project'`.

Example request:

```http
POST /api/v1/catalog/project/projects%2Fa1b2c3%2Fq4-launch/publish HTTP/1.1
Content-Type: application/json

{ "folderPath": "Marketing", "rules": [] }
```

Example `201` response:

```json
{
  "entityId": "projects/a1b2c3/q4-launch",
  "entityType": "project",
  "folderPath": "Marketing",
  "version": "",
  "publishedAt": "2026-10-28T12:00:00.000Z",
  "publishedBy": "jane.doe"
}
```

#### Scenario: Owned project is published without version

- **WHEN** an owner publishes `projects/a1b2c3/q4-launch` to `Marketing`
- **THEN** the BFF calls Core for the whole project resource with target `projects/public/Marketing/q4-launch`, returns 201, and reports `version: ""`

#### Scenario: Unknown entity type is still rejected

- **WHEN** `entityType` is `folder`
- **THEN** the response is 400

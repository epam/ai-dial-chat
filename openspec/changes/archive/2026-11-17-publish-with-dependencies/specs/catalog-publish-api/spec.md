# Spec Delta

## ADDED Requirements

### Requirement: Publishing an application may submit its dependencies in the same Core request

The publish endpoint of an application (`POST /api/v1/catalog/applications/:entityId/publish`, `operationId` unchanged) SHALL submit the application's first-level private dependencies as additional `ADD` resources in the same DIAL Core `createPublication` request, as defined by the `application-publish-dependencies` capability. The endpoint's request DTO, success response (`PublishResultDto`) and existing error responses are unchanged.

One response is added for an application with private dependencies: `409` when the same application is already being published. It SHALL be listed in the endpoint's `@ApiResponse` metadata; `libs/chat-api-client/openapi.json` SHALL be regenerated with `npm run openapi` and checked with `npm run openapi:check`. A failure or refusal while the dependencies and the copy are prepared does not fail the publish: the application is published as before (see the fallback requirement of `application-publish-dependencies`); a refusal of `createPublication` itself is returned as the mapped Core error the endpoint already returns. Frontend callers keep using the normal generated method through `apps/chat/src/server-api/publish.api.ts`.

Example (shape), request:
```
POST /api/v1/catalog/applications/applications%2Fbucket-123%2FHelper__1.0.0/publish
{ "folderPath": "Organization/Agents", "version": "1.0.0" }
```
Core request sent (shape):
```json
{
  "name": "Helper 1.0.0",
  "targetFolder": "public/Organization/Agents/",
  "resources": [
    { "action": "ADD", "sourceUrl": "<temporary copy of the application>", "targetUrl": "applications/public/Organization/Agents/Helper__1.0.0" },
    { "action": "ADD", "sourceUrl": "skills/bucket-123/Docs%20helper", "targetUrl": "skills/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Docs%20helper" }
  ]
}
```

#### Scenario: Dependencies travel in the same request
- **WHEN** an application with one private skill is published
- **THEN** the single Core request lists the application and the skill, and the response is the usual `PublishResultDto`

#### Scenario: Unreadable dependencies do not fail the publish
- **WHEN** the application's dependencies cannot be read
- **THEN** the application is published as before, with the unchanged Core request and response

#### Scenario: Unchanged for an application without dependencies
- **WHEN** an application with no private references is published
- **THEN** the Core request and the response are identical to the request and response before this change

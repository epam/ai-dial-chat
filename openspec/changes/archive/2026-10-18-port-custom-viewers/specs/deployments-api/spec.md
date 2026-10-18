## ADDED Requirements

### Requirement: DeploymentItemDto exposes the application viewer URL

`DeploymentItemDto` (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts`) SHALL carry an optional `viewerUrl?: string` (`@ApiPropertyOptional`, example `https://viewer.example.com/`). `RawDeploymentDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`) SHALL declare DIAL Core's `viewer_url?: string`, and `mapToDeploymentItem` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) SHALL set `viewerUrl` from it only when the item type is `application` and the value is a non-empty string; for models and toolsets the field SHALL be absent.

The endpoint shape is otherwise unchanged: `GET /api/v1/deployments` (operationId `listDeployments`, generated method `deploymentsApi.listDeployments`, normal — not `Raw` — call) returns the same list, now with `viewerUrl` on applications that configure a viewer. Error codes are unchanged. No cache key or TTL changes: the field rides on the existing deployments listing cache.

Example response item:

```json
{
  "id": "applications/bucket/data-explorer",
  "type": "application",
  "displayName": "Data Explorer",
  "viewerUrl": "https://viewer.example.com/"
}
```

Generated-client impact: `libs/chat-api-client/openapi.json` and the generated `DeploymentItemDto` model gain `viewerUrl?: string`; regenerated with `npm run openapi`.

#### Scenario: Application with viewer_url

- **WHEN** DIAL Core returns an application with `viewer_url: "https://viewer.example.com/"`
- **THEN** the mapped item has `viewerUrl: "https://viewer.example.com/"`

#### Scenario: Model never carries viewerUrl

- **WHEN** DIAL Core returns a model with a `viewer_url` field
- **THEN** the mapped item has no `viewerUrl`

#### Scenario: Missing or empty viewer_url

- **WHEN** an application has no `viewer_url`, or it is an empty string
- **THEN** the mapped item has no `viewerUrl`

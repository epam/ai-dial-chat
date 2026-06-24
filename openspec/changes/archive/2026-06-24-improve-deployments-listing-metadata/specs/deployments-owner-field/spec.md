## ADDED Requirements

### Requirement: `owner` field forwarded from DIAL Core to DeploymentItemDto

The `DeploymentItemDto` SHALL include an optional `owner` field that carries the ownership string returned by DIAL Core for each deployment item.

The backend SHALL:
- Extend `RawDeploymentDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`) with `owner?: string`.
- Read `raw.owner` in `mapToDeploymentItem` (`apps/chat-api/src/deployments/deployments.service.ts:33–84`) and assign it to `DeploymentItemDto.owner` when present.
- Annotate `DeploymentItemDto.owner` with `@ApiPropertyOptional({ description: 'Owner of the deployment as reported by DIAL Core' })`.
- Include `owner` in the cached `DeploymentItemDto[]` (the field is static per deployment).
- Not throw or skip items when `owner` is absent; the field is optional.

#### Scenario: DIAL Core provides `owner` for a deployment

- **WHEN** DIAL Core returns a deployment item with `owner: "users/alice@example.com/"` in the raw payload
- **THEN** the mapped `DeploymentItemDto` has `owner: "users/alice@example.com/"`

#### Scenario: DIAL Core omits `owner` for a deployment

- **WHEN** DIAL Core returns a deployment item without an `owner` field
- **THEN** the mapped `DeploymentItemDto` has `owner` as `undefined` and the item is still included in the response

#### Scenario: `owner` is present in the 200 response body

- **WHEN** `GET /api/v1/deployments` returns an item with `owner` set
- **THEN** the JSON response body includes `"owner": "<value>"` for that item

#### Scenario: `owner` is absent from the 200 response body when not provided by DIAL Core

- **WHEN** `GET /api/v1/deployments` returns an item without `owner` from DIAL Core
- **THEN** the JSON response body omits the `owner` key for that item (or serializes it as `undefined`)

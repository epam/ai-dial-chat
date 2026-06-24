## MODIFIED Requirements

### Requirement: DeploymentItemDto shape

`DeploymentItemDto` SHALL be a strongly typed Swagger DTO that normalises DIAL Core's `ModelOpenAi | ApplicationOpenAi | ToolsetOpenAi` union into a flat structure:

- `id: string` — unique stable identifier from DIAL Core; items without an `id` SHALL be skipped during mapping
- `displayName: string` — `display_name` from DIAL Core, falling back to `id` when absent
- `type: 'model' | 'application' | 'toolset'` — discriminator; derived from DIAL Core `object` field (`"model"` → `'model'`, `"application"` → `'application'`); items with a `toolset` field present SHALL be mapped to `'toolset'`
- `iconUrl?: string` — `icon_url` from DIAL Core
- `description?: string` — `description` from DIAL Core
- `interfaces?: string[]` — `interfaces` from DIAL Core (list of interface types supported by the deployment)
- `inputAttachmentTypes?: string[]` — `input_attachment_types` from DIAL Core; omitted when the source field is absent or null
- `owner?: string` — `owner` from DIAL Core's `DeploymentBase`; forwarded verbatim; omitted when DIAL Core does not provide it (**new**)
- `isMy?: boolean` — `true` when the session `bucket` appears as a path segment of the deployment `id` (e.g. `applications/{bucket}/{name}`); `false` otherwise; computed post-cache and never stored in the cache entry (**new**)
- `applicationFolder?: string` — parent directory path of the application derived from `id` (everything before the last `/`); set only for `type === 'application'` items whose `id` contains a `/`; absent for root-level applications and all non-application types (**new**)

`DeploymentsResponseDto` SHALL wrap this as `{ deployments: DeploymentItemDto[] }`.

No `any` types are allowed in success response shapes.

#### Scenario: Authenticated user receives all deployments without filter

- **WHEN** `GET /api/v1/deployments` is called with a valid session and no `interface_type` parameter
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing all models, applications, and toolsets from DIAL Core

#### Scenario: Authenticated user filters by single interface type

- **WHEN** `GET /api/v1/deployments?interface_type=chat` is called with a valid session
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing only deployments whose DIAL Core `interfaces` array includes `'chat'`

#### Scenario: New fields present on response items

- **WHEN** `GET /api/v1/deployments` returns items with DIAL Core `owner` populated
- **THEN** each item in the response includes `owner`, `isMy`, and (for folder-nested applications) `applicationFolder`

#### Scenario: Backward compatibility — clients ignoring new fields are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `owner`, `isMy`, or `applicationFolder`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

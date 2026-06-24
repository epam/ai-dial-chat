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
- `features?: DeploymentFeatures` — feature flags from DIAL Core; omitted when the source field is absent or null. `DeploymentFeatures` is imported from `@epam/ai-dial-chat-shared`.

`DeploymentsResponseDto` SHALL wrap this as `{ deployments: DeploymentItemDto[] }`.

The mapping logic in `DeploymentsService` SHALL read a `features` property from the raw DIAL Core deployment object. When the property is present, its value SHALL be assigned as-is to `DeploymentItemDto.features`. When absent, `features` SHALL be omitted (undefined).

No `any` types are allowed in success response shapes.

#### Scenario: DIAL Core returns deployment with features

- **WHEN** the DIAL Core deployment payload includes `{ features: { systemPrompt: true, temperature: false } }`
- **THEN** `DeploymentItemDto.features` equals `{ systemPrompt: true, temperature: false }`

#### Scenario: DIAL Core returns deployment without features

- **WHEN** the DIAL Core deployment payload does not include a `features` field
- **THEN** `DeploymentItemDto.features` is undefined

#### Scenario: DeploymentFeatures is documented in Swagger

- **WHEN** Swagger documentation is generated for `GET /api/v1/deployments`
- **THEN** `DeploymentItemDto` includes an optional `features` property of type `DeploymentFeatures` with its two boolean sub-properties documented

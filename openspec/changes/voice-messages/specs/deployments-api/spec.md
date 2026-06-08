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

`DeploymentsResponseDto` SHALL wrap this as `{ deployments: DeploymentItemDto[] }`.

No `any` types are allowed in success response shapes.

The `DeploymentItem` interface in `libs/chat-shared/src/models/deployment.ts` SHALL also gain `inputAttachmentTypes?: string[]`. The deployment mapping in `apps/chat` SHALL copy the field through from `DeploymentItemDto`.

#### Scenario: Model item is mapped correctly

- **WHEN** a DIAL Core `ModelOpenAi` entry has `object: 'model'`, `id: 'gpt-4o'`, `display_name: 'GPT-4o'`
- **THEN** the mapped `DeploymentItemDto` has `type: 'model'`, `id: 'gpt-4o'`, `displayName: 'GPT-4o'`

#### Scenario: Application item is mapped correctly

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `object: 'application'`, `id: 'my-app'`, no `display_name`
- **THEN** the mapped `DeploymentItemDto` has `type: 'application'`, `id: 'my-app'`, `displayName: 'my-app'`

#### Scenario: Toolset item is mapped correctly

- **WHEN** a DIAL Core `ToolsetOpenAi` entry has a `toolset` field and `id: 'search-tool'`
- **THEN** the mapped `DeploymentItemDto` has `type: 'toolset'`, `id: 'search-tool'`

#### Scenario: Item with no id is skipped

- **WHEN** a DIAL Core deployment entry has no `id` field
- **THEN** it is excluded from the `deployments` array in the response

#### Scenario: displayName falls back to id

- **WHEN** a source item has no `display_name`
- **THEN** `DeploymentItemDto.displayName` equals the source `id`

#### Scenario: inputAttachmentTypes mapped from DIAL Core

- **WHEN** a DIAL Core model entry has `input_attachment_types: ['audio/*', 'image/*']`
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes: ['audio/*', 'image/*']`

#### Scenario: inputAttachmentTypes omitted when absent in source

- **WHEN** a DIAL Core model entry has no `input_attachment_types` field
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes` as `undefined`

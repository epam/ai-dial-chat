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
- `owner?: string` — `owner` from DIAL Core's `DeploymentBase`; forwarded verbatim; omitted when DIAL Core does not provide it
- `isMy?: boolean` — `true` when the session `bucket` appears as a path segment of the deployment `id` (e.g. `applications/{bucket}/{name}`); `false` otherwise; computed post-cache and never stored in the cache entry
- `applicationFolder?: string` — parent directory path of the application derived from `id` (everything before the last `/`); set only for `type === 'application'` items whose `id` contains a `/`; absent for root-level applications and all non-application types
- `features?: DeploymentFeaturesDto` — feature flags from DIAL Core, including the new `mcp?: boolean` field (see below)
- `reference?: string` — `reference` from DIAL Core's raw deployment payload, forwarded verbatim; omitted when DIAL Core does not provide it. Callers MAY receive a deployment `id` elsewhere in the system (e.g. a stored conversation's `model` value) that actually holds this `reference` value instead of `id` — the frontend is responsible for matching against either field (see `deployment-reference-resolution`)

`DeploymentItemDto.conversationStarters?: ConversationStartersDto` SHALL expose Quick Apps conversation starter settings mapped from `application_properties.conversation_starters`. It SHALL be set only for `type === 'application'` items with at least one valid starter.

`ConversationStartersDto` SHALL contain:
- `introText?: string` mapped from `application_properties.conversation_starters.intro_text`
- `autoSubmit?: boolean` mapped from `application_properties.conversation_starters.auto_submit`
- `chatMessageInputDisabled?: boolean` mapped from `application_properties.conversation_starters.chat_message_input_disabled`
- `starters: ConversationStarterDto[]`, where each starter contains `title: string` and `text: string` from the corresponding raw starter

Invalid or blank starters SHALL be omitted. If no valid starters remain, `conversationStarters` SHALL be omitted. Non-application deployments SHALL NOT expose `conversationStarters`, even if a malformed source payload contains `application_properties`.

`DeploymentFeaturesDto.mcp?: boolean` SHALL be `true` when any of the following is present on the raw DIAL Core list entry, and `undefined` (omitted) otherwise:
- `features.mcp === true` (read defensively, the same way `DeploymentFeaturesDetailsDto.mcp` is already populated for the deployment-details endpoint);
- a root-level `mcp` descriptor object (`endpoint`/`transport`/`allowedTools`/...) is present (non-`null`), regardless of its contents;
- `interfaces` contains the string `'mcp'` (the same per-item signal DIAL Core's own `interface_type=mcp` list filter relies on).

These three signals are not mutually exclusive but are also not reliably combined — real DIAL Core list responses have been observed reporting MCP support through any one of them alone, with the other two absent, depending on the application's configuration.

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

#### Scenario: Application item with MCP support maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `features.mcp: true`
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application item without MCP support omits features.mcp

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has no `features.mcp` field, no root-level `mcp` descriptor, and no `'mcp'` entry in `interfaces`
- **THEN** the mapped `DeploymentItemDto`'s `features.mcp` is `undefined`

#### Scenario: Application item with a root-level mcp descriptor maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has a root-level `mcp` descriptor object and no `features.mcp`
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application item with "mcp" in interfaces maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `interfaces` containing `'mcp'` and neither `features.mcp` nor a root-level `mcp` descriptor
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application conversation starters mapped from application properties

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `application_properties.conversation_starters` with `intro_text`, `auto_submit`, `chat_message_input_disabled`, and one starter `{ title, text }`
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters.introText`, `conversationStarters.autoSubmit`, `conversationStarters.chatMessageInputDisabled`, and `conversationStarters.starters[0]` mapped to `{ title, text }`

#### Scenario: Non-application item omits conversationStarters

- **WHEN** a model or toolset entry contains a malformed `application_properties.conversation_starters` payload
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters` as `undefined`

#### Scenario: Empty or invalid starters omit conversationStarters

- **WHEN** an application entry has `application_properties.conversation_starters.starters` with no valid `{ title, text }` pairs
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters` as `undefined`

#### Scenario: reference mapped from DIAL Core

- **WHEN** a DIAL Core model entry has `id: 'gemini-3.1-flash-lite'` and `reference: 'ref-gemini-3-1-flash-lite'`
- **THEN** the mapped `DeploymentItemDto` has `reference: 'ref-gemini-3-1-flash-lite'`

#### Scenario: reference omitted when absent in source

- **WHEN** a DIAL Core deployment entry has no `reference` field
- **THEN** the mapped `DeploymentItemDto` has `reference` as `undefined`

#### Scenario: Backward compatibility — clients ignoring reference are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `reference`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

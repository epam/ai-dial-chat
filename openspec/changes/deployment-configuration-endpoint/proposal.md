## Why

When a model or application is selected in the chat, the UI currently has no way to discover whether that deployment supports dynamic configuration or quick-start prompts. DIAL Core exposes `GET /v1/deployments/{deployment_name}/configuration` which returns the JSON Schema of the configuration a deployment accepts. Without this endpoint being proxied through chat-api, the frontend cannot read per-deployment features such as starter prompts, settings panels, or `custom_fields.configuration` in completion requests.

## What Changes

- **New backend endpoint** `GET /api/deployments/:deployment/configuration` proxies the DIAL Core configuration schema for a given deployment to the authenticated session user.
- **Shared types** `StarterWidgetOptions`, `StarterOption`, `DeploymentConfigurationSchemaProperty`, and `DeploymentConfigurationSchema` added to `libs/chat-shared`.
- **New frontend server-api helper** `getDeploymentConfiguration(deploymentName)` calls the new endpoint and returns the typed schema.
- **`ModelsContext`** is updated to call `getDeploymentConfiguration` when `selectedModelId` changes and expose the resulting schema as `selectedModelConfiguration`. The previously present `selectedModel` field has been removed — only `selectedModelConfiguration` is needed.
- **`StarterButtons` component** renders pill-shaped conversation-starter buttons on the welcome screen, driven by `selectedModelConfiguration.properties.starter.oneOf`.

## Capabilities

### New Capabilities

- `deployment-configuration`: Backend proxy endpoint and frontend fetch helper that retrieve the JSON Schema configuration for a DIAL Core deployment. Triggers when a model/application is selected and exposes the schema through `ModelsContext`.
- `starter-buttons`: Welcome-screen conversation-starter buttons populated from the deployment configuration schema's `starter.oneOf` entries.

### Modified Capabilities

- `models-context`: `selectedModel: DialModelDto | null` removed; `selectedModelConfiguration: DeploymentConfigurationSchema | null` added.

## Impact

- `libs/chat-shared/src/models/deployment-configuration.ts` — new file with `StarterWidgetOptions`, `StarterOption`, `DeploymentConfigurationSchemaProperty`, `DeploymentConfigurationSchema`; re-exported from `libs/chat-shared/src/index.ts`
- `apps/chat-api/src/deployments/` — new `getDeploymentConfiguration` method in service, new `GET :deployment/configuration` route in controller, Swagger decorators added
- `apps/chat/src/server-api/deployments.ts` — new `getDeploymentConfiguration` export
- `apps/chat/src/context/ModelsContext.tsx` — `selectedModel` removed; `selectedModelConfiguration` state + effect added
- `apps/chat/src/components/StarterButtons/StarterButtons.tsx` — new component
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — `StarterButtons` rendered below `ConversationInput`
- `@epam/chat-api-client` openapi spec (`openapi.json`) and generated client (`DeploymentsApi`) — new operation `getDeploymentConfiguration`; generated client rebuilt after spec update
- No new npm dependencies required; DIAL SDK `configurationDeployment` method is already available

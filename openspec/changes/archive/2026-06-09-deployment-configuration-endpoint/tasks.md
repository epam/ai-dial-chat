## 1. Shared types — deployment configuration schema

- [x] 1.1 Add `DeploymentConfigurationSchemaProperty` and `DeploymentConfigurationSchema` interfaces to `libs/chat-shared/src/models/deployment-configuration.ts` with fields `type?`, `title?`, `additionalProperties?`, `properties?: Record<string, DeploymentConfigurationSchemaProperty>`, plus `[key: string]: unknown` index signature on both; export from `libs/chat-shared/src/index.ts`
- [x] 1.2 Add `StarterWidgetOptions` interface (`populateText: string`, `submit: boolean`, `confirmationMessage: string | null`) and `StarterOption` interface (`const: number`, `title: string`, `'dial:widgetOptions': StarterWidgetOptions`) to the same file; update `DeploymentConfigurationSchemaProperty.oneOf` to `StarterOption[] | unknown[]`; export both from `libs/chat-shared/src/index.ts`

## 2. Backend — DeploymentsService

- [x] 2.1 Add `getDeploymentConfiguration(name: string, userSub: string, accessToken: string): Promise<Record<string, unknown>>` to `apps/chat-api/src/deployments/deployments.service.ts` using `this.client.configurationDeployment(name, { headers: getBearerAuthHeaders(accessToken) })` with in-memory cache key `deployments:configuration:<userSub>:<name>` (60 s TTL)
- [x] 2.2 Handle `result.error` → `mapDialHttpStatus`; handle catch → `handleDialFetchError`

## 3. Backend — DeploymentsController

- [x] 3.1 Add `GET :deployment/configuration` route handler in `apps/chat-api/src/deployments/deployments.controller.ts` that calls `deploymentsService.getDeploymentConfiguration(deployment, userSub, at)` — note: `DeploymentsController` is **unversioned**, so the route resolves to `/api/deployments/:deployment/configuration` (not `/api/v1/...`)
- [x] 3.2 Add `@ApiOperation`, `@ApiResponse` Swagger decorators (200 `Record<string,unknown>`, 401, 404, 502, 503) under the `deployments` tag

## 4. Backend — Tests

- [x] 4.1 Add unit tests for `DeploymentsService.getDeploymentConfiguration` covering: success (cache miss → upstream call), cache hit, DIAL Core 404 → HTTP 404, network error → HTTP 503
- [x] 4.2 Add controller and integration tests for `GET /api/deployments/:deployment/configuration`: 200 passthrough, 401 when unauthenticated, 404 and 503 passthrough

## 5. API Client — openapi spec + codegen

- [x] 5.1 Add `GET /api/deployments/{deployment}/configuration` operation to `libs/chat-api-client/openapi.json`: `operationId: getDeploymentConfiguration`, path param `deployment`, response 200 `{ type: object, additionalProperties: true }`, responses 401/404/502/503
- [x] 5.2 Add `GetDeploymentConfigurationRequest` interface and `getDeploymentConfiguration` / `getDeploymentConfigurationRaw` methods to `libs/chat-api-client/src/generated/src/apis/DeploymentsApi.ts` (path: `/api/deployments/{deployment}/configuration`)
- [x] 5.3 Rebuild `@epam/chat-api-client` (`npm exec nx build chat-api-client`) — zero TypeScript errors

## 6. Frontend — server-api helper

- [x] 6.1 Add `export const getDeploymentConfiguration = (deploymentName: string): Promise<DeploymentConfigurationSchema> => deploymentsApi.getDeploymentConfiguration({ deployment: deploymentName }) as Promise<DeploymentConfigurationSchema>;` to `apps/chat/src/server-api/deployments.ts`; import `DeploymentConfigurationSchema` from `@epam/ai-dial-chat-shared`

## 7. Frontend — ModelsContext

- [x] 7.1 Remove `selectedModel: DialModelDto | null` (and its state, effect, and `getModel` import) from `ModelsContext`
- [x] 7.2 Add `selectedModelConfiguration: DeploymentConfigurationSchema | null` to `ModelsContextType`; import `DeploymentConfigurationSchema` from `@epam/ai-dial-chat-shared`
- [x] 7.3 Add `const [selectedModelConfiguration, setSelectedModelConfiguration] = useState<DeploymentConfigurationSchema | null>(null);` state to `ModelsProvider`
- [x] 7.4 Add a `useEffect` that watches `selectedModelId`: when `null` → `setSelectedModelConfiguration(null)`; otherwise call `getDeploymentConfiguration(selectedModelId)`, update state on success, set `error` and `setSelectedModelConfiguration(null)` on failure; use a `cancelled` flag for cleanup
- [x] 7.5 Include `selectedModelConfiguration` in the `useMemo` context value object and its dependency array

## 8. Frontend — StarterButtons component

- [x] 8.1 Create `apps/chat/src/components/StarterButtons/StarterButtons.tsx` with `Props: { starters: StarterOption[]; onSelect: (text: string) => void }`; render a `<div role="list">` of `DialRoundedButton` elements, each displaying `starter.title` and calling `onSelect(starter['dial:widgetOptions'].populateText)` on click; return `null` when `starters` is empty
- [x] 8.2 Update `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` to read `selectedModelConfiguration` from `useModels()`, extract `properties.starter.oneOf as StarterOption[]`, and render `<StarterButtons starters={starters} onSelect={handleSend} />` below `<ConversationInput>`

## 9. Frontend — Verification

- [x] 9.1 Run `npm exec nx lint chat` and `npm exec nx build chat` — zero TypeScript/ESLint errors
- [x] 9.2 Smoke-test locally: select a model in the UI, confirm `selectedModelConfiguration` is populated and starter buttons render on the welcome screen

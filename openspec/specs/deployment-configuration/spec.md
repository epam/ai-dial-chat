# Spec: deployment-configuration

## Requirements

### Requirement: Backend exposes deployment configuration schema endpoint

`GET /api/v1/deployments/:deployment/configuration` SHALL proxy the DIAL Core `GET /v1/deployments/{deployment_name}/configuration` endpoint using the authenticated session user's access token. The response body SHALL be the raw JSON object returned by DIAL Core (`Record<string, unknown>`). The endpoint is hosted on the versioned `DeploymentsController`, so the route resolves below `/api/v1/deployments`. The endpoint SHALL be documented in Swagger under the `deployments` tag.

The decoded `deployment` parameter may be a single-segment static deployment name or a slash-separated DIAL resource identifier. The BFF MUST reject identifiers longer than 2048 characters, empty segments, `.` or `..` segments, and ASCII control characters with 400 before calling DIAL Core. For accepted values it MUST percent-encode every segment independently before passing the identifier to the DIAL SDK, preserving structural `/` separators.

Cache: results SHALL be cached in-memory for 60 seconds, keyed as `deployments:configuration:<userSub>:<deploymentName>`.

Rate limiting: inherits the global throttler default (no per-route override required).

#### Scenario: Configuration returned for a configurable deployment

- **WHEN** an authenticated user calls `GET /api/v1/deployments/my-model/configuration` and DIAL Core returns a JSON Schema object
- **THEN** the endpoint returns HTTP 200 with the JSON Schema body

#### Scenario: Cache hit avoids upstream call

- **WHEN** the same user requests configuration for the same deployment within 60 seconds
- **THEN** the service returns the cached value without calling DIAL Core

#### Scenario: Deployment does not support configuration (DIAL Core 404)

- **WHEN** DIAL Core returns 404 for the deployment's configuration endpoint
- **THEN** chat-api returns HTTP 404 to the client

#### Scenario: DIAL Core is unreachable

- **WHEN** the DIAL Core host is unreachable (network error)
- **THEN** the endpoint returns HTTP 503

#### Scenario: DIAL Core returns unexpected error

- **WHEN** DIAL Core returns a 5xx response
- **THEN** the endpoint returns HTTP 502

#### Scenario: Unauthenticated request is rejected

- **WHEN** the request carries no valid session cookie
- **THEN** the endpoint returns HTTP 401

#### Scenario: Unsafe deployment id is rejected before proxying

- **WHEN** the decoded `deployment` parameter contains an empty segment, a `.` or `..` segment, or an ASCII control character
- **THEN** the endpoint returns HTTP 400 without calling DIAL Core

---

### Requirement: Shared types for deployment configuration schema

`libs/chat-shared/src/models/deployment-configuration.ts` SHALL export the following interfaces (all with JSDoc on every property):

- **`StarterWidgetOptions`** — DIAL widget options for a starter button entry:
  - `populateText: string` — text to populate in the input field
  - `submit: boolean` — when true, auto-submits after populating
  - `confirmationMessage: string | null` — optional confirmation prompt before submission

- **`StarterOption`** — one entry in a `starter` property's `oneOf` array:
  - `const: number` — numeric schema `const` value (used as React key)
  - `title: string` — display label for the button
  - `'dial:widgetOptions': StarterWidgetOptions` — DIAL-specific widget options

- **`DeploymentConfigurationSchemaProperty`** — a single property within a deployment configuration JSON Schema:
  - `default?: unknown`
  - `description?: string`
  - `'dial:widget'?: string`
  - `oneOf?: StarterOption[] | unknown[]`
  - `[key: string]: unknown` index signature

- **`DeploymentConfigurationSchema`** — the JSON Schema object returned by the configuration endpoint:
  - `type?: string`
  - `title?: string`
  - `additionalProperties?: boolean | Record<string, unknown>`
  - `properties?: Record<string, DeploymentConfigurationSchemaProperty>`
  - `[key: string]: unknown` index signature

All four interfaces SHALL be re-exported from `libs/chat-shared/src/index.ts`.

#### Scenario: StarterOption shape matches DIAL Core API response

- **WHEN** DIAL Core returns a starter `oneOf` entry such as `{ const: 1, title: "WEO US GDP projection", "dial:widgetOptions": { populateText: "What is...", submit: true, confirmationMessage: null } }`
- **THEN** it is assignable to `StarterOption` without casting

---

### Requirement: Frontend server-api exposes getDeploymentConfiguration helper

`apps/chat/src/server-api/deployments.ts` SHALL export a `getDeploymentConfiguration(deploymentName: string): Promise<DeploymentConfigurationSchema>` function that calls `deploymentsApi.getDeploymentConfiguration({ deployment: deploymentName })` and casts the result to `DeploymentConfigurationSchema`. The generated `DeploymentsApi` client returns `Record<string, unknown>` at the network boundary; the cast happens in this helper so all callers receive the typed shape.

#### Scenario: Helper returns schema on success

- **WHEN** the backend returns HTTP 200 with a JSON Schema body
- **THEN** the helper resolves with a `DeploymentConfigurationSchema` value whose `type`, `title`, `properties`, and `additionalProperties` fields are accessible without further casting

#### Scenario: Helper propagates HTTP errors

- **WHEN** the backend returns HTTP 404 or 503
- **THEN** the helper rejects with an error (propagated by the generated client's error handling)

---

### Requirement: ModelsContext exposes selectedModelConfiguration

`ModelsContext` SHALL expose a `selectedModelConfiguration: DeploymentConfigurationSchema | null` field. The value SHALL be owned by `ModelsProvider` and updated whenever `selectedModelId` changes. The `ModelsContextType` interface SHALL declare this field with a JSDoc comment. The context value object SHALL include `selectedModelConfiguration` in its `useMemo` dependency array.

`ModelsContextType` SHALL NOT expose a `selectedModel` field (full model DTO). Only `selectedModelId` and `selectedModelConfiguration` are needed.

Cache key owned by context: none — context relies on the backend cache.

#### Scenario: Configuration loaded after model selection

- **WHEN** `selectedModelId` is set to a non-null value
- **THEN** `ModelsContext` calls `getDeploymentConfiguration(selectedModelId)` and updates `selectedModelConfiguration` with the result

#### Scenario: Configuration cleared when no model selected

- **WHEN** `selectedModelId` is set to `null`
- **THEN** `selectedModelConfiguration` is set to `null` without making a network request

#### Scenario: Configuration fetch is cancelled on unmount

- **WHEN** the component using `ModelsProvider` unmounts while the `getDeploymentConfiguration` fetch is in flight
- **THEN** the in-flight result is discarded (cancelled flag prevents `setState` after unmount)

#### Scenario: Configuration fetch error does not crash the context

- **WHEN** `getDeploymentConfiguration` rejects (e.g. deployment returns 404)
- **THEN** `selectedModelConfiguration` is set to `null` and `error` is updated with the caught error

#### Scenario: Consumer hook throws outside provider

- **WHEN** `useModels()` is called outside `ModelsProvider`
- **THEN** it throws `"useModels must be used within a ModelsProvider"`

---

### Requirement: StarterButtons component renders conversation starters

`apps/chat/src/components/StarterButtons/StarterButtons.tsx` SHALL render a list of pill-shaped buttons for each `StarterOption` in the `starters` prop. Each button SHALL display `starter.title` as its label. Clicking a button SHALL call `onSelect` with `starter['dial:widgetOptions'].populateText` as the argument.

The component SHALL return `null` when `starters` is empty.

Props:
- `starters: StarterOption[]` — starter options to display
- `onSelect: (text: string) => void` — called with the populate text on click

Each button SHALL use `DialRoundedButton` from `@epam/ai-dial-ui-kit`. The list SHALL be wrapped in a `<div role="list" aria-label="Conversation starters">`.

#### Scenario: Buttons render for each starter

- **WHEN** `starters` contains two entries with titles `"A"` and `"B"`
- **THEN** two `DialRoundedButton` elements are rendered with labels `"A"` and `"B"`

#### Scenario: Click sends populateText, not title

- **WHEN** a starter has `title: "WEO US GDP projection"` and `populateText: "What is the IMF WEO..."`
- **THEN** clicking the button calls `onSelect("What is the IMF WEO...")`

#### Scenario: Empty starters renders nothing

- **WHEN** `starters` is an empty array
- **THEN** the component returns `null`

---

### Requirement: ConversationRoute displays starter buttons

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL read `selectedModelConfiguration` from `ModelsContext`, extract `properties.starter.oneOf` as `StarterOption[]`, and pass it to `<StarterButtons>` below `<ConversationInput>`. The `onSelect` handler SHALL call `handleSend` with the populate text string.

#### Scenario: Starters shown when configuration has starter property

- **WHEN** `selectedModelConfiguration.properties.starter.oneOf` is a non-empty array
- **THEN** `StarterButtons` renders below `ConversationInput` with the extracted starters

#### Scenario: No starters shown when configuration is absent

- **WHEN** `selectedModelConfiguration` is `null` or has no `starter` property
- **THEN** `StarterButtons` receives an empty array and renders nothing

---

### Requirement: @epam/chat-api-client DeploymentsApi includes getDeploymentConfiguration

`libs/chat-api-client/src/generated/src/apis/DeploymentsApi.ts` SHALL include:
- `GetDeploymentConfigurationRequest` interface with `deployment: string`
- `getDeploymentConfigurationRaw(requestParameters: GetDeploymentConfigurationRequest): Promise<runtime.ApiResponse<Record<string, unknown>>>`
- `getDeploymentConfiguration(requestParameters: GetDeploymentConfigurationRequest): Promise<Record<string, unknown>>`

The path SHALL be `/api/v1/deployments/{deployment}/configuration` (versioned, matching the backend controller).

The `openapi.json` source SHALL include a `GET /api/v1/deployments/{deployment}/configuration` operation with:
- `operationId`: `getDeploymentConfiguration`
- Path parameter `deployment` (string, required)
- Response 200: `application/json` with schema `{ type: object, additionalProperties: true }`
- Responses 401, 404, 502, 503

#### Scenario: Generated client method exists and is callable

- **WHEN** the source is updated and the client is built
- **THEN** `deploymentsApi.getDeploymentConfiguration({ deployment: 'my-model' })` compiles without TypeScript errors and returns `Promise<Record<string, unknown>>`

---

### Requirement: Frontend consumption of deployment configuration schema

The system SHALL expose the deployment configuration schema (`DeploymentConfigurationSchema`) to frontend consumers for:
1. Extracting starter options from `properties.*.oneOf` arrays (existing behavior).
2. Extracting tool toggle metadata from boolean properties whose key matches a configured tool id (new behavior).

The `DeploymentsContext` SHALL continue to expose `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` unchanged. Downstream consumers (hooks, components) are responsible for interpreting specific schema properties.

#### Scenario: Existing starter extraction unchanged
- **WHEN** the deployment configuration schema contains a property with `oneOf` starter options and `dial:widget: "starter"`
- **THEN** `getStartersFromSchema()` continues to extract and render starter buttons as before

#### Scenario: Tool property extraction by configured id
- **WHEN** the deployment configuration schema contains a property key matching the configured `deepResearchToolId` with boolean type
- **THEN** the `useToolsMenu` hook extracts that property's `title` and `default` to construct a `ToolMenuItem`

#### Scenario: Non-matching properties ignored
- **WHEN** the deployment configuration schema contains boolean properties whose keys do NOT match `deepResearchToolId`
- **THEN** those properties are NOT rendered as tool menu items (they are ignored in this slice)

#### Scenario: Schema with both starters and tools
- **WHEN** the schema contains both a starter property (with `oneOf`) and a tool property (boolean matching configured id)
- **THEN** both starter buttons and the Tools menu item render independently without interference

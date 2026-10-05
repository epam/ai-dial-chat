# deployment-configuration Specification

## Purpose

The deployment configuration schema endpoint and the conversation starters the frontend renders from it.

## Requirements

### Requirement: Backend exposes deployment configuration schema endpoint

`GET /api/v1/deployments/:deployment/configuration` SHALL proxy the DIAL Core `GET /v1/deployments/{deployment_name}/configuration` endpoint using the authenticated session user's access token. The response body SHALL be a `DeploymentConfigurationDto` (`apps/chat-api/src/deployments/dto/deployment-configuration.dto.ts`) mapped from the DIAL Core JSON: `type` and `title` (kept only when strings), `properties` (kept only when an object), `additionalProperties`, and `isChatMessageInputDisabled` (`true` only when DIAL Core's `dial:chatMessageInputDisabled` is `true`, otherwise omitted). Other top-level DIAL Core keys are dropped. The endpoint is hosted on the versioned `DeploymentsController`, so the route resolves below `/api/v1/deployments`. The endpoint SHALL be documented in Swagger under the `deployments` tag.

The decoded `deployment` parameter may be a single-segment static deployment name or a slash-separated DIAL resource identifier. The BFF MUST reject identifiers longer than 2048 characters, empty segments, `.` or `..` segments, and ASCII control characters with 400 before calling DIAL Core. For accepted values it MUST percent-encode every segment independently before passing the identifier to the DIAL SDK, preserving structural `/` separators.

Cache: results SHALL be cached in-memory for 60 seconds, keyed as `deployments:configuration:<userSub>:<deploymentName>`.

#### Scenario: Configuration returned for a configurable deployment

- **WHEN** an authenticated user calls `GET /api/v1/deployments/my-model/configuration` and DIAL Core returns a JSON Schema object
- **THEN** the endpoint returns HTTP 200 with the mapped `DeploymentConfigurationDto` body

#### Scenario: Input-disabled flag is mapped

- **WHEN** the DIAL Core schema carries `"dial:chatMessageInputDisabled": true`
- **THEN** the response body carries `isChatMessageInputDisabled: true`

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
  - `populateText: string | null` — text to populate in the input field; `null` means the starter carries no text of its own
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
  - `isChatMessageInputDisabled?: boolean` — mapped by the backend from `dial:chatMessageInputDisabled`
  - `[key: string]: unknown` index signature

All four interfaces SHALL be re-exported from `libs/chat-shared/src/index.ts`.

#### Scenario: StarterOption shape matches DIAL Core API response

- **WHEN** DIAL Core returns a starter `oneOf` entry such as `{ const: 1, title: "WEO US GDP projection", "dial:widgetOptions": { populateText: "What is...", submit: true, confirmationMessage: null } }`
- **THEN** it is assignable to `StarterOption` without casting

---

### Requirement: Frontend server-api exposes getDeploymentConfiguration helper

`apps/chat/src/server-api/deployments.ts` SHALL export a `getDeploymentConfiguration(deploymentName: string): Promise<DeploymentConfigurationSchema>` function that calls `deploymentsApi.getDeploymentConfiguration({ deployment: deploymentName })` and casts the result to `DeploymentConfigurationSchema`. The generated `DeploymentsApi` client returns `DeploymentConfigurationDto` (whose `properties` is an untyped `Record<string, unknown>`); the cast happens in this helper so all callers receive the typed `DeploymentConfigurationSchemaProperty` shape.

#### Scenario: Helper returns schema on success

- **WHEN** the backend returns HTTP 200 with a JSON Schema body
- **THEN** the helper resolves with a `DeploymentConfigurationSchema` value whose `type`, `title`, `properties`, and `additionalProperties` fields are accessible without further casting

#### Scenario: Helper propagates HTTP errors

- **WHEN** the backend returns HTTP 404 or 503
- **THEN** the helper rejects with an error (propagated by the generated client's error handling)

---

### Requirement: DeploymentsContext exposes selectedDeploymentConfiguration

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) SHALL expose `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` alongside `selectedDeploymentDetails: DeploymentDetailsDto | null` and `isDeploymentDetailsLoading: boolean`, each declared with JSDoc on `DeploymentsContextType`. `DeploymentsProvider` owns the values and reloads them whenever `resolvedSelectedDeploymentId` changes — the selected item id resolved against the deployment list by id or reference, falling back to the raw selected id.

The provider fetches `getDeploymentConfiguration(id)` and `getDeploymentDetails(id)` together through `Promise.allSettled`; each value is set from its own result, or `null` when that request rejected. A configuration failure does not touch the context's `error` field, which reports only the deployments-list fetch.

Cache key owned by context: none — context relies on the backend cache.

#### Scenario: Configuration loaded after deployment selection

- **WHEN** `resolvedSelectedDeploymentId` becomes a non-null value
- **THEN** the provider calls `getDeploymentConfiguration` and `getDeploymentDetails` with that id and updates `selectedDeploymentConfiguration` and `selectedDeploymentDetails` with the results

#### Scenario: Configuration cleared when no deployment selected

- **WHEN** `resolvedSelectedDeploymentId` is `null`
- **THEN** `selectedDeploymentConfiguration` and `selectedDeploymentDetails` are set to `null` and `isDeploymentDetailsLoading` to `false` without making a network request

#### Scenario: Stale fetch is discarded

- **WHEN** the selection changes or the provider unmounts while the fetches are in flight
- **THEN** the in-flight results are discarded (an `isCancelled` signal prevents `setState`)

#### Scenario: Configuration fetch error does not crash the context

- **WHEN** `getDeploymentConfiguration` rejects (e.g. deployment returns 404)
- **THEN** `selectedDeploymentConfiguration` is set to `null`, `selectedDeploymentDetails` still reflects its own result, and `error` is unchanged

#### Scenario: Consumer hook throws outside provider

- **WHEN** `useDeployments()` is called outside `DeploymentsProvider`
- **THEN** it throws `"useDeployments must be used within a DeploymentsProvider"`

---

### Requirement: StarterButtons component renders conversation starters

`apps/chat/src/components/StarterButtons/StarterButtons.tsx` SHALL be a thin app wrapper around `StarterButtons` from `@epam/ai-dial-starter-buttons`. It forwards `starters` and `onSelect`, passes `isMobile` from `useIsMobile()`, sets `isCollapsible` to `!useUiFeature(OverlayFeature.ShowAllStarters)`, and supplies translated `labels`: `list` from `ChatI18nKeys.ConversationStarters` and `overflow` from `ChatI18nKeys.StarterButtonsOverflow`.

Props:
- `starters: StarterOption[]` — starter options to display
- `onSelect: (starter: StarterOption) => void` — called with the whole selected `StarterOption`

The lib component renders a `role="list"` container labelled `labels.list`, with one `role="listitem"` holding a `StarterButton` labelled `starter.title` per visible starter. When `isCollapsible` is true, starters that do not fit are moved into a `Dropdown` opened by an icon button labelled `labels.overflow`; when false, every starter is rendered in a column. It returns `null` when `starters` is empty.

#### Scenario: Buttons render for each starter

- **WHEN** `starters` contains two entries with titles `"A"` and `"B"` and both fit
- **THEN** two `StarterButton` list items are rendered with labels `"A"` and `"B"`

#### Scenario: Click passes the whole starter

- **WHEN** the user clicks the button for a starter, either in the list or in the overflow dropdown
- **THEN** `onSelect` is called with that `StarterOption`

#### Scenario: All starters shown when the overlay asks for it

- **WHEN** `OverlayFeature.ShowAllStarters` is enabled
- **THEN** `isCollapsible` is `false` and no overflow button is rendered

#### Scenario: Empty starters renders nothing

- **WHEN** `starters` is an empty array
- **THEN** the component returns `null`

---

### Requirement: ConversationRoute displays starter buttons

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL read `selectedDeploymentConfiguration` from `useDeployments()` and extract starters with `getStartersFromSchema` (`@epam/ai-dial-chat-hooks`), which uses the schema property keyed `starter`, else `button`, and returns its `oneOf` as `StarterOption[]` with that `propertyKey` and the property's `description`. When the selected deployment's own `conversationStarters` yield starters (`getQuickAppConversationStarters`), those take precedence and no `propertyKey` is used. The active starters render as `<StarterButtons>` children of `<NewConversationComposer>`.

`handleStarterSelect(starter)` SHALL branch on `starter['dial:widgetOptions'].submit`:
- `true` — when a deployment is selected, create a conversation through `apiCreateConversation` with the text from `getStarterConversationText(starter, description)` and a configuration value merging `{ [propertyKey]: starter.const }` (when a `propertyKey` exists) with the active tool configuration (omitted when empty), then navigate to the new conversation. Failure shows an error notification with the API message (fallback `ChatI18nKeys.CreateConversationError`) and request id.
- `false` — seed the composer with `getStarterConversationText(starter, description)` without sending.

`getStarterConversationText` returns the schema `description` only when the starter's `populateText` is `null`; otherwise `populateText`, falling back to `title` when empty.

#### Scenario: Starters shown when configuration has a starter property

- **WHEN** `selectedDeploymentConfiguration.properties.starter.oneOf` is a non-empty array
- **THEN** `StarterButtons` renders inside `NewConversationComposer` with the extracted starters

#### Scenario: Submitting starter creates a configured conversation

- **WHEN** the user selects a starter with `submit: true` and `const: 2` from the `starter` property
- **THEN** a conversation is created with configuration `{ starter: 2, ...toolConfigurationValue }` and the route navigates to it

#### Scenario: Non-submitting starter seeds the composer

- **WHEN** the user selects a starter with `submit: false`
- **THEN** the composer is seeded with the starter's text and no conversation is created

#### Scenario: No starters shown when configuration is absent

- **WHEN** `selectedDeploymentConfiguration` is `null` or has neither a `starter` nor a `button` property, and the deployment has no conversation starters
- **THEN** `StarterButtons` receives an empty array and renders nothing

---

### Requirement: @epam/chat-api-client DeploymentsApi includes getDeploymentConfiguration

`libs/chat-api-client/src/generated/src/apis/DeploymentsApi.ts` SHALL include:
- `GetDeploymentConfigurationRequest` interface with `deployment: string`
- `getDeploymentConfigurationRaw(requestParameters: GetDeploymentConfigurationRequest): Promise<runtime.ApiResponse<DeploymentConfigurationDto>>`
- `getDeploymentConfiguration(requestParameters: GetDeploymentConfigurationRequest): Promise<DeploymentConfigurationDto>`

The path SHALL be `/api/v1/deployments/{deployment}/configuration` (versioned, matching the backend controller).

The `openapi.json` source SHALL include a `GET /api/v1/deployments/{deployment}/configuration` operation with:
- `operationId`: `getDeploymentConfiguration`
- Path parameter `deployment` (string, required)
- Response 200: `application/json` with schema `DeploymentConfigurationDto`
- Responses 400, 401, 404, 502, 503

#### Scenario: Generated client method exists and is callable

- **WHEN** the source is updated and the client is built
- **THEN** `deploymentsApi.getDeploymentConfiguration({ deployment: 'my-model' })` compiles without TypeScript errors and returns `Promise<DeploymentConfigurationDto>`

---

### Requirement: Frontend consumption of deployment configuration schema

The system SHALL expose the deployment configuration schema (`DeploymentConfigurationSchema`) to frontend consumers for:
1. Extracting starter options from `properties.*.oneOf` arrays (existing behavior).
2. Extracting tool toggle metadata from every boolean property of the schema.

The `DeploymentsContext` SHALL continue to expose `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` unchanged. Downstream consumers (hooks, components) are responsible for interpreting specific schema properties.

#### Scenario: Existing starter extraction unchanged
- **WHEN** the deployment configuration schema contains a property with `oneOf` starter options and `dial:widget: "starter"`
- **THEN** `getStartersFromSchema()` continues to extract and render starter buttons as before

#### Scenario: Tool extraction from boolean properties
- **WHEN** the deployment configuration schema contains a boolean-typed property
- **THEN** the `useToolsMenu` hook extracts that property's `title` and `default` to construct a `ToolMenuItem`, one per boolean property

#### Scenario: Non-boolean properties ignored
- **WHEN** the deployment configuration schema contains non-boolean properties (strings, numbers, `oneOf` starters)
- **THEN** those properties are NOT rendered as tool menu items

#### Scenario: Schema with both starters and tools
- **WHEN** the schema contains both a starter property (with `oneOf`) and a boolean tool property
- **THEN** both starter buttons and the Tools menu item render independently without interference

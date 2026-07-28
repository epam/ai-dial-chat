## ADDED Requirements

### Requirement: Client configuration factory
`apps/chat/src/server-api/api-client.ts` SHALL export a `createApiConfiguration()` factory function that returns a `Configuration` instance configured with `basePath: ''`, `credentials: 'include'`, and the CSRF, unauthorized, and telemetry middlewares. It SHALL also export pre-built module-level singleton instances: `modelsApi`, `deploymentsApi`, `conversationsApi`.

#### Scenario: Same-origin requests
- **WHEN** a generated API class is instantiated via the factory
- **THEN** all requests it makes SHALL be relative URLs (no hardcoded host), compatible with the Vite dev proxy (`/api/**` → `localhost:5000`) and production same-origin deployment

#### Scenario: Cookies forwarded
- **WHEN** the factory-created client sends any request
- **THEN** `credentials: 'include'` SHALL be set on the underlying `fetch` call so session cookies are forwarded

---

### Requirement: CSRF middleware
The CSRF middleware SHALL inject an `X-CSRF-Token` header on every non-GET request when a CSRF token has been set via `setCsrfToken()`.

#### Scenario: CSRF token present, mutating request
- **WHEN** `setCsrfToken('abc123')` has been called
- **AND** a POST/PUT/DELETE request is made via a generated API class
- **THEN** the request SHALL include the header `X-CSRF-Token: abc123`

#### Scenario: CSRF token absent
- **WHEN** no CSRF token has been set (initial state or after `setCsrfToken(null)`)
- **AND** a POST request is made
- **THEN** no `X-CSRF-Token` header SHALL be added to the request

#### Scenario: GET request never carries CSRF token
- **WHEN** a GET request is made regardless of CSRF token state
- **THEN** no `X-CSRF-Token` header SHALL be added

---

### Requirement: Unauthorized (401) middleware
The unauthorized middleware SHALL intercept HTTP 401 responses, notify all registered `onUnauthorized` listeners, and throw `UnauthorizedError` with the request URL. The error SHALL propagate to the original caller.

#### Scenario: 401 response received
- **WHEN** the backend returns HTTP 401 for any request made via a generated API class
- **THEN** all listeners registered via `onUnauthorized()` SHALL be called with the request URL
- **AND** an `UnauthorizedError` SHALL be thrown

#### Scenario: Non-401 error response
- **WHEN** the backend returns HTTP 4xx or 5xx that is not 401
- **THEN** `onUnauthorized` listeners SHALL NOT be called
- **AND** the generated client's normal error handling SHALL proceed (throws `runtime.ResponseError`)

#### Scenario: Listener deregistration
- **WHEN** a listener was registered via `onUnauthorized()` and then its returned cleanup function was called
- **THEN** that listener SHALL NOT be called on subsequent 401 responses

---

### Requirement: Telemetry middleware
The telemetry middleware SHALL record the HTTP method, URL, response status, and request duration for every API call made via generated API classes.

#### Scenario: Successful request telemetry
- **WHEN** a generated API method completes successfully
- **THEN** the telemetry middleware post-hook SHALL have access to the method, URL, response status, and elapsed duration

#### Scenario: Failed request telemetry
- **WHEN** a generated API method receives a non-2xx response
- **THEN** the telemetry middleware SHALL still execute (post-hook fires before the client throws)

---

### Requirement: Models domain module uses generated client
`apps/chat/src/server-api/models.ts` SHALL delegate to `ModelsApi` from `@epam/chat-api-client` instead of calling `get()` from `base.ts`. The exported function signatures (`getModels`, `getModel`) SHALL remain identical.

#### Scenario: List models
- **WHEN** `getModels()` is called
- **THEN** it SHALL return a `DialModelListResponse`-compatible value via `ModelsApi.listModels()`

#### Scenario: Get single model
- **WHEN** `getModel(modelName)` is called
- **THEN** it SHALL return a `DialModel`-compatible value via `ModelsApi.getModel({ modelName })`

---

### Requirement: Deployments domain module uses generated client
`apps/chat/src/server-api/deployments.ts` SHALL delegate to `DeploymentsApi` from `@epam/chat-api-client`. The exported function signatures (`getDeployments`, `getDeployment`) SHALL remain identical.

#### Scenario: List deployments
- **WHEN** `getDeployments()` is called
- **THEN** it SHALL return a deployment list via `DeploymentsApi.listDeployments()`

#### Scenario: Get single deployment
- **WHEN** `getDeployment(deploymentName)` is called
- **THEN** it SHALL return a single deployment via `DeploymentsApi.getDeployment({ deploymentName })`

---

### Requirement: Conversations domain module uses generated client
`apps/chat/src/server-api/conversations.api.ts` SHALL delegate to `ConversationsApi` from `@epam/chat-api-client`. The exported function signatures (`createConversation`, `getConversation`, `saveConversation`, `deleteConversation`, `getConversationMetadata`) SHALL remain identical.

#### Scenario: Create conversation
- **WHEN** `createConversation(firstMessage)` is called
- **THEN** it SHALL POST via `ConversationsApi` and return a `Conversation`

#### Scenario: Get conversation by path
- **WHEN** `getConversation(conversationPath)` is called
- **THEN** it SHALL GET via `ConversationsApi` with the `path` query parameter encoded correctly

#### Scenario: Save conversation
- **WHEN** `saveConversation(conversationPath, conversation)` is called
- **THEN** it SHALL PUT via `ConversationsApi` with the `path` query parameter and conversation body

#### Scenario: Delete conversation
- **WHEN** `deleteConversation(conversationPath)` is called
- **THEN** it SHALL DELETE via `ConversationsApi` with the encoded `path` query parameter

#### Scenario: Get conversation metadata
- **WHEN** `getConversationMetadata(conversationPath, { permissions: true })` is called
- **THEN** it SHALL GET via `ConversationsApi` with both `path` and `permissions` query parameters

---

### Requirement: `base.ts` infrastructure symbols preserved
`UnauthorizedError`, `onUnauthorized`, `setCsrfToken`, `getCsrfToken`, `isValidResponse`, and `hasRequiredProperties` SHALL remain exported from `apps/chat/src/server-api/base.ts` throughout and after the migration. The `get`/`post`/`put`/`del` helpers and entries in `ApiEndpoints` that are no longer referenced by any module (excluding `chat-stream.api.ts`) SHALL be removed after all domain modules are migrated.

#### Scenario: 401 error identity preserved
- **WHEN** any code catches an error thrown by the unauthorized middleware
- **THEN** `error instanceof UnauthorizedError` SHALL be `true`
- **AND** `error.status` SHALL equal `401`

#### Scenario: Streaming module unaffected
- **WHEN** `chat-stream.api.ts` is compiled after the migration
- **THEN** it SHALL still resolve `ApiEndpoints.CONVERSATIONS` and `getCsrfToken` from `base.ts` without errors

---

### Requirement: `@epam/chat-api-client` is a declared dependency of `apps/chat`
`apps/chat/package.json` (or the workspace root `package.json` with appropriate Nx project boundary configuration) SHALL declare `@epam/chat-api-client` as a dependency so `nx graph` shows the correct lib → app edge.

#### Scenario: Dependency graph edge
- **WHEN** `pnpm nx graph` is run after the migration
- **THEN** `apps/chat` SHALL show an explicit dependency on `libs/chat-api-client`

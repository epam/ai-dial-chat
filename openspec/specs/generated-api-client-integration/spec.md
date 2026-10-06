# generated-api-client-integration Specification

## Purpose
Defines how frontend domain modules consume the generated `@epam/ai-dial-chat-api-client` OpenAPI client — factory-created, same-origin, cookie-forwarding API instances with CSRF/unauthorized/telemetry middleware — instead of hand-rolled `fetch` calls, keeping app-side API wrappers thin adapters over generated methods.
## Requirements
### Requirement: Client configuration factory
`apps/chat/src/server-api/api-client.ts` SHALL export a `createApiConfiguration()` factory function that returns a `Configuration` instance configured with `basePath: ''`, `credentials: 'include'`, and the CSRF, unauthorized, and telemetry middlewares. It SHALL also export pre-built module-level singleton instances built from one shared `createApiConfiguration()` result — one per generated API class the app consumes (e.g. `deploymentsApi`, `conversationsApi`, `filesApi`, `skillsApi`, `shareApi`, `promptsApi`, `publishApi`, `toolsetsApi`).

#### Scenario: Same-origin requests
- **WHEN** a generated API class is instantiated via the factory
- **THEN** all requests it makes SHALL be relative URLs (no hardcoded host), compatible with the Vite dev proxy (`/api/**` → `localhost:5000`) and production same-origin deployment

#### Scenario: Cookies forwarded
- **WHEN** the factory-created client sends any request
- **THEN** `credentials: 'include'` SHALL be set on the underlying `fetch` call so session cookies are forwarded

---

### Requirement: CSRF middleware
`apps/chat/src/server-api/api-client.ts` SHALL obtain its CSRF middleware by calling `@epam/ai-dial-chat-hooks`'s `createCsrfMiddleware({ getCsrfToken, setCsrfToken })` with `apps/chat/src/server-api/base.ts`'s existing `getCsrfToken`/`setCsrfToken`, instead of defining `csrfMiddleware` inline. The middleware SHALL inject an `X-CSRF-Token` header on every non-GET request when a CSRF token has been set via `setCsrfToken()`.

#### Scenario: CSRF token present, mutating request
- **WHEN** `setCsrfToken('abc123')` has been called
- **AND** a POST/PUT/DELETE request is made via a generated API class configured with `api-client.ts`'s `Configuration`
- **THEN** the request SHALL include the header `X-CSRF-Token: abc123`

#### Scenario: CSRF token absent
- **WHEN** no CSRF token has been set (initial state or after `setCsrfToken(null)`)
- **AND** a POST request is made
- **THEN** no `X-CSRF-Token` header SHALL be added to the request

#### Scenario: GET request never carries CSRF token
- **WHEN** a GET request is made regardless of CSRF token state
- **THEN** no `X-CSRF-Token` header SHALL be added

#### Scenario: Middleware is produced by the shared factory
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected
- **THEN** its CSRF middleware is the return value of `createCsrfMiddleware` imported from `@epam/ai-dial-chat-hooks`, with no locally re-implemented CSRF-header-injection logic

---

### Requirement: Unauthorized (401) middleware
`apps/chat/src/server-api/api-client.ts` SHALL obtain its unauthorized middleware by calling `@epam/ai-dial-chat-hooks`'s `createUnauthorizedMiddleware({ notifyUnauthorized, refreshCsrfToken, isInvalidCsrfErrorBody, getCsrfToken, setCsrfToken, createUnauthorizedError })` with `apps/chat/src/server-api/base.ts`'s existing implementations (`refreshCsrfToken` adapted from `base.ts`'s `CsrfRefreshStatus` enum to the factory's plain-literal `CsrfRefreshOutcome`, and `createUnauthorizedError` returning `new UnauthorizedError(url)`), instead of defining `unauthorizedMiddleware` inline. The middleware SHALL intercept HTTP 401 responses, notify all registered `onUnauthorized` listeners, throw `UnauthorizedError` with the request URL, and refresh-and-retry exactly once on a classified invalid-CSRF response.

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

#### Scenario: Invalid-CSRF response refreshes and retries once
- **WHEN** a response is classified invalid-CSRF by `isInvalidCsrfErrorBody`
- **THEN** the middleware refreshes the CSRF token via `refreshCsrfToken` and retries the original request exactly once

#### Scenario: Middleware is produced by the shared factory
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected
- **THEN** its unauthorized middleware is the return value of `createUnauthorizedMiddleware` imported from `@epam/ai-dial-chat-hooks`, with no locally re-implemented 401/invalid-CSRF-retry logic

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

### Requirement: Deployments domain module uses generated client
The deployments wrappers SHALL delegate to the `deploymentsApi` singleton (`DeploymentsApi` from `@epam/ai-dial-chat-api-client`): `apps/chat/src/server-api/deployments.api.ts` exports `getDeployments(interfaceType?, refresh?)`, and `apps/chat/src/server-api/deployments.ts` exports `getDeploymentConfiguration(deploymentName)` and `getDeploymentDetails(deploymentId)`. There is no single-deployment `getDeployment` wrapper.

#### Scenario: List deployments
- **WHEN** `getDeployments(interfaceType, refresh)` is called
- **THEN** it SHALL return a `DeploymentsResponseDto` via `deploymentsApi.listDeployments({ interfaceType, refresh })`

#### Scenario: Get deployment configuration and details
- **WHEN** `getDeploymentConfiguration(deploymentName)` or `getDeploymentDetails(deploymentId)` is called
- **THEN** it SHALL delegate to `deploymentsApi.getDeploymentConfiguration({ deployment })` or `deploymentsApi.getDeploymentDetails({ deployment })` respectively

---

### Requirement: Conversations domain module uses generated client
`apps/chat/src/server-api/conversations.api.ts` SHALL delegate to `ConversationsApi` from `@epam/ai-dial-chat-api-client`. Its exported wrappers include `createConversation`, `getConversation`, `saveConversation`, `deleteConversation`, `markConversationViewed`, `listConversations`, `renameConversation`, `generateConversationTitle`, `duplicateConversation`, `deleteAllConversations`, `watchConversation`, and `attachToGeneration`; the generated `ConversationsApi.getConversationMetadata` has no app wrapper.

#### Scenario: Create conversation
- **WHEN** `createConversation(firstMessage, deploymentId, attachments?, configurationValue?, formValue?, skills?)` is called
- **THEN** it SHALL POST via `conversationsApi.createConversation`, nesting any attachments, configuration value, form value, or skills under `custom_content`

#### Scenario: Get conversation by path
- **WHEN** `getConversation(conversationPath, signal?)` is called
- **THEN** it SHALL GET via `ConversationsApi` with the `path` query parameter encoded correctly, forwarding the optional `AbortSignal`

#### Scenario: Save conversation
- **WHEN** `saveConversation(conversationPath, conversation, signal?)` is called
- **THEN** it SHALL PUT via `ConversationsApi` with the `path` query parameter and a `saveConversationBodyDto: { conversation }` body

#### Scenario: Delete conversation
- **WHEN** `deleteConversation(conversationPath)` is called
- **THEN** it SHALL DELETE via `ConversationsApi` with the encoded `path` query parameter

#### Scenario: Streaming reconnect wrappers use Raw generated methods
- **WHEN** `watchConversation` or `attachToGeneration` is called
- **THEN** it SHALL call `conversationsApi.watchConversationRaw`/`conversationsApi.attachToGenerationRaw` to obtain the raw streaming `Response`

---

### Requirement: `base.ts` infrastructure symbols preserved
`UnauthorizedError`, `onUnauthorized`, `setCsrfToken`, `getCsrfToken`, `isValidResponse`, and `hasRequiredProperties` SHALL remain exported from `apps/chat/src/server-api/base.ts` throughout and after the migration. The `del` helper has been removed; `get`, `post`, and `put` remain exported from `base.ts` because `ThemeContext.tsx` still calls `get` and `chat.api.ts` still calls `post`.

#### Scenario: 401 error identity preserved
- **WHEN** any code catches an error thrown by the unauthorized middleware
- **THEN** `error instanceof UnauthorizedError` SHALL be `true`
- **AND** `error.status` SHALL equal `401`

#### Scenario: Streaming module unaffected
- **WHEN** `chat-stream.api.ts` is compiled after the migration
- **THEN** it SHALL still resolve `ApiEndpoints.CONVERSATIONS`, `getCsrfToken`, and `setCsrfToken` from `base.ts` without errors

---

### Requirement: `@epam/ai-dial-chat-api-client` is a declared dependency of `apps/chat`
`apps/chat` SHALL resolve `@epam/ai-dial-chat-api-client` as a workspace package so `nx graph` shows the correct lib → app edge. `apps/chat/package.json` does not list it; the edge comes from Nx's import inference over the npm workspace (`libs/*`), backed by the TypeScript project reference to `libs/chat-api-client/tsconfig.lib.json` in `apps/chat/tsconfig.app.json` and the `@epam/ai-dial-chat-api-client` → `libs/chat-api-client/src/index.ts` alias in `apps/chat/vite.config.mts`.

#### Scenario: Dependency graph edge
- **WHEN** `npm exec nx graph` is run after the migration
- **THEN** `apps/chat` SHALL show an explicit dependency on `libs/chat-api-client`

### Requirement: Skills domain module uses generated client
`apps/chat/src/server-api/api-client.ts` SHALL export a `skillsApi` singleton, built from `SkillsApi` in `@epam/ai-dial-chat-api-client` using the shared `createApiConfiguration()` factory, alongside the existing `deploymentsApi`/`conversationsApi`/`filesApi` singletons.

`apps/chat/src/server-api/skills.api.ts` SHALL provide thin wrapper functions for every skill operation (`listCatalogSkills`, `listSkills`, `listSkillFiles`, `getSkillMetadata`, `downloadSkill`, `downloadSkillFile`, `createSkill`, `updateSkill`, `importSkillArchive`, `uploadSkillFile`, `deleteSkill`, `deleteSkillFile`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder`), delegating to `skillsApi`, following the exact pattern `apps/chat/src/server-api/files.api.ts` already establishes for its own domain.

#### Scenario: skillsApi singleton is exported
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected
- **THEN** it exports `export const skillsApi = new SkillsApi(config);` alongside the other domain singletons

#### Scenario: Binary skill downloads use Raw generated methods
- **WHEN** `downloadSkill`/`downloadSkillFile` are called from `apps/chat/src/server-api/skills.api.ts`
- **THEN** they call `skillsApi.downloadSkillRaw(...)`/`skillsApi.downloadSkillFileRaw(...)` to obtain the raw `fetch` `Response` (whose `.body` is a `ReadableStream`), documenting the same generator gap `files.api.ts:downloadFile` already documents for `application/octet-stream`/`application/zip` responses

#### Scenario: ETag-returning mutations use normal generated methods
- **WHEN** `createSkill`, `updateSkill`, `uploadSkillFile`, `deleteSkillFile`, or `createSkillGroupingFolder` are called from `skills.api.ts`
- **THEN** the wrapper calls the plain (non-`Raw`) generated method, because the new ETag is returned in the JSON response body (e.g. `SkillUploadResponseDto.etag`) rather than as an HTTP response header; `updateSkill` requires an `ifMatch` argument

#### Scenario: Non-binary, non-ETag operations use normal generated methods
- **WHEN** `listCatalogSkills`, `listSkills`, `listSkillFiles`, `getSkillMetadata`, `importSkillArchive`, `deleteSkill`, or `deleteSkillGroupingFolder` are called from `skills.api.ts`
- **THEN** they use the normal (non-`Raw`) generated method, since their response is a small JSON body with no header the caller needs

#### Scenario: No hand-edited generated files
- **WHEN** the skills OpenAPI contract changes
- **THEN** `npm run openapi` and `npm run openapi:check` regenerate `libs/chat-api-client`'s `SkillsApi` and model classes — no file under `libs/chat-api-client/` is hand-edited


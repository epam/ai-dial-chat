## MODIFIED Requirements

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
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected after this change
- **THEN** its CSRF middleware is the return value of `createCsrfMiddleware` imported from `@epam/ai-dial-chat-hooks`, with no locally re-implemented CSRF-header-injection logic

---

### Requirement: Unauthorized (401) middleware
`apps/chat/src/server-api/api-client.ts` SHALL obtain its unauthorized middleware by calling `@epam/ai-dial-chat-hooks`'s `createUnauthorizedMiddleware({ notifyUnauthorized, refreshCsrfToken, isInvalidCsrfErrorBody })` with `apps/chat/src/server-api/base.ts`'s existing implementations, instead of defining `unauthorizedMiddleware` inline. The middleware SHALL intercept HTTP 401 responses, notify all registered `onUnauthorized` listeners, throw `UnauthorizedError` with the request URL, and refresh-and-retry exactly once on a classified invalid-CSRF response.

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
- **WHEN** `apps/chat/src/server-api/api-client.ts` is inspected after this change
- **THEN** its unauthorized middleware is the return value of `createUnauthorizedMiddleware` imported from `@epam/ai-dial-chat-hooks`, with no locally re-implemented 401/invalid-CSRF-retry logic

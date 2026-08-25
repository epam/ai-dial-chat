# dial-error-mapping Specification

## Purpose
Provides one shared mapper (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) that every `chat-api` domain service uses to translate a DIAL Core error — whether SDK-shaped (`@epam/ai-dial-typescript-sdk`) or fetch-shaped — into the matching NestJS `HttpException`, so upstream DIAL Core status codes surface consistently across the API instead of each domain reimplementing its own mapping.
## Requirements
### Requirement: Single DIAL error mapper for all chat-api domains
The system SHALL expose one module (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) that all `chat-api` domain services use to translate a DIAL Core error into a NestJS `HttpException`, regardless of whether the error originated from `@epam/ai-dial-typescript-sdk` (SDK-shaped, `{ status }`) or from a raw `fetch` call (`Response`-shaped, `AbortError`, network `TypeError`).

#### Scenario: SDK-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialSdkError(error, context, logger?, response?)` with an SDK error carrying `status` 400, 401, 403, 404, 409, 413, 429, or a 5xx value
- **THEN** the function throws the same NestJS `HttpException` subtype that the pre-consolidation `handleDialError` threw for that status code

#### Scenario: An optional response argument's status always wins over the error body
- **WHEN** a caller passes a 4th `response: { status: number }` argument to `handleDialSdkError` alongside an `error` argument
- **THEN** the function merges `response.status` into the error body before mapping, so `response.status` is used for exception selection even if the error body already carries its own (possibly stale or absent) `status` field, and omitting `response` falls back to using `error.status` (or a generic `BadGatewayException` if neither carries a usable status)

#### Scenario: Fetch-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialFetchError(err, context, logger, timeoutMs?)` with a `Response`-shaped error, an `AbortError`, or a network `TypeError`
- **THEN** the function throws the same NestJS `HttpException` subtype (including timeout/service-unavailable handling) that the pre-consolidation `handleDialFetchError` threw for that input

#### Scenario: Existing HttpException instances are re-thrown unchanged
- **WHEN** either `handleDialSdkError` or `handleDialFetchError` receives an error that is already an instance of `HttpException`
- **THEN** the function re-throws that exact exception without re-mapping it, its status code, or its response body

#### Scenario: Optional logger records the error before mapping
- **WHEN** a caller passes a `logger` argument to `handleDialSdkError`, `handleDialFetchError`, or `mapDialHttpStatus`
- **THEN** the mapper logs the error with the provided `context` before throwing the mapped exception, and omitting `logger` SHALL NOT change which exception is thrown

### Requirement: SDK-shaped error paths propagate the real upstream HTTP status
Every `chat-api` service method that calls `handleDialSdkError` after receiving an SDK-shaped `{ data, error, response }` result SHALL pass the raw `response` (or a `{ status }` value derived from it) as the 4th argument, not rely on the parsed error body alone, so `mapDialHttpStatus` throws the exception matching DIAL Core's actual response.

#### Scenario: deleteConversation surfaces 404 for an already-deleted conversation
- **WHEN** `ConversationLifecycleService.deleteConversation` calls the DIAL SDK and DIAL Core responds with HTTP 404 and an error body with no `status` field
- **THEN** the method throws `NotFoundException`, not `BadGatewayException`

#### Scenario: getStoredConversation-derived reads surface the real status
- **WHEN** `getConversation`, `duplicateConversation`, or `renameConversation` triggers `getStoredConversation` and DIAL Core responds with a non-2xx status
- **THEN** the caller receives the NestJS exception matching that real status code (e.g. 404 → `NotFoundException`), not a generic `BadGatewayException` from an un-shaped thrown error

#### Scenario: getUserBucket surfaces the real status
- **WHEN** `BucketService.getUserBucket` calls the DIAL SDK and DIAL Core responds with a non-2xx status
- **THEN** `handleDialSdkError` receives that real status (via the `response` argument) and throws the matching exception

#### Scenario: every SDK-shaped service passes the response through to the mapper
- **WHEN** any of `conversation.service.ts`, `bucket.service.ts`, `files.service.ts`, `user-config.service.ts`, `chat.service.ts`, or `transcription.service.ts` handles an SDK-shaped result on a path where a `response` is available
- **THEN** it passes that `response` (or a `{ status }` object derived from it) as the 4th argument to `handleDialSdkError`, so no SDK-path service can silently lose the upstream status; `rate.service.ts` is out of scope for this requirement because it is fetch-based, not SDK-shaped

### Requirement: mapDialHttpStatus maps 405, 412, and 422 explicitly
`mapDialHttpStatus` (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) SHALL map DIAL Core status `405` to `MethodNotAllowedException`, `412` to `PreconditionFailedException`, and `422` to `UnprocessableEntityException`, instead of falling through to the generic `>= 500` `BadGatewayException` branch (which previously caught nothing for these three codes and fell to the final catch-all `BadGatewayException` at the function's end). Every other previously-mapped status (`400`, `401`, `403`, `404`, `409`, `413`, `429`, `5xx`) SHALL remain mapped exactly as before this change.

This is required by the skills domain, whose verified DIAL Core operations (`downloadSkillFolder`, `uploadSkillFolder`, `uploadSkillFile`, `deleteSkillFile`, `deleteSkillGroupingFolder`, and others) declare real `405`/`412`/`422` responses in their OpenAPI schema, but is a shared-mapper change available to every `chat-api` domain, not skills-specific code.

#### Scenario: 405 maps to MethodNotAllowedException
- **WHEN** any caller invokes `mapDialHttpStatus(405, context, logger)`
- **THEN** the function throws `MethodNotAllowedException`, not `BadGatewayException`

#### Scenario: 412 maps to PreconditionFailedException
- **WHEN** any caller invokes `mapDialHttpStatus(412, context, logger)`
- **THEN** the function throws `PreconditionFailedException`, not `BadGatewayException`

#### Scenario: 422 maps to UnprocessableEntityException
- **WHEN** any caller invokes `mapDialHttpStatus(422, context, logger)`
- **THEN** the function throws `UnprocessableEntityException`, not `BadGatewayException`

#### Scenario: Existing status mappings are unchanged
- **WHEN** `mapDialHttpStatus` is called with any of `400`, `401`, `403`, `404`, `409`, `413`, `429`, or a `5xx` status
- **THEN** the exact same exception subtype it threw before this change is thrown again, verified by the pre-existing `dial-error.mapper.spec.ts` regression suite passing unmodified

#### Scenario: handleDialSdkError and handleDialFetchError inherit the new mappings automatically
- **WHEN** `handleDialSdkError` or `handleDialFetchError` resolves a `405`, `412`, or `422` status through `mapDialHttpStatus`
- **THEN** they throw the newly mapped exception without requiring any change to their own implementation, since both already delegate final status-to-exception mapping to `mapDialHttpStatus`


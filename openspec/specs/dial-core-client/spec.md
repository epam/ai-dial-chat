# dial-core-client Specification

## Purpose

A single shared DIAL Core SDK client service used by every chat-api domain.

### Requirement: Single shared DIAL Core SDK client
The system SHALL create exactly one `@epam/ai-dial-typescript-sdk` client instance per process, owned by `DialClientService`, using `createSDK({ baseUrl })` where `baseUrl` is read from the `DIAL_CORE_URL` environment variable via `ConfigService<EnvironmentVariables>` with `{ infer: true }`.

#### Scenario: Multiple services inject the client
- **WHEN** `ModelsService`, `ApplicationsService`, `ChatService`, and any other `chat-api` domain service are constructed within the same NestJS application instance
- **THEN** all of them receive the identical `DialClientService.client` reference (same object identity), and no additional `createSDK` call is made beyond the one performed by `DialClientService`'s constructor

#### Scenario: DialCoreModule is globally available
- **WHEN** a domain module (e.g. `ModelsModule`) declares `DialClientService` as a constructor dependency of one of its providers
- **THEN** Nest resolves the dependency without that domain module needing to list `DialCoreModule` in its own `imports` array, because `DialCoreModule` is registered with `@Global()`

### Requirement: DialClientService exposes baseUrl and dialApiVersion
`DialClientService` SHALL expose `baseUrl` (the raw `DIAL_CORE_URL` value) and `dialApiVersion` (the raw `DIAL_API_VERSION` value) as readonly members, in addition to `client`, so that services needing raw HTTP access or the `api-version` query parameter do not need their own `ConfigService` reads for these values.

#### Scenario: Raw fetch escape hatch
- **WHEN** `ApplicationsService` needs to call a DIAL Core endpoint not covered by the SDK (e.g. `/v1/bucket`)
- **THEN** it builds the request URL using `dialClient.baseUrl` rather than reading `DIAL_CORE_URL` from `ConfigService` itself

#### Scenario: Chat completion api-version parameter
- **WHEN** `ChatService`, `TranscriptionService`, or `ConversationNamingService` issue a chat completion request
- **THEN** they read `dialClient.dialApiVersion` for the `api-version` query parameter rather than reading `DIAL_API_VERSION` from `ConfigService` themselves

### Requirement: No behavior change to DIAL Core requests
Replacing inheritance-based client access with injected `DialClientService` access SHALL NOT change the DIAL Core base URL, API version, request headers, or any HTTP behavior observed by DIAL Core or by API consumers of `chat-api`.

#### Scenario: Identical outbound requests before and after migration
- **WHEN** any migrated service (e.g. `ModelsService.listModels`) issues the same logical request before and after the `DialClientService` migration
- **THEN** the resulting DIAL Core HTTP request (URL, method, headers, body) is unchanged

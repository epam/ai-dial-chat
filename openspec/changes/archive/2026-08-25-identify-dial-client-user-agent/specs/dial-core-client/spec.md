## MODIFIED Requirements

### Requirement: Single shared DIAL Core SDK client
The system SHALL create exactly one `@epam/ai-dial-typescript-sdk` client instance per process, owned by `DialClientService`, using `createSDK({ baseUrl, fetch })` where `baseUrl` is read from the `DIAL_CORE_URL` environment variable via `ConfigService<EnvironmentVariables>` with `{ infer: true }` and `fetch` is the shared DIAL Core transport owned by `DialClientService`.

#### Scenario: Multiple services inject the client
- **WHEN** `ModelsService`, `ApplicationsService`, `ChatService`, and any other `chat-api` domain service are constructed within the same NestJS application instance
- **THEN** all of them receive the identical `DialClientService.client` reference (same object identity), and no additional `createSDK` call is made beyond the one performed by `DialClientService`'s constructor

#### Scenario: DialCoreModule is globally available
- **WHEN** a domain module (e.g. `ModelsModule`) declares `DialClientService` as a constructor dependency of one of its providers
- **THEN** Nest resolves the dependency without that domain module needing to list `DialCoreModule` in its own `imports` array, because `DialCoreModule` is registered with `@Global()`

#### Scenario: SDK uses the shared Core transport
- **WHEN** `DialClientService` constructs the SDK client
- **THEN** it passes the same fetch-compatible transport that raw DIAL Core callers receive, so SDK and raw requests share the client identity behavior

### Requirement: No behavior change to DIAL Core requests
Except for cross-cutting transport behavior explicitly specified by this capability, replacing inheritance-based client access with injected `DialClientService` access SHALL NOT change the DIAL Core base URL, API version, operation-specific request headers, or any HTTP behavior observed by DIAL Core or by API consumers of `chat-api`.

#### Scenario: Identical operation-specific requests before and after migration
- **WHEN** any migrated service (e.g. `ModelsService.listModels`) issues the same logical request before and after the `DialClientService` migration
- **THEN** the resulting DIAL Core HTTP request has the same URL, method, operation-specific headers, and body, while also carrying any shared transport headers required by this capability

## ADDED Requirements

### Requirement: DIAL Core requests carry the Chat product identity
Every outbound HTTP request from `chat-api` to DIAL Core SHALL include exactly one `User-Agent` field with the value `ai-dial-chat/<normalized-version>`. The value is diagnostic metadata only and MUST NOT contain a tenant, user, hostname, pod, environment, credential, or Node.js runtime identifier. This behavior SHALL NOT change any browser-facing API, OpenAPI operation, generated client, authorization rule, rate limit, cache, UI, or feature flag.

#### Scenario: Configured deployment version
- **WHEN** `CHAT_VERSION` is `2026.08.25-a1b2c3d`
- **THEN** SDK-backed and raw DIAL Core requests include `User-Agent: ai-dial-chat/2026.08.25-a1b2c3d`

#### Scenario: Missing or blank deployment version
- **WHEN** `CHAT_VERSION` is missing or blank
- **THEN** the User-Agent version is derived from the bundled `apps/chat-api/package.json` version using the same fallback as the health and client-config version

#### Scenario: Version requires normalization
- **WHEN** the resolved version is ` release 2026/08 `
- **THEN** the outbound User-Agent is `ai-dial-chat/release-2026-08`
- **AND** the version exposed by health, client config, and the footer remains unchanged

#### Scenario: Version normalizes to no supported characters
- **WHEN** the resolved version contains no supported User-Agent version characters
- **THEN** the outbound User-Agent is `ai-dial-chat/unknown`

#### Scenario: Existing request headers are preserved
- **WHEN** an operation supplies Authorization, Accept, Content-Type, X-CONVERSATION-ID, X-DIAL-CLIENT-CHANNEL-ID, or other operation-specific headers
- **THEN** the shared Core transport preserves them and sets only the canonical User-Agent

#### Scenario: Caller attempts to override User-Agent
- **WHEN** an SDK or raw Core call supplies a different User-Agent value or casing
- **THEN** the shared Core transport replaces it with the canonical `ai-dial-chat/<normalized-version>` value without producing a duplicate header

### Requirement: Raw DIAL Core escape hatches use the shared transport
Any `chat-api` integration that calls a DIAL Core URL without an SDK operation MUST use the fetch-compatible transport exposed by `DialClientService` rather than `globalThis.fetch`, so the common User-Agent and future Core-only transport behavior remain consistent. Non-Core upstreams MUST continue using their own transport and MUST NOT receive the DIAL Chat-to-Core User-Agent automatically.

#### Scenario: Rating request uses the shared transport
- **WHEN** `RateService` proxies a rating to DIAL Core
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Scheduler request uses the shared transport
- **WHEN** `ScheduledTasksService` calls the DIAL Core Scheduler route not exposed by the SDK
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Streaming file upload uses the shared transport
- **WHEN** `FilesUploadService` uploads file content to a DIAL Core route not exposed by the SDK
- **THEN** it uses the `DialClientService` transport and includes both the operation's existing headers and the canonical User-Agent

#### Scenario: Non-Core upstream remains unaffected
- **WHEN** `ThemeService` fetches theme configuration or an icon from the configured theme service
- **THEN** it does not use the DIAL Core transport and does not receive `User-Agent: ai-dial-chat/<normalized-version>` from this capability

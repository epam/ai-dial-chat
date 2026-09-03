## ADDED Requirements

### Requirement: The `job_title` OIDC claim is captured into the session on login

`AuthController.callback()` SHALL include `job_title` in the allowlist of OIDC ID-token claims copied into `SessionPayload.claims` when present on the token, using the same allowlist mechanism as `name`, `email`, `preferred_username`, and the other existing allowlisted claims. No new per-provider configuration key is introduced for this claim name — it is read the same way for every provider, same as the other allowlisted claims (unlike `rolesClaim`, which is configurable). Once a request is authenticated via the session cookie, the same value is available as `SessionUser.claims['job_title']`.

#### Scenario: Provider's ID token includes a job title

- **WHEN** a user completes login and the ID token includes a `job_title` claim
- **THEN** the encrypted session payload's `claims` includes `job_title` with that value, and it is present on `SessionUser.claims` for every subsequent authenticated request in that session

#### Scenario: Provider's ID token omits job title

- **WHEN** a user completes login and the ID token has no `job_title` claim
- **THEN** the session's `claims` does not include a `job_title` key, and reading it from `SessionUser.claims` yields no value

### Requirement: Header-token authenticated callers forward job title from unfiltered claims

The header-token (JWT bearer) authentication strategy SHALL continue assigning the full verified JWT payload to `SessionUser.claims` without an allowlist filter, so a `job_title` claim present on that JWT is available the same way as for cookie-session callers, with no additional code path.

#### Scenario: Bearer JWT carries a job title claim

- **WHEN** a request is authenticated via `Authorization: Bearer <jwt>` and the verified JWT payload includes `job_title`
- **THEN** `SessionUser.claims['job_title']` holds that value for the request

### Requirement: Chat completion requests to DIAL Core carry the caller's job title

For an authenticated completion request, the BFF SHALL add an `X-JOB-TITLE` header carrying the caller's session `job_title` value (percent-encoded using the same byte-safety rules as `X-CONVERSATION-ID`) to the DIAL Core request for both the Chat Completions and the Responses API generation paths. When no `job_title` is available on the session, the header SHALL be omitted entirely rather than sent empty.

#### Scenario: Chat Completions path forwards job title

- **WHEN** a completion request is resolved to the Chat Completions generation API and the caller's session has `job_title` = `Lead Software Engineer`
- **THEN** the outbound DIAL Core chat completion request includes `X-JOB-TITLE: Lead Software Engineer`

#### Scenario: Responses API path forwards job title

- **WHEN** a completion request is resolved to the Responses API generation path and the caller's session has a `job_title` value
- **THEN** the outbound DIAL Core Responses API request includes `X-JOB-TITLE` with that value

#### Scenario: No job title on session

- **WHEN** a completion request is made by a caller whose session has no `job_title` claim
- **THEN** the outbound DIAL Core request (either generation path) omits `X-JOB-TITLE` entirely

#### Scenario: Job title requires percent-encoding

- **WHEN** the caller's `job_title` contains bytes outside the safe HTTP field-value range (e.g. non-ASCII characters)
- **THEN** the outbound `X-JOB-TITLE` value is percent-encoded the same way `X-CONVERSATION-ID` already is, and the request is not rejected by the HTTP client for an invalid header byte

### Requirement: Models list and default-model requests to DIAL Core carry the caller's job title

The `GET /api/v1/deployments` endpoint's single underlying DIAL Core `listDeployments` call — which backs both the models list and the default-model value embedded in that same response — SHALL include `X-JOB-TITLE` with the caller's session `job_title` value when present, omitted when absent. This header is not part of the deployments list cache key: a cache hit SHALL continue to skip the DIAL Core call (and therefore this header) exactly as it does today, since the header does not affect the returned deployment data.

#### Scenario: Deployments list request forwards job title

- **WHEN** `GET /api/v1/deployments` triggers a DIAL Core `listDeployments` call (cache miss or `refresh=true`) for a caller whose session has `job_title` set
- **THEN** the outbound DIAL Core request includes `X-JOB-TITLE` with that value

#### Scenario: Cached deployments response skips the DIAL Core call and the header

- **WHEN** `GET /api/v1/deployments` is served from the existing server-side cache
- **THEN** no DIAL Core request is made, and job title has no observable effect on the cached response

### Requirement: Rate requests to DIAL Core carry the caller's job title

`RateService.rateMessage` SHALL include `X-JOB-TITLE` with the caller's session `job_title` value when present, alongside the existing `X-CONVERSATION-ID` header, omitted when absent.

#### Scenario: Rate request forwards job title

- **WHEN** an authenticated caller with `job_title` set on their session submits `POST /api/v1/rate`
- **THEN** the outbound DIAL Core rate request includes both `X-CONVERSATION-ID` (unchanged) and `X-JOB-TITLE` with the caller's job title

### Requirement: Transcribe requests to DIAL Core carry the caller's job title

`TranscriptionService.transcribeAudio` SHALL include `X-JOB-TITLE` with the caller's session `job_title` value when present, omitted when absent.

#### Scenario: Transcribe request forwards job title

- **WHEN** an authenticated caller with `job_title` set on their session submits `POST /api/v1/transcription`
- **THEN** the outbound DIAL Core chat-completion-based transcription request includes `X-JOB-TITLE` with the caller's job title

### Requirement: No cross-cutting behavior change beyond the new header

This capability SHALL NOT change any REST endpoint path, HTTP method, request/response DTO, OpenAPI operation, generated SDK client shape, status code, per-route rate limit, authorization/role requirement, cache key or TTL, log content, or user-visible UI/i18n surface. It affects only: (1) which OIDC claims the session stores, and (2) one additional outbound header on the five DIAL Core request types listed above.

#### Scenario: OpenAPI contract is unchanged

- **WHEN** OpenAPI artifacts are regenerated after this change
- **THEN** no operation, DTO, or generated client method changes shape as a result of this capability

#### Scenario: Logs do not gain the job title value

- **WHEN** any of the five affected requests succeeds or fails
- **THEN** existing logs continue recording their current fields, and no new log line includes the caller's job title

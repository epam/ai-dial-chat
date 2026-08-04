## MODIFIED Requirements

### Requirement: Endpoint failure handling and rate limiting

The endpoint SHALL be rate limited per user via `@Throttle`, and SHALL translate upstream/LLM failures into typed HTTP exceptions rather than returning `null` or an empty name, using the shared `mapDialHttpStatus` / `handleDialFetchError` DIAL Core error mapping used elsewhere in `chat-api` so the same upstream status always maps to the same exception type across domains. Upstream DIAL Core rejections that indicate the calling user's token is not authorized for the configured `UTILITY_MODEL` deployment (upstream HTTP 401 or 403) SHALL be surfaced as HTTP 401 or 403 respectively, distinct from other upstream failures (timeouts, network errors, or upstream 5xx), which SHALL continue to surface as HTTP 503 or 502 respectively.

#### Scenario: Upstream LLM failure

- **WHEN** the DIAL Core / utility-model call fails with a network error or an upstream 5xx response
- **THEN** the system responds with HTTP 502 and logs the failure context, including the upstream status, without leaking secrets

#### Scenario: Upstream rejects the calling user's access to the utility model

- **WHEN** the DIAL Core / utility-model completion call responds with upstream HTTP 401 or 403 (the calling user's token is not authorized for the `UTILITY_MODEL` deployment)
- **THEN** the system responds with the matching HTTP 401 or 403 status
- **AND** the failure is logged at a level visible in standard production log aggregation (not only at debug level), including the upstream status and error body, without leaking the token or other secrets

#### Scenario: Rate limit exceeded

- **WHEN** a user exceeds the configured request rate for the endpoint
- **THEN** the system responds with HTTP 429

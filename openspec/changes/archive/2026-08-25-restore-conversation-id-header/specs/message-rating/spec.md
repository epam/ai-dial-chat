## MODIFIED Requirements

### Requirement: BFF rate endpoint

`POST /api/v1/rate` SHALL accept a JSON body with `conversationId`, `responseId`, `modelId`, and `rate` (`1` for like, `-1` for dislike), plus an optional `comment`. It SHALL proxy the rating to the DIAL Core endpoint `POST /v1/{modelId}/rate` using the authenticated session's access token as a Bearer credential and SHALL include `X-CONVERSATION-ID: <conversationId>` in that outbound BFF-to-DIAL-Core request. On success it SHALL return HTTP 204 No Content. Invalid request bodies SHALL return HTTP 400.

The browser-facing request DTO, response, generated `RateApi.rateMessage` method, authentication, authorization, rate limit, cache behavior, and error mapping SHALL remain unchanged. This transport-only change introduces no UI, state, i18n, RTL, accessibility, feature-flag, or telemetry event changes.

#### Scenario: Valid rating returns 204

- **WHEN** an authenticated user sends `POST /api/v1/rate` with a valid body
- **THEN** the endpoint returns HTTP 204 with an empty body

#### Scenario: Rating forwards the conversation id header

- **WHEN** an authenticated user rates a message with `conversationId: "bucket/gpt-4o__Hello__uuid"`
- **THEN** the BFF calls `POST /v1/{modelId}/rate` with `X-CONVERSATION-ID: bucket/gpt-4o__Hello__uuid`

#### Scenario: Missing required field returns 400

- **WHEN** `modelId` (or any other required field) is absent from the body
- **THEN** the endpoint returns HTTP 400

#### Scenario: Invalid rate value returns 400

- **WHEN** `rate` is a value other than `1` or `-1`
- **THEN** the endpoint returns HTTP 400

#### Scenario: DIAL Core error is propagated

- **WHEN** the DIAL Core rating endpoint returns a non-2xx status
- **THEN** the BFF returns an appropriate HTTP error (502 or 503)

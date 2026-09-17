# toolset-write-api Specification

## Purpose
TBD - created by archiving change add-toolset-editor-flow. Update Purpose after archive.
## Requirements
### Requirement: Create toolset endpoint
The backend SHALL expose `POST /api/v1/toolsets` that creates a toolset by proxying DIAL
Core using the caller's session access token. The request body SHALL be validated via a DTO;
the per-user toolset list cache SHALL be invalidated on success, and DIAL Core error statuses
SHALL be mapped to typed HTTP responses. The DTO SHALL NOT define an `intro` field — a request
body that still includes an `intro` property SHALL be rejected with a 400 (the global
`ValidationPipe`'s `forbidNonWhitelisted` behavior). The `endpoint` field SHALL be required to
be present but MAY be an empty string — an empty string is accepted so the toolset editor can
create a draft toolset right after its General step, before the endpoint is collected on the
Settings step; when non-empty, `endpoint` SHALL still be validated as a well-formed
`http(s)://` URL. DIAL Core validates the URI scheme of the endpoint it stores and accepts
only `http`/`https`, answering anything else with a 400 `invalid URI scheme <x>`; the SSE
transport is an ordinary `http(s)://` endpoint selected through `transport`, so an `sse://`
endpoint SHALL be rejected by the DTO rather than forwarded to DIAL Core. The `authSettings`
field SHALL be required to be present in the request body — an entirely omitted
`authSettings` SHALL fail DTO validation and SHALL NOT reach the DIAL Core call, regardless
of whether its nested `authenticationType` is itself valid.

#### Scenario: Successful create with a draft (empty) endpoint
- **WHEN** an authenticated user POSTs a toolset body with `endpoint` set to an empty string
- **THEN** the service proxies the create to DIAL Core and returns the created toolset
  identifier

#### Scenario: Missing endpoint field
- **WHEN** an authenticated user POSTs a toolset body with the `endpoint` field omitted
  entirely
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Missing authSettings field
- **WHEN** an authenticated user POSTs a toolset body with the `authSettings` field omitted
  entirely
- **THEN** the endpoint responds with a 400 naming `authSettings` and does not call DIAL Core

#### Scenario: Successful create
- **WHEN** an authenticated user POSTs a valid toolset body
- **THEN** the service proxies the create to DIAL Core, invalidates the user's toolset list
  cache, and returns the created toolset identifier

#### Scenario: Request body still includes intro
- **WHEN** an authenticated user POSTs a toolset body that includes an `intro` property
- **THEN** the endpoint responds with a 400 validation error (unknown property) and does not
  call DIAL Core

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Endpoint using the sse:// scheme
- **WHEN** an authenticated user POSTs a toolset body with `endpoint` set to
  `sse://mcp-test.example.com/events`, whether or not `transport` is `SSE`
- **THEN** the endpoint responds with a 400 naming `endpoint` and does not call DIAL Core

#### Scenario: SSE transport over an https endpoint
- **WHEN** an authenticated user POSTs a toolset body with `transport` set to `SSE` and
  `endpoint` set to an `https://` URL
- **THEN** the body passes DTO validation and is forwarded to DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Additional-locale translations on create and update
The create and update request bodies SHALL accept an optional `locales` array of
`{language, name, description}` entries and an optional `primaryLocale` string. When `locales`
is non-empty, `primaryLocale` SHALL be required by DTO validation; each entry's `language` SHALL
be validated against a locale-code pattern, and any unrecognized property on an entry (such as a
client-side `id`) SHALL be rejected. When `locales` is absent or empty, the service SHALL send
DIAL Core a plain-string `displayName`/`description`, identical to a request that predates this
field. When `locales` is non-empty, the service SHALL compose `displayName`/`description` into a
map keyed by `primaryLocale` (seeded from `name`/`description`) plus one key per `locales` entry.

#### Scenario: Create with additional locales composes a locale map
- **WHEN** an authenticated user POSTs a toolset body with one `locales` entry and a
  `primaryLocale`
- **THEN** the service sends DIAL Core a `displayName`/`description` map keyed by
  `primaryLocale` and by each entry's `language`

#### Scenario: Create without locales sends a plain string
- **WHEN** an authenticated user POSTs a toolset body with `locales` omitted
- **THEN** the service sends DIAL Core a plain-string `displayName`, unchanged from a request
  that predates additional-locale support

#### Scenario: Non-empty locales without primaryLocale is rejected
- **WHEN** an authenticated user POSTs a toolset body with a non-empty `locales` array and no
  `primaryLocale`
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: A locale entry with a stray client-side id is rejected
- **WHEN** an authenticated user POSTs a `locales` entry that includes an `id` property
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Update without locales replaces an existing locale map with a plain string
- **WHEN** an authenticated user PATCHes an existing toolset whose `displayName` is currently a
  locale map, omitting `locales` from the request body
- **THEN** the service sends DIAL Core a plain-string `displayName`, replacing the existing map

### Requirement: Update and delete toolset endpoints
The backend SHALL expose `PATCH /api/v1/toolsets/:toolsetName` and
`DELETE /api/v1/toolsets/:toolsetName` that proxy DIAL Core, validate the toolset name
parameter against an allowlist, and invalidate the affected caches on success.

#### Scenario: Successful update
- **WHEN** an authenticated user PATCHes an existing toolset with a valid body
- **THEN** the service proxies the update to DIAL Core and invalidates the relevant caches

#### Scenario: Successful delete
- **WHEN** an authenticated user DELETEs an existing toolset
- **THEN** the service proxies the delete to DIAL Core and invalidates the relevant caches

#### Scenario: Invalid toolset name
- **WHEN** the toolset name path parameter contains disallowed characters
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

### Requirement: Login and logout endpoints
The backend SHALL expose `POST /api/v1/toolsets/:toolsetName/login` and
`POST /api/v1/toolsets/:toolsetName/logout` that proxy DIAL Core credential submission and
revocation. The login endpoint SHALL accept the credentials level and either an API key or
an OAuth `code` + `redirectUri`, validated via a DTO.

Both endpoints SHALL accept valid bucketless platform deployment IDs, including platform
toolsets and applications configured as toolsets, as well as bucket-qualified toolset
references. The service SHALL derive the upstream `url` from the validated `toolsetName`
route parameter rather than the request body's `url`. Platform IDs SHALL NOT acquire an
invented bucket or resource prefix. Valid percent-encoded names SHALL be decoded once for
Core's credential API; bucket-qualified toolsets SHALL retain their bucket and nested path.
An incomplete `toolsets/` resource reference SHALL still be rejected with `400 Bad Request`
before credentials are sent upstream. This authentication behavior SHALL NOT relax the
validation used by resource CRUD operations.

The endpoints SHALL proxy `POST /v1/ops/toolset/signin` and
`POST /v1/ops/toolset/signout`, respectively, with the caller's session access token and
return `200` with `{ "success": true }` on success. Supporting bucketless IDs SHALL preserve
the existing request and response DTOs and generated `loginToolset` / `logoutToolset`
operations.

#### Scenario: API key login
- **WHEN** an authenticated user submits an API key login for a toolset
- **THEN** the service proxies the credential submission to DIAL Core and returns the result

#### Scenario: OAuth code login
- **WHEN** an authenticated user submits an OAuth `code` and `redirectUri` for a toolset
- **THEN** the service proxies the code exchange to DIAL Core and returns the result

#### Scenario: Logout
- **WHEN** an authenticated user requests logout for a toolset
- **THEN** the service proxies the credential revocation to DIAL Core

#### Scenario: Platform toolset login without a bucket
- **WHEN** an authenticated user submits valid API-key or OAuth credentials to
  `POST /api/v1/toolsets/NS_toolset_1097_test/login`
- **THEN** the service submits them to Core with `url: "NS_toolset_1097_test"`, without
  requiring or adding a bucket

#### Scenario: Platform application configured as a toolset
- **WHEN** an authenticated user logs in or out through these endpoints using the
  bucketless ID `NS_application_1097_test` of an application configured as a toolset
- **THEN** the service uses that ID as the upstream `url` without adding a `toolsets/`
  or `applications/` prefix

#### Scenario: Logout before login uses the platform ID
- **WHEN** a login flow first revokes existing credentials for `NS_toolset_1097_test`,
  or the user explicitly logs out of that toolset
- **THEN** the logout request reaches Core with `url: "NS_toolset_1097_test"` and is not
  rejected solely because the ID has no bucket

#### Scenario: Route identifier takes precedence over body URL
- **WHEN** a valid login or logout request targets `NS_toolset_1097_test` but its body
  contains `url: "different-resource"`
- **THEN** the service sends Core `url: "NS_toolset_1097_test"`

#### Scenario: Percent-encoded platform name
- **WHEN** the validated route parameter is `Platform%20toolset`
- **THEN** the upstream credential request contains `url: "Platform toolset"`

#### Scenario: Bucket-qualified nested paths retain their identity
- **WHEN** the validated route parameter is
  `toolsets/test-bucket/folder/My%20toolset__0.0.1`
- **THEN** the upstream credential request contains
  `url: "toolsets/test-bucket/folder/My toolset__0.0.1"`
- **AND** a literal percent encoded as `%25` is decoded once without double-encoding

#### Scenario: Incomplete resource reference remains invalid
- **WHEN** a login or logout request targets `toolsets/bucket` or `toolsets//name`
- **THEN** the endpoint returns `400 Bad Request` without submitting credentials to Core

### Requirement: Secrets are never returned or logged
The write API SHALL NOT return credential secrets (such as API key or client secret) in
responses and SHALL NOT log credential payloads. Existing secret redaction SHALL be applied
to any toolset returned to the client.

#### Scenario: Secret redaction on response
- **WHEN** a toolset response would include a client secret
- **THEN** the secret is stripped before the response is returned to the client

#### Scenario: No credential logging
- **WHEN** a login request is processed
- **THEN** the API does not write the API key, client secret, or code to logs

### Requirement: Endpoints are versioned, rate-limited, and documented
All new write endpoints SHALL be URI-versioned at `/api/v1/toolsets`, SHALL declare
`@Throttle` rate limits, and SHALL document every response status via `@ApiResponse`, with
handler names suitable for the generated client (e.g. `createToolset`, `updateToolset`,
`deleteToolset`, `loginToolset`, `logoutToolset`).

#### Scenario: OpenAPI contract regenerated
- **WHEN** the new endpoints are added
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` exposes the new operations

#### Scenario: Authentication required
- **WHEN** a request to a write endpoint has no valid session cookie
- **THEN** the endpoint responds with 401

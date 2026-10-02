## ADDED Requirements

### Requirement: Disabled-by-default deployment exposure registry

The BFF SHALL parse an immutable server-only registry directly from the CUSTOM_CORE_API_CONFIG environment string through ConfigService at startup. Unset, empty or whitespace-only values SHALL enable no operations. A nonblank value MUST be a JSON object with version equal to 1 and an operations array of at most 64 uniquely identified entries; an empty operations array SHALL be valid. The raw environment value MUST be at most 16 KiB measured as UTF-8 bytes before parsing. Each entry MUST contain id, method equal to GET and corePath, with only optional timeoutMs and maxResponseBytes. Malformed JSON, invalid root/version/operations types, unknown keys, duplicate IDs, invalid limits and invalid paths SHALL fail startup without a partial registry or disclosure of the raw value.

The registry SHALL contain no Core role policies, upstream credentials, response schemas or query definitions. It MUST NOT be populated from requests, user settings or Admin's management API. It SHALL remain private to the backend registry provider and MUST NOT be exposed through client-config, CUSTOM_CLIENT_VARIABLES or browser build variables. The BFF MUST NOT read a registry file, resolve a file-path fallback or fetch a remote registry. The deployment SHALL supply the environment value; the repository template SHALL default it to blank. Environment changes SHALL take effect only after a BFF restart.

#### Scenario: Default deployment remains inactive
- **WHEN** an authenticated user requests an operation with no registry configured
- **THEN** the BFF returns 404 and sends no custom request to Core
- **AND** startup and ordinary chat interactions do not fetch custom catalogs

#### Scenario: Environment alone enables a configured operation
- **WHEN** CUSTOM_CORE_API_CONFIG contains a valid version-1 registry and BFF starts without any registry file or volume mount
- **THEN** the configured operations are available subject to normal authentication and Core policy
- **AND** no filesystem or network read is used to load the registry

#### Scenario: Blank or explicitly empty configuration disables operations
- **WHEN** the environment value is empty, whitespace-only or {"version":1,"operations":[]}
- **THEN** startup succeeds with no enabled custom operations

#### Scenario: Changes require restart
- **WHEN** a deployment setting changes while a BFF process is running
- **THEN** that process retains its validated startup registry
- **AND** a restarted process validates and uses the new environment value

#### Scenario: Configuration fails closed
- **WHEN** the environment value is malformed JSON, has an invalid root/version/operations type, exceeds byte/entry limits or contains an access, query or responseSchema field
- **THEN** startup fails without serving a partially enabled registry
- **AND** diagnostics identify the invalid field without printing configuration contents

#### Scenario: Browser cannot change exposure
- **WHEN** a caller sends a replacement registry or updates user preferences
- **THEN** the operation map is unchanged
- **AND** client-config responses expose neither internal Core addresses nor registry definitions

### Requirement: Fixed GET API and generated-client boundary

The BFF SHALL expose GET /api/v1/custom-api/:operationId, accepting no query parameters and no nonempty body. A malformed operation ID or query/body input SHALL return 400 before dispatch. A valid unknown ID SHALL return 404 after normal authentication. Unsupported business methods, including HEAD, SHALL return 405 without upstream dispatch; OPTIONS SHALL remain local under existing CORS behavior.

Success SHALL return CustomApiResponseDto as {"data": <JSON value>}. Swagger operationId SHALL be getCustomApiOperation with CustomApiOperationParamsDto for the path ID and no query/body DTO. Generated normal and Raw methods SHALL be available. The app adapter SHALL use getCustomApiOperationRaw, validate the envelope and expose data as unknown. Generator-produced any for the opaque payload SHALL be documented and contained at that boundary; generated files MUST NOT be edited manually.

Illustrative deployment mapping: data-products -> GET /data-products.

Example request: GET /api/v1/custom-api/data-products.

Example response:

```json
{"data":[{"id":"1","display_name":"Display name","description":"some description"}]}
```

#### Scenario: Configured catalog is retrieved
- **WHEN** a supported authenticated user requests the configured data-products operation and Core permits it
- **THEN** the BFF returns its JSON catalog in the data envelope
- **AND** public source contains no DataProduct DTO or enabled private operation

#### Scenario: Inputs cannot widen the call
- **WHEN** a request includes parameters, url, path or any other query field, or a nonempty body
- **THEN** the BFF returns 400 before any custom Core request

#### Scenario: Implicit HEAD cannot invoke GET
- **WHEN** a caller sends HEAD, POST, PUT, PATCH or DELETE to a configured operation
- **THEN** the BFF returns 405 and sends no custom Core request

#### Scenario: Generic values survive client decoding
- **WHEN** the response data is an array, object, string, number, boolean or null
- **THEN** the generated Raw adapter preserves it as unknown
- **AND** the downstream app performs its domain validation

### Requirement: Exact Core destination and isolated credentials

IDs MUST match ^[a-z][a-z0-9-]{0,63}$. Configured paths MUST consist of one leading slash and nonempty slash-separated ASCII letter/digit/underscore/hyphen segments. Absolute/protocol-relative URLs, percent encodings, dots, backslashes, duplicate/trailing slashes, templates, queries and fragments MUST be rejected.

The BFF SHALL append the exact path to the trusted DIAL_CORE_URL base, preserving its configured prefix and checking origin and expected pathname before dispatch. It MUST NOT insert /v1, /openai, /api or api-version. Browser input MUST NOT select the target, method or outgoing headers.

All redirects MUST be disabled. Outgoing Authorization MUST come solely from the authenticated principal's access token, with existing host-owned headers. Caller cookies, API keys, proxy and method-override headers MUST NOT be copied.

#### Scenario: Core root is used directly
- **WHEN** DIAL_CORE_URL is https://core-api.com and corePath is /data-products
- **THEN** the request is GET https://core-api.com/data-products without a version prefix or query

#### Scenario: Path escapes are rejected
- **WHEN** configuration includes /../admin, /%2e%2e/admin, /%252e%252e/admin, //other-host, backslashes, /items//all, /items/ or a full URL
- **THEN** startup rejects the entry and sends no request to that destination

#### Scenario: Redirects cannot forward the token
- **WHEN** Core returns a redirect to any destination
- **THEN** the BFF returns sanitized 502 and sends no second request

#### Scenario: Caller headers cannot replace verified identity
- **WHEN** an authenticated request contains cookies, API keys or method-override headers
- **THEN** none are forwarded to Core
- **AND** any supported header-based identity has first passed the existing authentication strategy

### Requirement: Existing session authentication and Core-owned authorization

Every custom operation SHALL use existing global SessionGuard and CsrfGuard behavior, including refresh and configured strategy precedence. Missing valid credentials SHALL return 401. No browser token endpoint, Admin credential, service-account fallback or feature-specific role resolver SHALL be introduced.

Core SHALL remain the authority for route role authorization and business rate limits. The BFF SHALL propagate Core 401, 403 and 429 as sanitized errors without elevated retries. It MUST NOT infer access from an Admin entity's existence, operation name or UI origin.

Deployment documentation MUST distinguish global route roles from object/tenant authorization, and warn that upstream response fields are already visible to the caller before frontend validation. Routes requiring additional BFF-specific policy SHALL use a dedicated endpoint.

#### Scenario: Missing credentials fail before Core
- **WHEN** a caller has no valid supported credentials
- **THEN** SessionGuard returns 401 and no custom upstream call occurs

#### Scenario: Core denial remains effective
- **WHEN** Core returns 403 for the user's route roles or 429 for its quota
- **THEN** the BFF returns the corresponding sanitized status
- **AND** it does not retry with another identity or route

#### Scenario: Role changes do not require BFF role configuration
- **WHEN** an operator changes a route's roles and the change becomes active in Core
- **THEN** subsequent custom calls are subject to that Core policy without changing the BFF registry

#### Scenario: Session refresh remains server-side
- **WHEN** an allowed operation needs session refresh
- **THEN** existing auth refreshes the session and dispatches using the refreshed principal token
- **AND** BFF-owned cookies/CSRF headers remain intact without returning the token

### Requirement: Domain-agnostic bounded JSON transport

The BFF SHALL accept only upstream 200 with valid JSON and either application/json, application/*+json (optional MIME parameters allowed), or absent Content-Type. Explicit non-JSON MIME types MUST be rejected. Missing Content-Type is allowed for Admin static Responses, not as permission to relay arbitrary raw content.

The BFF SHALL bound each call to 10,000 ms total and 1,048,576 decoded response bytes; optional positive integer entry settings may only lower these ceilings. Limits MUST apply through body consumption, including compressed/chunked responses. JSON container depth MUST be at most 32. Client disconnect, time or size/depth failure SHALL abort processing and release resources.

The BFF SHALL validate JSON syntax and transport limits without business schemas, coercion or business field filtering. The data service MUST own safe response contents and any object/tenant authorization. The downstream app SHALL own domain decoding; browser validation MUST NOT be represented as data-access protection.

#### Scenario: Static Admin JSON works without MIME
- **WHEN** a permitted route returns status 200, no Content-Type and the valid JSON catalog
- **THEN** the BFF parses it and returns the data envelope as application/json

#### Scenario: HTML and malformed static responses fail
- **WHEN** a route returns HTML MIME, invalid JSON, an empty body or excessive JSON depth
- **THEN** the BFF returns sanitized 502 without relaying the raw content

#### Scenario: Additive fields do not require BFF schema changes
- **WHEN** a reviewed service adds a JSON field while staying within transport limits
- **THEN** the BFF preserves that field in data without a registry/schema change
- **AND** the downstream adapter decides how to validate and map it

#### Scenario: Compression cannot bypass byte limits
- **WHEN** decoded bytes exceed the configured ceiling despite absent or misleading Content-Length
- **THEN** reading stops, resources are released and the BFF returns sanitized 502

#### Scenario: Slow bodies and disconnects release work
- **WHEN** the total deadline expires or the client disconnects during header/body processing
- **THEN** the BFF aborts upstream transport and releases admission capacity
- **AND** a connected caller whose deadline expired receives 504

### Requirement: Safe errors and response metadata

Upstream 400/401/403/404/409/422/429 SHALL retain status with generic BFF errors. Redirects, unsupported statuses, upstream 5xx and invalid/oversized/deep responses SHALL yield 502; transport failures 503; deadlines 504. The BFF SHALL make no automatic retries.

Success SHALL use application/json, private, no-store and existing security headers. Upstream cookies, Location, cache/security headers and raw error bodies MUST NOT be forwarded. BFF-owned authentication headers MUST remain intact. No custom response cache SHALL be introduced.

#### Scenario: Error details remain private
- **WHEN** an upstream error contains a credential or internal URL in its body/headers
- **THEN** the BFF returns only its generic error with the specified status mapping
- **AND** the upstream content is not sent to the browser or logged

#### Scenario: Response headers cannot modify the chat session
- **WHEN** Core includes Set-Cookie or Location with a response
- **THEN** those headers do not reach the browser
- **AND** a legitimate BFF session refresh cookie is preserved

### Requirement: Bounded local admission and observability

This surface SHALL permit at most 32 in-flight requests per BFF process and 4 per verified provider/subject across operations. Excess work SHALL return 429 without upstream dispatch or a wait queue. Principal records SHALL exist only while calls are active and MUST be removed after the final call releases capacity; storage is consequently bounded by global concurrency. Capacity MUST remain held through body consumption and be released on every exit.

The BFF SHALL NOT introduce a parallel business requests-per-minute quota. Documentation MUST state that Core quotas depend on deployment configuration, local BFF concurrency is per-process, and replicated deployments need suitable ingress controls.

Telemetry SHALL contain only bounded registered IDs (constant label for unknown IDs), status/result category, duration and byte count, without duplicate HTTP metrics. No tokens, cookies, payloads, rejected query values, configuration contents or full URLs SHALL appear in this feature's logs/traces.

#### Scenario: One principal cannot multiply concurrency using sessions
- **WHEN** one verified provider/subject uses several sessions or operations
- **THEN** all its calls share the four-call capacity bound

#### Scenario: Overload does not create unbounded state
- **WHEN** global or principal capacity is exhausted
- **THEN** new calls receive 429 without a custom upstream request or queued work
- **AND** completion/failure/cancellation removes unused principal records

#### Scenario: Secret-bearing responses and unknown IDs stay out of telemetry
- **WHEN** a request returns sensitive strings, fails or contains an unknown ID
- **THEN** telemetry contains only the approved bounded metadata

### Requirement: Admin/Core lifecycle and reversible downstream rollout

The parent SHALL ship no private enabled operations, DataProduct DTOs, new Admin integration, executable plugins or startup hooks. No route enumeration SHALL be exposed. The server-only CUSTOM_CORE_API_CONFIG environment setting SHALL be the only capability gate; no ENABLED_FEATURES / ENABLED_FEATURES_ROLES key SHALL be added.

Operator documentation MUST show inline environment JSON, .env quoting versus raw deployment values, empty defaults, validation limits and restart-based updates without requiring a configuration file. It MUST explain exact Admin path/method selection, route priority/overlap, null-versus-empty userRoles, rewritePath semantics, trusted upstreams and possible Authorization forwarding, and verify configuration activation separately from saving in Admin. It MUST distinguish the BFF operation ID, Admin entity name and Core runtime path. BFF MUST NOT copy Admin regexes or assume its path mapping authenticates the identity of a Core route.

State SHALL be owned by the backend registry; response cache TTL SHALL be zero. Hand-authored libraries SHALL receive data/callbacks without host integration details. No parent UI, i18n keys, RTL, accessibility or React memoization changes are required.

#### Scenario: Same image supports private and standard deployments
- **WHEN** one deployment configures a reviewed operation and another leaves the registry empty
- **THEN** the former can dispatch that operation while the latter returns 404
- **AND** both use the same published BFF without private source modules

#### Scenario: Admin save is not assumed to activate the route
- **WHEN** the BFF operation exists but the corresponding path is not active in Core
- **THEN** Core's 404 is returned as a sanitized error
- **AND** the BFF neither queries Admin nor changes route configuration or credentials

#### Scenario: Rollback disables only the bridge
- **WHEN** an operator unsets CUSTOM_CORE_API_CONFIG and restarts BFF
- **THEN** custom operations return 404 without upstream calls
- **AND** ordinary chat APIs/authentication continue unchanged
- **AND** Core route availability for other clients remains governed by Core configuration
## RENAMED Requirements

- FROM: `### Requirement: Fixed GET API and generated-client boundary`
- TO: `### Requirement: Configured-method API and generated-client boundary`

## MODIFIED Requirements

### Requirement: Disabled-by-default deployment exposure registry

The BFF SHALL parse an immutable server-only registry directly from the CUSTOM_CORE_API_CONFIG environment string through ConfigService at startup. Unset, empty or whitespace-only values SHALL enable no operations. A nonblank value MUST be a JSON object with version equal to 1 and an operations array of at most 64 uniquely identified entries; an empty operations array SHALL be valid. The raw environment value MUST be at most 16 KiB measured as UTF-8 bytes before parsing. Each entry MUST contain id, method and corePath, with only optional query, body, timeoutMs and maxResponseBytes. method MUST be one of GET, POST, PUT or DELETE. query, when present, MUST be an array of at most 16 unique parameter names, each matching ^[a-z][a-z0-9_]{0,31}$. body, when present, MUST equal "json" and is allowed only when method is POST or PUT. Malformed JSON, invalid root/version/operations types, unknown keys, duplicate IDs, invalid methods, invalid query names, a body on a GET or DELETE operation, invalid limits and invalid paths SHALL fail startup without a partial registry or disclosure of the raw value.

The registry SHALL contain no Core role policies, upstream credentials, response schemas or query value definitions; query lists only parameter names. It MUST NOT be populated from requests, user settings or Admin's management API. It SHALL remain private to the backend registry provider and MUST NOT be exposed through client-config, CUSTOM_CLIENT_VARIABLES or browser build variables. The BFF MUST NOT read a registry file, resolve a file-path fallback or fetch a remote registry. The deployment SHALL supply the environment value; the repository template SHALL default it to blank. Environment changes SHALL take effect only after a BFF restart.

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
- **WHEN** the environment value is malformed JSON, has an invalid root/version/operations type, exceeds byte/entry limits or contains an access or responseSchema field
- **THEN** startup fails without serving a partially enabled registry
- **AND** diagnostics identify the invalid field without printing configuration contents

#### Scenario: Write and query fields are validated
- **WHEN** an entry has method PATCH, a query name such as `Url` or `a-b`, more than 16 query names, a duplicate query name, or body "json" on a GET or DELETE operation
- **THEN** startup fails without serving a partially enabled registry

#### Scenario: A GET-only configuration keeps its meaning
- **WHEN** every entry has method GET and neither query nor body
- **THEN** each operation accepts exactly what it accepted before this extension

#### Scenario: Browser cannot change exposure
- **WHEN** a caller sends a replacement registry or updates user preferences
- **THEN** the operation map is unchanged
- **AND** client-config responses expose neither internal Core addresses nor registry definitions

### Requirement: Configured-method API and generated-client boundary

The BFF SHALL expose /api/v1/custom-api/:id (`CustomApiController`, path parameter `id` holding the operation ID) for the GET, POST, PUT and DELETE methods. A request SHALL be dispatched only when its method equals the operation's configured method; any other of these methods, and HEAD and PATCH always, SHALL return 405 without upstream dispatch. OPTIONS SHALL remain local under existing CORS behavior. A malformed operation ID SHALL return 400 before dispatch, and a valid unknown ID SHALL return 404 after normal authentication.

Query parameters SHALL be accepted only by name from the operation's query list. A name outside the list, a repeated name, a non-string value, a value over 2,048 UTF-8 bytes or a total encoded query over 8 KiB SHALL return 400 before dispatch; an operation without query SHALL reject every query value with 400. A request body SHALL be accepted only by an operation with body "json": the request MUST declare Content-Type application/json, and its JSON MUST be an object or array of at most 65,536 bytes once serialized and at most 32 levels deep, else 400. Every other operation SHALL reject a nonempty body with 400.

Success SHALL return CustomApiResponseDto as {"data": <JSON value>}. Swagger operationIds SHALL be getCustomApiOperation, postCustomApiOperation, putCustomApiOperation and deleteCustomApiOperation, with CustomApiOperationParamsDto for the path ID; the POST and PUT operations SHALL document an optional opaque JSON request body as a free-form object, and no query DTO SHALL be declared. Generated normal and Raw methods SHALL be available. Because a deployment's query names cannot be expressed in OpenAPI (a free-form object parameter is serialized as `params[name]=…`), callers passing query parameters SHALL build the request URL themselves on the generated Configuration's fetchApi; this generator gap SHALL be documented beside the endpoint. The Chat app adapter (`callCustomApiOperation` in apps/chat/src/server-api/custom-api.api.ts) SHALL keep using getCustomApiOperationRaw, validate the envelope and expose data as unknown. Generator-produced any for the opaque payload SHALL be documented and contained at that boundary; generated files MUST NOT be edited manually.

Illustrative deployment mappings: data-products -> GET /data-products; loop-probe (query url) -> GET /dial-loop/editor/probe; loop-teams-binding-put (query application_id, body json) -> PUT /dial-loop/editor/teams/binding.

Example request: GET /api/v1/custom-api/data-products.

Example response:

```json
{"data":[{"id":"1","display_name":"Display name","description":"some description"}]}
```

Example write request (illustrative payload): PUT /api/v1/custom-api/loop-teams-binding-put?application_id=applications%2Fb%2Floop__1.0.0 with headers Content-Type: application/json and X-CSRF-Token, body {"bot_service_id":"loopbot","enabled":true}.

Example write response:

```json
{"data":{"application_id":"applications/b/loop__1.0.0","enabled":true}}
```

#### Scenario: Configured catalog is retrieved
- **WHEN** a supported authenticated user requests the configured data-products operation and Core permits it
- **THEN** the BFF returns its JSON catalog in the data envelope
- **AND** public source contains no DataProduct DTO or enabled private operation

#### Scenario: Inputs cannot widen the call
- **WHEN** a request to an operation without query or body includes parameters, url, path or any other query field, or a nonempty body
- **THEN** the BFF returns 400 before any custom Core request

#### Scenario: Only allowlisted query names pass
- **WHEN** a request to loop-probe carries url once and nothing else
- **THEN** the BFF dispatches with that url parameter
- **AND** a request that adds another name or repeats url returns 400 without dispatch

#### Scenario: Only the configured method dispatches
- **WHEN** a caller sends POST, PUT or DELETE to a GET operation, or GET to a PUT operation
- **THEN** the BFF returns 405 and sends no custom Core request

#### Scenario: Implicit HEAD cannot invoke GET
- **WHEN** a caller sends HEAD or PATCH to any configured operation
- **THEN** the BFF returns 405 and sends no custom Core request

#### Scenario: A write carries its bounded JSON body
- **WHEN** a caller sends PUT with a JSON object body to an operation configured with method PUT and body json
- **THEN** the BFF forwards that JSON as the request body to the exact Core path

#### Scenario: Oversized, deep or non-JSON bodies are refused
- **WHEN** a write request body exceeds 65,536 serialized bytes, nests deeper than 32 levels, is a JSON scalar or is sent without Content-Type application/json
- **THEN** the BFF returns 400 before any custom Core request

#### Scenario: Generic values survive client decoding
- **WHEN** the response data is an array, object, string, number, boolean or null
- **THEN** the generated Raw adapter preserves it as unknown
- **AND** the downstream app performs its domain validation

### Requirement: Exact Core destination and isolated credentials

IDs MUST match ^[a-z][a-z0-9-]{0,63}$. Configured paths MUST consist of one leading slash and nonempty slash-separated ASCII letter/digit/underscore/hyphen segments. Absolute/protocol-relative URLs, percent encodings, dots, backslashes, duplicate/trailing slashes, templates, queries and fragments MUST be rejected in configured paths.

The BFF SHALL append the exact path to the trusted DIAL_CORE_URL base, preserving its configured prefix, and SHALL append only the request's allowlisted query parameters, re-encoded in configuration order. It SHALL check origin and expected pathname before dispatch. It MUST NOT insert /v1, /openai, /api or api-version. Browser input MUST NOT select the target, path, method or outgoing headers.

All redirects MUST be disabled. Outgoing Authorization MUST come solely from the authenticated principal's access token, with existing host-owned headers, Accept application/json, and Content-Type application/json only when a body is sent. Caller cookies, API keys, proxy and method-override headers MUST NOT be copied.

#### Scenario: Core root is used directly
- **WHEN** DIAL_CORE_URL is https://core-api.com and corePath is /data-products
- **THEN** the request is GET https://core-api.com/data-products without a version prefix or query

#### Scenario: Allowlisted query is appended, nothing else changes
- **WHEN** DIAL_CORE_URL is https://core-api.com, corePath is /dial-loop/editor/probe and the request carries url=https://svc.example/a b
- **THEN** the request is GET https://core-api.com/dial-loop/editor/probe?url=https%3A%2F%2Fsvc.example%2Fa+b
- **AND** a query value cannot change the origin or pathname of the destination

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

### Requirement: Domain-agnostic bounded JSON transport

The BFF SHALL accept upstream 200 and 201 with valid JSON and either application/json, application/*+json (optional MIME parameters allowed), or absent Content-Type, and upstream 204 with an empty body, returned as {"data": null}. A 204 carrying body bytes and explicit non-JSON MIME types MUST be rejected. Missing Content-Type is allowed for Admin static Responses, not as permission to relay arbitrary raw content.

The BFF SHALL bound each call to 10,000 ms total by default and 1,048,576 decoded response bytes. An entry's optional positive integer timeoutMs may set the deadline up to 300,000 ms; its optional maxResponseBytes may only lower the byte ceiling. Limits MUST apply through body consumption, including compressed/chunked responses. JSON container depth MUST be at most 32. Client disconnect, time or size/depth failure SHALL abort processing and release resources.

The BFF SHALL validate JSON syntax and transport limits without business schemas, coercion or business field filtering, for responses and request bodies alike. The data service MUST own safe response contents, validation of request inputs and any object/tenant authorization. The downstream app SHALL own domain decoding; browser validation MUST NOT be represented as data-access protection.

#### Scenario: Static Admin JSON works without MIME
- **WHEN** a permitted route returns status 200, no Content-Type and the valid JSON catalog
- **THEN** the BFF parses it and returns the data envelope as application/json

#### Scenario: Created and no-content writes succeed
- **WHEN** a write operation's route returns 201 with a JSON body, or 204 with no body
- **THEN** the BFF returns {"data": <that JSON>} or {"data": null} respectively

#### Scenario: HTML and malformed static responses fail
- **WHEN** a route returns HTML MIME, invalid JSON, an empty 200 body, a 204 with a body or excessive JSON depth
- **THEN** the BFF returns sanitized 502 without relaying the raw content

#### Scenario: A long operation is opted in, not defaulted
- **WHEN** an entry sets timeoutMs 300000 and another sets no timeoutMs
- **THEN** the first may run up to 300 s and the second is cut at 10 s with 504
- **AND** an entry with timeoutMs above 300000 fails startup

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

### Requirement: Existing session authentication and Core-owned authorization

Every custom operation SHALL use existing global SessionGuard and CsrfGuard behavior, including refresh and configured strategy precedence, for every method. Missing valid credentials SHALL return 401. POST, PUT and DELETE operations SHALL require the CSRF token and a matching Origin as enforced by CsrfGuard; a missing or wrong token SHALL return 403 CSRF_INVALID without upstream dispatch. No browser token endpoint, Admin credential, service-account fallback or feature-specific role resolver SHALL be introduced.

Core SHALL remain the authority for route role authorization and business rate limits. The BFF SHALL propagate Core 401, 403 and 429 as sanitized errors without elevated retries. It MUST NOT infer access from an Admin entity's existence, operation name or UI origin.

Deployment documentation MUST distinguish global route roles from object/tenant authorization, warn that upstream response fields are already visible to the caller before frontend validation, and warn that write routes deliver caller-supplied JSON to the upstream, which must validate it. Routes requiring additional BFF-specific policy SHALL use a dedicated endpoint.

#### Scenario: Missing credentials fail before Core
- **WHEN** a caller has no valid supported credentials
- **THEN** SessionGuard returns 401 and no custom upstream call occurs

#### Scenario: Writes require the CSRF token
- **WHEN** a session-authenticated caller sends PUT to a configured PUT operation without X-CSRF-Token or from another Origin
- **THEN** CsrfGuard returns 403 CSRF_INVALID and no custom upstream call occurs

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

### Requirement: Bounded local admission and observability

This surface SHALL permit at most 32 in-flight requests per BFF process and 4 per verified provider/subject across operations and methods. Excess work SHALL return 429 without upstream dispatch or a wait queue. Principal records SHALL exist only while calls are active and MUST be removed after the final call releases capacity; storage is consequently bounded by global concurrency. Capacity MUST remain held through body consumption, for the whole of a long-deadline call, and be released on every exit.

The BFF SHALL NOT introduce a parallel business requests-per-minute quota. Documentation MUST state that Core quotas depend on deployment configuration, local BFF concurrency is per-process, long-deadline operations hold capacity while they run, and replicated deployments need suitable ingress controls.

Telemetry SHALL contain only bounded registered IDs (constant label for unknown IDs), the HTTP method, status/result category, duration and byte count, without duplicate HTTP metrics. No tokens, cookies, payloads, request bodies, query values, configuration contents or full URLs SHALL appear in this feature's logs/traces.

#### Scenario: One principal cannot multiply concurrency using sessions
- **WHEN** one verified provider/subject uses several sessions, operations or methods
- **THEN** all its calls share the four-call capacity bound

#### Scenario: Overload does not create unbounded state
- **WHEN** global or principal capacity is exhausted
- **THEN** new calls receive 429 without a custom upstream request or queued work
- **AND** completion/failure/cancellation removes unused principal records

#### Scenario: Secret-bearing inputs, responses and unknown IDs stay out of telemetry
- **WHEN** a request carries sensitive query values or a body, returns sensitive strings, fails or contains an unknown ID
- **THEN** telemetry contains only the approved bounded metadata

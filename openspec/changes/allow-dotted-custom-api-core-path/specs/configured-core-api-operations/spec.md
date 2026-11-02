## MODIFIED Requirements

### Requirement: Exact Core destination and isolated credentials

IDs MUST match ^[a-z][a-z0-9-]{0,63}$. Configured paths MUST consist of one leading slash and nonempty slash-separated ASCII letter/digit/underscore/hyphen/dot segments; a dot MAY appear inside a segment, such as an application id like runner__1.0.0. A segment that is exactly . or .., absolute/protocol-relative URLs, percent encodings, backslashes, duplicate/trailing slashes, templates, queries and fragments MUST be rejected in configured paths.

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

#### Scenario: Dot segments are rejected
- **WHEN** configuration includes /.., /., /items/../admin, /items/./all or /items/..
- **THEN** startup rejects the entry and sends no request to that destination

#### Scenario: An application route is a valid path
- **WHEN** DIAL_CORE_URL is https://core-api.com and corePath is /v1/deployments/applications/public/team/runner__1.0.0/route/editor/browse
- **THEN** startup accepts the entry
- **AND** the request goes to https://core-api.com/v1/deployments/applications/public/team/runner__1.0.0/route/editor/browse with the path unchanged

#### Scenario: Redirects cannot forward the token
- **WHEN** Core returns a redirect to any destination
- **THEN** the BFF returns sanitized 502 and sends no second request

#### Scenario: Caller headers cannot replace verified identity
- **WHEN** an authenticated request contains cookies, API keys or method-override headers
- **THEN** none are forwarded to Core
- **AND** any supported header-based identity has first passed the existing authentication strategy

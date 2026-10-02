## Context

The browser client uses an encrypted HttpOnly cookie. Global SessionGuard establishes req.user.at and CsrfGuard retains its existing behavior. AuthController's profile endpoint does not return the token. DialClientService owns DIAL_CORE_URL and fetchCore.

The example /data-products endpoint is a Core runtime path configured through Admin's global Entities -> Routes, not an Admin management endpoint and not an application-owned route. The public BFF needs no DataProduct controller or DTO.

### Evidence from related repositories

Source references below identify repositories and paths within those repositories. They describe source behavior, not the configuration or behavior of a particular deployment.

| Evidence | Consequence |
| --- | --- |
| ai-dial-admin-frontend: apps/ai-dial-admin/src/models/dial/route.ts:5; components/Routes/View/Properties/RouteProperties.tsx:58 under the same src root | Routes support paths, methods, rewritePath, upstreams or a static status/body response. |
| ai-dial-admin-frontend: apps/ai-dial-admin/src/components/Routes/View/TabsContent.tsx:35 | Global routes have an existing Roles editor. |
| ai-dial-admin-backend: src/main/java/com/epam/aidial/cfg/domain/mapper/RouteCoreMapper.java:38 and DeploymentCoreMapper.java:27 | Admin exports route definitions and enabled roles into Core userRoles. isPublic or null roleLimits maps to null userRoles. |
| ai-dial-admin-backend: src/main/java/com/epam/aidial/cfg/web/controller/RouteController.java:28 | /api/v1/routes is Admin's management API, not a runtime route discovery API for chat users. |
| ai-dial-admin-backend: src/main/java/com/epam/aidial/cfg/service/config/export/ConfigExportScheduler.java:22 | Export is separately configured and scheduled; saving a route does not prove runtime activation. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/BaseRouteController.java:55 | Core checks route roles before both static and upstream responses, then applies its route limiter. |
| ai-dial-core: config/src/main/java/com/epam/aidial/core/config/RoleBasedEntity.java:24 | Actual implementation: null userRoles permits any authenticated role; empty set denies all; a nonempty set requires an intersection. The comment loosely describing empty roles is not authoritative. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/BaseRouteController.java:214; config/ConfigPostProcessor.java:298 under the same server package | Core selects the first matching route in configured priority order, matches regex paths and checks allowed methods. An empty paths/methods collection is broad. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/ControllerSelector.java:638 | Built-in controllers are selected before the global route fallback. BFF cannot prove route identity from a path alone. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/GlobalRouteController.java:23 | Global routes do not enforce application resource permissions. Row/object/tenant authorization must be implemented by the data service when needed. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/RouteRequestBodyHandler.java:126 | rewritePath=true replaces the upstream path and copies the incoming query; false uses the configured endpoint URI. This is not a simple strip-prefix toggle. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/BaseRouteController.java:150; util/ProxyUtil.java:65 under the same server package | Core supplies an upstream configured API key or a per-request key. Authorization is not excluded by the default header-copy filter, so the user's bearer may reach the upstream unless deployment settings exclude it. |
| ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/BaseRouteController.java:83 | Static Response sends status/body directly without setting Content-Type in this branch. |

## Goals / Non-Goals

Provide a small reusable bridge for fixed GET catalog calls. Preserve ordinary authentication, exact deployment-controlled exposure, bounded transport and generated-client integration.

Exclude writes, query/body inputs, templates, regex BFF paths, files/streams, Admin API dependencies, route enumeration, hot reload, business role/schema duplication and changes to BFF packaging. A future parameterized API requires an explicit contract extension.

## Decisions

### 1. Responsibilities

Admin/Core own route matching, upstream destinations/keys, route roles and business rate limits. The service behind a route owns business authorization and safe response fields. A static Response is shared content for every principal permitted by that route; it cannot supply per-user row filtering.

The BFF owns session-to-bearer translation, an exact list of exposed operations, transport validation/limits and safe error mapping. It does not evaluate Core roles again, consume Admin credentials, fetch configuration from Admin or copy its regex routes.

The client application owns the operation ID and domain response decoding/presentation. Runtime validation in a browser cannot hide secret fields already received by that browser. If the upstream cannot produce a safe user-authorized response, fix that service or use a dedicated server-side controller; do not rely on frontend filtering.

### 2. Server-only deployment registry

CUSTOM_CORE_API_CONFIG contains the registry JSON directly and is read once through ConfigService at startup. Unset, empty or whitespace-only values mean an empty registry. An explicit {"version":1,"operations":[]} is also valid. Require a version-1 object with an operations array; invalid roots, missing fields and malformed JSON fail startup. Check the raw value's UTF-8 byte length before parsing; limit it to 16 KiB and the registry to 64 operations. Reject unknown keys, duplicate IDs and invalid paths/limits without logging the value or raw parser errors that may include it. The env size ceiling suits a small registry; deployment platforms may impose additional limits.

The deployment supplies this server environment setting. No configuration file, mount, file-path fallback or remote registry loader is needed. The repository contains a blank template setting and illustrative examples, never a deployment's enabled operations. Keep this setting out of client-config, CUSTOM_CLIENT_VARIABLES and browser build variables. Parsed state remains immutable until restart; changing the deployment setting requires restarting BFF processes.

Illustrative .env-style deployment setting (outer single quotes delimit the value and are not part of the JSON):

```dotenv
CUSTOM_CORE_API_CONFIG='{"version":1,"operations":[{"id":"data-products","method":"GET","corePath":"/data-products"}]}'
```

In a deployment UI, supply the JSON without the outer quotes. The expanded value below is for readability, not a separate file:

```json
{
  "version": 1,
  "operations": [
    {
      "id": "data-products",
      "method": "GET",
      "corePath": "/data-products"
    }
  ]
}
```

Each entry has only id, method, corePath and optional timeoutMs/maxResponseBytes. method must equal GET. IDs match ^[a-z][a-z0-9-]{0,63}$. Paths consist of one leading slash and nonempty slash-separated ASCII letters/digits/underscore/hyphen segments. Reject dots, percent encodings, backslashes, duplicate/trailing slashes, URLs, query/fragment syntax and templates.

No access, query or responseSchema fields exist. Optional integer limits may lower but never exceed the hard ceilings of 10,000 ms and 1,048,576 decoded bytes, and must be positive.

This allowlist is intentionally smaller than Core's route registry. It controls which calls the chat session can make, independently of Core's user policy. Core role/upstream changes require no BFF config changes for an unchanged path. Review changes to both configurations as capability delegation.

### 3. Request and destination contract

GET /api/v1/custom-api/:operationId has no query and no body. Validate the ID and reject all query values, including a parameters field, and nonempty bodies with 400. Unknown/disabled valid IDs return 404 after normal authentication. Reject other business methods with 405 before dispatch; explicitly prevent implicit HEAD-to-GET behavior. OPTIONS stays local under existing CORS behavior.

Resolve corePath relative to the configured Core API base, preserving an intentional base prefix. With DIAL_CORE_URL=https://core-api.com the destination is exactly https://core-api.com/data-products. Do not prepend /v1, /openai or /api; do not add api-version. Assert parsed authority and expected pathname before sending. The browser cannot select a host, path, verb or upstream headers.

Use DialClientService.fetchCore with req.user.at, Accept: application/json and the host-owned user agent/trace policy. Never copy caller cookies, API keys, proxy or method-override headers. Existing optional bearer authentication still runs through its verified strategy; do not directly forward an unverified input header.

Disable redirects, including same-origin redirects. Preserve existing Core TLS/network policy. The Core SDK gap is deployment-private paths; this exception belongs in the server transport, not frontend components.

### 4. Authentication and authorization

Keep SessionGuard/CsrfGuard unchanged. All exposed operations require a valid supported user principal. Use only that user's token; never replace a Core 401/403 with an admin/service credential or fallback endpoint. Core enforces route roles and business rate limits on each request.

Do not create custom-api-access.service or interpret provider role claims in this feature. Existing BFF-specific feature/role restrictions must not be bypassed: the registry is intended for newly exposed custom APIs; an endpoint needing app-specific policy belongs in a dedicated controller.

Trust boundaries are explicit:
- Registry editors decide which exact calls chat exposes.
- Admin route editors can change the actual destination, data, role policy and potentially credential exposure behind an already allowed path.
- A fixed BFF Core URL confines the BFF's own request, but cannot prevent a trusted Core route from contacting an unsafe upstream.
- Operation IDs and browser origins are not authorization. Configured operations are available to supported authenticated callers subject to Core policy.

Prefer an exact Admin pattern ^/data-products$ with methods ["GET"]; inspect priority/overlaps and existing built-in paths. Do not assume the Admin entity name equals its runtime path. Route roles do not imply row-level or tenant-level data isolation.

### 5. JSON responses and failures

Accept upstream status 200 with valid bounded JSON. Accept application/json or application/*+json, with optional MIME parameters. Also accept absent Content-Type, to support Admin static JSON Response; still parse JSON and enforce all limits. Explicit non-JSON types, including HTML/text, are rejected. Always reserialize into a BFF JSON envelope, never relay raw bytes as HTML.

Return 200 {"data": <upstream JSON>} with application/json, private, no-store and existing security headers. Preserve arrays, objects, scalars and null. Require maximum JSON container depth 32, checked before any recursive processing. Count actual decoded stream bytes, including compressed/chunked bodies; do not trust Content-Length. The total deadline covers connect, headers and body consumption. Cancel on disconnect/limit failure and release resources. No BFF retries or cache; Core may independently retry according to route configuration.

No BFF response schema/compiler or business field filtering. The client application's adapter validates the domain response and maps it for presentation. Extra fields still reach the browser, so the upstream must already be safe to expose.

Preserve upstream 400/401/403/404/409/422/429 with generic BFF messages. Map redirects, unsupported statuses, upstream 5xx, invalid JSON/MIME and byte/depth failures to 502; transport failure to 503; deadline expiry to 504. Local input errors are 400, unsupported methods 405 and admission rejection 429. Do not expose raw upstream errors or forward Set-Cookie, Location, cache/security headers. Preserve BFF-owned refresh cookies/CSRF headers.

### 6. Resource protection and observability

Core owns business request-rate quotas; do not add a parallel 60/min policy or 10,000-record rate store in BFF. Core quotas may be unconfigured, so deployment ingress controls remain relevant.

Bound in-flight custom calls per BFF process to 32 total and 4 per verified provider/subject. No queue. Keep a principal entry only while it has active calls, hence at most 32 active entries. Hold capacity through body consumption and release/delete in finally on every exit. Reject excess calls with 429. These local bounds protect BFF memory; they are not cross-replica quotas and cancellation does not guarantee an upstream stops its own work.

Reuse current HTTP instrumentation; record bounded registered operation IDs, status/result category, duration and decoded byte count. Unknown IDs use a constant label. No tokens, cookies, bodies, config contents, rejected query values or full URLs in this feature's logs/traces; audit automatic instrumentation too.

### 7. Generated client and host boundary

Swagger operationId getCustomApiOperation generates normal/Raw methods. CustomApiOperationParamsDto describes the ID; there is no query/body DTO. CustomApiResponseDto describes a required data envelope with an opaque JSON value. The public generated client cannot know a deployment's domain response types.

Use getCustomApiOperationRaw in apps/chat/src/server-api/custom-api.api.ts, registered through api-client.ts, to decode and check the envelope as unknown without lossy generated domain deserialization. Preserve cancellation and existing auth/CSRF middleware. Contain any generator-produced any in this opaque field at the adapter's unknown boundary and document it. Do not hand-edit generated output.

Hand-authored libraries receive only resolved data/callbacks. No new parent UI, startup fetch, React state, i18n, RTL or accessibility behavior.

## Risks / Trade-offs

- A path allowlist cannot attest which Core route currently handles that path. Admin/Core configuration and overlapping routes remain a trusted operational responsibility.
- Global Routes check roles, not per-object permissions. Safe user-specific contents require the service's authorization contract.
- Core can forward Authorization as well as its selected API key. Only trusted upstreams are appropriate; BFF-only SSRF controls do not secure Core egress.
- Omitting a BFF business schema removes a second field filter. This is deliberate for service-owned APIs; secrets must never enter the user response. Frontend validation is not a substitute.
- Admin static JSON may lack MIME. The narrowly allowed absent-header case still requires valid bounded JSON and produces only application/json.
- GET can have side effects. Enable reviewed read operations only. Writes and inputs remain outside this release.
- Exact paths and no query constrain initial reuse but keep a small verifiable contract; extend when a concrete API needs more.

## Migration Plan

1. Release the parent bridge/client with an empty registry using normal startup/package wiring.
2. Configure /data-products through Admin: exact GET path, intended roles and a static JSON body or trusted upstream. For rewritePath=false use the full desired upstream endpoint; for true verify the replaced path. Verify configured export/sync has reached the deployed Core.
3. Set CUSTOM_CORE_API_CONFIG to the registry JSON in the client application's deployment environment and restart the same BFF image. No configuration file or volume mount is required.
4. In a separate client application change, connect its domain adapter to the generic envelope and retain runtime domain validation.
5. Disable by unsetting CUSTOM_CORE_API_CONFIG (or setting it blank) and restarting. Disabling this bridge does not remove the Core route for other clients. No user data migration.

## Open Questions

- Deployment contract: is /data-products a static response or an upstream service, and which roles/data-scope rules are required? Both transport forms are covered; no live config was inferred.
- Verify deployed Core/Admin versions and actual route activation before enabling the integration; source inspection is not deployment evidence.
- Confirm catalog size/latency against proposed ceilings; no traffic measurements were taken.
- Prove generator Raw preservation of all JSON value kinds in tests.
- The initial fixed GET scope targets catalog-style integrations; inputs or writes need a separately specified extension.

## References

Parent authority: docs/auth/auth-bff-encrypted-cookie.md; implementation conventions: apps/chat-api/AGENTS.md, especially domain layout, authentication, Swagger and testing. See proposal.md for OWASP references.
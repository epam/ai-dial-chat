## Why

### Problem

Client applications need deployment-specific Core APIs, such as GET /data-products, without adding their business endpoints or DTOs to public BFF source. The browser has an encrypted HttpOnly session, while the BFF obtains the user's Core token server-side.

A deployment-specific endpoint such as /data-products can be a global Core Route configured in Admin's Entities -> Routes. Core already selects its path/method, enforces route roles and rate limits, and returns either a static response or an upstream response. The missing chat capability is a generic authenticated bridge to selected Core paths.

Evidence in this repository: apps/chat-api/src/auth/auth.controller.ts:602 and auth/strategies/cookie-session.strategy.ts:164; related repository ai-dial-admin-frontend: apps/ai-dial-admin/src/components/Routes/View/TabsContent.tsx:35; ai-dial-admin-backend: src/main/java/com/epam/aidial/cfg/domain/mapper/DeploymentCoreMapper.java:27; ai-dial-core: server/src/main/java/com/epam/aidial/core/server/controller/route/BaseRouteController.java:55. Detailed findings and limitations are in design.md.

## What Changes

### Solution

- Add a disabled-by-default, server-only mapping of operation ID to exact GET path under DIAL_CORE_URL, supplied as JSON in CUSTOM_CORE_API_CONFIG.
- Expose GET /api/v1/custom-api/:operationId using existing session/CSRF guards and the authenticated user's token.
- Keep route definitions, roles, upstream credentials and business rate limits in Admin/Core. Do not duplicate their policy in BFF or connect BFF to Admin's management API.
- Keep BFF transport bounds, exact destination checks, redirect rejection, header isolation and safe JSON/error handling.
- Return an opaque JSON data envelope through a generic generated client. The upstream service owns data authorization and safe response contents; the client application owns domain validation and presentation.
- Use the same published BFF image with deployment-provided environment configuration. No configuration file or volume mount is required. Public defaults contain no private operation.

### Initial scope

Core owns role policies, and client applications own domain response validation. No BFF business-schema registry, schema-validator dependency or custom role resolver is needed. Core owns business rate limits; BFF retains only bounded concurrent work, bytes and duration. The first version accepts fixed GET calls with no query or body, suitable for catalog endpoints. Parameterized calls and writes require separate contract extensions.

This is a proposed first-release scope, not a claim that all custom APIs are read-only.

### Non-goals

Arbitrary URL/path forwarding, all-route auto-discovery, Admin management credentials, dynamic plugins, browser-readable bearer tokens, generic CRUD, query/body forwarding, streaming, business response transformations, new Admin/Core features, client-specific UI or persistence.

### Alternatives

| Option | Correctness / delivery | Security / performance | Migration / rollback |
| --- | --- | --- | --- |
| Domain controller per private API (baseline) | Strong DTOs; each API needs public BFF code/release | Precise app policy; suitable if domain authorization is needed | Remove controller to revert |
| Named allowlisted Core bridge (selected) | Generic release; Admin/Core retain their route responsibility | Exact exposure list; existing user token; bounded transport | Same image; remove config and restart |
| All Core paths / all Admin routes via a generic proxy | Less configuration but silently expands the chat surface | Exposes unrelated or privileged routes; regex routes and overlaps complicate scope | Broad contract and unexpected coupling |
| Browser-to-Core calls | Requires browser authentication/CORS redesign | Existing HttpOnly BFF session supplies no browser token | Cross-cutting auth change for a small catalog |

A route being created by trusted administrators does not automatically make it appropriate for exposure through chat. The BFF allowlist controls exposure; Core controls who can use the selected route. Operation IDs are not secrets or proof that the caller uses a particular client application.

## Capabilities

### New Capabilities

- configured-core-api-operations: Opt-in authenticated access to explicitly named Core GET paths, including global Routes managed by Admin.

### Modified Capabilities

None. Session, CSRF, client-config and existing feature-role contracts remain unchanged.

## Impact

- New apps/chat-api/src/custom-api/ domain, app/app.module.ts registration and server-only environment configuration.
- Follow deployments/user-limits.controller.ts:22 for a thin authenticated controller. Use DialClientService.fetchCore for the documented SDK gap: private deployment paths have no generated Core SDK method.
- Regenerate libs/chat-api-client from generic Swagger sources; app-level adapters contain host knowledge. No integration knowledge enters hand-authored shared libraries.
- Update operator/auth/client documentation. No new UI, i18n keys, RTL, accessibility or React state.
- No changes to Admin/Core repositories in this change. Their inspected source is evidence, not a guarantee about a deployed version.

### Acceptance criteria

1. Empty configuration returns 404 for authenticated custom requests without upstream dispatch.
2. A deployment maps an operation to /data-products through CUSTOM_CORE_API_CONFIG and restarts the same BFF image; BFF calls Core using the caller's normal token.
3. Core role denial and rate limits remain effective; BFF never retries with a service/admin key.
4. Unknown IDs, wrong verbs, any query/body, path escapes and redirects cannot cause an unapproved call.
5. Bounded JSON works with both upstream JSON responses and Admin static JSON responses without Content-Type.
6. No BFF domain schemas/role policy are required; the generated adapter exposes unknown for downstream validation.
7. Automated tests cover real BFF guards, transport limits, cancellation, credential isolation and mocked Core responses.

### Compatibility and rollback

Additive and opt-in; invalid configuration fails startup. Unset CUSTOM_CORE_API_CONFIG and restart to disable this bridge. Changing Core roles/upstreams takes effect through Core's own configuration lifecycle without a BFF registry update when the path remains the same. Saving an Admin entity alone does not prove that the deployed Core has loaded it.

### Security references

- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): destination allowlists and disabled redirects.
- [OWASP API10](https://api-security.owasp.org/editions/2023/en/0xaa-unsafe-consumption-of-apis/): validate consumed responses and bound upstream resource use.

Concrete limits are project design choices. Domain validation in the frontend is a correctness check, not a confidentiality boundary.
## Context

A DIAL Core application can declare `routes` (`paths`, `methods`, `rewritePath`, `upstreams`), which Core exposes as `/v1/deployments/{id}/route/{path}` (Core docs, `docs/dynamic-settings/routes.md` in `ai-dial-core`). Calling one needs a Core token. The browser has only a cookie session with the BFF, which keeps the access token server-side (`SessionUser.at`). The existing `CustomApiController` (`apps/chat-api/src/custom-api/custom-api.controller.ts`) is the closest model for "BFF calls Core as the user", but it is a fixed-path, allowlisted, enveloped-JSON bridge and cannot carry `/v1/items/{itemId}/details`.

A typical consumer is an application with a catch-all route (`/.*`, methods `GET`, `POST`, `DELETE`, `rewritePath: true`) in front of an internal REST service.

## Goals / Non-Goals

**Goals:**
- Let the browser call any application's configured route as the signed-in user, with one small generic endpoint and no per-application code.
- Keep Core the single authority for route authorization and rate limits.
- Preserve upstream status codes and bodies so callers keep full HTTP semantics.

**Non-Goals:**
- A registry or allowlist of deployments, streaming, binary or multipart bodies, `HEAD`/`PATCH`, response caching.
- OpenAPI exposure or a generated client for the pass-through.

## Decisions

**1. A dedicated controller, not an extension of `custom-api`.** `custom-api` guarantees an exact, deployment-registered Core path, an opaque `{ data }` envelope, bounded responses and per-principal admission. Path parameters and relayed errors would contradict each of those guarantees. A separate module (`DeploymentRouteModule`) keeps both contracts simple. Alternative: add path templates to the registry — rejected as a breaking redefinition of an archived capability.

**2. Wildcard route with the deployment ID as one encoded segment.** `@All(':id/*path')` (Express 5 / path-to-regexp 8, `*path` yields an array of segments). Deployment IDs contain slashes, so the client encodes them as `%2F`; Express decodes the param after matching, and the controller re-encodes each segment when building the Core URL. The controller spec asserts this round trip. Risk: an ingress that decodes `%2F` before the BFF would split the ID (see Risks).

**3. Relay, do not interpret.** The upstream status, `Content-Type` and body bytes are returned as received, with `Cache-Control: private, no-store`. An upstream's error envelope (for example `{ error, detail }`) and its 409/422 semantics can drive client behaviour, so wrapping or remapping them (as `custom-api` does) would lose information. The controller uses `@Res()` for this and therefore does not use the shared error mapper.

**4. Caller's token, existing guards.** The call is authenticated with `user.at` via `getBearerAuthHeaders`; the global session and CSRF guards already cover the new controller, so writes need the CSRF token and unauthenticated calls never reach it. No credential other than the user's token is sent.

**5. Fixed host, safe path.** The URL is built from `DialClientService.baseUrl` plus per-segment-encoded ID and path; nothing from the request selects the host. Dot segments are refused because Core or an intermediary could normalise them out of `/route/`. `redirect: 'manual'` prevents following a redirect to another host with the token.

**6. Core transport.** `DialClientService.fetchCore` is used so the User-Agent and Core timing apply as for every other Core call; a 60-second `AbortSignal.timeout` bounds it (a slow upstream operation should be started by one call and polled by later ones rather than awaited; 60 s keeps a stuck call from holding a worker).

**7. No allowlist now.** Core already decides, for the caller's token, whether the route exists and is permitted. Adding a BFF allowlist would need a config format and a restart for every new application, which defeats the reuse goal. Hardening option for a later change: an `ENABLED`-style env list of deployment IDs (default: all), checked before the Core call.

## Risks / Trade-offs

- [Any authenticated user can address any deployment's routes through the BFF] → Core still enforces route `userRoles`/permissions for that user's token, exactly as a direct call would; an env allowlist is the documented hardening follow-up.
- [An ingress or CDN decodes `%2F` in the deployment ID] → the ID would no longer be one segment and the request 404s; mitigate by testing the deployed path or by moving the ID into a query or header in a follow-up.
- [Large or non-JSON bodies] → only non-empty JSON bodies are forwarded; other bodies are out of scope. Responses are buffered in memory, so very large upstream responses are a risk; routes used through this endpoint are expected to return small JSON.
- [A single stuck upstream holds a request for up to 60 s] → bounded by the timeout; the BFF has no per-principal admission for this endpoint, unlike `custom-api`.
- [Route `authType`/key misconfiguration] → surfaces as the upstream's 401/403 relayed unchanged; no BFF involvement.

## Migration Plan

Additive: deploy the BFF with the module registered; no configuration or data migration. Rollback: remove `DeploymentRouteModule` from `apps/chat-api/src/app/app.module.ts`.

## Open Questions

- Should the BFF gain a deployment allowlist or per-principal admission before the endpoint is used by more than one application?

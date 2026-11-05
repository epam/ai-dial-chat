## Why

A DIAL application can expose plain REST endpoints through the `routes` of its Core configuration (`/v1/deployments/{id}/route/{path}`), but only a caller holding a Core token can reach them. The chat frontend holds only a cookie session, and the generic `GET|POST|PUT|DELETE /api/v1/custom-api/:id` bridge cannot express a path with a dynamic segment (`/v1/items/{itemId}/…`) because each operation is one exact, pre-registered Core path. Features that front a REST service with a DIAL application therefore have no way to call it.

## What Changes

- Add a BFF proxy `ALL /api/v1/deployment-route/:id/*path` that forwards `GET`, `POST`, `PUT` and `DELETE` to Core's `/v1/deployments/{id}/route/{path}` with the caller's own session access token, passing the query string and a JSON body through and relaying Core's status and body unchanged.
- The deployment ID is a parameter, sent URL-encoded as one segment (`applications%2Fpublic%2Fname__1.0.0`), so the proxy serves any application route, not one fixed service. It contains no per-application logic.
- Refuse `.` and `..` segments in the ID or path, and map an unreachable Core to 503 and a timeout to 504.
- The endpoint is hidden from OpenAPI (`@ApiExcludeEndpoint`): a pass-through has no business schema to generate a client for. Callers use a thin hand-written wrapper.

## Capabilities

### New Capabilities

- `deployment-route-proxy`: authenticated browser access to any DIAL application's configured route through the BFF, using the caller's own Core token.

### Modified Capabilities

None. `configured-core-api-operations` is unchanged: it stays the allowlisted, fixed-path GET bridge.

## Non-goals

- No registry or allowlist of deployments or paths. Core already authorizes each call (route `userRoles`, permissions, rate limits) for the caller's token; an allowlist is a possible hardening follow-up (see `design.md`).
- No streaming, WebSocket or binary request body support; no `HEAD` or `PATCH`.
- No change to `custom-api`, no OpenAPI or generated-client change, no new UI and no new user-visible strings.

## Alternatives considered

- **Extend `custom-api` with path parameters.** Rejected: its contract is "exact path, allowlisted query, opaque envelope"; path parameters would break its admission and registry model.
- **Call the application through chat completions** (as the agent and skill validators do). Rejected for REST services: it forces an RPC-over-chat contract on the upstream and loses HTTP status semantics.
- **Give the browser a Core token.** Rejected: the BFF exists so the browser never holds one.

## Impact

- Code: `apps/chat-api/src/deployment-route/deployment-route.controller.ts`, `apps/chat-api/src/deployment-route/deployment-route.module.ts`, registered in `apps/chat-api/src/app/app.module.ts`.
- API: one new URI-versioned (`v1`) path; no OpenAPI or generated client change.
- Auth: any authenticated session may call it; CSRF applies to writes through the existing global guards.
- Rollback: remove the module import from `app.module.ts`; nothing else depends on it on the BFF side.
- i18n: none. RTL: none (no UI).

## Acceptance criteria

- A request to `/api/v1/deployment-route/{encodedId}/{path}` reaches Core's `/v1/deployments/{id}/route/{path}` with `Authorization: Bearer <caller token>`, and the caller receives Core's status and body.
- A dot segment is refused with 400 before any Core call.
- The controller spec in `apps/chat-api/src/deployment-route/tests/deployment-route.controller.spec.ts` passes.

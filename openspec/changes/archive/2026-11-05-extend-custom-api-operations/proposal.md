## Why

Applications that run behind their own `ai-dial-chat-bff` (the DIAL Loop editor, like Quick Apps) hold no
access token in the page, so every call to a service other than Core has to go through the BFF. The
DIAL Loop editor's runner and Teams service answer the editor's connector status, resource browsing,
skill discovery and Teams binding; under the BFF those calls have no way to carry the user's identity,
and they fail.

The configured Core API bridge (`GET /api/v1/custom-api/:id`, change
`2026-10-02-add-configured-core-api-operations`) is the BFF's sanctioned path to deployment-specific
services behind Core Routes. It was scoped to fixed GET calls on purpose and names the next step itself:
"Parameterized calls and writes require separate contract extensions." This is that extension.

## What Changes

- An operation entry in `CUSTOM_CORE_API_CONFIG` may declare:
  - `method`: `GET` (default and today's only value), `POST`, `PUT` or `DELETE`;
  - `query`: an allowlist of query parameter names the caller may pass, forwarded to the Core path;
  - `body`: `json` for `POST`/`PUT` operations, which accept one bounded JSON request body;
  - `timeoutMs` above today's 10 s ceiling, up to 300 s, for a named long-running operation.
- `/api/v1/custom-api/:id` answers the configured method of each operation: `POST`, `PUT` and `DELETE`
  join `GET`. A method other than the configured one returns 405. Query names outside the allowlist,
  repeated names and any body on a bodiless operation keep returning 400.
- Upstream `201` and `204` are accepted next to `200`. `204` returns `{"data": null}`.
- OpenAPI and the generated `@epam/ai-dial-chat-api-client` gain `post`/`put`/`deleteCustomApiOperation`.
- Existing version-1 configurations keep their exact behaviour; nothing new is enabled without
  configuration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `configured-core-api-operations`: the registry accepts `method`, `query`, `body` and a raised
  per-operation timeout; the endpoint accepts the configured method, allowlisted query parameters and a
  JSON body for writes; `201`/`204` are successful upstream statuses.

## Non-goals

- No arbitrary path forwarding, path templates or wildcard routes: the destination is still one exact
  configured Core path per operation.
- No direct BFF calls to non-Core upstreams: services stay behind Core Routes, so Core keeps owning
  route roles, upstream credentials and rate limits.
- No streaming responses, file uploads, non-JSON bodies, `PATCH` or `HEAD`.
- No raised response size ceiling (1 MiB) and no change to admission bounds (32 total, 4 per principal).
- No Chat UI, no i18n, no feature flag.

## Alternatives considered

| Option | Correctness / security | Complexity and delivery risk | Rollback |
| --- | --- | --- | --- |
| Baseline: keep custom-api GET-only; the editor drops runner features | No new surface | None here; the editor loses connector status, browsing, skill discovery and Teams | Nothing to revert |
| **Extend custom-api (picked)** | Same allowlist model, Core Routes keep policy; each widening is explicit per operation | Extends one module and its tests; deployments also configure Core Routes | Unset the new fields or the env var, restart |
| New BFF passthrough straight to named upstreams | Forwards the user's token to non-Core services; contradicts the recorded non-goals (arbitrary forwarding, query/body, streaming) | New module with its own security review | Unset its config, restart |
| Runner reads the BFF session cookie and asks `auth/me` | The runner learns the user but gets no Core token to act as them | Couples every upstream to the BFF's cookie | Per upstream |

The extension follows the bridge's own model and boundaries, so its existing tests and security
reasoning carry over; the passthrough would re-open decisions the bridge's change made deliberately.

## Impact

- Model files: `apps/chat-api/src/custom-api/custom-api.controller.ts:54` (controller),
  `apps/chat-api/src/custom-api/custom-api-registry.service.ts:124` (`parseCustomApiRegistry`),
  `apps/chat-api/src/custom-api/custom-api.service.ts:106` (status handling),
  `apps/chat-api/src/custom-api/custom-api-response.ts:130` (`readBoundedJson`).
- `apps/chat-api/src/custom-api/` — registry, controller, service, DTOs, tests;
  `apps/chat-api/README.md` (Custom Core API operations).
- `libs/chat-api-client` regenerated (new operations). The Chat app's own adapter
  (`apps/chat/src/server-api/custom-api.api.ts`) is unchanged: it calls GET operations only.
- No shared libs or global providers touched beyond the generated client. No new user-visible strings.

## Acceptance criteria

- A version-1 configuration without the new fields behaves exactly as before; the existing custom-api
  specs pass unchanged.
- A configured `POST`/`PUT`/`DELETE` operation dispatches that method to its exact Core path with the
  caller's session token; a different method returns 405 without dispatch.
- Allowlisted query parameters reach Core; any other or repeated name returns 400 without dispatch.
- A JSON body reaches Core only for `body: "json"` operations, within the size and depth bounds; CSRF is
  enforced on every write by the existing guard.
- `201` and `204` upstream responses succeed; every other status keeps today's mapping.
- `npm run openapi:check` passes; `chat-api-client` builds and lints.

## Rollback

Additive and backward compatible. Removing the new fields from an entry (or unsetting
`CUSTOM_CORE_API_CONFIG`) and restarting returns the bridge to GET-only; reverting the commit restores the
previous code, under which a configuration that uses the new fields fails startup rather than
half-applying.

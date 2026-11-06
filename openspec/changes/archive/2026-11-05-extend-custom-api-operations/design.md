## Context

`GET /api/v1/custom-api/:id` (`apps/chat-api/src/custom-api/`) dispatches a deployment-allowlisted call
to one exact Core path with the caller's session token, bounded in time, bytes and concurrency, and
returns opaque JSON in a `{"data": …}` envelope. Its contract
(`openspec/specs/configured-core-api-operations/spec.md`) fixed the first version to GET with no query
and no body, and deferred parameterized calls and writes to a contract extension.

The consumer driving this extension is the DIAL Loop editor, which runs on its own `ai-dial-chat-bff`
and holds no token in the page. Its runner and Teams service sit behind Core Routes and are reached with
these calls:

| Editor feature | Upstream call | Method | Inputs |
| --- | --- | --- | --- |
| Connector status | `probe` | GET | `url` |
| Resource browser | `browse`, `resolve-share` | GET | `service`, `type`, `repo`, `ref`, `path`, `search`, `branches`, `site`, `url` |
| Skill / plugin discovery | `discover-skills`, `discover-plugins` | GET (clones; up to 300 s) | `host`, `repo`, `ref`, `subpath`, `service`, `site` |
| Shared / public connectors, link check | `shared-services`, `public-services`, `probe-source` | GET | `type`, `host`, `repo`, `ref` |
| Teams binding | `teams/binding`, `teams/binding/material` | GET, PUT, DELETE, POST | `application_id`; JSON body on PUT/POST |
| Connect page report | `connect/connected`, `connect/check` | POST | JSON body |

Every input is a flat query parameter or one JSON body; every destination is a fixed path. Nothing needs
path templates, streaming or files.

## Goals / Non-Goals

**Goals:**

- Let an operation declare its method (GET/POST/PUT/DELETE), an allowlist of query parameter names, a
  JSON body for writes and, explicitly, a longer deadline.
- Keep every existing guarantee: exact destinations, fail-closed configuration, session credentials only,
  no redirects, bounded JSON, sanitized errors, bounded admission, private telemetry.
- Leave version-1 configurations without the new fields behaving exactly as today.

**Non-Goals:**

- Arbitrary or templated paths, non-Core upstreams, streaming, file or non-JSON bodies, `PATCH`/`HEAD`.
- A higher response-size ceiling or different admission bounds.
- Any Chat UI change. The Chat app keeps calling GET operations only.

## Decisions

### 1. Registry fields, in version 1

An entry gains optional `query` and `body`, and `method` widens to `GET | POST | PUT | DELETE`:

```json
{"version":1,"operations":[
  {"id":"loop-probe","method":"GET","corePath":"/dial-loop/editor/probe","query":["url"]},
  {"id":"loop-discover-skills","method":"GET","corePath":"/dial-loop/editor/discover-skills",
   "query":["host","repo","ref","subpath"],"timeoutMs":300000},
  {"id":"loop-teams-binding-put","method":"PUT","corePath":"/dial-loop/editor/teams/binding",
   "query":["application_id"],"body":"json"}]}
```

- `query`: at most 16 unique names, each `^[a-z][a-z0-9_]{0,31}$`.
- `body`: only `"json"`, and only on `POST`/`PUT`. Present on GET/DELETE → startup failure.
- `timeoutMs`: positive integer up to 300,000. Absent → 10,000, today's default.
- Same version number: an older BFF build rejects the unknown fields and fails startup, which is the
  intended fail-closed behaviour for a configuration it cannot honour. A version bump would add a second
  parse path without adding safety.
- One method per operation. A path served with several methods (Teams binding) is several operations,
  so the allowlist names each exposed method explicitly.

*Alternative:* a `params` object per entry with types and required flags. Rejected: the BFF does not
validate business inputs. The upstream does, and names alone bound what the caller can send.

### 2. One route, method checked against the operation

`CustomApiController` handles `GET`, `POST`, `PUT` and `DELETE` on `:id`. Each handler resolves the
operation, then answers 405 when the request method differs from the configured one, before admission
and dispatch. `HEAD` and `PATCH` keep their explicit 405 handlers, so Express's implicit HEAD-to-GET
dispatch stays impossible. Unknown IDs still return 404 for any method.

### 3. Query forwarding

The controller reads the parsed query (Express 5 `simple` parser: flat keys, a repeated key becomes an
array). Every key must be in the operation's `query`. A repeated key, a non-string value, a value over
2,048 UTF-8 bytes or a total encoded query over 8 KiB returns 400 before dispatch. The BFF rebuilds the
query with `URLSearchParams` from the allowed names in configuration order, appends it to the destination
from `resolveCustomApiDestination`, and asserts that origin and pathname are unchanged. An operation
without `query` keeps rejecting every query value.

Core Routes with `rewritePath: true` copy the incoming query to the upstream (finding in
`openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md`), which is how the
runner receives it.

### 4. JSON request body

For `body: "json"` operations the request must carry `Content-Type: application/json`. The parsed body
must be a JSON object or array, at most 65,536 bytes once re-serialized and at most 32 levels deep. It
is sent re-serialized, never as the raw stream. Every other operation keeps rejecting a nonempty body
with 400 (`hasNonEmptyBody`). The existing JSON body parser limit (`CONVERSATION_BODY_SIZE_LIMIT_BYTES`)
still applies first.

### 5. Outgoing request

Method from configuration, the exact destination, `Authorization` from the principal's access token,
`Accept: application/json`, and `Content-Type: application/json` only when a body is sent. Redirects
stay disabled; no caller header is copied.

### 6. Accepted upstream statuses

`200` and `201` with bounded JSON as today. `204` with an empty body → `{"data": null}`, and a `204`
carrying bytes → 502. The retained error statuses and the 502/503/504 mapping are unchanged.

### 7. Deadlines

The hard ceiling becomes 300,000 ms; the default stays 10,000 ms, so only an operation that sets
`timeoutMs` gets longer. A long call holds its admission permit for its whole duration. With 4 permits per
principal, one user can run at most 4 such calls at once, which the existing bound already accepts.

*Alternative:* keep 10 s and make the runner's discovery asynchronous (start + poll). Rejected for this
change because it moves work into another service. It remains the fallback if Core Routes cannot hold a
call that long (Open Questions).

### 8. Authorization

Every method uses the global `SessionGuard` and `CsrfGuard`. Any authenticated principal may call a
configured operation; Core Route roles decide whether it succeeds, as for GET today. Writes therefore
require the CSRF token and a matching Origin, enforced by the existing guard. No feature-specific role
check is added.

### 9. OpenAPI and the generated client

New operationIds `postCustomApiOperation` and `putCustomApiOperation`, with an optional opaque JSON
request body documented inline as a free-form object (like the envelope's `data`; an empty DTO class
would render with no properties), and `deleteCustomApiOperation`, all returning `CustomApiResponseDto`.
The query allowlist is per deployment and cannot be declared in OpenAPI. Declaring a free-form object
parameter would make the generated client serialize it as `params[name]=…`
(`libs/chat-api-client/src/generated/src/runtime.ts`, `querystringSingleKey`), which is not the wire contract.
This is a documented generator gap: callers that pass query parameters build the URL themselves on the
generated `Configuration`'s `fetchApi`. The Chat app's own adapter needs neither query nor writes.

### 10. Telemetry

`recordCustomApiCall` gains a bounded `method` label. No query values, bodies or full URLs are recorded,
as today.

## Risks / Trade-offs

- [A write reaches Core through a browser-chosen body] → Allowed only for operations configured with
  `body: "json"`; size and depth bounded; CSRF and Origin checked; Core Route roles authorize; the
  upstream validates the business content.
- [Query values carry user-controlled data to an upstream] → Names are allowlisted per operation and
  values bounded. The upstream owns validation, as the bridge already documents for response contents.
- [Long calls exhaust a principal's permits] → Opt-in per operation; the default stays 10 s; the permit
  is released on completion, abort or disconnect as today.
- [Core forwards the user's Authorization to the route upstream] → Already documented for this bridge.
  Only trusted upstreams belong behind these routes; operator docs repeat it for write routes.

## Migration Plan

1. Ship the BFF change. Existing configurations are unaffected.
2. Per deployment, add the Core Routes (exact paths, methods, roles, `rewritePath` as needed) and the
   matching operations to `CUSTOM_CORE_API_CONFIG`; restart the BFF.
3. The consuming application (DIAL Loop editor) switches its calls in its own change.

Rollback: remove the new fields or the operations and restart, or revert the commit (a configuration
that still uses the new fields then fails startup, by design).

## Open Questions

- Can a Core Route hold an upstream call for 300 s, or does Core's route timeout cap it lower? If it is
  lower, discovery needs the asynchronous fallback in the runner, and `timeoutMs` stays within Core's cap.
- Confirm on a deployment that the runner receives the user's bearer through a Core Route (the default
  header filter passes `Authorization`), since the runner authorizes per user.

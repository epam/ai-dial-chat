## Why

`CUSTOM_CORE_API_CONFIG` rejects every `corePath` that contains a dot: a segment may hold only ASCII letters,
digits, `_` and `-` (`CORE_PATH_PATTERN` in `apps/chat-api/src/custom-api/custom-api-registry.service.ts`).
DIAL application ids carry their version with dots (`<name>__1.0.0`), so an operation cannot reach a route
declared on an application, `/v1/deployments/applications/<folder>/<name>__1.0.0/route/<path>`.

An application behind its own `ai-dial-chat-bff` (the DIAL Loop editor) can reach its backend through a global
Core route configured in DIAL Admin, which `corePath` supports today, or through an application route declared
in the application's own definition, as DIAL Scheduler ships its routes. The application route keeps the
configuration with the application, and the backend receives a per-request key for one call instead of the
person's bearer token. Only the dot rule stands in its way. Issue #9581.

## What Changes

- A `corePath` segment may contain `.`; a segment that is exactly `.` or `..` is still rejected at startup.
- Everything else the path rule rejects stays rejected: percent encodings, backslashes, doubled and trailing
  slashes, absolute and protocol-relative URLs, queries and fragments.
- `resolveCustomApiDestination` is unchanged: it still re-parses the assembled URL and refuses a destination
  whose pathname differs from the configured one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `configured-core-api-operations`: the configured-path rule allows a dot inside a segment.

## Non-goals

- No path templates, wildcards or caller-selected paths; one exact configured path per operation.
- No change to methods, query, body, limits, credentials or admission.

## Impact

- Code: `CORE_PATH_PATTERN` and its comment; registry and destination tests.
- Docs: the `corePath` rule in `apps/chat-api/README.md`.
- Builds on the open change `extend-custom-api-operations`, which restates the same requirement; this change's
  delta is written against that version and archives after it.
- Existing configurations parse exactly as before: every path valid today stays valid.

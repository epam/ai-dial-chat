## ADDED Requirements

### Requirement: ALLOWED_IFRAME_ORIGINS accepts a leading-wildcard-label origin pattern

In addition to today's exact-origin entries (`scheme://host[:port]`, no path/query/fragment), `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` SHALL accept an entry whose host is a single `*.` wildcard label followed by a normal dotted hostname, e.g. `https://*.example.com` or `http://*.example.internal:8080` — mirroring CSP's own host-source wildcard grammar, so the value can be forwarded verbatim into `frame-src`/`frame-ancestors` (per the existing `chat-overlay-security-config` CSP requirements) without server-side rewriting. Exact-origin and wildcard entries MAY be mixed in the same comma-separated list. An entry is rejected, and env validation fails at boot with the existing `Environment validation failed` error, when it contains a bare `*` host, a `*` anywhere other than the leftmost label, more than one `*`, or any path/query/fragment on either form.

#### Scenario: A wildcard subdomain pattern is accepted

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com` is set
- **THEN** the app boots successfully and `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` is `['https://*.example.com']`

#### Scenario: Exact and wildcard entries can be mixed

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://quickapps.test,https://*.example.com` is set
- **THEN** the app boots successfully and `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` is `['https://quickapps.test', 'https://*.example.com']`

#### Scenario: A bare wildcard host is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*` is set
- **THEN** env validation fails at boot with the existing `Environment validation failed` error and the app does not start

#### Scenario: A wildcard outside the leftmost label is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://foo.*.example.com` is set
- **THEN** env validation fails at boot and the app does not start

#### Scenario: A wildcard entry with a path is rejected

- **WHEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com/embed` is set
- **THEN** env validation fails at boot and the app does not start

## MODIFIED Requirements

### Requirement: Incoming SET_OVERLAY_OPTIONS is validated against the same allowlist

The accepted `hostDomain` SHALL be pinned to the message's `event.origin`: if the payload contains `hostDomain`, it must match `event.origin`, and after a host is stored the app SHALL reject active-conversation requests from any different origin, even if that origin is also allowlisted.

The app SHALL validate an inbound `SET_OVERLAY_OPTIONS` message's `event.origin` against `ALLOWED_IFRAME_ORIGINS` (surfaced to the frontend via `chat-overlay-security-config`'s client-config additions) before accepting it as authoritative for `hostDomain`, per `chat-overlay-protocol`'s origin-validation requirement. This is a defense-in-depth check in addition to (not a replacement for) the server-side CSP `frame-ancestors` restriction — CSP prevents the browser from framing the page at all under a disallowed origin, while this check protects against a origin that manages to deliver a `postMessage` despite not being the actual framing origin (e.g. a misconfigured intermediate frame).

The allowlist check SHALL be wildcard-aware: an `ALLOWED_IFRAME_ORIGINS` entry of the form `scheme://*.host[:port]` matches an incoming origin when the origin's scheme matches exactly and the origin's remainder (host, optionally `:port`) ends with `.host[:port]` — the bare `host[:port]` itself (no subdomain label) does not match. A non-wildcard entry continues to require an exact string match against the full origin, unchanged from before this capability's wildcard support.

#### Scenario: Origin outside the allowlist is rejected even if CSP were bypassed

- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` not present in the configured `ALLOWED_IFRAME_ORIGINS` list
- **THEN** the app does not adopt its `hostDomain` and sends no response, regardless of CSP enforcement having already been bypassed by some other means

#### Scenario: An origin matching a wildcard allowlist entry is accepted

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://portal.example.com`
- **THEN** the app accepts `https://portal.example.com` as the trusted `hostDomain`

#### Scenario: A nested subdomain still matches a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://a.b.example.com`
- **THEN** the app accepts `https://a.b.example.com` as the trusted `hostDomain`

#### Scenario: The apex domain alone does not match a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com` (and no exact entry for the apex)
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `https://example.com`
- **THEN** the app rejects the message and does not adopt `https://example.com` as `hostDomain`

#### Scenario: A different scheme does not match a wildcard allowlist entry

- **GIVEN** `ALLOWED_IFRAME_ORIGINS=https://*.example.com`
- **WHEN** a `SET_OVERLAY_OPTIONS` message arrives with `event.origin` equal to `http://portal.example.com`
- **THEN** the app rejects the message and does not adopt `http://portal.example.com` as `hostDomain`

**Authorization:** No end-user identity is involved in this check — it authorizes an *origin*, configured by the deployment operator, not a user or role.

**Observability:** Rejected-origin attempts SHOULD be logged (origin value, no payload contents) at `warn` level for operational visibility, without exposing them to the host page.

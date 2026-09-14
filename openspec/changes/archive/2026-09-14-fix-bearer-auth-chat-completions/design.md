## Context

`apps/chat-api` supports two credential sources through one DI-ordered strategy chain
(`bff-header-token-auth`): `HeaderTokenStrategy` (`AuthSource.Header`) and
`CookieSessionStrategy` (`AuthSource.Cookie`). `SessionGuard` picks the first strategy whose
`supports(req)` is true and sets both `req.user` and `req.authSource`
(`apps/chat-api/src/auth/session/session.guard.ts:34-44`).

Only the cookie strategy produces a session id. `SessionUser.sid` and `SessionUser.csrf` are
declared optional precisely for that reason
(`apps/chat-api/src/auth/session/session.types.ts:41-59`), and
`HeaderTokenStrategy.authenticate` returns `{ sub, providerId, claims, at, bucket }` with
neither field (`apps/chat-api/src/auth/strategies/header-token.strategy.ts:114-120`).

Chat generation is the only subsystem that took `sid` as mandatory.
`ConversationGenerationService` keys its in-memory registry by `` `${sessionId}::${path}` ``
(`apps/chat-api/src/conversations/conversation-generation.service.ts:93-95`), so
`ConversationController` guards the three endpoints that touch the registry with
`requireSessionId`, which throws `401` when `sid` is absent
(`apps/chat-api/src/conversations/conversation.controller.ts:107-114`, applied at `:288`,
`:374`, `:413`). That, and nothing else, is why a bearer-authenticated caller can list, read,
save, rename and delete conversations but cannot generate into one.

**Constraint established by investigation, not assumed:** the streaming transport is not
implicated. `createChatStreamApi` attaches only `Content-Type`, `X-CSRF-Token` and
`X-Timezone` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts:117-127`, `:154-175`),
and `createApiConfiguration` attaches only CSRF, unauthorized-handling and telemetry middleware
(`apps/chat/src/server-api/api-client.ts:78-83`). No `Authorization` request header is
constructed anywhere in `apps/chat/src` or `libs/chat-hooks/src`. `POST .../completions/attach`
already travels the *same* generated-client path as every REST call that works
(`apps/chat/src/server-api/conversations.api.ts:132-144`) and still returns `401` — which
isolates the fault to the controller gate. In the affected setup the `Authorization` header is
therefore added uniformly by something outside `apps/chat`: an edge proxy/gateway, or a
non-`apps/chat` client of the BFF. The user confirmed this reading. That makes the fix
backend-only.

**Second finding, a latent hole rather than the reported defect:**
`HeaderTokenStrategy` coerces a missing subject to an empty string —
`sub: String(verifiedClaims.sub ?? '')` (`header-token.strategy.ts:115`). Harmless while
nothing keys on the subject; unacceptable the moment ownership does.

Registry callers are few and all internal: `conversation.controller.ts` and
`conversation-streaming.service.ts` (`:426`, `:438`, `:456`, `:486`, `:567`, `:577`, `:611`,
`:617`, `:704`, `:755`, `:758`). Nothing else in `apps/chat-api` reads `sid` outside the auth
domain itself.

## Goals / Non-Goals

**Goals:**

- Make `completions`, `completions/stop` and `completions/attach` work under
  `AuthSource.Header`, with the same lifecycle guarantees they have under `AuthSource.Cookie`.
- Define generation ownership once, from server-verified identity only, and apply the same
  definition to start, stop and attach.
- Make owner keys injective across principals and across auth modes, so no two distinct
  principals can ever share a registry entry.
- Keep ownership stable across access-token renewal.
- Close the empty-`sub` hole that the ownership derivation would otherwise depend on.
- Leave every cookie-mode behaviour bit-identical.

**Non-Goals:**

- Any frontend change. `apps/chat` and `libs/chat-hooks` are untouched; no token-source
  capability is injected into the stream transport, because the affected setup does not need one.
- Changing the bearer verification contract — issuer allowlist, JWKS verification, `aud` being
  deliberately unconstrained, header-over-cookie precedence, no cookie fallback, no server-side
  refresh, no session-cookie creation. All unchanged.
- Changing CSRF: cookie requests keep both the origin and token checks; the exemption stays
  limited to requests already authenticated as `AuthSource.Header`
  (`apps/chat-api/src/auth/csrf/csrf.guard.ts:44-55`).
- Persisting the registry, sharing it across pods, or changing its lifetime, stale sweep, or
  `MAX_GENERATION_DURATION_MS` bound.
- Unifying cookie and header ownership into one namespace (see Decision 2).
- Introducing per-client generation isolation for bearer callers (see Decision 3).
- Any change to SSE framing, backend-owned persistence, live replay, `409`, or `404` semantics.

## Decisions

### Decision 1 — Ownership is a *principal key* derived from server-verified identity

Introduce a pure resolver, `apps/chat-api/src/auth/session/principal-key.ts`:

```
resolvePrincipalKey(user: SessionUser, authSource: AuthSource | undefined): string
```

- `AuthSource.Cookie` → `c:<enc(sid)>`
- `AuthSource.Header` → `h:<enc(providerId)>:<enc(sub)>`
- anything else, or a required component missing/empty → `UnauthorizedException`

`enc` is `encodeURIComponent`. Both inputs come only from values the server itself verified:
`sid` from the decrypted session payload, `providerId` from the registry entry matched by
issuer, `sub` from the JWKS-verified claims. Nothing is read from a request body, query string,
or client-supplied header other than the credential itself.

*Why the auth domain and not the conversations domain?* The key is a property of the
authenticated principal, not of conversations, and `ConversationController` already imports
from `../auth/session/session.types` (`conversation.controller.ts:261`), so this follows an
existing cross-domain dependency direction rather than creating a new one. It stays a pure
function with no I/O, so it needs no module wiring.

*Why keyed off `authSource` rather than "is `sid` present?"* `authSource` is set by
`SessionGuard` from the strategy that actually authenticated the request
(`session.guard.ts:41`). Branching on it makes the mode explicit and makes an inconsistent
`SessionUser` (header auth that somehow carries a `sid`, or cookie auth that lost one) a loud
`401` rather than a silent mis-attribution.

*Alternatives rejected:* hash of the access token — breaks on renewal and puts token material
into a long-lived key (proposal, alternative 2); a client-supplied owner id — lets any caller
address another caller's generation (alternative 3).

### Decision 2 — Two disjoint namespaces, not one unified key

The `c:` / `h:` prefix keeps the modes separate. Cookie callers keep `sid`, so their keys are
structurally what they are today and nothing about multi-session cookie isolation shifts.

The alternative — keying everything by `providerId` + `sub` — would be *more* uniform but would
change working behaviour: two browser sessions of one user today hold independent generations on
the same conversation path, and unifying would start rejecting the second with `409`. Rewriting
the common path's semantics to fix the uncommon path's defect is the wrong trade.

**Accepted consequence:** a cookie session and a bearer client *of the same human user* are
different principals. Both can start a generation on the same conversation path at the same
time, and both will persist into the same conversation resource — last writer wins. This is not
a new failure mode; it is exactly what two cookie sessions of one user can already do today, and
the registry has never been the mechanism that serialises writes to a conversation. It is called
out here so the limitation is recorded rather than discovered.

### Decision 3 — Bearer ownership is subject-scoped, which is the finest server-verifiable grain

Every client presenting a token for the same `(providerId, sub)` is one principal: one active
generation per conversation path across all of them, and any of them can stop or attach to it.

This is deliberate, and it is the *only* option that does not violate a stated constraint. A
bearer request carries no server-issued session artifact — that is the defining property of the
mode (`docs/auth/auth-bff-encrypted-cookie.md:341`). Distinguishing "client A" from "client B"
of the same subject would require trusting a value the client asserts, which Decision 1 rules
out on security grounds. Subject-level is therefore the floor.

It is also the behaviour that makes the feature useful: it mirrors multiple tabs of one cookie
session (which already share one `sid` and can already all attach to one generation —
`generation-live-replay`, "Two concurrent subscribers on the same generation"), and it is what
lets a bearer client that reconnects, or renews its token, resume the generation it started.

### Decision 4 — Injectivity comes from per-component encoding, and the key stays opaque

`encodeURIComponent` percent-escapes both `:` (→ `%3A`) and `%` (→ `%25`), so an encoded
component can never contain a separator and the component→encoding map is injective. Joining
injective, separator-free components with a separator yields an injective tuple encoding. Hence:

- `providerId="a"`, `sub="b:c"` → `h:a:b%3Ac`
- `providerId="a:b"`, `sub="c"` → `h:a%3Ab:c`

Distinct, where naive concatenation would have collided on `h:a:b:c`. Cross-mode collision is
excluded by the `c:` / `h:` prefix, which no encoded component can produce.

The registry key remains `` `${ownerKey}::${path}` ``. It is used purely as a `Map` key and is
never parsed back apart, so injectivity is the whole requirement — there is no need to make the
path component escaped or the composition reversible.

Rejected: SHA-256 of the joined components. It is also injective in practice but makes every
key unreadable in a debugger for no gain, and hashing is not what prevents the collision here —
encoding is.

### Decision 5 — Reject a verified header token with no non-empty `sub`

In `HeaderTokenStrategy.authenticate`, after signature verification and before returning, throw
`UnauthorizedException` with `AuthErrorCode.HeaderTokenInvalid` and the message
`Token is missing a "sub" claim`, mirroring the existing missing-`iss` rejection
(`header-token.strategy.ts:136-144`) rather than inventing a new code or shape.

This is a dependency of Decision 1, not a drive-by: with `String(sub ?? '')`, every `sub`-less
token from one provider would resolve to the single owner key `h:<provider>:` and those callers
would share each other's generations.

It narrowly tightens existing behaviour: a `sub`-less token that authenticates today would now
be rejected on *all* endpoints, not just the three being fixed. That is the correct call — `sub`
is REQUIRED in an OIDC ID token and universally present in the access tokens of the supported
providers, and a caller with `sub: ''` is already mis-served downstream (for example
`resolveGenerationApiForDeployment(sub, …)` at
`conversation-streaming.service.ts:445`). Recorded here so it is a documented decision rather
than a surprise in the diff.

### Decision 6 — Owner keys must not reach the logs verbatim

`ConversationGenerationService` logs the registry key in two places today —
`Evicting stale generation entry: ${key}` (`:136`) and
`Aborting generation past MAX_GENERATION_DURATION_MS: ${key}` (`:172`). Under cookie auth that
key's owner half is an opaque session UUID. Under bearer auth it would become the user's OIDC
subject, so those two lines would start emitting a user identifier into application logs.

Both lines therefore log a truncated SHA-256 digest of the owner key alongside the conversation
path, instead of the owner key itself. Operators keep the ability to correlate entries belonging
to one principal; the subject never lands in a log line. Raw tokens were never logged and still
are not. No metric is affected: `trackGeneration()` takes no labels
(`apps/chat-api/src/telemetry/runtime-metrics.ts:38-47`), so registry cardinality does not reach
the metrics pipeline at all.

### Decision 7 — Rename the registry parameter, keep the registry's shape

`ConversationGenerationService`'s `sessionId` parameter becomes `ownerKey` across `register`,
`seedAssembledMessage`, `applyChunk`, `attach`, `abort`, `getStatus`, `complete` and `error`,
and `ConversationStreamingService.streamCompletion` renames its own pass-through parameter to
match. Positional signatures, entry structure, TTLs, the stale sweep, the max-duration timer,
`ConflictException` on an active duplicate, and the `generationId` match requirement on `abort`
are all untouched.

The rename is not cosmetic: leaving the name `sessionId` on a value that is a session id in one
mode and a subject tuple in the other is exactly the ambiguity that produced this defect.

### Decision 8 — No contract change, but prove it

No path, method, DTO, status code or `operationId` changes, and both security schemes are already
registered document-wide via `.addCookieAuth('session')` + `.addBearerAuth(...)`
(`apps/chat-api/src/openapi/openapi.config.ts:21-22`), so the three operations already advertise
bearer as acceptable. `@ApiResponse` description text on the three endpoints is reworded from
"session" to "principal" — prose, not schema.

`npm run openapi && npm run openapi:check` runs as a guard rather than as a regeneration step. If
the check reports any diff, the standard workflow applies: regenerate, then build and lint
`chat-api-client`, and treat the client as part of the change.

## Risks / Trade-offs

**[Cookie-mode regression]** → The cookie branch resolves to `c:<enc(sid)>`, a pure function of
the same `sid` the code uses today, so key identity is preserved under a different spelling. The
existing cookie integration suites (`completions.integration.spec.ts`,
`attach-generation.integration.spec.ts`, `conversation.controller.integration.spec.ts`) run
unmodified as the regression gate; changes to them beyond the `sessionId` → `ownerKey` rename
are a signal that behaviour moved.

**[A bearer client can stop another client's generation for the same user]** → Accepted and
specified (Decision 3), not a bug. It matches multi-tab behaviour under one cookie session, and
the alternative requires trusting client-asserted identity.

**[Mixed cookie + bearer concurrency on one conversation]** → Accepted and documented
(Decision 2). Same class as two cookie sessions today; the registry is not, and never was, the
write-serialisation mechanism for a conversation resource.

**[Token expiry mid-generation]** → `streamCompletion` captures `token` once, at request start
(`conversation-streaming.service.ts:410`), and uses it for the upstream relay *and* for the
persistence writes that follow. If it expires before the generation ends, DIAL Core rejects those
calls and the generation finalises as an error. This is pre-existing and shared with cookie mode —
transparent refresh rotates the cookie per request, not mid-stream — but it bites harder under
bearer, where the BFF refreshes nothing by contract. Mitigation is bounded exposure, not a code
change: `MAX_GENERATION_DURATION_MS` caps how long a captured token can be in flight
(`generation-registry`), and the caller owns its token lifecycle per `bff-header-token-auth`.
This is called out in the README so operators size token lifetime against that bound. Changing
it would mean mid-stream credential rotation — a different change.

**[Tightening `sub` breaks an existing bearer integration]** → Only for a token with no `sub`
claim, which is not a valid OIDC subject-bearing token and is already mis-served downstream
(Decision 5). Failure is a clear `401` + `AUTH_HEADER_TOKEN_INVALID`, not silent misbehaviour.

**[Registry growth under bearer]** → Unchanged bounds: one entry per `(principal, path)`, same
30-minute stale sweep, same max-duration timer. Subject-scoped ownership means *fewer* potential
keys per user than a per-client scheme would produce.

## Migration Plan

Single deployment, no data migration, no coordination with the frontend.

1. Ship `principal-key.ts` and its unit spec — additive, nothing calls it yet.
2. Ship the `HeaderTokenStrategy` `sub` rejection.
3. Ship the `sessionId` → `ownerKey` rename through the generation service and streaming service.
4. Switch `ConversationController` from `requireSessionId` to `resolvePrincipalKey`, deleting
   `requireSessionId`.
5. Apply the log redaction of Decision 6.
6. Update `generation-registry`, `stop-generation-endpoint`, `generation-live-replay`,
   `backend-owned-generation-persistence` and `bff-header-token-auth` specs, plus
   `docs/architecture.md:421,423`, `docs/auth/auth-bff-encrypted-cookie.md` §6.1 and
   `apps/chat-api/README.md:233-243`, in the same change.

**Rollback:** plain revert plus restart. The registry is in-memory and non-persisted, so no key
format survives a restart and there is nothing to clean up. In-flight generations are lost
exactly as they are on any other pod restart. Cookie callers see no difference at any point;
bearer callers return to the pre-change `401` on the three endpoints.

**Feature flag:** none added. The behaviour is already gated by `AUTH_HEADER_TOKEN_ENABLED`
(default `false`) — with header auth off, no request ever reaches the header branch of the
resolver, so the blast radius on an unconfigured deployment is zero.

## Open Questions

None blocking. The one material ambiguity — how the `Authorization` header reaches
`apps/chat-api` in the affected setup — was resolved with the user: an external edge or a
non-`apps/chat` client supplies it, so no frontend work is in scope. Should a future setup need
`apps/chat` itself to hold and attach the token, that is a separate change: it would add a
narrow injected capability (e.g. `getAuthHeaders`) to `CreateChatStreamApiDeps` and to the
generated client's `Configuration`, with the token source living at the application edge per the
library-isolation rule. Nothing in this design forecloses it.

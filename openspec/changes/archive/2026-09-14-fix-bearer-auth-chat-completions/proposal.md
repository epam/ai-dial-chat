## Why

`apps/chat-api` already accepts `Authorization: Bearer <token>` as a first-class credential
source (`bff-header-token-auth`), and every ordinary REST endpoint works under it. Chat
generation does not: the three completion endpoints hard-require a cookie session and reject
a bearer-authenticated caller with `401`.

The cause is confirmed in code, not inferred:

- `HeaderTokenStrategy.authenticate` returns a `SessionUser` with no `sid` and no `csrf`
  (`apps/chat-api/src/auth/strategies/header-token.strategy.ts:114-120`), which is the
  documented contract — no session is created for a header-authenticated caller
  (`apps/chat-api/src/auth/session/session.types.ts:42`, `docs/auth/auth-bff-encrypted-cookie.md:341`).
- `ConversationController.requireSessionId` throws
  `UnauthorizedException('This endpoint requires a cookie-authenticated session')` whenever
  `user.sid` is absent (`apps/chat-api/src/conversations/conversation.controller.ts:107-114`).
- It gates exactly three handlers: `POST /api/v1/conversations/completions`
  (`conversation.controller.ts:288`), `POST /api/v1/conversations/completions/stop`
  (`conversation.controller.ts:374`), and `POST /api/v1/conversations/completions/attach`
  (`conversation.controller.ts:413`).
- The reason the gate exists is the registry key: `ConversationGenerationService` keys every
  entry by `` `${sessionId}::${path}` `` (`conversation-generation.service.ts:93-95`), and a
  bearer caller has no session id to key on.

So the defect is not a transport problem. It is a missing definition of *generation ownership*
for the bearer authentication mode.

Two facts bound the scope, both verified:

1. **The streaming transport is not the cause.** `createChatStreamApi`
   (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts:113-175`) sends
   `Content-Type`, `X-CSRF-Token` and `X-Timezone` and nothing else; `createApiConfiguration`
   (`apps/chat/src/server-api/api-client.ts:78-83`) adds CSRF, unauthorized-handling and
   telemetry middleware and nothing else. Neither attaches `Authorization`, and a repository-wide
   search finds no `Authorization` request header anywhere in `apps/chat/src` or `libs/chat-hooks/src`.
   In the affected setup the header is supplied by an external edge (reverse proxy / gateway) or
   by a non-`apps/chat` client, uniformly across all requests to `apps/chat-api` — which is exactly
   why ordinary REST calls succeed while the completion endpoints return `401` from the gate above.
   `POST .../completions/attach` already goes through the same generated client as every working
   REST call (`apps/chat/src/server-api/conversations.api.ts:132-144`), and it still fails —
   further confirming the gate, not the transport, is the cause.
2. **A second, latent isolation hole must be fixed as a dependency.** `HeaderTokenStrategy`
   writes `sub: String(verifiedClaims.sub ?? '')` (`header-token.strategy.ts:115`). A verified
   token with no `sub` claim currently yields an empty subject. Once ownership is derived from
   the subject, an empty `sub` would collapse every such caller of one provider into a single
   owner. The token must be rejected instead.

## What Changes

- Introduce an explicit **generation principal key** derived only from server-verified identity:
  the cookie session id for `AuthSource.Cookie`, and the verified `providerId` + `sub` pair for
  `AuthSource.Header`. The two modes live in separate, prefixed namespaces that cannot collide.
- Replace `ConversationController.requireSessionId` with principal-key resolution, applied
  identically to `completions`, `completions/stop` and `completions/attach`, so all three endpoints
  succeed for a bearer caller and remain byte-for-byte unchanged for a cookie caller.
- Rename `ConversationGenerationService`'s `sessionId` parameter to `ownerKey` and build the
  registry key from the already-namespaced, component-encoded principal key. No raw token is ever
  used as, or incorporated into, a registry key, and no owner identifier is read from a request body.
- Reject a header token that verifies but carries no non-empty `sub` claim with
  `401 / AUTH_HEADER_TOKEN_INVALID`, closing the empty-subject collapse described above.
- Define, and cover with tests, the bearer-mode semantics the cookie mode already had implicitly:
  cross-user and cross-provider isolation, behaviour across several concurrent clients of the same
  user, and behaviour after the caller renews its access token.
- No change to: the bearer verification contract, header-over-cookie precedence, the no-cookie-fallback
  rule, the absence of server-side refresh, the absence of session-cookie creation, CSRF enforcement
  for cookie requests, or the CSRF exemption for successfully header-authenticated requests.
- No change to: SSE framing, backend-owned persistence after disconnect, live replay, the `409`
  generation-conflict response, the `404` unknown-generation response, or DIAL Core access isolation.
- No frontend change. `apps/chat` and `libs/chat-hooks` are untouched; the design records the verified
  fact that `apps/chat` does not attach `Authorization` itself.
- Not breaking. No request or response shape changes; the only externally visible difference is that
  three endpoints that returned `401` for a valid bearer caller now succeed.

## Capabilities

### New Capabilities

- `generation-principal-ownership`: how the backend derives a stable, server-verified owner for an
  in-flight generation under each authentication mode, how owner keys are composed so distinct
  principals can never collide, and the isolation guarantees that follow for start, stop and attach.

### Modified Capabilities

- `generation-registry`: the registry key changes from `` `${sessionId}::${path}` `` to
  `` `${ownerKey}::${path}` ``, where `ownerKey` is the namespaced principal key rather than a
  cookie session id.
- `stop-generation-endpoint`: the handler resolves the principal key instead of requiring a cookie
  session id, and no longer returns `401` for a valid bearer caller.
- `generation-live-replay`: attach is scoped to the caller's principal rather than to a cookie
  session; the multi-subscriber guarantee is restated in principal terms.
- `backend-owned-generation-persistence`: the "already active for this session and path" conflict
  condition is restated as "already active for this principal and path".
- `bff-header-token-auth`: a header token that verifies but has no non-empty `sub` claim is rejected
  with `AUTH_HEADER_TOKEN_INVALID`; completion, stop and attach are reachable under header auth.

## Impact

**Code (all in `apps/chat-api`, backend only)**

- `src/auth/session/principal-key.ts` — new; pure resolver, no I/O. Placed in the auth domain
  because it derives from `SessionUser` + `AuthSource`, following the same cross-domain import the
  controller already makes for `session.types` (`conversation.controller.ts:261`).
- `src/auth/strategies/header-token.strategy.ts` — reject an empty/absent `sub`.
- `src/conversations/conversation.controller.ts` — drop `requireSessionId`, use the resolver.
- `src/conversations/conversation-generation.service.ts` — `sessionId` → `ownerKey`.
- `src/conversations/streaming/conversation-streaming.service.ts` — parameter rename only; the value
  is threaded through unchanged (`:426`, `:438`, `:456`, `:486`, `:567`, `:577`, `:611`, `:617`,
  `:704`, `:755`, `:758`).

**API / OpenAPI / generated client**

No contract change: no path, method, DTO, status code or `operationId` changes. The three operations
already carry both security schemes through the document-level `addCookieAuth('session')` +
`addBearerAuth(...)` registration (`src/openapi/openapi.config.ts:21-22`). `npm run openapi` and
`npm run openapi:check` are run as a guard to prove the document did not drift; if the check reports
any diff, the standard regeneration workflow (regenerate, then build and lint `chat-api-client`) applies.
`@ApiResponse` *descriptions* on the three endpoints are reworded from "session" to "principal", which
is documentation text and does not alter the schema.

**Tests** — extend the existing integration suites in `apps/chat-api/src/conversations/tests/`
(`completions.integration.spec.ts`, `attach-generation.integration.spec.ts`,
`conversation-generation.service.spec.ts`) rather than adding a parallel harness, plus a new unit spec
for the resolver and an addition to `apps/chat-api/src/auth/strategies/tests/header-token.strategy.spec.ts`.

**Docs** — `docs/architecture.md:421,423` (registry keyed by `sessionId`; attach "in the caller's
session"), `docs/auth/auth-bff-encrypted-cookie.md` §6.1, and the `AUTH_HEADER_TOKEN_*` section of
`apps/chat-api/README.md:233-243`. `npm run validate:docs` is required because `docs/**` and a README
change.

**i18n** — none. No user-visible strings are added or changed; the frontend is untouched.

**Scope creep** — none. No `libs/*` and no shared provider is touched, so the library-isolation rule
has nothing to arbitrate here.

## Alternatives Considered

Four options, weighed on correctness, delivery risk, security, and rollback.

1. **Derive ownership from server-verified identity, namespaced per auth mode** *(selected)*.
   Correct under token renewal, because the key contains no token material. Preserves cookie
   isolation exactly, because the cookie branch keeps using `sid`. Confined to three backend files
   plus a pure resolver. Requires closing the empty-`sub` hole as a dependency.

2. **Key bearer generations by a hash of the access token.** Rejected on correctness: a renewed
   access token produces a different hash, so the caller instantly loses the ability to stop or
   attach to its own running generation, and the orphaned entry blocks the path with `409` until the
   30-minute stale sweep (`conversation-generation.service.ts:16,132-140`). Also rejected on security:
   it makes token material part of a long-lived in-memory key.

3. **Accept an owner identifier from the request body** (e.g. reuse `clientChannelId`).
   Rejected on security: any caller could then address, stop, or attach to another caller's
   generation by supplying that caller's identifier. Ownership must never be client-asserted.

4. **Unify both modes onto `providerId` + `sub`, dropping `sid`.** Rejected on blast radius: it
   silently changes cookie behaviour — two browser sessions of one user, which today hold independent
   generations on the same path, would start colliding with `409`. That is a behavioural change for
   the common, working path, taken on for a defect that only affects the bearer path.

**Conservative baseline — do nothing** (document bearer as unsupported for generation) is rejected:
it leaves the advertised authentication mode unusable for the product's primary function.

## Rollback and Backward Compatibility

Backward compatible. Cookie-authenticated callers are unaffected: their principal key is their `sid`,
so their registry keys are identical in structure to today's, and every existing conflict, stop,
attach, disconnect and replay behaviour is preserved. No persisted data, no cookie, and no wire
contract changes, so there is nothing to migrate and nothing to migrate back.

The registry is in-memory and non-persisted (`generation-registry`), so a rollback is a plain revert
plus a restart: in-flight generations at the moment of the restart are lost exactly as they are on any
other pod restart today, and reverting cannot leave a stale key format behind. Bearer callers simply
return to receiving the pre-change `401` on the three endpoints.

## Acceptance Criteria

1. A valid bearer token with no session cookie can `POST /api/v1/conversations/completions`, receive
   the SSE stream, and have the result persisted by the backend.
2. The same principal can stop that generation via `POST .../completions/stop` (`204`) and attach to
   it via `POST .../completions/attach` (snapshot → chunks → one terminal event).
3. A different `sub`, or the same `sub` from a different `providerId`, cannot attach to or stop that
   generation: both receive `404`, with no information about its existence.
4. Two principals whose identity components concatenate to the same string (for example a `sub`
   containing the key separator) still resolve to distinct owner keys and stay isolated.
5. Renewing the access token does not change the principal key: the caller can still stop and attach
   to a generation it started with the previous token, and starting a second generation on the same
   path still yields `409`.
6. An invalid, expired, untrusted-issuer, malformed, or `sub`-less bearer token yields the defined
   `401` and its `AUTH_HEADER_TOKEN_*` code on all three endpoints, with no cookie fallback.
7. Cookie-authenticated regression holds: CSRF enforcement, the `409` conflict, `404` on unknown
   generation, backend-owned persistence after disconnect, and live replay all behave as before.
8. `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm run openapi:check` and
   `npm run validate:docs` all pass.

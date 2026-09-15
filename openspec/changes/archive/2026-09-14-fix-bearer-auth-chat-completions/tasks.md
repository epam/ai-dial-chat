**Slicing strategy: risk-first.** The riskiest thing here is not the fix — it is proving that the
`401` really comes from `ConversationController.requireSessionId` and not from the streaming
transport, and proving that the replacement cannot leak one principal's generation to another.
So slice 1 reproduces the defect against the real controller before any production code changes,
and slice 6 attacks the new ownership rule adversarially before the change is closed. Slices 2–4
are the dependencies the fix needs; slice 5 is the switch that turns slice 1 green.

Slice 1's spec is **expected to fail** until slice 5 lands — that is the point of the
reproduction. `npm run verify:changed` is therefore deliberately deferred to the end of slice 5,
not run at the end of slice 1.

Everything is inside `apps/chat-api`. Read `apps/chat-api/AGENTS.md` §1 (layout), §3 (thin
controllers) and §8 (tests) before starting; no `libs/*` and no frontend file is touched by any
task below, so the library-isolation rule has nothing to arbitrate here — task 7.4 verifies that
claim rather than assuming it.

## 1. Reproduce the bearer completion failure (risk-first, expected red)

- [x] 1.1 In `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, add a
      `describe('header-authenticated caller')` block whose middleware sets `req.user` to a
      bearer-shaped `SessionUser` (`{ sub, providerId, at, bucket, claims }` — no `sid`, no
      `csrf`) and `req.authSource = AuthSource.Header`. Assert that
      `POST /conversations/completions` returns `200` with an SSE body and that
      `ConversationService.streamCompletion` is invoked. Confirm it currently fails with `401`
      and the body message `This endpoint requires a cookie-authenticated session`, pinning
      `apps/chat-api/src/conversations/conversation.controller.ts:107-114` as the cause.
- [x] 1.2 In the same file, add the equivalent bearer case for
      `POST /conversations/completions/stop`, asserting `204` and that
      `ConversationGenerationService.abort` was called.
- [x] 1.3 In `apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts`, add
      the equivalent bearer case for `POST /conversations/completions/attach`, asserting the
      snapshot → chunk → terminal SSE sequence.
- [x] 1.4 Record in the change's notes that no frontend file is implicated: neither
      `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` nor
      `apps/chat/src/server-api/api-client.ts` constructs an `Authorization` header, and
      `attach` already travels the working generated-client path
      (`apps/chat/src/server-api/conversations.api.ts:132-144`) yet still fails.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts
```

Expected outcome: the three new cases fail with `401`; every pre-existing case still passes. Do
not run `verify:changed` yet.

## 2. Principal-key resolver

- [x] 2.1 Create `apps/chat-api/src/auth/session/principal-key.ts` exporting a pure
      `resolvePrincipalKey(user: SessionUser, authSource: AuthSource | undefined): string`:
      `AuthSource.Cookie` → `` `c:${encodeURIComponent(user.sid)}` ``; `AuthSource.Header` →
      `` `h:${encodeURIComponent(user.providerId)}:${encodeURIComponent(user.sub)}` ``; any other
      `authSource`, or a missing/empty required component, → `UnauthorizedException`. No I/O, no
      injected dependencies, extensionless relative imports only.
- [x] 2.2 Add `apps/chat-api/src/auth/tests/session/principal-key.spec.ts` covering: a cookie
      principal resolves from `sid`; a header principal resolves from `providerId` + `sub`;
      `providerId="a"/sub="b:c"` and `providerId="a:b"/sub="c"` resolve to different keys; a
      cookie `sid` textually equal to a header `sub` resolves to a different key; an undefined
      `authSource`, a cookie user with no `sid`, a header user with an empty `sub`, and a header
      user with an empty `providerId` each throw `UnauthorizedException`.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/auth/tests/session/principal-key.spec.ts
```

## 3. Require a non-empty `sub` on a verified header token

- [x] 3.1 In `apps/chat-api/src/auth/strategies/header-token.strategy.ts`, after
      `verifySignature` and before building the returned `SessionUser` (currently line 114),
      reject verified claims whose `sub` is absent or an empty string with
      `UnauthorizedException` carrying `AuthErrorCode.HeaderTokenInvalid` and the message
      `Token is missing a "sub" claim`, mirroring the existing missing-`iss` rejection at
      `:136-144`. Remove the `String(verifiedClaims.sub ?? '')` coercion at `:115`.
- [x] 3.2 In `apps/chat-api/src/auth/strategies/tests/header-token.strategy.spec.ts`, add cases
      for a verified token with no `sub` and one with `sub: ''`, both asserting `401` /
      `AUTH_HEADER_TOKEN_INVALID`, plus a case asserting a normal token still resolves its `sub`
      unchanged.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/auth/strategies/tests/header-token.strategy.spec.ts
```

## 4. Registry takes an opaque owner key and stops logging principal identity

- [x] 4.1 In `apps/chat-api/src/conversations/conversation-generation.service.ts`, rename the
      `sessionId` parameter to `ownerKey` on `register`, `seedAssembledMessage`, `applyChunk`,
      `attach`, `abort`, `getStatus`, `complete` and `error`, and on the private
      `buildKey(ownerKey, path)`. Positional signatures, entry structure, `STALE_ENTRY_TTL_MS`,
      the max-duration timer, `ConflictException` on an active duplicate and the `generationId`
      match on `abort` all stay exactly as they are. Update the class JSDoc so it states the key
      is an opaque principal key, not a session id.
- [x] 4.2 In the same file, stop emitting the registry key verbatim in the two log lines that
      carry it — `Evicting stale generation entry` (`:136`) and
      `Aborting generation past MAX_GENERATION_DURATION_MS` (`:172`). Log the conversation path
      plus a truncated SHA-256 digest of the owner key instead, so a header principal's `sub`
      never reaches application logs.
- [x] 4.3 In `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`,
      rename the `sessionId` parameter of `streamCompletion` to `ownerKey` and update its
      pass-through uses (`:426`, `:438`, `:456`, `:486`, `:567`, `:577`, `:611`, `:617`, `:704`,
      `:755`, `:758`). Value semantics are unchanged — this is a rename, not a behaviour change.
- [x] 4.4 Update `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`
      for the rename, and add cases asserting that two different owner keys on the same path
      produce independent entries, and that `abort` with a non-owning key returns `false` without
      aborting.
- [x] 4.5 Add a case to the same spec asserting the stale-eviction log line contains neither the
      owner key verbatim nor a subject-shaped value.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts
```

## 5. Controller switchover — turns slice 1 green

- [x] 5.1 In `apps/chat-api/src/conversations/conversation.controller.ts`, delete the private
      `requireSessionId` (`:107-114`) and resolve the owner key through
      `resolvePrincipalKey(req.user as SessionUser, req.authSource)` at all three call sites:
      `streamCompletion` (`:288`), `stopCompletion` (`:374`) and `attachToGeneration` (`:413`).
      Keep the controller thin per `apps/chat-api/AGENTS.md` §3 — resolution is a single call, no
      branching on auth mode in the handler.
- [x] 5.2 Reword the `@ApiResponse` descriptions and the `attachToGeneration` `@ApiOperation`
      description on those three endpoints from session wording to principal wording (for example
      "No active generation found for the given path for this principal"). Prose only — no
      schema, status code, DTO or `operationId` changes.
- [x] 5.3 Set `req.authSource = AuthSource.Cookie` in the existing cookie-user middleware of
      `completions.integration.spec.ts`, `attach-generation.integration.spec.ts`,
      `attach-generation-backpressure.spec.ts` and
      `conversation.controller.integration.spec.ts`. Without it `resolvePrincipalKey` throws
      `401` and every pre-existing case fails — this is required test-harness upkeep, not a
      behaviour change.
- [x] 5.4 Update the existing cookie assertions that compare the tenth positional argument of
      `streamCompletion` and the registry keys used in the attach specs from `TEST_USER.sid` to
      `` `c:${TEST_USER.sid}` ``.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts
npm run verify:changed
```

Expected outcome: the three slice-1 reproduction cases now pass, and every pre-existing case
still passes. This is the first `verify:changed` of the change.

## 6. Ownership isolation and token renewal (adversarial)

- [x] 6.1 In `completions.integration.spec.ts`, add: a generation started by header principal
      (`P`, `S1`) cannot be stopped by (`P`, `S2`) — `404`, and the entry stays `active`.
- [x] 6.2 Add: the same `sub` under a different `providerId` is a different principal — its stop
      returns `404`.
- [x] 6.3 Add: a cookie-authenticated caller cannot stop a header principal's generation, and a
      header principal cannot stop a cookie session's generation — `404` both ways.
- [x] 6.4 Add: a second client presenting a different token for the same (`providerId`, `sub`)
      receives `409` when starting on the same path, and `204` when stopping the running
      generation — the subject-scoped, multi-client rule from
      `specs/generation-principal-ownership/spec.md`.
- [x] 6.5 Add a token-renewal case: register under (`P`, `S`) with token `T1`, then issue stop
      and attach with token `T2` for the same (`P`, `S`) and assert `204` / a live SSE stream —
      proving the key carries no token material.
- [x] 6.6 Add a separator-collision case at the endpoint level: (`providerId` `"a"`, `sub`
      `"b:c"`) and (`providerId` `"a:b"`, `sub` `"c"`) stay isolated — one cannot stop or attach
      to the other's generation.
- [x] 6.7 In `attach-generation.integration.spec.ts`, add the attach-side isolation case: a
      non-owning principal attaching to an active generation gets `404` and no SSE stream opens.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts
```

## 7. Regression guards

- [x] 7.1 Run the cookie-mode suites unchanged as the regression gate: generation conflict
      (`409`), unknown generation (`404`), backend-owned persistence after disconnect, live
      replay and attach backpressure. Any needed edit beyond the mechanical `sid` → `c:<sid>` and
      `authSource` updates of slice 5 means behaviour moved and must be investigated, not patched.
- [x] 7.2 Run `apps/chat-api/src/auth/csrf/csrf.guard.spec.ts` unchanged to confirm CSRF
      enforcement for cookie requests and the `AuthSource.Header` exemption are both untouched.
- [x] 7.3 Run `npm run openapi && npm run openapi:check` as a contract guard. Expected: no diff,
      because no path, method, DTO, status code or `operationId` changed and both security
      schemes are already registered document-wide in
      `apps/chat-api/src/openapi/openapi.config.ts:21-22`. If the check does report a diff,
      regenerate, then build and lint `chat-api-client` and add those to this change.
- [x] 7.4 Confirm the backend-only claim holds: `git diff --name-only` shows no file under
      `apps/chat/` or `libs/`.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/auth/csrf/csrf.guard.spec.ts
npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts
npm run openapi && npm run openapi:check
```

## 8. Documentation

- [x] 8.1 Update `docs/architecture.md:421` — the registry is keyed by principal + path, not
      `sessionId` + path — and `:423` — attach is scoped to the caller's principal, not "the
      caller's session". Keep the depth here to a summary and leave the rules in the specs.
- [x] 8.2 Update `docs/auth/auth-bff-encrypted-cookie.md` §6.1: the bullet stating
      `SessionUser.sid`/`csrf` are absent under header auth now also states that generation
      ownership derives from `providerId` + `sub`, that no endpoint may reject a header caller
      for a missing `sid`, and that a verified token with no `sub` is rejected as
      `AUTH_HEADER_TOKEN_INVALID`.
- [x] 8.3 Update the "Header bearer-token authentication" section of
      `apps/chat-api/README.md:233-243`: note that chat completion, stop and attach are supported
      under header auth, that all clients of one (`providerId`, `sub`) share one generation owner,
      and that a token captured at generation start is used for the whole generation — so operators
      should size token lifetime against `MAX_GENERATION_DURATION_MS`.
- [x] 8.4 Check whether `docs/auth/auth-diagrams/09-header-token-auth-chain.mmd` needs a matching
      edit; if it does, update the `.mmd` source and its rendered `.svg` in this same change.

**Verification**

```sh
npm run validate:docs
```

## 9. Close the change

- [x] 9.1 Run `npm exec nx lint chat-api` and `npm exec nx test chat-api`.
- [x] 9.2 Run exactly one `npm run verify:full`.
- [x] 9.3 Re-read `proposal.md`'s acceptance criteria 1–8 and confirm each has a passing test or a
      passing command behind it; note any criterion covered by manual reasoning rather than a test
      so it is visible at review.

**Verification**

```sh
npm exec nx lint chat-api
npm exec nx test chat-api
npm run verify:full
```

`npm run build:quiet` is not required: no bundling input, entry point or module boundary changes.

## 10. Out-of-scope findings (follow-ups, not part of this change)

- [x] 10.1 A cookie session and a bearer client of the same human user are distinct principals, so
      both can generate into one conversation path concurrently and the last write wins. Same class
      as two cookie sessions today (design.md, Decision 2). Record as a follow-up; do not fix here.
- [x] 10.2 `ConversationStreamingService.streamCompletion` captures the access token once at
      request start and reuses it for the upstream relay and the persistence writes, so a token
      expiring mid-generation fails the generation. Pre-existing and shared with cookie mode;
      mid-stream credential rotation is a separate change. Record as a follow-up.

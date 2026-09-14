## ADDED Requirements

### Requirement: Generation ownership is a principal key derived only from server-verified identity

The system SHALL derive the owner of a generation from a **principal key** computed by a pure resolver, `resolvePrincipalKey(user: SessionUser, authSource: AuthSource | undefined): string` (`apps/chat-api/src/auth/session/principal-key.ts`), from values the server itself verified:

- `AuthSource.Cookie` → the decrypted session payload's `sid`
- `AuthSource.Header` → the pair (`providerId` resolved from the token's verified issuer, `sub` from the JWKS-verified claims)

The resolver SHALL NOT read any owner identifier from a request body, query string, route parameter, or any request header other than the credential itself, and SHALL NOT incorporate access-token material into the returned key.

The three endpoints that touch the generation registry — `POST /api/v1/conversations/completions`, `POST /api/v1/conversations/completions/stop`, and `POST /api/v1/conversations/completions/attach` — SHALL each resolve the principal key through this single resolver and pass it to the registry, so start, stop, and attach always agree on who owns a generation.

`ConversationController.requireSessionId` SHALL be removed; no endpoint SHALL reject a successfully authenticated caller for the sole reason that `SessionUser.sid` is absent.

#### Scenario: Bearer caller with no session cookie starts a completion

- **WHEN** a request to `POST /api/v1/conversations/completions` is authenticated as `AuthSource.Header` with a valid bearer token and carries no session cookie
- **THEN** the request is not rejected with `401`, the generation registers under the caller's principal key, the SSE stream is returned, and the backend persists the result exactly as it does for a cookie-authenticated caller

#### Scenario: Cookie caller is unaffected

- **WHEN** a request to any of the three endpoints is authenticated as `AuthSource.Cookie`
- **THEN** its principal key is derived from the session's `sid`, and every observable behaviour — conflict, stop, attach, persistence, CSRF enforcement — is unchanged from before this change

#### Scenario: Owner identity supplied in the request body is ignored

- **WHEN** a request body carries a field that names another principal (for example another caller's `clientChannelId` or subject)
- **THEN** the principal key is still derived solely from the authenticated credential, and the request cannot address another principal's generation

### Requirement: Principal keys are injective across principals and across authentication modes

The resolver SHALL produce keys of the form `c:<enc(sid)>` for cookie callers and `h:<enc(providerId)>:<enc(sub)>` for header callers, where `enc` percent-encodes each component so that no encoded component can contain the `:` separator.

Two distinct principals SHALL NEVER produce the same principal key, including when their identity components differ only in how they would concatenate. The registry key SHALL be `` `${principalKey}::${path}` `` and SHALL be treated as an opaque map key that is never parsed back into components.

#### Scenario: Components containing the separator do not collide

- **WHEN** one header principal has `providerId` `"a"` and `sub` `"b:c"`, and another has `providerId` `"a:b"` and `sub` `"c"`
- **THEN** the two resolve to different principal keys (`h:a:b%3Ac` and `h:a%3Ab:c`), and a generation registered by one is invisible to the other

#### Scenario: A cookie principal and a header principal never share a key

- **WHEN** a cookie caller's `sid` is textually equal to a header caller's `providerId` or `sub`
- **THEN** the two principal keys differ, because the `c:` and `h:` namespace prefixes cannot be produced by any encoded component

### Requirement: Access isolation between principals for stop and attach

A generation SHALL be visible only to the principal that started it. `POST .../completions/stop` and `POST .../completions/attach` SHALL respond `404` — the same response as for a path with no generation at all, disclosing nothing about the generation's existence — when the caller's principal key does not match the entry's.

#### Scenario: A different subject cannot stop another principal's generation

- **GIVEN** a generation is active for header principal (`providerId` P, `sub` S1) on path X
- **WHEN** header principal (`providerId` P, `sub` S2) posts to `.../completions/stop` with path X and the correct `generationId`
- **THEN** the response is `404`, and the generation for S1 keeps running

#### Scenario: The same subject from a different provider is a different principal

- **GIVEN** a generation is active for header principal (`providerId` P1, `sub` S) on path X
- **WHEN** header principal (`providerId` P2, `sub` S) posts to `.../completions/attach` with path X
- **THEN** the response is `404` and no SSE stream is opened

#### Scenario: A cookie caller cannot attach to a bearer caller's generation

- **GIVEN** a generation is active for a header principal on path X
- **WHEN** a cookie-authenticated caller posts to `.../completions/attach` with path X
- **THEN** the response is `404`

### Requirement: Bearer ownership is subject-scoped across a principal's clients

All clients presenting a valid token for the same (`providerId`, `sub`) SHALL be treated as one principal. Consequently, for one conversation path: only one generation SHALL be active across all of that principal's clients at a time, a second concurrent start SHALL receive the documented `409`, and any of that principal's clients SHALL be able to stop or attach to the generation regardless of which client started it.

This is the finest granularity the server can verify: a bearer request carries no server-issued session artifact, so distinguishing one client of a subject from another would require trusting a client-asserted value, which the first requirement forbids.

#### Scenario: A second client of the same principal can stop the generation

- **GIVEN** bearer client A started a generation on path X for principal (P, S)
- **WHEN** bearer client B, presenting a valid token for the same (P, S), posts to `.../completions/stop` with path X and that `generationId`
- **THEN** the response is `204` and the generation is aborted

#### Scenario: A second client of the same principal receives 409 on the same path

- **GIVEN** bearer client A has an active generation on path X for principal (P, S)
- **WHEN** bearer client B, presenting a valid token for the same (P, S), posts to `.../completions` for path X
- **THEN** the response is `409` with the conflict message

#### Scenario: Several clients of the same principal attach concurrently

- **WHEN** two bearer clients of the same principal both attach to the same active generation
- **THEN** each receives its own snapshot and its own subsequent live chunk events, independently, as `generation-live-replay` already specifies for multiple subscribers

### Requirement: Ownership survives access-token renewal

The principal key SHALL NOT depend on the raw access token, its hash, its `exp`, `iat`, `jti`, or any other per-token claim. A caller that renews its access token while a generation is running SHALL retain ownership of that generation.

#### Scenario: Stop works with a renewed token

- **GIVEN** a bearer caller started a generation on path X with access token T1
- **WHEN** the caller renews to access token T2 for the same (`providerId`, `sub`) and posts to `.../completions/stop` with path X and that `generationId`
- **THEN** the response is `204` and the generation is aborted

#### Scenario: Attach works with a renewed token

- **GIVEN** a bearer caller started a generation on path X with access token T1
- **WHEN** the caller attaches with access token T2 for the same (`providerId`, `sub`)
- **THEN** the SSE stream opens with a snapshot followed by live chunks, as for the original token

#### Scenario: A renewed token still conflicts on the same path

- **GIVEN** a bearer caller has an active generation on path X started with access token T1
- **WHEN** the same principal posts a new completion for path X with access token T2
- **THEN** the response is `409`, not a second concurrent generation

### Requirement: Principal identity is not written to application logs

Log statements that identify a registry entry SHALL NOT emit the principal key verbatim, because under header authentication it contains the caller's OIDC subject. `ConversationGenerationService`'s stale-eviction and max-duration-abort log lines SHALL identify the entry by conversation path together with a truncated, non-reversible digest of the principal key.

Access tokens SHALL continue never to be logged.

#### Scenario: Stale eviction logs no subject

- **WHEN** a stale entry owned by a header principal is evicted
- **THEN** the emitted log line contains the conversation path and a digest of the principal key, and contains neither the `sub` claim nor the access token

#### Scenario: Max-duration abort logs no subject

- **WHEN** a generation owned by a header principal is aborted for exceeding `MAX_GENERATION_DURATION_MS`
- **THEN** the emitted log line contains the conversation path and a digest of the principal key, and contains neither the `sub` claim nor the access token

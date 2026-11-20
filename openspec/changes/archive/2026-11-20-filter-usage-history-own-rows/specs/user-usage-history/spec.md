# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Caller-scoped data through ADAS row policy`
- TO: `### Requirement: Caller-scoped data through ADAS row policy and an own-rows predicate`

## MODIFIED Requirements

### Requirement: Caller-scoped data through ADAS row policy and an own-rows predicate

Every call to ADAS SHALL send `Authorization: Bearer <session access token>`, the token the BFF already holds for that
user. The BFF SHALL hold no ADAS credential, service account or user-hash salt, and SHALL never compute, receive or log
a user hash. Two mechanisms SHALL confine the rows to the caller: the ADAS row policies that govern the caller's read,
and the own-rows predicate every usage query carries, which ADAS resolves from that same token.

#### Scenario: Session token is forwarded

- **GIVEN** a session whose access token is `T`
- **WHEN** the history is requested
- **THEN** every outbound ADAS request carries `Authorization: Bearer T` and no other credential

#### Scenario: Token never reaches logs or the response

- **WHEN** a history request succeeds, or fails with any unavailable reason
- **THEN** no BFF log line and no response body contains the access token or a user hash

#### Scenario: A row policy still confines a regular user

- **GIVEN** ADAS grants `*` read on `dial_usage_log` with rows `user_hash = caller.user_hash`
- **WHEN** two different users without an unconfined ADAS role request the same period
- **THEN** each response contains only that user's own rows

#### Scenario: The user filter is a caller value, never an identifier

- **WHEN** the BFF sends any query to ADAS
- **THEN** the only user condition in its filter compares the field `user_hash` with the `param` `caller.user_hash`,
  and the document holds no user hash, e-mail, subject or other user identifier as a literal

### Requirement: Unavailable states

When ADAS cannot answer, the body SHALL be `{ "available": false, "reason": <reason> }` with status `200`. The reason
SHALL be `not_configured` when `ANALYTICS_URL` is unset. It SHALL be `forbidden` when ADAS answers `401` or `403`, when
the caller's view of `dial_usage_log` does not grant `read`, or when ADAS answers `400` to a required usage query (an
ADAS without caller values). It SHALL be `unavailable` for a timeout, a network error, an ADAS `5xx`, or any other
unexpected ADAS response.

#### Scenario: Not configured

- **GIVEN** `ANALYTICS_URL` is unset
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "not_configured" }` and no outbound request is made

#### Scenario: Timeout

- **GIVEN** ADAS does not respond within `ANALYTICS_TIMEOUT_MS`
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "unavailable" }` and the request is not retried

#### Scenario: Network error

- **GIVEN** ADAS refuses the connection
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "unavailable" }`

#### Scenario: ADAS server error

- **GIVEN** ADAS answers `503` to a required query
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "unavailable" }`

#### Scenario: ADAS rejects the token

- **GIVEN** ADAS answers `401` (or `403`) to a required query
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }`, and the BFF logs one `warn` entry that names a
  configuration problem (issuer, grants or row policy) and contains no token

#### Scenario: ADAS rejects the query

- **GIVEN** ADAS answers `400` to a required query
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }`

#### Scenario: Partial failure is not returned as data

- **GIVEN** one required query succeeds and another fails
- **WHEN** the history is built
- **THEN** the body is the unavailable variant for the failure, and no partial `daily` or `byModel` is returned

### Requirement: Fixed server-side queries

Every ADAS query document SHALL be a constant defined in the BFF. Only the window bounds (typed timestamp literals),
for the per-day model query the already-ranked deployment names (typed string literals in an `in` list), and in budget
scope the validated `costObject` and `policy` (string literals) vary. The own-rows predicate is part of every document
and SHALL NOT vary. The BFF SHALL NOT build SQL, SHALL NOT use ADAS's SQL endpoint, and SHALL NOT forward any other
browser input into a query.

#### Scenario: Only bound values vary

- **WHEN** two requests for different periods are compared
- **THEN** their ADAS query documents differ only in the timestamp literal values

#### Scenario: Two users send identical documents

- **GIVEN** two different users request the same period at the same instant
- **WHEN** their ADAS query documents are compared
- **THEN** they are identical, because the caller is identified by ADAS from each request's token, not by the document

### Requirement: Budget narrowing unsupported by DIAL Analytics

The route SHALL answer `200` with `available: false` and reason `budget_unsupported`, run no usage query, and
log the cause at `warn`, when a budget is requested and the caller's schema of `dial_usage_log` does not list
`budget_cost_object`, `budget_policy` and `budget_outcome`. The table read guard SHALL still apply
first, and a failed schema read SHALL answer `forbidden` for `401`/`403` and `unavailable` otherwise.

#### Scenario: ADAS without budget columns

- **WHEN** a budget is requested and the schema lists no budget columns
- **THEN** the body is `{ "available": false, "reason": "budget_unsupported" }` and no query is executed

#### Scenario: The read guard applies first

- **WHEN** a budget is requested and the caller's view of `dial_usage_log` does not grant `read`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` and no query is executed

## ADDED Requirements

### Requirement: Own-rows predicate in every usage query

Every structured query the BFF sends to ADAS SHALL carry, as a top-level conjunct of its `filter`, the comparison of
the field `user_hash` with the `param` `caller.user_hash`, in user and budget scope alike, including the per-day model
query and the client split. The predicate SHALL apply to the `dial_usage_log` rows; joined enrichment fields SHALL
NOT replace or loosen it. The BFF SHALL NOT send a usage query without it.

#### Scenario: User scope

- **WHEN** a caller requests `period=week` with no budget
- **THEN** the daily totals, model ranking, per-day model and client split queries each filter on
  `{"op": "eq", "args": [{"type": "field", "name": "user_hash"}, {"type": "param", "name": "caller.user_hash"}]}`
  beside the window bounds and the root-span condition

#### Scenario: Budget scope

- **WHEN** a caller requests `period=month&costObject=engineering&policy=policies/company/pro`
- **THEN** every query filters on the own-rows comparison beside the window bounds and the three budget predicates

#### Scenario: Client split stays confined to the caller's rows

- **GIVEN** ADAS exposes `usage_client_identity.client_type` to the caller
- **WHEN** the client split query is sent
- **THEN** its filter carries the own-rows comparison on the `dial_usage_log` field `user_hash`, and its grouping on
  the enrichment field cannot add rows of another user

#### Scenario: Administrator sees only their own rows

- **GIVEN** the caller holds an ADAS role that reads `dial_usage_log` with no row policy, so ADAS reports
  `permissions.read: true` and `permissions.rows_restricted: false`
- **WHEN** the caller requests `period=month`
- **THEN** the usage queries run with the own-rows predicate, and the body has `available: true` with only the rows ADAS
  returns for that predicate

#### Scenario: Caller without a user hash

- **GIVEN** ADAS resolves no user hash for the caller (for example ADAS in `none` security mode, or without its
  `logging-*` settings), so every query returns no rows
- **WHEN** the caller requests `period=week`
- **THEN** the body has `available: true`, `totals` `{ "spend": 0, "requests": 0 }`, `byModel` `[]`, and a zero entry
  for every day of the window

### Requirement: Table read guard

Before running any usage query, the BFF SHALL read the caller's effective permissions on `dial_usage_log` from ADAS. It
SHALL answer `forbidden` and run no usage query unless `permissions.read` is `true`, and when ADAS answers that read
with `401`, `403` or `404`. Whether the view is row-restricted SHALL NOT decide the outcome, because every usage query
carries the own-rows predicate.

#### Scenario: View without read

- **GIVEN** ADAS reports `permissions.read: false` for the caller, or no `permissions` at all
- **WHEN** the caller requests a period
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` and no usage query is sent

#### Scenario: Caller cannot see the table

- **GIVEN** ADAS answers the permissions read with `401`, `403` or `404`
- **WHEN** the caller requests a period
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` and no usage query is sent

#### Scenario: Row-restricted caller proceeds

- **GIVEN** ADAS reports `permissions.read: true` and `permissions.rows_restricted: true` for the caller
- **WHEN** the caller requests a period
- **THEN** the usage queries run with the own-rows predicate and the available variant is returned

#### Scenario: Unrestricted caller proceeds

- **GIVEN** ADAS reports `permissions.read: true` and `permissions.rows_restricted: false` for the caller
- **WHEN** the caller requests a period
- **THEN** the usage queries run with the own-rows predicate and the available variant is returned

### Requirement: ADAS without caller values is refused

When ADAS answers `400` to a required usage query, which is how an ADAS without query caller values
(epam/ai-dial-analytics#86) rejects the `caller.user_hash` parameter, the BFF SHALL answer `forbidden` and log one `warn`
line that names the required ADAS capability and contains no token. It SHALL NOT send any usage query without the
own-rows predicate, neither as a retry nor as a fallback.

#### Scenario: ADAS older than caller values

- **GIVEN** an ADAS that answers every query holding a `param` with `400`
- **WHEN** a caller with a readable view requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }`, and one `warn` log line names query caller
  values (ADAS 0.24, ai-dial-analytics#86) as the requirement

#### Scenario: No unfiltered retry

- **GIVEN** ADAS answers `400` to the daily totals query
- **WHEN** the history request completes
- **THEN** every query document ADAS received carries the own-rows predicate, and no query is sent twice

#### Scenario: The optional client split alone is rejected

- **GIVEN** the required queries succeed and ADAS answers `400` to the client split query
- **WHEN** the history is returned
- **THEN** `available` is `true`, `byClient` is absent, and the failure is logged at `warn`

## REMOVED Requirements

### Requirement: Unrestricted readers are refused

**Reason**: Every usage query now carries the own-rows predicate, so a caller whose view is not row-restricted (an ADAS
administrator, or ADAS in `none` mode) is confined by the query itself and no longer needs to be refused.
**Migration**: Replaced by "Table read guard" (a view must still grant `read`) and "Own-rows predicate in every usage
query". Administrators now get their own history; ADAS must include caller values (0.24, ai-dial-analytics#86), see
"ADAS without caller values is refused".

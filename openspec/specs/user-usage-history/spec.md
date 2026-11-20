# user-usage-history Specification

## Purpose
The authenticated BFF route that returns the signed-in user's own spend and request history for the current UTC day,
week or month. The data is read from DIAL Analytics (ADAS) with the user's own token, and every query is confined to that
user's own rows by ADAS row policies and an own-rows caller value that ADAS resolves from the token. When ADAS cannot
answer, the route reports why.

## Requirements

### Requirement: Usage history endpoint

The BFF SHALL expose `GET /api/v1/user/usage/history` behind the same session authentication as
`GET /api/v1/user/limits`. A request without a valid session SHALL be rejected with `401`. An authenticated request
with a valid `period` SHALL always return `200` with a JSON body. The body is either the available variant or the
unavailable variant. The route has no request body and no path parameters.

#### Scenario: Authenticated request returns 200

- **GIVEN** a valid BFF session
- **WHEN** the client sends `GET /api/v1/user/usage/history?period=week`
- **THEN** the response status is `200` and the body has a boolean `available`

#### Scenario: Request without a session is rejected

- **WHEN** a client without a BFF session cookie or accepted bearer header sends
  `GET /api/v1/user/usage/history?period=week`
- **THEN** the response status is `401` and the BFF makes no call to ADAS

### Requirement: Period parameter

The `period` query parameter SHALL be required. Its values SHALL be exactly `today`, `week` and `month`. A missing,
empty, repeated or unknown value SHALL be rejected with `400` before any call to ADAS. The BFF SHALL accept no other
query parameter (`400` for an unknown one), and no input that shapes an ADAS query.

#### Scenario: Missing period is rejected

- **WHEN** an authenticated client sends `GET /api/v1/user/usage/history`
- **THEN** the response status is `400` and no call to ADAS is made

#### Scenario: Unknown period is rejected

- **WHEN** an authenticated client sends `GET /api/v1/user/usage/history?period=year`
- **THEN** the response status is `400` and no call to ADAS is made

#### Scenario: Smuggled query input is rejected

- **WHEN** an authenticated client sends `GET /api/v1/user/usage/history?period=today&filter=user_hash%3D%27x%27`
- **THEN** the response status is `400` and no call to ADAS is made

### Requirement: UTC calendar windows

The window SHALL run from the start of the current UTC calendar period to the request instant (`to`), half-open
`[from, to)`. `today` starts at today's 00:00:00.000Z. `week` starts at 00:00:00.000Z on the Monday of the current ISO
week. `month` starts at 00:00:00.000Z on the 1st of the current month. These match the windows of DIAL Core's day, week
and month stats.

#### Scenario: Month window on a mid-month day

- **GIVEN** the request instant is `2026-11-18T14:05:09.120Z`
- **WHEN** the client requests `period=month`
- **THEN** `period.from` is `2026-11-01T00:00:00.000Z` and `period.to` is `2026-11-18T14:05:09.120Z`

#### Scenario: Week window on a Sunday

- **GIVEN** the request instant is `2026-11-22T23:59:59.999Z`, a Sunday
- **WHEN** the client requests `period=week`
- **THEN** `period.from` is `2026-11-16T00:00:00.000Z`, the Monday of that ISO week

#### Scenario: Week window on a Monday

- **GIVEN** the request instant is `2026-11-16T08:00:00.000Z`, a Monday
- **WHEN** the client requests `period=week`
- **THEN** `period.from` is `2026-11-16T00:00:00.000Z` and `daily` has exactly one entry, `2026-11-16`

#### Scenario: First day of a month

- **GIVEN** the request instant is `2026-12-01T09:30:00.000Z`
- **WHEN** the client requests `period=month`
- **THEN** `period.from` is `2026-12-01T00:00:00.000Z` and `daily` has exactly one entry, `2026-12-01`

#### Scenario: Request at midnight UTC

- **GIVEN** the request instant is `2026-11-18T00:00:00.000Z`
- **WHEN** the client requests `period=today`
- **THEN** `period.from` and `period.to` are both `2026-11-18T00:00:00.000Z`, the totals are zero, and `daily` has
  exactly one zero entry, `2026-11-18`

#### Scenario: Week that crosses a month boundary

- **GIVEN** the request instant is `2026-12-02T10:00:00.000Z`, a Wednesday
- **WHEN** the client requests `period=week`
- **THEN** `period.from` is `2026-11-30T00:00:00.000Z` and `daily` lists `2026-11-30`, `2026-12-01` and `2026-12-02`

### Requirement: Available response shape

When ADAS answers, the body SHALL have `available: true`, `period` `{ name, from, to }` (ISO-8601 UTC with
milliseconds), `currency: "USD"`, `totals` `{ spend, requests }`, `daily` and `byModel`. `byClient` is optional. Every
`spend` SHALL be a JSON number rounded to 6 decimal places, half away from zero. Every `requests` SHALL be a
non-negative integer.

#### Scenario: Example available response

- **GIVEN** a session, a configured and reachable ADAS, and the request instant `2026-11-03T10:00:00.000Z`
- **WHEN** the client sends `GET /api/v1/user/usage/history?period=month`
- **THEN** the response is `200` with a body of this shape:

```json
{
  "available": true,
  "period": { "name": "month", "from": "2026-11-01T00:00:00.000Z", "to": "2026-11-03T10:00:00.000Z" },
  "currency": "USD",
  "totals": { "spend": 1.234568, "requests": 42 },
  "daily": [
    { "date": "2026-11-01", "spend": 0, "requests": 0, "byModel": {} },
    { "date": "2026-11-02", "spend": 1.0, "requests": 30, "byModel": { "gpt-4o": 0.9, "my-app": 0.1 } },
    { "date": "2026-11-03", "spend": 0.234568, "requests": 12, "byModel": { "gpt-4o": 0.234568 } }
  ],
  "byModel": [
    { "deployment": "gpt-4o", "spend": 1.134568, "requests": 39 },
    { "deployment": "my-app", "spend": 0.1, "requests": 3 }
  ],
  "byClient": [
    { "client": "chat", "spend": 1.0, "requests": 35 },
    { "client": "claudecode", "spend": 0.234568, "requests": 7 }
  ]
}
```

#### Scenario: Money is rounded to six decimals

- **GIVEN** ADAS reports a window spend of `0.123456789012`
- **WHEN** the response is built
- **THEN** `totals.spend` is `0.123457`

#### Scenario: Currency is always USD

- **WHEN** any available response is returned
- **THEN** `currency` is `"USD"`. ADAS prices carry no currency, and DIAL Core prices are configured in USD.

### Requirement: Root-span counting

Each user request SHALL be counted once. Every figure SHALL come only from root spans of the usage log
(`parent_deployment` is null). Spend SHALL be the sum of the root span's chain-inclusive `total_price`, and a null price
SHALL count as zero. `requests` SHALL be the number of root spans. Child spans of a call chain SHALL contribute neither
spend nor requests.

#### Scenario: An application chain counts once

- **GIVEN** the user made one request to application `my-app` (root span, `total_price` 0.30), which called `gpt-4o`
  (child span, `parent_deployment` `my-app`, `total_price` 0.25)
- **WHEN** the history is returned
- **THEN** `totals` is `{ "spend": 0.3, "requests": 1 }` and `byModel` holds `my-app` with spend `0.3` and no `gpt-4o`
  entry

#### Scenario: A root span without a price counts as a request

- **GIVEN** a root span whose `total_price` is null
- **WHEN** the history is returned
- **THEN** it adds `1` to `requests` and `0` to `spend`

### Requirement: Daily series

`daily` SHALL have exactly one entry per UTC calendar date from the date of `period.from` to the date of `period.to`
inclusive. Entries SHALL be in ascending date order, with `date` formatted `YYYY-MM-DD`. A date without usage SHALL
appear with spend `0`, requests `0` and an empty `byModel`. Each entry's `byModel` SHALL use only the keys of the
top-level `byModel` and SHALL omit keys that have zero spend and zero requests on that date.

#### Scenario: Days without usage are zero-filled

- **GIVEN** a `week` window from Monday to Thursday, with usage only on Tuesday
- **WHEN** the history is returned
- **THEN** `daily` has four entries in date order, and Monday, Wednesday and Thursday each read
  `{ "spend": 0, "requests": 0, "byModel": {} }`

#### Scenario: Empty usage

- **GIVEN** the caller has no root spans in the window
- **WHEN** the history is returned
- **THEN** `available` is `true`, `totals` is `{ "spend": 0, "requests": 0 }`, `byModel` is `[]`, and every `daily`
  entry is zero

### Requirement: Model breakdown

`byModel` SHALL list the root deployments of the window ordered by spend descending, then requests descending, then
deployment name ascending. It SHALL hold at most 10 named entries. When more than 10 deployments have usage, one final
entry `deployment: "other"` SHALL hold the remainder of spend and requests. The entries SHALL sum to `totals`, up to
rounding.

#### Scenario: More than ten deployments are folded into other

- **GIVEN** 12 root deployments with usage in the window
- **WHEN** the history is returned
- **THEN** `byModel` has 11 entries: the 10 highest-spend deployments, then `other` with the summed spend and requests
  of the remaining two, and each `daily[].byModel` uses those same keys

#### Scenario: Ten or fewer deployments have no other entry

- **GIVEN** 3 root deployments with usage in the window
- **WHEN** the history is returned
- **THEN** `byModel` has exactly 3 entries and no `other`

#### Scenario: Daily other is the day's remainder

- **GIVEN** 12 root deployments with usage, and a day on which only the two lowest-ranked deployments were used
- **WHEN** the history is returned
- **THEN** that day's `byModel` is `{ "other": <that day's spend> }`

### Requirement: Client breakdown

`byClient` SHALL be present only when the caller's view of ADAS exposes the client-identity enrichment
(`usage_client_identity.client_type`). It SHALL list `{ client, spend, requests }` per client type, ordered by spend
descending. Root spans without an enrichment value SHALL be reported as client `unknown`. When the enrichment is
unavailable, `byClient` SHALL be absent, not an empty list.

#### Scenario: Enrichment available

- **GIVEN** ADAS exposes `usage_client_identity.client_type` to the caller
- **WHEN** the history is returned
- **THEN** `byClient` is present, and its client values are ADAS's own labels (for example `chat`, `claudecode`,
  `dialcli`, `other`) or `unknown`

#### Scenario: Enrichment missing

- **GIVEN** ADAS does not expose `usage_client_identity.client_type` to the caller
- **WHEN** the history is returned
- **THEN** the body has no `byClient` key and every other field is unchanged

#### Scenario: Enrichment lookup fails but the core queries succeed

- **GIVEN** the totals, daily and model queries succeed, and the client-identity check or client query fails
- **WHEN** the history is returned
- **THEN** `available` is `true`, `byClient` is absent, and the failure is logged at `warn`

### Requirement: Unavailable states

When ADAS cannot answer, the body SHALL be `{ "available": false, "reason": <reason> }` with status `200`. The reason
SHALL be `not_configured` when `ANALYTICS_URL` is unset. It SHALL be `forbidden` when ADAS answers `401`, `403` or
`404` to a required usage query, or `400` to the daily totals or model ranking query (an ADAS that cannot run the
own-rows filter). It SHALL be `unavailable` for a timeout, a network error, an ADAS `5xx`, or any other unexpected ADAS
response, including a `400` to the per-day model query.

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

- **GIVEN** ADAS answers `400` to the daily totals query
- **WHEN** an authenticated client requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }`

#### Scenario: Partial failure is not returned as data

- **GIVEN** one required query succeeds and another fails
- **WHEN** the history is built
- **THEN** the body is the unavailable variant for the failure, and no partial `daily` or `byModel` is returned

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

### Requirement: Bounded upstream work

Each ADAS call SHALL be aborted after `ANALYTICS_TIMEOUT_MS` (default `10000`). A user request SHALL make no retries
and at most five ADAS calls, in at most three sequential steps. Each query SHALL request a bounded page: at most 31
daily rows, at most 310 per-day model rows, at most 1000 model rows, at most 100 client rows.

#### Scenario: Per-day model rows are bounded

- **GIVEN** a `month` window and a caller with 40 root deployments
- **WHEN** the history is built
- **THEN** the per-day model query asks only for the 10 top-ranked deployments, at most 310 rows

### Requirement: Server-only analytics configuration

The BFF SHALL read `ANALYTICS_URL` (optional URL; unset turns the feature off) and `ANALYTICS_TIMEOUT_MS` (optional
integer, at least 1000, default 10000). Both are validated at boot. Neither SHALL appear in the client-config response,
in `CUSTOM_CLIENT_VARIABLES` or in any browser build variable.

#### Scenario: Invalid timeout fails startup

- **GIVEN** `ANALYTICS_TIMEOUT_MS=abc`
- **WHEN** chat-api starts
- **THEN** environment validation fails and the app does not boot

#### Scenario: Analytics settings are not exposed

- **GIVEN** `ANALYTICS_URL` and `ANALYTICS_TIMEOUT_MS` are set
- **WHEN** a client calls `GET /api/v1/client-config`
- **THEN** the response contains neither value

### Requirement: Not cached

The response SHALL carry `Cache-Control: private, no-store`, on both the available and unavailable variants. The BFF
SHALL keep no server-side cache of history results across requests. No cache key, TTL or invalidation applies.

#### Scenario: No-store header

- **WHEN** any `200` response is returned from `GET /api/v1/user/usage/history`
- **THEN** it has the header `Cache-Control: private, no-store`

#### Scenario: Every request queries ADAS

- **GIVEN** ADAS is configured
- **WHEN** the same client requests `period=today` twice in a row
- **THEN** each request makes its own ADAS calls

### Requirement: OpenAPI and generated client contract

The route SHALL have OpenAPI operationId `getUserUsageHistory`, tag `user`, a query DTO with an enum `period`, and one
response DTO in which `available` is required and the other fields are documented as variant-dependent. The reason
values SHALL be a named enum schema. The route SHALL appear in `libs/chat-api-client/openapi.json` and in the generated
`@epam/ai-dial-chat-api-client` as `getUserUsageHistory({ period })`.

#### Scenario: Generated client exposes the operation

- **WHEN** `npm run openapi` regenerates the client
- **THEN** the generated `UserApi` (or the tag's API class) has `getUserUsageHistory` taking a `period` enum and
  returning a typed `UserUsageHistoryResponseDto`, with no `any` in the endpoint signature

#### Scenario: Documented status codes

- **WHEN** the OpenAPI document is generated
- **THEN** the operation documents `200` (both variants), `400` (invalid `period`) and `401` (no session)

### Requirement: Feature exposure and observability

The route SHALL NOT be gated by `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`. Only `ANALYTICS_URL` enables it. The
BFF SHALL log each unavailable outcome once per request: `warn` for `forbidden` and for a degraded `byClient`, `error`
for `unavailable`. Logs SHALL carry the period and ADAS status, never the token or response rows. No new metric is
added. The existing HTTP metrics interceptor covers the route.

#### Scenario: Unavailable outcome is logged

- **GIVEN** ADAS answers `502`
- **WHEN** a history request completes
- **THEN** one `error` log line names the ADAS status and the period, and contains neither the token nor any row data

#### Scenario: No UI surface

- **WHEN** this capability ships
- **THEN** it adds no user-visible string, i18n key, RTL behavior or accessibility surface. Those belong to the first
  UI consumer.

### Requirement: Usage history narrowed to one budget

`GET /api/v1/user/usage/history` SHALL accept optional `costObject` and `policy` query parameters. When both are
present, every figure of an available response SHALL cover only the model calls that budget paid for: rows of the
window whose `budget_cost_object` equals `costObject`, whose `budget_policy` equals `policy` and whose
`budget_outcome` is `paid`, at any depth of the call chain, with spend summed from `deployment_price`. The response
SHALL then include `budget` with the requested `costObject` and `policy`, and `requests` SHALL count those model calls.
Without the parameters, the queries and the response SHALL be unchanged and SHALL NOT include `budget`. The values
SHALL reach DIAL Analytics only as string literals of the fixed structured queries.

#### Scenario: Budget narrowing

- **WHEN** a signed-in caller requests `period=month&costObject=engineering&policy=policies/company/pro` and DIAL
  Analytics lists the budget columns
- **THEN** every query filters the window by the three budget predicates without the root-span predicate, sums
  `deployment_price`, and the body includes `budget: { costObject: "engineering", policy: "policies/company/pro" }`

#### Scenario: No budget requested

- **WHEN** the caller requests only `period`
- **THEN** the queries keep the root-span predicate and `total_price`, and the body has no `budget`

### Requirement: Budget parameters are validated together

The route SHALL answer `400` without any call to DIAL Analytics when only one of `costObject` and `policy` is present,
when either is empty or longer than 1024 characters, or when either is repeated.

#### Scenario: Cost object alone

- **WHEN** the caller requests `period=today&costObject=engineering`
- **THEN** the response is `400` and no request reaches DIAL Analytics

### Requirement: Budget narrowing unsupported by DIAL Analytics

The route SHALL answer `200` with `available: false` and reason `budget_unsupported`, run no usage query, and
log the cause at `warn`, when a budget is requested and the caller's schema of `dial_usage_log` does not list
`budget_cost_object`, `budget_policy` and `budget_outcome`. A failed schema read SHALL answer `forbidden` for
`401`/`403` and `unavailable` otherwise.

#### Scenario: ADAS without budget columns

- **WHEN** a budget is requested and the schema lists no budget columns
- **THEN** the body is `{ "available": false, "reason": "budget_unsupported" }` and no query is executed

#### Scenario: A refused schema read

- **WHEN** a budget is requested and ADAS answers the schema read with `403`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` and no query is executed

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

### Requirement: No permissions pre-check

The BFF SHALL NOT read the caller's table permissions before the usage queries, and whether the caller's view is
row-restricted SHALL NOT decide the outcome, because every usage query carries the own-rows predicate. A caller who
cannot read `dial_usage_log` SHALL be refused through the queries: ADAS answering `401`, `403` or `404` to a required
usage query SHALL answer `forbidden`.

#### Scenario: No table permissions request

- **WHEN** a caller requests a period
- **THEN** the BFF sends no request to `GET /v1/tables/dial_usage_log`, and every usage query carries the own-rows
  predicate

#### Scenario: Caller who cannot read the table

- **GIVEN** ADAS answers the daily totals and model ranking queries with `403` (or `401`, or `404`)
- **WHEN** the caller requests a period
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` and no per-day model query is sent

#### Scenario: Unrestricted caller proceeds

- **GIVEN** the caller's ADAS view of `dial_usage_log` is not row-restricted
- **WHEN** the caller requests a period
- **THEN** the usage queries run with the own-rows predicate and the available variant is returned

### Requirement: ADAS that cannot run the own-rows filter is refused

When ADAS answers `400` to the daily totals or model ranking query, the BFF SHALL answer `forbidden` and log one `warn`
line, without the token, naming both causes: an ADAS without query caller values (epam/ai-dial-analytics#86), and a
column policy hiding `user_hash`. It SHALL NOT send any usage query without the own-rows predicate, as a retry or as a
fallback.

#### Scenario: ADAS older than caller values

- **GIVEN** an ADAS that answers every query holding a `param` with `400`
- **WHEN** a caller requests `period=today`
- **THEN** the body is `{ "available": false, "reason": "forbidden" }`, and one `warn` log line names query caller
  values (ADAS 0.24, ai-dial-analytics#86) and a column policy hiding `user_hash` as the causes to check

#### Scenario: user_hash hidden by a column policy

- **GIVEN** a column policy hides `user_hash` from the caller, so ADAS answers every usage query with `400`
- **WHEN** the caller requests a period
- **THEN** the body is `{ "available": false, "reason": "forbidden" }` with the same `warn` line

#### Scenario: No unfiltered retry

- **GIVEN** ADAS answers `400` to the daily totals query
- **WHEN** the history request completes
- **THEN** every query document ADAS received carries the own-rows predicate, and no query is sent twice

#### Scenario: A rejected per-day query is a BFF defect

- **GIVEN** the daily totals and model ranking queries succeed and ADAS answers `400` to the per-day model query
- **WHEN** the history request completes
- **THEN** the body is `{ "available": false, "reason": "unavailable" }`, logged at `error`

#### Scenario: The optional client split alone is rejected

- **GIVEN** the required queries succeed and ADAS answers `400` to the client split query
- **WHEN** the history is returned
- **THEN** `available` is `true`, `byClient` is absent, and the failure is logged at `warn`


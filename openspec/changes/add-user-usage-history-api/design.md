# Design: User usage history from DIAL Analytics (ADAS)

See `proposal.md` for motivation and `specs/user-usage-history/spec.md` for the externally visible contract. This
document covers how the BFF meets that contract, and the evidence behind each ADAS-specific choice.

## Context

- **BFF today.** `UserLimitsController` (`apps/chat-api/src/deployments/user-limits.controller.ts`) serves
  `/api/v1/user/limits` and `/user/usage` under `@Controller({ path: 'user', version: '1' })`. It relies on the global
  `SessionGuard` (registered as `APP_GUARD` in `apps/chat-api/src/auth/auth.module.ts`) and reads
  `(req.user as SessionUser).at`. The BFF's only non-DIAL-Core upstream with a user token is DIAL Scheduler,
  through `SchedulerUpstreamClient` (`AbortController` + `*_TIMEOUT_MS`, `getBearerAuthHeaders`,
  `mapDialHttpStatus`/`handleDialFetchError`). Outbound `fetch` already goes through the proxy-aware global undici
  dispatcher (`apps/chat-api/src/net/proxy-agent.setup.ts`).
- **ADAS facts** (sibling repo `ai-dial-analytics`, checked at `0ea3f87`):
  - Structured queries run at `POST /v1/queries/execute`. The body is `{ entity, mode, filter, select, group_by, sort,
    page }` with snake_case keys. `filter` is CQL2-JSON (`op`/`args`). Expressions are typed: `field`, `value` with
    `value_type`, `fn`, `array`. The response is `{ rows: [ {<alias>: value} ], totalCount }`
    (`openspec/specs/structured-query/spec.md`: envelope, filter grammar, response envelope).
  - The function catalog includes `sum`, `count`, `date_trunc(unit, ts)` (calendar-aligned, rendered with explicit
    `'UTC'`) and `to_string` (renders a `decimal` as trimmed plain text and a `timestamp` as
    `YYYY-MM-DD hh:mm:ss.fff` UTC). `eq` against a `null` literal renders `IS NULL`.
  - A `timestamp` literal is **epoch milliseconds** as a string (`ValueExprToObjectMapper`: "TIMESTAMP is parsed as
    epoch milliseconds"), not ISO-8601.
  - In aggregate mode, `group_by` resolves to an entity column and falls back to a select alias for a computed key.
    An alias equal to a column name that projects a different expression is rejected as ambiguous.
  - The page limit is at most 1000, and 100 when omitted. A global aggregate returns one row.
  - Field resolution runs against the caller's role-visible schema: an unknown or hidden field is `400`.
    Enrichment columns are addressed as `<enrichment>.<column>` and LEFT-JOINed. `GET /v1/queries/entities/schema/{name}`
    returns `{ entity, tag_order, fields: [{ name, … }] }`, filtered the same way
    (`openspec/specs/query-schema-discovery/spec.md`).
  - `dial_usage_log` (`src/main/resources/db/migration/clickhouse/V1__create_dial_usage_log.sql`) has
    `request_time DateTime64(3,'UTC')`, `parent_deployment LowCardinality(Nullable(String))`,
    `deployment LowCardinality(String)`, `user_hash String`, `total_price Nullable(Decimal(38,12))` and
    `deployment_price Nullable(Decimal(38,12))`. Partitions are daily. The table is deduplicated by a
    ReplacingMergeTree read `FINAL` (`FORCE_FINAL_QUERIES=true` by default).
  - Security (`docs/configuration.md` Security, `docs/row-level-security.md`): `SECURITY_MODE=oidc` validates Bearer
    tokens against `providers.<name>` (JWT `issuer` + `jwk-set-uri`, or opaque `user-info-endpoint`).
    `providers.<name>.logging-key`/`logging-salt` derive `caller.user_hash` exactly as Core's
    `loggingKey`/`loggingSalt` do. A row policy `user_hash = caller.user_hash` on grantee `*` gives every user their own
    rows. "A policy narrows, it never grants": a role with an unrestricted global read still sees every row. "A caller
    without the value matches no row." In `none` mode every check fails open. `GET /v1/tables/{name}` reports the
    caller's `permissions.rows_restricted`.
  - Execution budget: `QUERY_BUDGET_TIMEOUT` defaults to `20s`, and exceeding it returns `422 query_budget_exceeded`.

## Goals / Non-Goals

**Goals:** one fixed set of ADAS queries per period; a response that is either complete or explicitly unavailable,
never partial; no new credential in the BFF; bounded ADAS work per user request; exact money arithmetic.

**Non-Goals:** a reusable ADAS client for other features (the transport is domain-local until a second consumer
exists); exposing ADAS errors or messages to the browser; any frontend wrapper; matching Core's live counters to the
cent (see Risks).

## Decisions

### D1. Domain layout — a new `usage-history` module

```
apps/chat-api/src/usage-history/
├── usage-history.module.ts            # registered in app.module.ts; controllers + providers
├── user-usage-history.controller.ts   # @Controller({ path: 'user', version: '1' }) → GET usage/history
├── usage-history.service.ts           # orchestration (D4) + unavailable mapping (D6)
├── analytics/analytics.client.ts      # ADAS transport (D2)
├── queries/usage-history.queries.ts   # constant query builders (D3)
├── usage-history.mapper.ts            # rows → response, money math (D5)
├── usage-period.ts                    # period → [from, to) and the date list
├── types/                             # UsageHistoryPeriod, UsageHistoryUnavailableReason (string enums)
├── dto/                               # query + response DTOs (D7)
└── tests/                             # specs, mirroring the layout above
```

A second controller at the `user` base path is the same arrangement `UserLimitsController` already uses beside
`DeploymentsController`, so `user/usage` and `user/usage/history` are distinct static routes. `DeploymentsService`
and `DeploymentsModule` are not touched.

*Alternative:* adding a handler to `UserLimitsController`. Rejected: it would tie a DIAL-Core proxy to an ADAS
integration, and the brief keeps `DeploymentsService` from growing.

### D2. Transport — raw `fetch`, the Scheduler timeout pattern, the shared error mapper

ADAS is not DIAL Core, so `@epam/ai-dial-typescript-sdk` and `DialClientService.fetchCore` do not apply. This is the
documented "non-DIAL upstream" exception in `apps/chat-api/AGENTS.md` §4. `AnalyticsClient` exposes three methods:

- `getTablePermissions(token)` → `GET {ANALYTICS_URL}/v1/tables/dial_usage_log`
- `getEntitySchema(token)` → `GET {ANALYTICS_URL}/v1/queries/entities/schema/dial_usage_log`
- `executeQuery(token, query)` → `POST {ANALYTICS_URL}/v1/queries/execute`

Each call:

- reads `ANALYTICS_URL` and `ANALYTICS_TIMEOUT_MS` once through `ConfigService<EnvironmentVariables>` with
  `infer: true`;
- builds the URL as the trimmed `ANALYTICS_URL` (trailing slashes dropped) followed by a fixed path constant, so a base URL with a path prefix keeps it, and no caller input reaches the URL;
- sends `getBearerAuthHeaders(token)`, plus `Content-Type: application/json` on the POST;
- aborts through `AbortController` + `setTimeout(timeoutMs)` and clears the timer in `finally`;
- on a non-OK status, calls `mapDialHttpStatus(status, context)` **without a logger**, so the shared mapper throws the
  matching Nest exception (`401`→`UnauthorizedException`, `403`→`ForbiddenException`, `5xx`→`BadGatewayException`, …)
  without logging "DIAL Core returned …" for an ADAS call;
- on a thrown `fetch` error (abort, DNS, refused), calls `handleDialFetchError(err, context, undefined, timeoutMs)`,
  which throws `ServiceUnavailableException`;
- sets `redirect: 'manual'`, like the repository's other raw upstream readers, so a redirect never decides where the
  user token goes (a 3xx maps to `unavailable`);
- logs one line of its own: method, path, the raw ADAS status and duration, at `warn` for a non-OK answer (the mapped
  exception no longer carries ADAS's status) and at `debug` otherwise. It never logs headers, the body or the token.

Reusing the shared mapper means one classification of upstream outcomes for the whole BFF, and no new helper. The
service converts the thrown exception into a `reason` (D6). No retries: `fetch` is called once per query.

*Alternatives:* a new ADAS-specific error helper (rejected: it duplicates `dial-error.mapper.ts`, against the brief);
calling the shared mapper with the logger (rejected: its log text names DIAL Core, which misleads operators).

### D3. Query shapes — structured queries only

Every query targets entity `dial_usage_log`, `mode: "aggregate"`, an offset page with a fixed limit, and no `final`
(an absent `final` resolves to the entity's `supports_final`, so re-ingested rows are deduplicated). The shared filter
is built from the window only:

```json
{ "op": "and", "args": [
  { "op": "ge", "args": [ { "type": "field", "name": "request_time" },
                          { "type": "value", "value_type": "timestamp", "value": "<from epoch ms>" } ] },
  { "op": "lt", "args": [ { "type": "field", "name": "request_time" },
                          { "type": "value", "value_type": "timestamp", "value": "<to epoch ms>" } ] },
  { "op": "eq", "args": [ { "type": "field", "name": "parent_deployment" },
                          { "type": "value", "value_type": "null", "value": null } ] }
] }
```

The leading `request_time` bounds let ClickHouse prune daily partitions. Money is selected as
`to_string(sum(total_price))`, so ADAS returns the exact decimal text (D5). Requests are counted with `count()`. Q2 and Q4 also select the numeric `sum(total_price)` as `usage_spend_rank`, used only to sort: sorting the decimal text would order "10.5" before "9.1".
Aliases are prefixed `usage_` so that no alias equals a `dial_usage_log` column name (ADAS rejects that collision).

| # | Purpose | `select` (alias) | `group_by` | `sort` | `limit` |
|---|---|---|---|---|---|
| Q1 | Daily totals (also window totals) | `to_string(date_trunc('day', request_time))` (`usage_day`), `to_string(sum(total_price))` (`usage_spend`), `count()` (`usage_requests`) | `usage_day` | `usage_day` asc | 31 |
| Q2 | Model ranking | `deployment`, `usage_spend`, `usage_spend_rank`, `usage_requests` | `deployment` | `usage_spend_rank` desc nulls last, `usage_requests` desc, `deployment` asc | 1000 |
| Q3 | Per-day top models | `usage_day`, `deployment`, `usage_spend`, `usage_requests`; filter adds `{ "op": "in", "args": [ field deployment, { "type": "array", "items": [ <≤10 string values> ] } ] }` | `usage_day`, `deployment` | `usage_day` asc, `deployment` asc | 310 |
| Q4 | Client split | `usage_client_identity.client_type` (`usage_client`), `usage_spend`, `usage_spend_rank`, `usage_requests` | `usage_client` | `usage_spend_rank` desc nulls last | 100 |

- Window totals are the sum of Q1's rows (at most 31). A separate global-aggregate query would return the same
  numbers and cost one more call.
- Q2 needs no limit on the number of deployments for correctness: `other` = window totals − top 10, so a caller with
  more than 1000 root deployments still gets exact totals and `other`.
- Q3's `in` list holds only names ADAS itself returned in Q2, as typed `string` literals. ADAS escapes literals
  (structured-query spec: "Every inlined string literal SHALL escape the backslash as well as the quote"). Browser
  input never reaches it.
- Q4 groups by the enrichment column. ADAS's own `sessions_rollup` does the same, and
  `openspec/specs/structured-query/spec.md` has a scenario grouping by `"usage_client_identity.user_ref"`. A spine row
  with no enrichment row reads `null` through the structured endpoint (response-envelope requirement) or `''` in the
  SQL dashboards (`docs/grafana-dashboards.md`). The mapper folds both into `unknown`.
- `execute-sql` is not used. Every query above fits the structured grammar, so no SQL string exists in the BFF.

### D4. Orchestration — three short steps, at most six calls

1. **Guard + discovery** (in parallel): `getTablePermissions` and `getEntitySchema`.
   - A permissions failure ends the request: `401`/`403`/`404` → `forbidden`; anything else → `unavailable`.
   - `permissions.rows_restricted !== true` → `forbidden` with a `warn` log (D8). Usage queries never run for an
     unrestricted reader, so an administrator's request does not scan the whole installation's month.
   - A discovery failure, or a missing `usage_client_identity.client_type` field, marks `byClient` as absent. The
     request continues.
2. **Core queries** (in parallel): Q1 and Q2 start as soon as the guard passes. Q4 starts on its own when discovery
   finds the enrichment field, so a slow schema endpoint never delays the required queries. A discovery failure is
   logged only after the guard has passed.
3. **Per-day models**: Q3, only when Q2 returned at least one deployment. With no usage, Q3 is skipped and `daily` is
   zero-filled.

Any failure in Q1, Q2 or Q3 ends the request with the unavailable variant (no partial data). A Q4 failure removes
`byClient` and logs at `warn`. Calls in flight when a required call fails are left to finish or time out; their results
are discarded. Worst-case latency is three timeouts (30 s at the default). The usual case is three short round trips.

*Alternatives:*
(a) Q3 without the `in` filter, all deployments per day, could hit the 1000-row limit for heavy users and silently
drop cells. Rejected.
(b) Running Q4 speculatively and treating ADAS `400` as "enrichment missing" saves a step but cannot tell a missing
enrichment from a malformed query. Rejected in favour of explicit discovery.
(c) Caching discovery and the guard across requests is out of scope (no cross-request caching), and stale permissions
would be a security issue.

### D5. Mapping and exact money arithmetic

- Money cells arrive as decimal text from `to_string`. They are parsed with an allowlist regex
  (`^-?\d+(\.\d+)?$`) into a `bigint` count of 10⁻¹² USD, the scale of `Decimal(38,12)`. `null` (a `sum` over no
  non-null price) is `0n`. All sums and the `other` remainders are computed in `bigint`, so the result is exact. Each
  output value is rounded once, half away from zero, to 10⁻⁶ and converted to `number` at the end.
- `usage_day` is ADAS `to_string`, which is ClickHouse `toString` over `toStartOfInterval(…, INTERVAL 1 DAY, 'UTC')`, so its text follows the type ClickHouse returns there. The mapper accepts `YYYY-MM-DD`, `YYYY-MM-DD 00:00:00` and `YYYY-MM-DD 00:00:00.fff`, all as the same date (checked against `ExprTranslator.asText`/`dateTrunc` in ai-dial-analytics).
- `count()` cells are accepted as a JSON number or a digit string and must be non-negative safe integers.
- A response that breaks the expected shape (missing `rows`, a non-numeric cell, a `usage_day` that is not
  one of those midnight renderings) is treated as an ADAS failure (`unavailable`, logged at `error` without row values). It is
  never shown as data.
- `daily`: the date list is generated from the window (D9). Q1 cells are placed by date, Q3 cells fill `byModel` for the
  top-10 keys, and a day's `other` is the day's Q1 total minus that day's top-10 sum. It is emitted only when the
  top-level `other` exists and that day's remainder is non-zero.
- `byModel` ranking follows Q2's ADAS sort. The mapper re-sorts with the same keys, so ties are deterministic whatever
  ADAS returns. When more than 10 deployments have usage, a real deployment literally named `other` is folded into the
  remainder (the next-ranked deployment takes its place), so the `other` key is never ambiguous. With 10 or fewer it is
  listed under its own name.
- Remainders (`other`, and a day's `other`) are clamped at zero: the queries run moments apart, so a later one can see
  rows ingested after an earlier one.
- `byClient`: `null`/`''` → `unknown`, merged when both appear. It is sorted by spend descending, then client name.

### D6. Unavailable mapping

| Condition | `reason` | Log |
|---|---|---|
| `ANALYTICS_URL` unset (checked before any I/O) | `not_configured` | `debug` once per request |
| Guard: `UnauthorizedException`/`ForbiddenException`/`NotFoundException`, or `rows_restricted !== true` | `forbidden` | `warn`, configuration hint (D8) |
| Required query: `UnauthorizedException`/`ForbiddenException` | `forbidden` | `warn`, configuration hint |
| `ServiceUnavailableException` (timeout, network), `BadGatewayException` (5xx and unexpected status), any other `HttpException` (ADAS `400`/`404`/`422 query_budget_exceeded`/`429`), malformed body | `unavailable` | `error` with ADAS status and period |

The controller always returns the service result with `200`. Only `ValidationPipe` (`400`) and `SessionGuard`
(`401`) produce non-200 responses.

### D7. DTOs and OpenAPI

DTOs live in `usage-history/dto/` (domain DTOs, not proxied-upstream shapes, so not `openapi-response.dto.ts`):

- `GetUserUsageHistoryQueryDto`: `period` with `@ApiProperty({ enum: UsageHistoryPeriod, enumName: 'UsageHistoryPeriod' })`
  and `@IsEnum(UsageHistoryPeriod)`. It has no `@IsOptional`, so a missing value fails validation. The global
  `ValidationPipe` (`forbidNonWhitelisted`) rejects extra query keys. A repeated `period` arrives as an array, which
  fails `@IsEnum`.
- `UserUsageHistoryResponseDto`: `available` (required boolean); `reason?` (`enumName: 'UsageHistoryUnavailableReason'`);
  and, present only when `available` is `true`, `period?: UsageHistoryWindowDto`, `currency?` (`'USD'`),
  `totals?: UsageHistoryTotalsDto`, `daily?: UsageHistoryDailyEntryDto[]`, `byModel?: UsageHistoryModelEntryDto[]`,
  `byClient?: UsageHistoryClientEntryDto[]`. Every property description states which variant carries it.
  `daily[].byModel` is `type: 'object', additionalProperties: { type: 'number' }`.
- The handler is `getUserUsageHistory`, which becomes operationId `getUserUsageHistory`, tag `user`, with
  `@ApiResponse` for `200` (`type: UserUsageHistoryResponseDto`), `400` and `401`.

*Alternative:* a `oneOf` of an available DTO and an unavailable DTO. Rejected: OpenAPI 3.0's `discriminator` requires a
string property, so a boolean `available` cannot discriminate, and the generated `typescript-fetch` client would emit
an untyped union with guessing `instanceOf` checks. One flattened DTO with a required `available` gives callers a
strongly typed narrowing point.

### D8. Security model

- **Authentication:** the user's session access token (`SessionUser.at`) is forwarded as `Authorization: Bearer`. The
  BFF adds nothing: no API key, no service credential, no salt.
- **Confinement:** ADAS's row policy on `dial_usage_log` for grantee `*`, `rows: user_hash = caller.user_hash`. ADAS
  derives `caller.user_hash` from the token with the same `logging-key`/`logging-salt` Core used when it wrote
  `user_hash`. ADAS applies the policy in ClickHouse on every reference
  (`additional_table_filters`).
- **Defence in depth:** the D4 guard refuses any caller whose view is not row-restricted (administrators, `none` mode),
  because a policy never narrows a role that also holds an unrestricted read. The BFF still does not add a user filter:
  it does not know the hash, and a BFF-side filter would hide a missing policy instead of exposing it.
- **Input surface:** `period` is the only input, an enum. Query documents are constants plus epoch-ms literals and
  ADAS-sourced deployment names.
- **Logging:** the `forbidden` warning names the likely misconfiguration ("ADAS refused the session token, or the
  caller's view of dial_usage_log is not row-restricted: check the ADAS providers.<name>.issuer/jwk-set-uri for the
  BFF's identity providers, the `*` grant and its rows policy"). Logs carry the period and ADAS status only, never the
  token, headers, row values or ADAS error bodies.
- **Authorization statement:** any authenticated Chat user may call the route. No Chat role is required. What ADAS
  returns is decided by ADAS grants.

*Alternatives:* see `proposal.md`, "Alternatives considered" (a BFF service account with a BFF-side user filter, and
BFF-side hashing). Both put a credential in the BFF that could read every user's usage, and both make the BFF the only
thing between one user and another's data.

### D9. Windows

`usage-period.ts` computes, from `new Date()` at request time (tests pin it with `vi.setSystemTime`):

- `today`: `Date.UTC(y, m, d)`.
- `week`: today minus `(getUTCDay() + 6) % 7` days, which is Monday (ISO).
- `month`: `Date.UTC(y, m, 1)`.

`to` is the request instant. The date list runs from the UTC date of `from` through the UTC date of `to`, so a request
at exactly 00:00:00.000Z still has one (empty) day. The window goes to ADAS as `request_time >= from AND
request_time < to`.

### D10. Configuration

- `IntegrationsEnv` (`apps/chat-api/src/config/env/integrations.env.ts`) gains `ANALYTICS_URL?: string`
  (`@IsOptional() @IsUrl({ require_tld: false })`, declared exactly like `THEMES_CONFIG_URL` in `dial.env.ts`) and
  `ANALYTICS_TIMEOUT_MS?: number = 10_000` (`@Transform(parseInt) @IsInt() @Min(1000)`, like
  `SCHEDULER_SERVICE_TIMEOUT_MS`). The service also treats a whitespace-only value as unset, so it can never build a
  relative URL.
- The env snapshot `apps/chat-api/src/config/tests/environment-composition.spec.ts` gains both names.
- `CONFIG_DEFINITIONS` gains `analytics.url` (`visibility: 'server'`, `valueType: 'string'`,
  `localOnlyKey(LocalOnlyReason.DeploymentTopology)`) and `analytics.timeoutMs` (`visibility: 'server'`,
  `valueType: 'number'`, `localOnlyKey(LocalOnlyReason.Capability)`). Server visibility keeps them out of
  `client-config`, which `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` already asserts for every
  server key. Local-only keys are not exported, so the managed-config schema artifact must stay byte-identical
  (checked with `npm run managed-config-schema`).
- Docs: `apps/chat-api/README.md` env table ("server-side only; never exposed to the browser") and endpoint table,
  `apps/chat-api/.env.template` (commented examples), and `docs/architecture.md` (`usage-history/` in the backend
  tree, the route in the endpoint table, ADAS as an optional upstream).

### D11. ADAS deployment prerequisites (operator-facing, copied into the README section)

1. `SECURITY_MODE=oidc`, with `providers.<name>` entries for **the same identity providers the BFF signs users in
   with**: matching `issuer` and `jwk-set-uri` for JWT providers, `user-info-endpoint` for opaque ones, and
   `audiences` that accept the BFF's access tokens.
2. `providers.<name>.logging-key` and `logging-salt` (and `obfuscate-user-email`) **equal to DIAL Core's**
   `loggingKey`/`loggingSalt` for that provider. Otherwise `caller.user_hash` differs from the stored `user_hash` and
   every user sees zero usage.
3. A grant on `dial_usage_log` for `*`: `{"privileges": ["get", "read"], "rows": {"where": "user_hash = caller.user_hash"}}`.
   `get` lets the BFF read `permissions` (D4). **Never grant `read` to `*` without `rows`**: it gives every caller
   every row and lifts every other role's policies (ADAS reports `everyone_reads_all_rows`).
4. For `byClient`: the recommended catalog's `usage_client_identity` enrichment with its `usage-client-identity-live`
   pipeline armed (`docs/recommended-catalog/README.md`). An enrichment follows its source's grants, so no extra grant
   is needed.
5. Network reachability from chat-api to `ANALYTICS_URL`, through `HTTP(S)_PROXY`/`NO_PROXY` where they apply.

**Local work:** ADAS with `SECURITY_MODE=none` fails every authorization check open and reports
`rows_restricted: false`, so the guard answers `forbidden` for every user. `none` is suitable only for exercising the
query and mapping code, which the unit tests already do against a mocked HTTP boundary. Verify the token and
row-policy path against an `oidc` ADAS.

## Risks / Trade-offs

- [Misconfigured salt or logging key → every user sees zero usage with `available: true`] → Prerequisite 2 is
  documented, with its symptom, in the README. ADAS exposes no cheap way to detect a missing caller hash, and an empty
  history is a valid state for a new user.
- [Ingestion lag: ADAS data-sync runs minutes behind Core, so `today` trails Core's live counters] → The `period.to`
  field is the request time, not the data freshness. A future UI labels the figures as analytics. Reconciling with
  Core's `/user/usage` is not a goal.
- [Spend is chain-inclusive per root deployment: an application's entry includes the models it called, so `byModel`
  is "what the user called", not "which model was billed"] → This matches Core's per-deployment cost semantics, already
  documented on `UserLimitStatsResponseDto`. A per-model billed view (`sum(deployment_price)` over all spans) would
  break the "count once" rule and is left to a follow-up if product asks for it.
- [No `event_kind` filter: root MCP and toolset calls count as requests] → Intended: they are user requests Core
  logged. Their price is usually null, which counts as zero.
- [Worst-case latency of three timeouts] → Each step is bounded, with no retries. Steps 1 and 3 are small metadata or
  bounded reads. Lower `ANALYTICS_TIMEOUT_MS` if needed.
- [ADAS `FINAL` reads cost more than raw reads] → The windows are at most 31 daily partitions, filtered by root spans.
  ADAS's own query budget (`422`) caps the worst case, which maps to `unavailable`.
- [ADAS API drift: the structured query contract is marked experimental] → The query constants are covered by
  snapshot-style tests of the exact documents. The ADAS paths and field names are cited above for the next upgrade.
- [Administrators always get `forbidden`] → This is intended, and documented. A follow-up could add an "own rows"
  path for administrators if ADAS gains a caller-value filter usable in queries.

## Migration Plan

1. Ship with `ANALYTICS_URL` unset (the default). The route answers `not_configured`, and nothing else changes.
2. Configure ADAS per D11, then set `ANALYTICS_URL` (and `ANALYTICS_TIMEOUT_MS` if needed) on chat-api and restart.
3. Rollback: unset `ANALYTICS_URL` and restart, or revert the module and regenerate the client. No data migration and
   no persisted state.

## Open Questions

- Whether an ADAS `read` grant implies `get` for `GET /v1/tables/{name}`. D11 grants both explicitly, so the answer
  changes no code. Confirm it against an `oidc` ADAS during rollout and simplify the documented grant if it does.

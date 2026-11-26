# Design

## Context

See `proposal.md` "Why" and "Problem". What the design builds on:

- **Today's transport.** `apps/chat-api/src/usage-history/analytics/analytics.client.ts`:
  - It normalises `ANALYTICS_URL` (trim, drop trailing `/`, keep any path prefix) and reads `ANALYTICS_TIMEOUT_MS`
    (default `10000`).
  - Each call sends `Authorization: Bearer`, `Accept: application/json` and, on POST, `Content-Type: application/json`,
    with `redirect: 'manual'` and an `AbortController` timeout.
  - It logs `DIAL Analytics <METHOD> <path> answered <status> in <ms>ms`: `warn` when the response is not ok, `debug`
    when it is.
  - A non-ok body is cancelled unread and the status goes to `mapDialHttpStatus` with no logger. Thrown errors go to
    `handleDialFetchError` with no logger.
  - So a 200 with an empty or non-JSON body throws `ServiceUnavailableException`, and a 302 throws
    `BadGatewayException`.
- **SDK client.** `createAnalyticsSDK(opts)` in `@epam/ai-dial-typescript-sdk` `0.3.1`:
  - It is an `openapi-fetch` 0.17 client. `getEntitySchema(name, init)` is `GET /v1/queries/entities/schema/{name}`,
    and `executeQuery({ body, … })` is `POST /v1/queries/execute`.
  - `openapi-fetch` builds a `Request` whose default is `redirect: 'follow'`, then calls `fetch(request, undefined)`.
    Overrides must therefore go into the `init` the wrapped `fetch` passes on.
  - A non-ok body is read and `JSON.parse`d into `error`.
  - A 200 whose `Content-Length` is `0` resolves to `{ data: undefined }` and does not throw.
  - A non-JSON 200 rejects with `SyntaxError`.
- **Core pattern to mirror.** `apps/chat-api/src/dial/dial-core.module.ts` (`@Global`) and `dial-client.service.ts`
  (one `createSDK`, a wrapped `fetch` that sets `User-Agent` and Core request timing). Call sites pass
  `getBearerAuthHeaders(token)` and handle `{ data, error, response }`.
- **SDK query types don't match the wire.** The analytics OpenAPI declares discriminators without `mapping`, so
  `openapi-typescript` emits `type: 'FieldExpr' | 'FnExpr' | 'ValueExpr' | 'ParamExpr' | 'ArrayExpr'` and
  `type: 'OffsetPage'`. ADAS's Jackson (`ai-dial-analytics` `service/query/model/Expr.java`, `PageSpec.java`) accepts
  only `field`, `fn`, `value`, `param`, `array` and `offset`.
  - `FnExpr` has no `args`.
  - `ValueExpr.value` is `string`, while the root-span filter sends `null`.
  - `StructuredQuery.filter` is `unknown`.
  - `entity`, `mode`, `group_by` and `sort` (`SortItem`) do match the wire. `0.4.0-dev.1` has the same gaps.

## Goals / Non-Goals

**Goals:**

- One process-wide ADAS SDK client, with exactly today's transport guarantees, plus the product User-Agent.
- Typed ADAS responses through the whole chain, typed query documents that are byte-identical on the wire, and no
  `unknown` left at the transport boundary.
- ADAS failures named "DIAL Analytics" everywhere, with Core behaviour provably unchanged.

**Non-Goals:**

- ADAS request timing (change 03), and refusal classification by `ErrorView` code (change 04).
- Retries, caching and new ADAS operations. `user-usage-history` keeps "no retries, at most five calls".

## Decisions

### D1. Module, service and file names

| File | Holds |
| --- | --- |
| `apps/chat-api/src/dial/dial-analytics.module.ts` | `@Global() DialAnalyticsModule`, providing and exporting `DialAnalyticsClientService`. Registered once in `apps/chat-api/src/app/app.module.ts` `imports`, next to `DialCoreModule`. |
| `apps/chat-api/src/dial/dial-analytics-client.service.ts` | `DialAnalyticsClientService` (D2, D3) |
| `apps/chat-api/src/dial/dial-analytics-result.ts` | `readDialAnalyticsData` and `handleDialAnalyticsFailure` (D5) |
| `apps/chat-api/src/common/utils/user-agent.ts` | `buildChatUserAgent` (D4) |
| `apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts` | the transport parity suite (D9) |
| `apps/chat-api/src/dial/tests/fake-analytics.server.ts` | the fake ADAS, moved unchanged from `usage-history/tests/` (D9) |

`UsageHistoryModule` lists only `UsageHistoryService`, and `UsageHistoryService` injects `DialAnalyticsClientService`.
The service does not depend on `DialClientService`, so an ADAS-only test needs no `DIAL_CORE_URL`.

*Alternative:* a provider local to usage-history. Rejected by the user (see `proposal.md`).

### D2. Configuration and lifecycle

The constructor reads `ConfigService<EnvironmentVariables>` with `{ infer: true }` once:

- `baseUrl = ANALYTICS_URL?.trim().replace(/\/+$/, '') || undefined`, the same normalisation as today, so
  `http://adas:8080/analytics/` keeps `/analytics`.
- `timeoutMs = ANALYTICS_TIMEOUT_MS ?? 10_000`. The env class already validates it as an integer of at least 1000.
- `userAgent = buildChatUserAgent(CHAT_VERSION)`.
- `isConfigured = baseUrl !== undefined`.
- When configured, the constructor makes one `createAnalyticsSDK({ baseUrl, fetch: this.fetchAnalytics })` call and
  keeps the result as a private field. There is no `apiKey`, `token` or `headers` option, so no credential lives in
  the factory.
- `get client(): DIAL_ANALYTICS_SDK` returns the instance. When the service is not configured, it throws
  `Error('DIAL Analytics: ANALYTICS_URL is not configured')`. This is a programming error, because callers check
  `isConfigured` first, as today.

With `ANALYTICS_URL` unset, no instance exists and nothing can reach the network. Nest creates the global provider
once, and nothing creates one per request.

### D3. The wrapped fetch: transport parity

`fetchAnalytics(input, init)` has the same shape as `DialClientService.withCoreHeaders` and calls
`globalThis.fetch(input, nextInit)`. `nextInit` contains:

- `headers`: a new `Headers(init?.headers ?? input.headers)` with `User-Agent` set (replaced, never duplicated) and
  `Accept: application/json` set. Everything else passes through as given: `Authorization` from the call site and
  `Content-Type` from `openapi-fetch` on the POST.
- `redirect: 'manual'`, so the bearer token never follows a redirect. Undici returns the 3xx response itself, which
  is not ok.
- `signal: AbortSignal.timeout(timeoutMs)`. It stays armed while `openapi-fetch` reads the body, so it also bounds a
  stalled body, which an `AbortController` cleared after the headers would not. It rejects with a `TimeoutError`
  (see D5).

After the response arrives, the wrapper logs
`DIAL Analytics ${method} ${url.slice(baseUrl.length)} answered ${status} in ${ms}ms`: `warn` when it is not ok, `debug`
when it is. This keeps today's text, with the path relative to the base and without a prefix. It never logs headers,
the body or the URL query. There is no Core request timing (change 03), and `fetchCore` is not used. The bearer token
is only ever passed per call: `headers: getBearerAuthHeaders(accessToken)`.

*Alternative:* `redirect` and `signal` on every call's `init`. Rejected: the guarantee would then depend on every call
site, and the brief puts it in the transport.

### D4. User-Agent builder moves to a shared util

`normalizeUserAgentVersion` and the `ai-dial-chat/` prefix move from `dial-client.service.ts` into
`apps/chat-api/src/common/utils/user-agent.ts` as
`buildChatUserAgent(override?: string | null): string`
(`= \`ai-dial-chat/${normalize(resolveAppVersion(override))}\``). The function keeps the hyphen trim by index scan and
its CodeQL comment. `DialClientService` calls it, and its `userAgent` member and every test in
`dial-client.service.spec.ts` stay as they are.

*Alternative:* `DialAnalyticsClientService` injects `DialClientService` and reads `userAgent`. Rejected: that makes
ADAS depend on `DIAL_CORE_URL`.

### D5. Error mapping parameterised by upstream

`dial-error.mapper.ts` gains
`createUpstreamErrorMapper({ upstream, timeoutErrorNames })`, which returns `{ mapHttpStatus, handleSdkError,
handleFetchError }`. The function bodies are today's, with `DIAL Core` replaced by `${upstream}`.

- The existing exports become `const core = createUpstreamErrorMapper({ upstream: 'DIAL Core', timeoutErrorNames:
  ['AbortError'] })`, re-exported as `mapDialHttpStatus`, `handleDialSdkError` and `handleDialFetchError`, with the
  same signatures, the `HandleDialFetchError` overload type and the same texts. `extractDialErrorMessage` and
  `isUpstreamTextExposable` stay as they are. `dial-error.mapper.spec.ts` stays unmodified and proves Core parity.
- The new export is `dialAnalyticsErrors = createUpstreamErrorMapper({ upstream: 'DIAL Analytics',
  timeoutErrorNames: ['AbortError', 'TimeoutError'] })`. `TimeoutError` is the D3 signal's rejection. Core's
  `handleDialFetchError` keeps `['AbortError']`, exactly as the `dial-error-mapping` scenario specifies. Core callers
  that use `AbortSignal.timeout`, such as `projects/projects.service.ts`, go through `handleDialSdkError`, which
  already treats `TimeoutError` as unreachable, and they stay unchanged.

`dial-analytics-result.ts` builds on it.

`readDialAnalyticsData<T>(result: SDKResponse<T, unknown>, context): NonNullable<T>`:

- `!result.response.ok` → `dialAnalyticsErrors.mapHttpStatus(result.response.status, context)`, with no logger, no
  `errorBody` and no `upstreamMessage`. The ADAS body that `openapi-fetch` parsed into `result.error` is read but never
  logged and never put into a message, which replaces today's "discarded unread". The raw status has already been
  logged at `warn` by D3.
- `result.data == null` → `ServiceUnavailableException('DIAL Analytics is currently unavailable')`. This covers an
  empty 200 and a JSON `null`, and keeps today's 503.
- Otherwise it returns `result.data`.

`handleDialAnalyticsFailure(err, context, timeoutMs): never` is
`dialAnalyticsErrors.handleFetchError(err, context, undefined, timeoutMs)`:

- an `HttpException` is rethrown;
- a timeout gives `ServiceUnavailableException('DIAL Analytics request timed out')`;
- a refused connection, a `SyntaxError` (non-JSON 200) or anything else gives
  `ServiceUnavailableException('DIAL Analytics is currently unavailable')`.

No logger is passed, as today. Usage-history logs the outcome itself through `describeError`.

### D6. Call-site migration in `usage-history.service.ts`

`UsageHistoryService` keeps its control flow, `isRefusal`, the `BadRequestException`-before-`hasAcceptedOwnRows` rule,
the `NotFoundException` → `forbidden` rule, and every `reason`. Only the two ADAS reads change. They become private
methods that call the SDK directly:

```ts
private async readSchema(accessToken: string): Promise<QueryEntitySchemaDto> {
  const context = `DIAL Analytics GET schema of ${USAGE_LOG_ENTITY}`;
  try {
    return readDialAnalyticsData(
      await this.analytics.client.getEntitySchema(USAGE_LOG_ENTITY, {
        headers: getBearerAuthHeaders(accessToken),
      }),
      context,
    );
  } catch (err) {
    return handleDialAnalyticsFailure(err, context, this.analytics.timeoutMs);
  }
}
// runQuery(accessToken, query: UsageQuery): Promise<StructuredQueryResultDto> — same shape around
// this.analytics.client.executeQuery({ body: toStructuredQuery(query), headers: getBearerAuthHeaders(accessToken) })
```

Because the exception classes match today's for every outcome (D5), every classification stays identical. The service
also imports `USAGE_LOG_ENTITY` (`'dial_usage_log'`, the `ENTITY` constant exported from the queries module), which is
fine for the SDK's unencoded path interpolation.

### D7. Typing

**Query documents (local wire types).** `queries/usage-history.queries.ts` exports the types below. The fields that
match the wire are taken from `AnalyticsComponents['schemas']['StructuredQuery']`:

```ts
type SdkQuery = AnalyticsComponents['schemas']['StructuredQuery'];
export type UsageExpr = FieldExpr | FnExpr | StringValue | TimestampValue | NullValue | ParamExpr | ArrayExpr;
export type UsageFilter = { op: 'and'; args: UsageFilter[] } | { op: 'eq' | 'ge' | 'lt' | 'in'; args: UsageExpr[] };
export interface UsageColumn { expr: UsageExpr; as: string }
export interface UsageOffsetPage { type: 'offset'; offset: number; limit: number }
export interface UsageQuery extends Required<Pick<SdkQuery, 'entity' | 'mode' | 'group_by' | 'sort'>> {
  filter: UsageFilter; select: UsageColumn[]; page: UsageOffsetPage;
}
/** The one conversion to the SDK body type: its discriminators don't match ADAS (see design). */
export const toStructuredQuery = (query: UsageQuery): SdkQuery => query as unknown as SdkQuery;
```

- Each member's `type` is the Jackson name.
- `FnExpr` carries `args: UsageExpr[]`.
- The `null` value is its own member `{ type: 'value'; value_type: 'null'; value: null }`.
- `field`, `fn`, `stringValue`, `timestampValue`, `windowFilter`, `scopePredicates`, `equals`, `page` and every
  `*_SELECT` get these return types.
- The four builders return `UsageQuery`, and `OWN_ROWS_PREDICATE` is typed as a `UsageFilter`.
- The object literals stay exactly as they are, and so does key order, so the serialised JSON does not change (D9 golden
  test).
- `toStructuredQuery` is the only `as unknown as` in the chain. It goes away with the upstream fix (proposal
  non-goal).

**Responses.**

- `discover(schema: QueryEntitySchemaDto)` and `schemaFieldNames(schema: QueryEntitySchemaDto)` keep the runtime check
  `Array.isArray(schema.fields)` and `typeof entry?.name === 'string'`, because the SDK does not validate.
- `readRows(body: StructuredQueryResultDto)` keeps `Array.isArray(body.rows)` and the every-row-is-an-object check.
  Cell values stay `unknown` and are validated by `parseSpend`, `parseRequests`, `parseDay` and `parseName`, which are
  unchanged.
- `rankDeployments(body: StructuredQueryResultDto)`.
- `UsageHistorySources.dailyTotals`, `.dailyTopModels` and `.clientSplit` become `StructuredQueryResultDto`.
- `mapDailyTotals`, `mapDailyTopModels` and `mapClientSplit` take `StructuredQueryResultDto`.
- `queryClientSplit` resolves to `StructuredQueryResultDto | undefined`.

**Dead once the types carry the shape (removed):**

- the `schema != null && typeof schema === 'object'` guard and the `(schema as { fields?: unknown })` and
  `(entry as { name?: unknown })` casts in `schemaFieldNames`;
- the `body != null && typeof body === 'object'` guard and the `(body as { rows?: unknown })` cast in `readRows`;
- the `return rows as Row[]` cast, now that `rows` is typed;
- the whole `AnalyticsClient` with `USAGE_LOG_SCHEMA_PATH`, `EXECUTE_QUERY_PATH` and its private `request`, whose
  default timeout moves to the D2 service.

No exported helper becomes dead: `discover`, `schemaFieldNames`, `readRows` and the parsers all keep validating
runtime input.

### D8. Rules and docs (same change)

| File | Edit |
| --- | --- |
| `apps/chat-api/AGENTS.md` §1 | Tree: drop the nonexistent `app.service.ts`. Reference list: "DIAL SDK client pattern → `apps/chat-api/src/dial/dial-client.service.ts` (DIAL Core), `dial/dial-analytics-client.service.ts` (DIAL Analytics)". |
| `apps/chat-api/AGENTS.md` §4 | "Prefer the SDK for DIAL Core (`DialClientService`) and DIAL Analytics (`DialAnalyticsClientService`); raw `fetch` only for other upstreams or an SDK gap". Update the "Follow `DialClientService` …" line and the §13 anti-pattern line to name both. |
| `.claude/rules/nestjs-best-practices.md` | The same wording. Both `app/app.service.ts` pointers become `dial/dial-client.service.ts`, and the frontmatter `description` names DIAL Core and DIAL Analytics. |
| `openspec/config.yaml` | Context line 25 and design rule line 163: "the shared `DialClientService`/`DialAnalyticsClientService` SDK clients" instead of "AppService". |
| `docs/architecture.md` | `dial/` tree entry: "DIAL Core and DIAL Analytics SDK client wiring". Extend the `usage-history/` entry and any mapper/transport prose that names raw `fetch` for ADAS. |
| `apps/chat-api/README.md` | "Usage history (DIAL Analytics)": one transport sentence (typed SDK client, `redirect` not followed, `ANALYTICS_TIMEOUT_MS` per call, product User-Agent). Project-structure line `dial/`: "DIAL Core and DIAL Analytics modules". |
| Source comments | `usage-history.service.ts` class JSDoc and the queries header comment: cite this change's design for the transport. `analytics.client.ts`'s raw-fetch rationale disappears with the file. |

`npm run validate:docs` and `npm run validate:specs` must pass. No spec cites `analytics.client.ts` (checked with
`grep` over `openspec/specs`).

### D9. Tests

- **Parity suite.** `dial/tests/dial-analytics-client.service.spec.ts` runs through the SDK path (service, `client`
  call, `readDialAnalyticsData`/`handleDialAnalyticsFailure`) against `fake-analytics.server.ts`. It keeps every
  `analytics.client.spec.ts` case:
  - not configured without `ANALYTICS_URL`;
  - only the bearer token reaches the fixed paths (no `api-key`, no cookie);
  - the query is posted unchanged as JSON;
  - the path prefix is kept;
  - 401/403/404/500/503 map to the same exceptions, once each;
  - a 302 is not followed and `answered 302` is logged;
  - `answered 503` is logged when the mapped exception differs;
  - timeout → 503; refused connection → 503; non-JSON 200 → 503;
  - neither the token nor the ADAS error body is logged.

  It adds:
  - `User-Agent: ai-dial-chat/<version>` is sent exactly once and `Accept: application/json` is sent;
  - an empty 200 and a JSON `null` 200 → 503;
  - a non-JSON 200 whose body does not arrive within the timeout → 503 (the timeout covers the body);
  - no log line or exception message from any ADAS failure contains `DIAL Core`.
- **Mapper.** `common/dial/dial-error.mapper.spec.ts` stays unmodified. New cases cover `dialAnalyticsErrors`: texts,
  `TimeoutError`, and the error body never logged.
- **User-Agent.** A small spec for `buildChatUserAgent`. The existing `dial-client.service.spec.ts` stays unmodified.
- **Golden test.** Before the typing edit, the four builders' `JSON.stringify` output for a fixed window, with and
  without a budget (and Q3 with two names), is recorded verbatim in
  `usage-history/tests/usage-history.queries.spec.ts`. After the edit, string equality must hold. This proves the
  documents are byte-for-byte identical, key order included.
- **Usage-history specs.** `usage-history.service.spec.ts` and
  `user-usage-history.controller.integration.spec.ts` change only their wiring: the imports, the
  `DialAnalyticsClientService` provider and constructor, and the `fake-analytics.server` import path. Every
  assertion stays as it is.

## Risks / Trade-offs

- [`toStructuredQuery` hides a real type mismatch] → It is the single named cast, documented with the upstream cause.
  The golden test pins the wire output, and dropping the cast is a recorded follow-up.
- [`AbortSignal.timeout` changes the error name] → `timeoutErrorNames` handles it, for Analytics only. A dedicated
  test covers the body-read timeout.
- [The error body is now read into memory] → ADAS error bodies are small `ErrorView` JSON. The guarantee is now "read,
  never logged or exposed", enforced by the log-scan test.
- [The new User-Agent reaches ADAS] → It is diagnostic only and specified in the `dial-core-client` delta. It carries
  no tenant, user or host.
- [Moving `fake-analytics.server.ts` makes usage-history specs import from `dial/tests/`] → This is test-only and the
  file is the shared ADAS harness. The alternative is two copies.
- [01 and 02 ship in one commit] → The commit is bigger to review, but the SDK bump is a 3-file diff that
  `openspec/changes/archive/2026-11-25-bump-typescript-sdk-0-3-1/` already documents.

## Migration Plan

There is no data or config migration: `ANALYTICS_URL` and `ANALYTICS_TIMEOUT_MS` keep their meaning and defaults.
Deploy as usual. To roll back, revert the single commit; that also reverts the SDK bump.

## Open Questions

- The ADAS OpenAPI fix (discriminator `mapping`, `FnExpr.args`, nullable `ValueExpr.value`) is owned by
  ai-dial-analytics and the SDK sync. It is tracked as a follow-up and does not block this change.

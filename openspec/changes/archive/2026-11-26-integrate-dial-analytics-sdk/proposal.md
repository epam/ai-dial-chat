# Proposal

## Why

`GET /api/v1/user/usage/history` reaches DIAL Analytics (ADAS) through a hand-written raw-`fetch` client,
`apps/chat-api/src/usage-history/analytics/analytics.client.ts`. Its two operations return `unknown`, and its header
comment says that the DIAL SDK does not apply because ADAS is not DIAL Core. That stopped being true in
`@epam/ai-dial-typescript-sdk` `0.3.1`, which ships a typed `createAnalyticsSDK` client
(`bump-typescript-sdk-0-3-1`, archived on 2026-11-25). ADAS should be integrated the same way DIAL Core is: one
process-wide SDK client owned by a global module, typed calls at the call sites, and shared error mapping.

## Problem

- ADAS integration code repeats transport rules: base URL normalisation, timeout, `redirect: 'manual'`, header set,
  and status logging. The DIAL Core path already has a single owner for these (`apps/chat-api/src/dial/dial-client.service.ts`).
- The ADAS schema and query responses are `unknown` from end to end. `usage-history.service.ts` and
  `usage-history.mapper.ts` re-derive the shape with `as` casts.
- `apps/chat-api/src/common/dial/dial-error.mapper.ts` writes "DIAL Core" into every log line and exception message.
  `AnalyticsClient` keeps ADAS failures from being logged as Core failures only by passing no logger, and its exceptions
  still say "DIAL Core".
- `apps/chat-api/AGENTS.md` and `.claude/rules/nestjs-best-practices.md` send readers to
  `apps/chat-api/src/app/app.service.ts`, which does not exist, and tell them to use raw `fetch` for every non-Core
  DIAL upstream.

## Solution

- Add a global `DialAnalyticsModule` with `DialAnalyticsClientService` in `apps/chat-api/src/dial/`, next to
  `DialCoreModule`. The service reads `ANALYTICS_URL` and `ANALYTICS_TIMEOUT_MS` once. When `ANALYTICS_URL` is set, it
  creates a single `createAnalyticsSDK` instance with a wrapped `fetch`. When it is not set, it creates no instance.
  The wrapped `fetch` keeps today's transport guarantees: `redirect: 'manual'`, the per-call timeout, bearer token only,
  the raw-status log line, and adds `User-Agent: ai-dial-chat/<version>`.
- `usage-history.service.ts` calls `getEntitySchema` and `executeQuery` directly with the caller's bearer headers.
  Two shared helpers turn `{ data, error, response }` and thrown errors into the same Nest exceptions as today.
- Make the error mapper's upstream name a parameter. DIAL Core keeps its exact functions and texts, and ADAS failures
  say "DIAL Analytics".
- Type the full chain within the limits of the SDK:
  - **Responses.** Discovery reads `QueryEntitySchemaDto`, and the mapper reads `StructuredQueryResultDto`.
  - **Query documents.** These get *local* wire types, because the SDK's `StructuredQuery` types do not describe
    ADAS's wire format. Its expression and page discriminators are `'FieldExpr'`/`'OffsetPage'`, while ADAS's Jackson
    names are `field`/`fn`/`value`/`param`/`array` and `offset`. `FnExpr` also has no `args`, and `ValueExpr.value`
    cannot be `null`. The local types reuse `entity`, `mode`, `group_by` and `sort` from `StructuredQuery`. A single
    documented conversion hands the document to the SDK. The wire documents stay byte-for-byte identical, and a golden
    test proves it.
- Delete `analytics.client.ts` and the `analytics/` folder, move its spec to the new service, and keep every case.

## What Changes

- New `apps/chat-api/src/dial/dial-analytics.module.ts` and `dial-analytics-client.service.ts`, registered once in
  `apps/chat-api/src/app/app.module.ts`. `UsageHistoryModule` no longer provides a client.
- New `apps/chat-api/src/common/utils/user-agent.ts`: the User-Agent builder moves out of `DialClientService`, which
  keeps its behaviour, so both upstreams share one normalisation.
- `dial-error.mapper.ts`: a `createUpstreamErrorMapper` factory. The exported Core functions are produced by it and
  keep their names, signatures and texts.
- `usage-history.service.ts`, `usage-history.mapper.ts`, `queries/usage-history.queries.ts`: SDK calls and typing.
- Removed: `usage-history/analytics/analytics.client.ts` and `usage-history/tests/analytics/analytics.client.spec.ts`.
  The spec moves to `dial/tests/dial-analytics-client.service.spec.ts`, and `fake-analytics.server.ts` moves to
  `dial/tests/`.
- Rules and docs: `apps/chat-api/AGENTS.md` §1/§4, `.claude/rules/nestjs-best-practices.md`, `openspec/config.yaml`
  (the stale "AppService" pointer), `docs/architecture.md`, `apps/chat-api/README.md`.

## Non-goals

- Any change to `GET /api/v1/user/usage/history`: request, response, `reason` values, logging levels, and the OpenAPI
  contract.
- ADAS request timing in telemetry (change 03), and refusal classification by `ErrorView` code (change 04).
- Fixing the ADAS OpenAPI document or the SDK's analytics types. This is a recorded follow-up: add a discriminator
  `mapping`, `FnExpr.args` and a nullable `ValueExpr.value`, then drop the local wire types.
- Other ADAS endpoints, or any `createAnalyticsSDK` option beyond `baseUrl` and `fetch`.

## Alternatives considered

- **A usage-history-local provider.** Rejected: the user chose a global module next to `DialCoreModule`, so the
  next ADAS consumer reuses it.
- **A wrapper class with one method per endpoint.** Rejected: this is today's `AnalyticsClient` shape, and it hides
  the typed SDK signatures. The user chose direct SDK calls.
- **Typing the documents strictly as `StructuredQuery`.** Rejected: ADAS would refuse the SDK's discriminator values
  (`ai-dial-analytics` `Expr.java`, `PageSpec.java`).
- **Typing responses only.** Considered and then replaced by local wire types at the user's request.
- **Blocking until the upstream fix.** Rejected: only the document types are affected, and a local type closes that
  gap without changing the wire.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dial-error-mapping`: the single mapper serves DIAL Core and DIAL Analytics and names the upstream in every log line
  and exception message. Core text is unchanged.
- `dial-core-client`: the Chat product User-Agent, with the same normalisation, is also sent to DIAL Analytics, but
  deliberately and through the Analytics transport, not the Core transport.

`user-usage-history` gets no delta. Every requirement keeps holding, including outcomes and `reason` values,
`ANALYTICS_TIMEOUT_MS`, fixed documents, no retries, bounded pages, and token-free logs. The User-Agent header is the
only new ADAS-observable effect, and it is specified under `dial-core-client`.

## Impact

- **Code:** `apps/chat-api/src/dial/`, `common/dial/dial-error.mapper.ts`, `common/utils/user-agent.ts`,
  `usage-history/**`, `app/app.module.ts`. No change in `apps/chat` or `libs/*`.
- **APIs:** none. `npm run openapi && npm run openapi:check` must report no diff.
- **Dependencies:** none new. This uses the `createAnalyticsSDK` already in `0.3.1`.
- **Security:** unchanged. Only the caller's bearer token is sent (no `Api-Key`, no cookie), and a redirect is never
  followed with it. The ADAS error body is now read by `openapi-fetch` into `error`, but it is never logged and never
  put into an exception message (previously it was discarded unread).
- **i18n:** no user-visible strings.
- **Shipping:** the user decided that `bump-typescript-sdk-0-3-1` (implemented, uncommitted on `development`) and this
  change land in **one commit**.
- **Rollback:** revert the commit. That also reverts the SDK bump, since both changes land together.

## Acceptance criteria

- `GET /api/v1/user/usage/history` returns identical bodies and logs the same levels for every case in
  `usage-history.service.spec.ts` and `user-usage-history.controller.integration.spec.ts`. Only their wiring lines
  change.
- Every former `analytics.client.spec.ts` case passes against `fake-analytics.server.ts` through the SDK path.
- No log line or exception message for an ADAS failure contains "DIAL Core", and `dial-error.mapper.spec.ts` passes
  unmodified.
- The golden test shows each query document serialises to exactly the JSON the pre-change builders produced.
- `analytics.client.ts` and `usage-history/analytics/` are gone.
- `npm exec -- nx run-many -t typecheck,build,test,lint -p chat-api`, `npm run openapi:check`,
  `npm run validate:docs` and `npm run validate:specs` pass.
- A manual smoke against a real ADAS is recorded in `tasks.md`.

# Proposal

Relates to #9922; follows #9928 (the route) and #9939 (budget scope). Depends on DIAL Analytics
epam/ai-dial-analytics#86 (commit `46af9b6`, planned for ADAS 0.24).

## Why

**Problem.** `GET /api/v1/user/usage/history` refuses every DIAL administrator. `UsageHistoryService` reads
`GET /v1/tables/dial_usage_log` as the caller and answers `available: false, reason: "forbidden"` unless both
`permissions.read` and `permissions.rows_restricted` are `true` (`isRowRestricted`,
`apps/chat-api/src/usage-history/usage-history.service.ts:59`, applied at `:143`). In ADAS a caller role that reads the
table with no row policy lifts the `*` own-rows policy (`RowPolicyFilter`), and the default `SECURITY_ROLES_MAPPING`
maps the provider roles `admin` and `ConfigAdmin` to `FULL_ADMIN` (global `TABLE_READ`). Verified on the dev stand on
2026-11-20: a user holding `admin` gets `forbidden`; the same user without it gets their history.

The guard exists because the queries carry no user filter
(`apps/chat-api/src/usage-history/queries/usage-history.queries.ts:9`): ADAS row policy alone confines the rows, so an
unconfined caller would see every user's spend as their own. Until ADAS #86 the BFF could not filter on the caller
without computing the user hash, which needs DIAL Core's logging salt.

**Why now.** ADAS #86 lets a structured query compare a `string` column with a caller value that ADAS resolves from the
request's own token on every execution:
`{"op": "eq", "args": [{"type": "field", "name": "user_hash"}, {"type": "param", "name": "caller.user_hash"}]}`.
The BFF never computes or sees the hash. A caller without the value matches no row. Row policies still apply, so the
predicate only narrows.

## What Changes

- **Own-rows predicate in every query.** Every structured query the service sends — daily totals, model ranking,
  daily top models and client split, in user and budget scope — gains `user_hash = caller.user_hash`, added once in the
  shared filter builder so no query can miss it.
- **Guard relaxed together with the predicate.** The table read stays; `permissions.read` must still be `true`.
  `rows_restricted: false` no longer means `forbidden`, so an administrator (and ADAS `none` mode) gets the history
  of their own rows.
- **ADAS without caller values answers `forbidden`.** An ADAS older than #86 rejects the `param` with `400`. A `400`
  on a required usage query now answers `forbidden` (it was `unavailable`); the BFF never retries without the
  predicate.
- **BREAKING (deployment):** the route needs an ADAS build with #86 (0.24 or later). On an older ADAS every caller,
  regular users included, gets `forbidden` instead of their history.
- **Docs.** `apps/chat-api/README.md` "Usage history (DIAL Analytics)": minimum ADAS version, administrators see their
  own history, the `*` grant with `rows: user_hash = caller.user_hash` remains the least-privilege recommendation, the
  new `forbidden` and `none`-mode outcomes.

Unchanged: route, query parameters and their `400` validation, response body and reason values, money and rounding,
root-span counting in user scope, `deployment_price` and paid model rows in budget scope, `Cache-Control: private,
no-store`, the six-call / three-step bound, env values, and the OpenAPI operation and schemas (only description text
changes, see Impact).

## Non-goals

- The `budget_policy` sensitivity in ADAS (regular users get `budget_unsupported` until ADAS stops marking
  `budget_policy` sensitive) — tracked separately in ai-dial-analytics.
- Project API keys, caching, UI, dependency upgrades, new env values.
- Computing or holding the user hash in the BFF.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Own-rows caller value in every query, guard on `read` only (pick)** | Admins get their own rows; safety holds whether or not the caller is row-restricted; no secret in the BFF; one predicate in one builder. Needs ADAS with #86. |
| B. Keep refusing unrestricted callers (baseline) | Zero risk, but every DIAL admin keeps getting `forbidden` — the bug this change fixes. |
| C. BFF-side hashing (`user_hash = '<hash>'` literal) | Works on older ADAS, but the BFF must hold DIAL Core's `loggingKey`/`loggingSalt` per provider — a credential the security model says the BFF never holds — and must re-implement Core's derivation and keep it in sync. Rejected. |
| D. Predicate only for unrestricted callers, old path for restricted ones | Keeps regular users working on pre-#86 ADAS, but two query shapes and a safety decision that depends on a permissions read; the uniform predicate is simpler to prove. Rejected; the ADAS minimum version is documented instead. |

Design D2 covers how unsupported ADAS is detected (first-query `400` vs. an up-front probe).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-usage-history`: the security model becomes "ADAS row policies plus an own-rows predicate in every query";
  the row-restriction guard becomes a read guard; `forbidden` now also covers an ADAS that rejects caller values;
  the fixed-query requirement includes the own-rows predicate. The capability has no main spec yet — it lives in the
  unarchived changes `add-user-usage-history-api` and `add-usage-history-budget-filter`, which must be archived
  before this one.

## Impact

- **Code:** `apps/chat-api/src/usage-history/queries/usage-history.queries.ts` (own-rows predicate in `windowFilter`),
  `apps/chat-api/src/usage-history/usage-history.service.ts` (guard, `400` → `forbidden`, log hints). No transport
  change in `apps/chat-api/src/usage-history/analytics/analytics.client.ts`: a `400` already maps to
  `BadRequestException` (`apps/chat-api/src/common/dial/dial-error.mapper.ts:57`).
- **Tests:** the existing suites under `apps/chat-api/src/usage-history/tests/` with ADAS mocked at the HTTP boundary
  (`fake-analytics.server.ts`); the queries test that asserts "never references a user identifier" is inverted.
- **Docs/specs:** `apps/chat-api/README.md`; a `user-usage-history` delta spec. The route row in
  `docs/architecture.md` says "a non-row-restricted ADAS view answers `forbidden`" and gets a one-line fix, because
  `.claude/rules/docs.md` requires it to match the code (a small extension of the requested scope).
- **API / OpenAPI / client:** no operation, parameter or schema change. The route and `reason` descriptions stated the
  old guard, so their text is corrected and `libs/chat-api-client` regenerated (description strings only; found during
  apply). **i18n:** no user-visible strings. **libs/\*:** untouched. **Env:** none.
- **Operations:** ADAS ≥ 0.24 with #86 required. On ADAS `none` mode or with missing `logging-*` settings, callers
  now get `available: true` with zero usage instead of `forbidden` (no user hash → no rows).

## Acceptance criteria

- Every query document the service sends, in user and budget scope including the client split, contains
  `user_hash = caller.user_hash` in its `filter`.
- A caller whose table view is `read: true, rows_restricted: false` gets `available: true` with only the rows ADAS
  returns for the predicate.
- A row-restricted caller still gets `available: true`, with the predicate present.
- ADAS answering `400` to a required query → `forbidden`, and no query without the predicate is ever sent.
- `read: false`, or `401`/`403`/`404` on the table read → `forbidden`, as today.
- ADAS returning no rows (caller without a user hash) → `available: true`, zero totals, zero-filled days.
- No log line contains the token or a user hash; README and the delta spec describe the new model.

## Rollback

Revert the commit: queries lose the predicate and the row-restriction guard returns, so admins get `forbidden` again
and the route works on pre-#86 ADAS. No data, schema, env or API contract to migrate.

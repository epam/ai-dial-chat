# Design

## Context

See proposal.md "Why" for the problem. The relevant current state:

- `apps/chat-api/src/usage-history/queries/usage-history.queries.ts` builds the four structured queries (Q1 daily
  totals, Q2 model ranking, Q3 per-day top models, Q4 client split). All four take their `filter` from the private
  `windowFilter(window, budget, ...extra)`, which ANDs the window bounds, `scopePredicates(budget)` (root span in user
  scope; the three budget predicates in budget scope) and Q3's `in` list. There is no other source of query documents.
- `apps/chat-api/src/usage-history/usage-history.service.ts` runs Step 1 (table read + `isRowRestricted`), Step 1b
  (budget columns, budget scope only), Step 2 (Q1 ‖ Q2, Q4 after schema discovery), Step 3 (Q3). Required-query errors
  map through `isRefusal` → `forbidden`, everything else → `unavailable`; Q4 errors only drop `byClient`.
- `apps/chat-api/src/usage-history/analytics/analytics.client.ts` maps a non-2xx through `mapDialHttpStatus`, so a `400`
  arrives as `BadRequestException`. It logs the raw status at `warn` and discards the ADAS body unread.
- ADAS #86 (`46af9b6`; `openspec/specs/structured-query/spec.md` "Caller values in a query filter" and "Caller values
  in a query resolve per execution", `docs/sql-reference.md` "Your own rows: caller values", `CallerValues`,
  `FilterTranslator`): `{"type": "param", "name": "caller.user_hash"}` is accepted only as a direct operand of `eq`/`ne`
  against a `string` expression that reads a field, reached from `filter`/`having` through `and`/`or`/`not`; anything
  else is `400 bad_request`. ADAS inlines the executing caller's hash per execution, never cached; an unknown value
  (no `logging-*` settings, `none` mode, project key) evaluates as SQL `NULL` and matches no row. The value only
  narrows; row policies still apply. Before #86 every `param` in a query was `400`.
- ADAS joins an enrichment with `LEFT JOIN ... ON source.grain_key = enrichment.grain_key`, 0..1 under a final read
  (structured-query spec, enrichment join requirement). Since `V56` an enrichment's read access and row policies follow
  its source table.

## Goals / Non-Goals

**Goals:**

- One place adds the own-rows predicate, so a future query cannot be written without it.
- Safety never depends on how ADAS support for caller values is detected.
- No extra ADAS call, step or latency; the "at most six calls in three steps" bound stays.

**Non-Goals:**

- Changing the response DTO, reasons, mapper, period/budget validation or the transport.
- Distinguishing ADAS `none` mode from an administrator (both now get their own rows: none, or their own).

## Decisions

### D1. The predicate lives in `windowFilter`

Add an exported constant, for example `OWN_ROWS_PREDICATE`, equal to
`{op: 'eq', args: [field('user_hash'), {type: 'param', name: 'caller.user_hash'}]}`, and put it in `windowFilter`'s
`and` unconditionally, right after the window bounds and before `scopePredicates(budget)` and the `extra` conjuncts.
Every builder already goes through `windowFilter`, in both scopes, so Q1–Q4 all carry it and there is no flag or
parameter that could drop it. The file's header comment ("There is no user filter — the ADAS row policy confines the
rows") is rewritten to state the two mechanisms.

It is a top-level conjunct, the placement ADAS accepts (`eq` against a `string` field, reached through `and`), and a
top-level `and` conjunct can only narrow: no `or` elsewhere in the filter can bypass it.

**Client split (Q4).** `user_hash` is a bare name, so ADAS resolves it as the `dial_usage_log` source column (enrichment
columns are always table-qualified, `usage_client_identity.client_type`). The predicate therefore filters source rows,
and the enrichment is `LEFT JOIN`ed onto those rows by grain key. A left join cannot introduce a source row that the
`WHERE` removed, and its 0..1 cardinality under a final read means it cannot multiply them either. Even the documented
non-final fan-out (an enrichment key with unmerged versions) can only repeat one of the caller's own rows, never add
another user's. The enrichment carries no row policy of its own since `V56`; its rows follow the source's.

*Alternatives:* adding the predicate per builder (four copies; a fifth query could forget it) or in the service before
sending (the service would have to rewrite documents it does not own). Rejected.

### D2. Detect missing caller-value support from the first query's `400`, not with a probe

A required usage query answered `400` maps to `forbidden`, with a `warn` line naming query caller values
(ADAS 0.24, ai-dial-analytics#86) and the read grant as the things to check. No query without the predicate is ever
built, so there is nothing to fall back to and no retry path to forget.

Why not detect up front:

- **Probe query** (for example a `count()` with only the own-rows predicate). It adds a call to every request and
  either a fourth sequential step or a parallel call next to the table read; it breaks the "at most six calls"
  bound in the spec; and it proves nothing the real queries do not prove a few milliseconds later, because they
  carry the same predicate. Caching the probe result is out of scope.
- **Capability from discovery.** #86 adds no capability flag to `GET /v1/tables/{name}` or the entity schema. The SQL
  function catalog (`GET /v1/queries/sql-functions`) lists `caller.user_hash`, but it describes the SQL surface rather
  than the structured DSL, is a large payload to fetch per request, and is a proxy for what the query itself answers.
- **Reading the `400` body** to see whether it names `caller.user_hash`. The client deliberately discards ADAS error
  bodies so ADAS text never reaches logs or clients, and matching an error message is brittle.

The rule is "any `400` on a required query", not "a `400` naming the caller value": the BFF cannot tell them apart
without reading the body (above). Q1–Q3 are fixed documents covered by unit tests, so a `400` from a supported ADAS
is a BFF defect; reporting it as `forbidden` instead of `unavailable` changes only the reason, and the client already
logs the raw ADAS status. Q4 keeps its existing behaviour: any failure, `400` included, only drops `byClient`; on an
ADAS without #86 Q1 and Q2 fail too, so the response is `forbidden` regardless.

### D3. Relax the guard only together with the predicate

`isRowRestricted` becomes a read check (`permissions.read === true`); `rows_restricted` is no longer read. The table
read itself stays: it answers `forbidden` before up to four queries are sent when the caller cannot read the table, it
turns a missing table (`404`) into `forbidden`, and it keeps "no access" distinct from "no usage".

The relaxation is only safe because of D1, so the two land in the same change and in this order: the predicate first
(slice 1 of tasks.md, safe on its own: it only narrows), the guard second. Relaxing the guard alone would show an
administrator every user's spend as their own.

### D4. A caller without a user hash gets an empty, available history

ADAS `none` mode reports `rows_restricted: false` and resolves no caller value, so it now passes the guard and every
query returns no rows: `available: true` with zero totals and zero-filled days. The table permissions do not say which
security mode ADAS runs in, so the BFF cannot tell `none` mode from an unconfined administrator, and it does not need
to: the outcome is safe either way. The README states it beside the existing symptom of a `logging-*` mismatch, which looks the same.

### D5. Logging

- The `not row-restricted` `warn` line goes away; a view without `read` keeps a `warn` line naming the `*` read grant.
- `FORBIDDEN_HINT` loses "row policy" as the cause of a refusal and names the `*` read grant; the `400` path uses its
  own hint naming caller values and ADAS 0.24 / #86.
- The BFF never holds a user hash, so it cannot log one; token-free logging is unchanged (`describeError` logs only the
  exception class and status). The existing "never logs the token" assertions are extended to the new paths.

### D6. Change-level alternatives

- **BFF-side hashing** (`user_hash = '<hash>'` literal): works on any ADAS, but the BFF would hold DIAL Core's
  `loggingKey`/`loggingSalt` per provider — a credential — and re-implement Core's derivation. Rejected; the spec keeps
  "no user-hash salt" as a requirement.
- **Keep refusing unrestricted callers:** zero risk, but every DIAL administrator stays at `forbidden`. Rejected.
- **Predicate only for unrestricted callers:** keeps regular users working on pre-#86 ADAS at the cost of two query
  shapes and a safety decision that hinges on the permissions read. Rejected in favour of one uniform shape and a
  documented ADAS minimum.

## Risks / Trade-offs

- [An ADAS without #86 now refuses regular users too] → README states the minimum ADAS version; the `warn` line names
  it; rollback is a revert (below).
- [A genuine BFF query defect that ADAS answers `400` reads as `forbidden`, not `unavailable`] → fixed documents with
  unit tests per builder and scope; the client logs the raw `400`; the service log names both causes.
- [`user_hash` hidden from the caller by a column policy] → ADAS answers `403 column_not_entitled` → `forbidden`, as
  for any refusal. Safe.
- [`none` mode or missing `logging-*` settings show an empty history rather than an error] → D4; documented in the
  README troubleshooting text.
- [ADAS performance] → the predicate narrows the scan for administrators and repeats the row policy for regular users;
  no measurable cost expected.

## Migration Plan

1. Deploy ADAS with #86 (0.24 or later) and keep the `*` grant with `rows: user_hash = caller.user_hash` for least
   privilege.
2. Deploy chat-api with this change. No env, API or data migration.
3. Rollback: revert the chat-api commit (admins get `forbidden` again; regular users work on any ADAS). Rolling ADAS
   back below #86 requires this revert first, or every caller gets `forbidden`.

## Revised after review

The local review before the PR overturned two decisions:

- **D2.** A `400` has a second cause besides a missing caller-value feature. ADAS answers a query over a column hidden by
  a column policy exactly as over an unknown column, so a policy hiding `user_hash` from `*` also rejects every query.
  The `forbidden` log hint now names both causes, and the README lists "`user_hash` visible to every caller" as a
  prerequisite. Only a `400` to the daily totals or model ranking query means "cannot run the own-rows filter"; the
  per-day query runs after ADAS has accepted the filter, so its `400` is a BFF defect and answers `unavailable`.
- **D3.** The table read is gone. Once every query is confined, it bought no safety and cost one sequential round
  trip per request. A caller who cannot read the table is refused by the queries (`401`/`403`/`404` → `forbidden`).
  The route now makes at most five ADAS calls. The main spec's "No permissions pre-check" replaces "Table read guard".

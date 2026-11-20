# Tasks

Slicing: **risk-first, then vertical.** Slice 1 adds the own-rows predicate, which only narrows and is safe on its own.
Slice 2 relaxes the guard, which is safe only on top of slice 1 (design D3), so the order must not be swapped. Slice 3
updates the docs. Conventions: `apps/chat-api/AGENTS.md` §4 (services, Logger), §6 (errors), §10 (logging), §11
(tests); extensionless relative imports; specs co-located in `apps/chat-api/src/usage-history/tests/`.

## 1. Own-rows predicate in every query (spec: "Own-rows predicate in every usage query", "Fixed server-side queries")

- [x] 1.1 In `apps/chat-api/src/usage-history/queries/usage-history.queries.ts` add an exported `OWN_ROWS_PREDICATE`
      (`eq` of `field('user_hash')` and `{type: 'param', name: 'caller.user_hash'}`) and put it unconditionally in
      `windowFilter`'s `and`, after the window bounds and before `scopePredicates(budget)` and `extra` (design D1).
      Rewrite the file header comment ("There is no user filter …") to state the two mechanisms: ADAS row policy plus
      the own-rows caller value, resolved by ADAS from the caller's token.
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` fails
      only on the "never references a user identifier" case until 1.2.
- [x] 1.2 In `apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` replace "never references a user
      identifier" with: every builder (Q1–Q4) in user scope and in budget scope has `OWN_ROWS_PREDICATE` as a top-level
      conjunct of its `filter.args`; the documents hold no other user condition and no `user_ref`, `user_email` or
      `jwt_` text; the existing "only bound values vary" case still holds with the predicate present.
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` passes.

## 2. Read guard and caller-value refusal (spec: "Table read guard", "ADAS without caller values is refused", "Unavailable states", "Budget narrowing unsupported by DIAL Analytics")

- [x] 2.1 In `apps/chat-api/src/usage-history/usage-history.service.ts` replace `isRowRestricted` with a read check
      (`permissions.read === true`, `rows_restricted` ignored); a view without read keeps answering `forbidden` with a
      `warn` line naming the `*` read grant. Map a `BadRequestException` from a required query (Q1, Q2, Q3) to
      `forbidden` with a `warn` line naming query caller values (ADAS 0.24, ai-dial-analytics#86); leave Q4's
      failure handling as is. Update `FORBIDDEN_HINT` and the class/step comments (design D2, D3, D5). No retry and
      no query builder call without the predicate is added.
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.service.spec.ts`
      (expected to fail only on the guard and `400` cases until 2.2).
- [x] 2.2 Update `apps/chat-api/src/usage-history/tests/usage-history.service.spec.ts`:
      - "row-restriction guard" → "read guard": `read: false` and missing `permissions` answer `forbidden` with no
        query; `401`/`403`/`404` on the table read answer `forbidden`; an administrator view
        (`read: true, rows_restricted: false`) and the `none`-mode shape answer `available: true` with only the mocked
        own rows, and every executed document carries `OWN_ROWS_PREDICATE`; a row-restricted view still works with
        the predicate present.
      - "unavailable states": `daily totals answer 400` → `forbidden`; a `400` on the ranking and on the per-day query
        → `forbidden`; after a `400` every document ADAS received carries the predicate and no query kind was sent
        twice.
      - "client breakdown": a `400` on the client split alone keeps `available: true` without `byClient`.
      - ADAS returning no rows → `available: true`, zero totals, `byModel: []`, a zero entry for every day.
      - "budget scope": every executed document carries the predicate beside the three budget predicates; "still
        applies the row-restriction guard first" becomes the read guard (`read: false`).
      - Logs: the token never appears in any log line on the new paths (admin success, `400` refusal, no-read refusal).
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.service.spec.ts` passes.
- [x] 2.3 In `apps/chat-api/src/usage-history/tests/user-usage-history.controller.integration.spec.ts` add end-to-end
      cases through HTTP with the fake ADAS: an administrator view (`read: true, rows_restricted: false`) answers
      `200` with `available: true` and `Cache-Control: private, no-store`, and every recorded query body carries the
      predicate; ADAS answering `400` to queries answers `200` with `{ available: false, reason: "forbidden" }`.
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/user-usage-history.controller.integration.spec.ts`
      passes; then `npm run verify:changed` once for slices 1–2.
- [x] 2.4 (Added during apply.) Rewrite the stale guard wording in the route's `@ApiOperation` description
      (`apps/chat-api/src/usage-history/user-usage-history.controller.ts`), the `reason` description
      (`apps/chat-api/src/usage-history/dto/user-usage-history-response.dto.ts`) and the `Forbidden` JSDoc
      (`apps/chat-api/src/usage-history/types/usage-history-unavailable-reason.ts`); regenerate the client with
      `npm run openapi`. Description text only: no operation, parameter, schema or enum change.
      Verification: `npm run openapi:check` passes; the `libs/chat-api-client` diff touches only description strings.

## 3. Docs (spec: "Caller-scoped data through ADAS row policy and an own-rows predicate")

- [x] 3.1 Update `apps/chat-api/README.md` "Usage history (DIAL Analytics)": the `forbidden` row (no `read`, refused
      token, `404` table, ADAS without caller values; no longer "not row-restricted"); the security model (row policy
      plus the `user_hash = caller.user_hash` caller value in every query, resolved by ADAS from the token; the BFF
      still holds no salt and never sees the hash); administrators see their own history; ADAS minimum version 0.24
      (a build with ai-dial-analytics#86) as the first prerequisite; prerequisite 3 (the `*` grant with
      `rows: user_hash = caller.user_hash`) kept as the least-privilege recommendation; the `SECURITY_MODE=none`
      paragraph and the `logging-*` mismatch symptom (both now `available: true` with zero usage).
      Verification: `npm run validate:docs` passes.
- [x] 3.2 Update the `/api/v1/user/usage/history` row in `docs/architecture.md` "a non-row-restricted ADAS view
      answers `forbidden`" → every query filters on the caller's own rows with the ADAS caller value; ADAS ≥ 0.24
      (#86) required.
      Verification: `npm run validate:docs` passes.
- [x] 3.3 Validate the change and the spec references.
      Verification: `openspec validate filter-usage-history-own-rows --strict` and `npm run validate:specs` pass.

## 4. Close

- [x] 4.1 Lint and full verification once for the whole change.
      Verification: `npm exec nx lint chat-api` and `npm run verify:full` pass, and `npm run openapi:check` passes
      after 2.4's regeneration.
      Result (2026-11-20): `nx lint chat-api`, `openapi:check`, and `verify:full`'s typecheck, lint and format steps
      pass. `test:full` fails only on two problems this change did not cause: `@epam/chat-api:test` has 213 failing
      tests in 8 `app-config`/`config` files (`pairs.map is not a function` in `managed-runtime.settings.ts`),
      identical on a clean `development` tree, and `attachment-canvas-consumer-fixture:pack-lib` cannot install
      `@epam/ai-dial-react-pdf-highlighter@0.3.3` (npm `ETARGET`). All usage-history tests pass.

## Workflow follow-up

- Archive `add-user-usage-history-api` and then `add-usage-history-budget-filter` before archiving this change: the
  `user-usage-history` main spec must exist for this delta's MODIFIED, RENAMED and REMOVED operations.
- After ADAS with #86 is on the dev stand, confirm that the user holding `admin` who got `forbidden` on 2026-11-20 now
  sees only their own history.

## 5. Review fixes (after archive, before the PR)

- [x] 5.1 Drop the table permissions read from `apps/chat-api/src/usage-history/usage-history.service.ts` and
      `getUsageLogTable` from `apps/chat-api/src/usage-history/analytics/analytics.client.ts`; map `404` from a required
      query to `forbidden`; answer `unavailable` for a `400` to the per-day query; name both `400` causes in the hint.
      Verification: the three usage-history specs and `tests/analytics/analytics.client.spec.ts` pass.
- [x] 5.2 Delete the `user_hash` count assertion in `tests/usage-history.queries.spec.ts`.
      Verification: `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` passes.
- [x] 5.3 Update `openspec/specs/user-usage-history/spec.md`, `apps/chat-api/README.md`, `docs/architecture.md`
      and the OpenAPI descriptions; regenerate `libs/chat-api-client`.
      Verification: `npm run validate:docs`, `npm run validate:specs` and `npm run openapi:check` pass.

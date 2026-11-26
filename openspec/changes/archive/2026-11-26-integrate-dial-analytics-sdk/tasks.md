# Tasks

The slicing is risk-first, then vertical. Group 1 pins the wire documents and the baseline before anything moves.
Groups 2–3 build the shared plumbing and the ADAS client, each verified by its own suite. Group 4 moves the one
consumer across. Group 5 lands the rules and docs. Group 6 is for integration checks only.

Commands follow the `lean-verification` skill. Nx needs `npm exec -- nx …`. Run Nx tests with
`NX_LOAD_DOT_ENV_FILES=false`: a developer-local `apps/chat-api/.env.local` that sets `MANAGED_CONFIG_*` breaks
unrelated `app-config` specs (see `openspec/changes/archive/2026-11-25-bump-typescript-sdk-0-3-1/design.md` "Spike
result").

## 1. Baseline

- [x] 1.1 Re-check freshness. `node_modules/@epam/ai-dial-typescript-sdk` is `0.3.1` and exports `createAnalyticsSDK`
      (the uncommitted change 01). No active change under `openspec/changes/` (excluding `archive/`) touches
      `apps/chat-api/src/usage-history/`, `apps/chat-api/src/dial/` or `common/dial/dial-error.mapper.ts`.
      `usage-history/analytics/analytics.client.ts` is unchanged since this plan. **Verify:** if any check fails, stop
      and report.
- [x] 1.2 Add the golden test to `apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` (design.md D9).
      For a fixed window, assert `JSON.stringify` of `buildDailyTotalsQuery`, `buildModelRankingQuery`,
      `buildDailyTopModelsQuery` (two names, one with a quote) and `buildClientSplitQuery`, with and without a budget,
      against string literals copied verbatim from the **current** builders' output. **Verify:**
      `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` passes on the
      unmodified builders.

## 2. Shared plumbing

- [x] 2.1 Create `apps/chat-api/src/common/utils/user-agent.ts` with `buildChatUserAgent(override?)` (design.md D4).
      Move the normalisation out of `apps/chat-api/src/dial/dial-client.service.ts` together with its CodeQL comment,
      and make `DialClientService` call the new function. Add
      `apps/chat-api/src/common/utils/tests/user-agent.spec.ts` covering a configured version, a blank version, a
      version needing normalisation, and the `unknown` fallback. **Verify:**
      `npm run test:file -- apps/chat-api/src/common/utils/tests/user-agent.spec.ts apps/chat-api/src/dial/tests/dial-client.service.spec.ts`
      passes, with `dial-client.service.spec.ts` unmodified.
- [x] 2.2 In `apps/chat-api/src/common/dial/dial-error.mapper.ts`, add
      `createUpstreamErrorMapper({ upstream, timeoutErrorNames })` (design.md D5). Rebuild `mapDialHttpStatus`,
      `handleDialSdkError` and `handleDialFetchError` from it with the `'DIAL Core'` / `['AbortError']` settings,
      keeping their names, overloads and texts. Export `dialAnalyticsErrors`. Add cases for `dialAnalyticsErrors` in a
      new `apps/chat-api/src/common/dial/tests/dial-analytics-errors.spec.ts`:
      - every text names DIAL Analytics, never DIAL Core;
      - `TimeoutError` and `AbortError` give `ServiceUnavailableException('DIAL Analytics request timed out')`;
      - other errors give `'DIAL Analytics is currently unavailable'`;
      - a status maps to the same subtype as for Core.

      **Verify:**
      `npm run test:file -- apps/chat-api/src/common/dial/dial-error.mapper.spec.ts apps/chat-api/src/common/dial/tests/dial-analytics-errors.spec.ts`
      passes, and `git diff --quiet -- apps/chat-api/src/common/dial/dial-error.mapper.spec.ts` confirms the Core
      suite is unmodified.

## 3. DIAL Analytics client

- [x] 3.1 Move `apps/chat-api/src/usage-history/tests/fake-analytics.server.ts` unchanged to
      `apps/chat-api/src/dial/tests/fake-analytics.server.ts`, and update the imports in
      `usage-history/tests/usage-history.service.spec.ts`,
      `usage-history/tests/user-usage-history.controller.integration.spec.ts` and
      `usage-history/tests/analytics/analytics.client.spec.ts`. **Verify:**
      `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.service.spec.ts apps/chat-api/src/usage-history/tests/user-usage-history.controller.integration.spec.ts apps/chat-api/src/usage-history/tests/analytics/analytics.client.spec.ts`
      passes.
- [x] 3.2 Create the following (design.md D1–D3, D5):
      - `apps/chat-api/src/dial/dial-analytics-client.service.ts` (`DialAnalyticsClientService`: config, `isConfigured`,
        `timeoutMs`, `client`, and the wrapped `fetchAnalytics` with `User-Agent`, `Accept`, `redirect: 'manual'`,
        `AbortSignal.timeout` and the `answered <status> in <ms>ms` log);
      - `apps/chat-api/src/dial/dial-analytics.module.ts` (`@Global`);
      - `apps/chat-api/src/dial/dial-analytics-result.ts` (`readDialAnalyticsData`, `handleDialAnalyticsFailure`).

      Register `DialAnalyticsModule` in `apps/chat-api/src/app/app.module.ts` next to `DialCoreModule`. Give every
      exported symbol JSDoc. **Verify:** `npm exec -- nx run typecheck -p chat-api` passes.
- [x] 3.3 Write `apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts`. Port every
      `analytics.client.spec.ts` case through the SDK path (`service.client.getEntitySchema` /
      `executeQuery` + `readDialAnalyticsData` / `handleDialAnalyticsFailure`) against the fake ADAS, and add the
      design.md D9 cases:
      - one `User-Agent: ai-dial-chat/<version>` and `Accept: application/json` are sent;
      - an empty 200 and a JSON `null` 200 → 503;
      - a body that stalls past the timeout → 503;
      - no ADAS failure logs or throws text containing `DIAL Core`.

      For the last case, extend the fake with an option to send headers and then never finish the body; keep the
      existing behaviour as the default. **Verify:**
      `npm run test:file -- apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts` passes. Then run
      `npm run verify:changed` once for the slice.

## 4. Usage history on the SDK

- [x] 4.1 Type `apps/chat-api/src/usage-history/queries/usage-history.queries.ts` with the local wire types and
      `toStructuredQuery` (design.md D7). Export `USAGE_LOG_ENTITY`. Keep every object literal and key order.
      **Verify:** `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.queries.spec.ts` passes
      with the 1.2 golden strings untouched.
- [x] 4.2 Migrate `apps/chat-api/src/usage-history/usage-history.service.ts` (design.md D6, D7):
      - inject `DialAnalyticsClientService`;
      - add the private `readSchema` and `runQuery` that call `getEntitySchema` / `executeQuery` with
        `getBearerAuthHeaders` and the D5 helpers;
      - type `discover`/`schemaFieldNames` on `QueryEntitySchemaDto` and `queryClientSplit` on
        `StructuredQueryResultDto | undefined`;
      - remove the dead guards and casts;
      - keep `isRefusal`, the 400 rule, the 404 rule, every `reason` and every log line as they are.

      Remove `AnalyticsClient` from `usage-history.module.ts`. In `usage-history.service.spec.ts` and
      `user-usage-history.controller.integration.spec.ts`, change only the wiring (import, provider, constructor).
      **Verify:**
      `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.service.spec.ts apps/chat-api/src/usage-history/tests/user-usage-history.controller.integration.spec.ts`
      passes, and `git diff` of both specs shows wiring lines only.
- [x] 4.3 Type `apps/chat-api/src/usage-history/usage-history.mapper.ts` (design.md D7):
      - `readRows`, `rankDeployments`, `mapDailyTotals`, `mapDailyTopModels` and `mapClientSplit` take
        `StructuredQueryResultDto`;
      - `UsageHistorySources` result fields are typed the same way;
      - remove the dead body guard and casts;
      - keep the `Array.isArray`/row-object check and every cell parser.

      **Verify:** `npm run test:file -- apps/chat-api/src/usage-history/tests/usage-history.mapper.spec.ts` passes.
      Any change to that spec is limited to typing its inputs as `StructuredQueryResultDto`; no case is removed.
- [x] 4.4 Delete `apps/chat-api/src/usage-history/analytics/analytics.client.ts`,
      `apps/chat-api/src/usage-history/tests/analytics/analytics.client.spec.ts`, and both now-empty `analytics/`
      folders. **Verify:** `git grep -n "AnalyticsClient\|analytics/analytics.client" -- apps/chat-api` is empty, and
      `npm exec -- nx run typecheck -p chat-api` passes. Then run `npm run verify:changed` once for the slice.

## 5. Rules and docs

- [x] 5.1 Update the agent rules (design.md D8):
      - `apps/chat-api/AGENTS.md` §1 (drop `app.service.ts` from the tree, fix the "DIAL SDK client pattern" pointer),
        §4 (SDK for DIAL Core and DIAL Analytics, raw `fetch` only for other upstreams or SDK gaps, the "Follow …"
        line) and §13 (anti-pattern);
      - `.claude/rules/nestjs-best-practices.md` (frontmatter `description`, the TL;DR bullet, both `app.service.ts`
        pointers);
      - `openspec/config.yaml` (lines naming "AppService").

      **Verify:** `git grep -n "app/app.service.ts\|AppService SDK" -- apps/chat-api/AGENTS.md .claude/rules openspec/config.yaml`
      is empty, and `npm run validate:docs` passes.
- [x] 5.2 Update the docs (design.md D8):
      - `docs/architecture.md`: the `dial/` tree entry, the `usage-history/` entry, and any prose about the ADAS
        transport;
      - `apps/chat-api/README.md`: one transport sentence in "Usage history (DIAL Analytics)" and the `dial/` line of
        the project structure;
      - the comments in `usage-history.service.ts` and `queries/usage-history.queries.ts` that cite the transport.

      **Verify:** `npm run validate:docs` and `npm run validate:specs` pass, and `npm run spec:impact` is reviewed
      (advisory) with any flagged spec either updated or noted here as unaffected.

## 6. Integration checks

- [x] 6.1 Run `NX_LOAD_DOT_ENV_FILES=false npm exec -- nx run-many -t typecheck,build,test,lint -p chat-api --skip-nx-cache`.
      **Verify:** all four targets pass.
- [x] 6.2 Run `npm run openapi && npm run openapi:check`. **Verify:** `git status --porcelain libs/chat-api-client`
      is empty, so the BFF contract is unchanged.
- [x] 6.3 Run `openspec validate integrate-dial-analytics-sdk`, then `npm run verify:full` exactly once. **Verify:**
      both pass. A `format:check` failure that is limited to git-ignored local files is noted, not fixed.
      _Result:_ `openspec validate` passes. In `verify:full`, `typecheck:full` and `lint:check` pass. `format:check`
      flags only git-ignored local files (`*-prompts/**`, `refactoring-frontend.md`), so `test:full` was run on its
      own (`test:full:quiet`) and passes. Every file this change touches passes `prettier --check`.
- [ ] 6.4 Smoke test against the real ADAS configured in `apps/chat-api/.env.local` (`ANALYTICS_URL` is set there),
      with a signed-in session (`npm run start:all`). The user supplies the session; Claude drives the requests and
      reads the logs. Cover:
      - `period=today|week|month`;
      - each period with a `costObject` + `policy` taken from `GET /api/v1/user/limits` `budgets`;
      - one run with `ANALYTICS_URL` unset.

      Expected: identical response shapes and `reason` values to before, `not_configured` with no outbound call when
      unset, and log lines that say "DIAL Analytics" and never "DIAL Core". **Verify:** record the outcome per case
      (status, `available`/`reason`, notable log lines with no token) in a "Smoke result" note under this task.

      _Deferred (user decision, 2026-11-25):_ not run locally. The smoke runs on the deployed environment after the
      merge, covering the same cases. Record its result here, or in the PR, before this change is archived.

## Workflow follow-up

- Ship in one commit together with `bump-typescript-sdk-0-3-1`, on a new branch off `development`, and only when the
  user asks.
- Upstream follow-up, out of scope: fix the ADAS OpenAPI (discriminator `mapping` for `Expr`/`PageSpec`,
  `FnExpr.args`, nullable `ValueExpr.value`), sync it into `@epam/ai-dial-typescript-sdk`, then replace the local wire
  types and drop `toStructuredQuery`'s cast.
- Changes 03 (ADAS request timing) and 04 (refusal classification by `ErrorView` code) build on this one.
- Archive the change after review (`/opsx:archive`).

# Proposal: User usage history from DIAL Analytics (ADAS)

## Why

Chat can show what a user has spent right now: `GET /api/v1/user/usage` proxies DIAL Core's counters. Those are
running totals for the current minute, day, week and month. They have no per-day breakdown, and they cannot say which
model or client the money went to. DIAL Analytics (ADAS, sibling repo `ai-dial-analytics`) already stores every Core
request in `dial_usage_log`, with a price and a hashed user id, and ADAS row policies can limit each caller to their own
rows. The BFF has no ADAS integration, so no Chat surface can use that history. This change adds a narrow, fixed,
read-only BFF route for it. The data contract comes first, so a later UI change (Chat or User Profile) only has to
render it.

## Problem

- No BFF route returns per-day, per-model or per-client spend for the signed-in user.
- The BFF has no ADAS configuration, transport or failure model. ADAS is optional in a DIAL installation, so the route
  must report "not available" clearly when ADAS is missing or misconfigured. Chat's other pages must not break.
- Spend must count each user request once. Core logs one span per hop of a call chain, and a span's `total_price`
  already includes the cost of the deployments it called. Summing every span would count chain costs several times.

## Solution

- A new domain `apps/chat-api/src/usage-history/` with its own module. It holds `UserUsageHistoryController` at
  `@Controller({ path: 'user', version: '1' })`, which serves `GET /api/v1/user/usage/history?period=today|week|month`.
  It follows the `UserLimitsController` pattern (`apps/chat-api/src/deployments/user-limits.controller.ts`): the global
  `SessionGuard`, the session access token from `(req.user as SessionUser).at`, and `Cache-Control: private, no-store`.
  `DeploymentsService` is not changed.
- An ADAS transport (`AnalyticsClient`) that sends the user's own session token as `Authorization: Bearer`. It follows
  the raw-fetch, `AbortController` and timeout pattern of `SchedulerUpstreamClient`
  (`apps/chat-api/src/scheduled-tasks/scheduler-upstream.client.ts`) and reuses `getBearerAuthHeaders`
  (`apps/chat-api/src/common/utils/auth-header.ts`). It reuses the `isTimeoutError`/network classification of
  `apps/chat-api/src/common/dial/dial-error.mapper.ts` without the DIAL-Core-specific exceptions. ADAS is not DIAL
  Core, so the shared DIAL SDK client does not apply.
- All ADAS query documents are fixed constants in the BFF. They are structured queries on `POST /v1/queries/execute`
  over `dial_usage_log`, limited to root spans (`parent_deployment IS NULL`). `execute-sql` is not used. The only
  browser input is the `period` enum. The BFF does not filter by user; the ADAS row policy
  (`user_hash = caller.user_hash` for grantee `*`) limits rows to the caller.
- A guard before any usage query: the BFF reads the caller's `permissions.rows_restricted` on `dial_usage_log`
  (`GET /v1/tables/dial_usage_log`). It refuses with `forbidden` when the caller's view is not row-restricted, which
  covers ADAS administrators and ADAS in `none` mode. ADAS policies only narrow access, so without this check an
  administrator's "history" would be the whole installation's spend.
- The response is always `200` for an authenticated, valid request. When ADAS can answer, the body has
  `available: true` and the data. Otherwise it has `available: false` and a `reason` of `not_configured`,
  `unavailable` or `forbidden`. A UI can then hide or explain the panel instead of handling a 5xx.
- Two server-only env vars, `ANALYTICS_URL` (unset means the feature is off) and `ANALYTICS_TIMEOUT_MS` (default
  `10000`). They are declared in `IntegrationsEnv` (`apps/chat-api/src/config/env/integrations.env.ts`) and registered
  as `visibility: 'server'` entries in `CONFIG_DEFINITIONS`
  (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). They are never part of client-config.
- Request and response DTOs in the style of `UserLimitStatsResponseDto`
  (`apps/chat-api/src/openapi/openapi-response.dto.ts`). They feed the generated `@epam/ai-dial-chat-api-client` as
  `getUserUsageHistory`, through the normal `npm run openapi` flow.

## Alternatives considered

| Option | Correctness | Complexity / risk | Security | Verdict |
|---|---|---|---|---|
| **A. Forward the user's token; ADAS row policy confines rows (chosen)** | Rows are confined where the data lives. ADAS logs the real caller. | Low in the BFF. It needs ADAS OIDC configuration and a `*` grant with `rows`. | No new secret in the BFF. A BFF bug cannot widen access. | **Chosen** |
| B. BFF service account plus a `user_hash = <hash>` filter added by the BFF | Correct only while the BFF computes the hash exactly as Core does | Needs Core's `loggingSalt` and an ADAS credential in the BFF | The BFF becomes able to read every user's usage. One filter bug leaks data. | Rejected |
| C. BFF hashes the user id and sends it with the user token | Duplicates the row policy | Needs the salt. Drifts when Core's hashing changes. | Puts a credential in the BFF for nothing the row policy does not already do | Rejected |
| D. Use Core's `/v1/user/usage` only (baseline) | No per-day, per-model history or client split | None | Already in place | Rejected: it does not answer the question |
| E. `execute-sql` with constant SQL | Equivalent | Needs typed literal binding and the SQL subset | Larger injection surface, although constant | Rejected: the structured query covers every query (see design) |

## Non-goals

- Per-package or budget attribution. Core does not log the charged budget yet.
- API keys and per-key usage.
- Any UI in `apps/chat`, `libs/*` or User Profile. No frontend `server-api` wrapper is added in this change; the first
  consumer adds it.
- Caching across requests. Every call queries ADAS.
- Changes to DIAL Core or ADAS, and dependency upgrades.
- Accepting SQL, filters or query documents from the browser.

## Acceptance criteria

- `GET /api/v1/user/usage/history?period=month` with a session returns `200` and `Cache-Control: private, no-store`.
  With ADAS reachable, the body has the `available: true` shape: a zero-filled ascending `daily` with one entry per UTC
  day of the window, `byModel` as the top 10 by spend plus `other`, money rounded to 6 decimals, and `currency: "USD"`.
- A missing or unknown `period` returns `400`. A request without a session returns `401`.
- Unset `ANALYTICS_URL` returns `{ "available": false, "reason": "not_configured" }` and makes no outbound call. A
  timeout, network error or ADAS 5xx returns `unavailable`. ADAS 401 or 403 returns `forbidden` and is logged at `warn`
  without the token.
- A caller whose ADAS view of `dial_usage_log` is not row-restricted gets `forbidden`, and no usage query is sent.
- Every ADAS call carries `Authorization: Bearer <session access token>`, and every query document is one of the fixed
  constants with only the window bounds varying.
- `byClient` is present only when ADAS exposes `usage_client_identity.client_type` to the caller. Otherwise the field
  is absent.
- `libs/chat-api-client/openapi.json` and the generated client contain `getUserUsageHistory` with strong types.
  `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.

## Capabilities

### New Capabilities

- `user-usage-history`: the authenticated `GET /api/v1/user/usage/history` route. It covers the period windows, the
  response contract (available and unavailable variants), root-span counting, the token-forwarding and row-policy
  security model, the optional client breakdown, the ADAS env configuration and the generated-client contract.

### Modified Capabilities

None. `user-usage-limits-api` (`GET /api/v1/user/limits` and `/user/usage`) is unchanged. The new route shares only the
`user` controller base path.

## Impact

- **Code:** new `apps/chat-api/src/usage-history/` (module, controller, service, ADAS client, query builders, mapper,
  DTOs, tests). Registration in `apps/chat-api/src/app/app.module.ts`. Env fields in
  `apps/chat-api/src/config/env/integrations.env.ts`, the env snapshot in
  `apps/chat-api/src/config/tests/environment-composition.spec.ts`, and two registry entries.
- **API:** one new additive endpoint and new OpenAPI schemas. Nothing is breaking.
- **Generated client:** `libs/chat-api-client/openapi.json` and the generated sources are regenerated. Publishing
  follows the normal release flow, not this change.
- **Docs:** `apps/chat-api/README.md` (env table and endpoint table), `apps/chat-api/.env.template`, and
  `docs/architecture.md` (backend domain list and endpoint table).
- **Shared libs and global providers:** none touched. There is no scope creep into `libs/*`.
- **i18n:** none. The route returns data and reason codes, not user-visible strings.
- **Dependencies:** none added.

## Rollback / backward compatibility

The change is purely additive. With `ANALYTICS_URL` unset (the default) the route answers `not_configured` and never
calls out. An operator can switch the feature off by unsetting the variable and restarting. To revert the code, remove
the module and regenerate the client. No existing route, schema or client method changes.

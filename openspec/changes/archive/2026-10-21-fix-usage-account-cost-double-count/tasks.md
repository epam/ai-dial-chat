Slicing strategy: **contract-first**.

1. Slice 1 settles the HTTP contract that already exists on this branch and removes the diagnostics.
2. Slice 2 changes the `libs/chat-hooks` contract (`UsageLimitsSources`, `UsageLimitsApi`) together
   with its two app call sites. The hook is shared by the popover and the banner, so neither surface
   compiles against the new signature alone.
3. Slice 3 updates docs and specs, then closes with one full verification.

## 1. BFF endpoint and diagnostics cleanup

- [x] 1.1 Remove the `TEMP(#9361)` code from `apps/chat-api/src/deployments/details/deployments-details.service.ts`:
  - delete `logRawDialBody`;
  - drop the `parseAs: 'text'` option from `getDeploymentLimits`, `getDeploymentUsage`, and `getUserUsage`;
  - give `getDeploymentUsage` no body log, matching `getDeploymentLimits`.

  Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`.
- [x] 1.2 Confirm the `getDeploymentUsage` tests already on the branch cover the spec scenarios: `200`, `401`, `404`, `400` traversal before the service call, no cache, and `Cache-Control: private, no-store`. Add any missing one to `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts` (supertest), `apps/chat-api/src/deployments/tests/deployments.controller.spec.ts`, or `apps/chat-api/src/deployments/tests/deployments.service.spec.ts`.

  Verification: `npm run test:file -- apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts apps/chat-api/src/deployments/tests/deployments.controller.spec.ts apps/chat-api/src/deployments/tests/deployments.service.spec.ts`.
- [x] 1.3 Re-run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx -- run-many -t build lint -p chat-api-client`). Confirm `libs/chat-api-client/openapi.json` carries `getDeploymentUsage` with a `DeploymentLimitsResponseDto` `200` response. Do not hand-edit generated files.
- [x] 1.4 Remove the `TEMP(#9361)` `Promise.allSettled` probe from `getDeploymentLimits` in `apps/chat/src/server-api/deployment-limits.ts`. Keep the `getDeploymentUsage` helper (it calls `deploymentsApi.getDeploymentUsage({ deployment })`).

  Verification: `npm exec nx -- run typecheck chat`.
- [x] 1.5 Slice check: `npm run verify:changed`, and confirm `grep -rn "TEMP(#9361)\|TEMP #9361" apps libs` returns nothing.

## 2. Single-scope sources in `libs/chat-hooks` and both call sites

- [x] 2.1 In `libs/chat-hooks/src/usage/useDeploymentUsageLimits/useDeploymentUsageLimits.ts`, add and export:
  - `AccountUsage` (`Pick<UserLimitStatsResponseDto, 'dayCostStats' | 'weekCostStats' | 'monthCostStats'>`);
  - `UsageLimitsSources` (`{ deployment; account }`);
  - `UsageLimitsApi` (`{ getDeploymentUsage; getAccountUsage }`), with JSDoc stating each field's scope.

  They are re-exported through `libs/chat-hooks/src/entry-points/usage-limits.ts` and `libs/chat-hooks/src/index.ts`, which already `export *` from this module; confirm they appear. Remove the `GetDeploymentLimits` type only if nothing else imports it.
- [x] 2.2 Rework `useDeploymentUsageLimits(deploymentId, api)` per design D2:
  - one effect, one monotonic request id, a `cancelled` flag, and `Promise.allSettled` over both calls;
  - a per-source last-known value; `hasError` when either call rejects; `isLoading` until both settle;
  - clear `deployment` and keep `account` on a deployment change;
  - `api` held in a ref;
  - return `{ sources, isLoading, hasError, refresh }`.
- [x] 2.3 Unit tests in `libs/chat-hooks/src/usage/useDeploymentUsageLimits/tests/useDeploymentUsageLimits.spec.ts`, rewritten for the new contract:
  - both calls run on mount and on `refresh()`;
  - a stale response for an earlier deployment is ignored;
  - one rejected call keeps that source's last value and sets `hasError` while the other source updates;
  - the account value survives a deployment change and the deployment value is cleared;
  - no fetch happens without a `deploymentId`;
  - a new `api` identity alone does not re-fetch.

  Verification: `npm run test:file -- libs/chat-hooks/src/usage/useDeploymentUsageLimits/tests/useDeploymentUsageLimits.spec.ts`.
- [x] 2.4 Change `mapDeploymentLimitsToInput` in `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts` to take `sources: UsageLimitsSources`. Build the token group from `sources.deployment` and the cost group from `sources.account`. Return `undefined` when both are `undefined`. Rewrite the `COST_MAPPINGS` comment to state that the cost group is the account budget from the user-usage response, and why `/limits` is not used (the router double count, #9361).
- [x] 2.5 Update `libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-input.spec.ts` to the new signature, and add the spec scenarios:
  - the issue's figures (`132.24 / 200` account vs `263.22 / 200` from `/limits`) produce no cost row;
  - identical cost groups for a model and an agent;
  - deployment cost stats are ignored;
  - one missing source drops only its group.

  Verification: `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-input.spec.ts`.
- [x] 2.6 Change `selectUsageBannerSource` in `libs/chat-hooks/src/usage/usage-banner-source.ts` to take `(sources: UsageLimitsSources, thresholdPercent)`. Token candidates come from `sources.deployment`, cost candidates from `sources.account`. Keep the tie-break order and the threshold logic unchanged.
- [x] 2.7 Update `libs/chat-hooks/src/usage/tests/usage-banner-source.spec.ts` to the new signature, and add:
  - the issue-figures case (no banner);
  - deployment cost stats ignored;
  - cost-only and token-only source sets.

  Verification: `npm run test:file -- libs/chat-hooks/src/usage/tests/usage-banner-source.spec.ts`.
- [x] 2.8 In `libs/chat-hooks/src/usage/useUsageLimitBanner/useUsageLimitBanner.ts`:
  - replace the `getDeploymentLimits` option with `getDeploymentUsage` and `getAccountUsage`;
  - build the `UsageLimitsApi` with `useMemo` on both;
  - pass `sources` to `selectUsageBannerSource`.

  Update `libs/chat-hooks/src/usage/useUsageLimitBanner/tests/useUsageLimitBanner.spec.ts`, including a case where a rejected `getDeploymentUsage` still yields a cost-row banner.

  Verification: `npm run test:file -- libs/chat-hooks/src/usage/useUsageLimitBanner/tests/useUsageLimitBanner.spec.ts`.
- [x] 2.9 Architecture guard for `libs/chat-hooks`:
  - the changed files import `@epam/ai-dial-chat-api-client` for types only;
  - they contain no `/api` path, no `apps/chat/src/server-api` import, no app context, no env, flag, or i18n import, and construct no client.

  Check with `grep -rn "api/v1\|server-api\|import.*from '@epam/ai-dial-chat-api-client'" libs/chat-hooks/src/usage libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts`, then review the type-only imports.
- [x] 2.10 Wire `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`:
  - pass a module-level `UsageLimitsApi` constant `{ getDeploymentUsage, getAccountUsage: getUserUsage }` from `apps/chat/src/server-api/deployment-limits.ts` and `apps/chat/src/server-api/user-limits.ts`;
  - map `sources` inside the existing `useMemo`;
  - remove the `getDeploymentLimits` import.
- [x] 2.11 Update `apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`:
  - the control requests the deployment usage and the user usage, and never `getDeploymentLimits`;
  - with the issue's figures for an agent, no trigger is rendered;
  - a failed source still renders the other group and announces the error politely.

  Use role, label, and text queries.

  Verification: `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`.
- [x] 2.12 Wire `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`: pass `getDeploymentUsage` and `getAccountUsage: getUserUsage` to `useUsageLimitBanner` instead of `getDeploymentLimits`. Update `apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx` (mocks of `server-api/deployment-limits` and `server-api/user-limits`), including the case where the agent's figures produce no banner.

  Verification: `npm run test:file -- apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`.
- [x] 2.13 Re-run the composer specs that mock these modules, to catch mock-shape drift: `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx`. Then run the slice check: `npm run verify:changed`.

## 3. Docs, specs, and final verification

- [x] 3.1 Update `libs/chat-hooks/README.md`:
  - the `useUsageLimitBanner` example and options table (`getDeploymentUsage`, `getAccountUsage` replace `getDeploymentLimits`);
  - the paragraph listing `useDeploymentUsageLimits(deploymentId, api)` and `selectUsageBannerSource(sources, thresholdPercent)`;
  - the `mapDeploymentLimitsToInput` section (signature, the two sources, an example with both).

  Document `UsageLimitsSources`, `UsageLimitsApi`, and `AccountUsage`. Every code fence must compile against the new exports.
- [x] 3.2 Confirm the `docs/architecture.md` endpoint-table row for `/api/v1/deployments/{deployment}/usage` (added on this branch) matches the spec, and no other doc names `getDeploymentLimits` as the popover's or banner's source. Run `npm run validate:docs`.
- [x] 3.3 Run `npm run validate:specs` against the delta specs. Fix any cited path or identifier it flags. Run `npm run spec:impact` and note any advisory hits in the PR.
- [x] 3.4 Final verification: `npm run verify:full`.

  Result on Node 24 (2026-10-21): typecheck and lint pass for all projects, and every project test suite passes. The only failure is `reusable-workflows-consumer-fixture:verify`, recorded in 4.3. `format:check` flags only `bff-observability-local/bff-observability-plan.md`, a local file excluded through `.git/info/exclude` and not part of the repository.

## 4. Follow-ups (out of scope, record only)

- [ ] 4.1 Record in the PR description that the dial and banner need DIAL Core 0.49.0 or later for token rows, and link the drafted DIAL Core ticket on the `/limits` double count once it is filed.
- [ ] 4.2 Record the open product question (an informational "this agent: $X" row from `sources.deployment.*CostStats.used`) as a separate issue. Do not implement it here.
- [ ] 4.3 Pre-existing failures on `origin/development`, outside this change's files, were found on 2026-10-21. The two specs are flaky (Nx reports `@epam/ai-dial-catalog:test` and `@epam/ai-dial-conversation-input:test` as flaky tasks, and they pass on retry); the fixture fails consistently. Report them separately and do not fix them here:
  - `libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.prompts.spec.tsx` ("renders the overlay content in the desktop flyout on keyboard open");
  - `libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx` ("announces the no-results label and clears the query on close");
  - `reusable-workflows-consumer-fixture:verify` (AG Grid in an eagerly loaded `ai-dial-catalog` chunk).

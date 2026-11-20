## 1. Queries and contract

- [x] 1.1 Add `UsageBudget`, the budget field constants and the optional `budget` argument to every builder in `apps/chat-api/src/usage-history/queries/usage-history.queries.ts`; verify the existing `usage-history.queries.spec.ts` still passes unchanged
- [x] 1.2 Add `costObject`/`policy` with paired validation to `get-user-usage-history-query.dto.ts`, `budget` and the scope-dependent descriptions to `user-usage-history-response.dto.ts`, and `budget_unsupported` to `usage-history-unavailable-reason.ts`; verify `tsc` for chat-api

## 2. Service

- [x] 2.1 Pass the budget from `user-usage-history.controller.ts` through `usage-history.service.ts` (schema guard, all four queries) and echo it in `usage-history.mapper.ts`; verify `usage-history.service.spec.ts` "budget scope" cases (narrowed filters and `deployment_price`, `budget_unsupported`, guard first, schema 403/502, no echo in user scope)
- [x] 2.2 Cover validation and the end-to-end budget path in `user-usage-history.controller.integration.spec.ts`; verify the suite passes

## 3. Client and docs

- [x] 3.1 Regenerate `libs/chat-api-client` with `npm run openapi`; verify `npm run openapi:check`
- [x] 3.2 Update `apps/chat-api/README.md` "Usage history (DIAL Analytics)" and the `docs/architecture.md` route row; verify `npm run validate:docs` and `npm run validate:specs`
- [ ] 3.3 Check one budget's `month` history against its `month.used` from `GET /user/limits` on the dev stand after Core #2308 is deployed

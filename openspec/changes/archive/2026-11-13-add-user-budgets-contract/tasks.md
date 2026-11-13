Slicing strategy: **contract-first**. The runtime already passes Core's body through, so the work
is to pin that behaviour with tests, publish the contract in Swagger, and then regenerate the
client from it. Each slice is independently verifiable. Only `apps/chat-api` sources are
hand-edited; `libs/chat-api-client` changes come from the generator alone.

## 1. Pin pass-through of `budgets` (regression tests, no source change)

- [x] 1.1 In `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`, add a shared budget-bearing payload. It has two entries with `costObject: 'projA'` (`policy` `org-wide`/`team`, `priority` 1/2), one `projB` entry without `priority`, fractional `used` (e.g. `14.2`, `0.0048335`), a sentinel `day.total` (`9223372036854775807`), and `resetsAt` on both `day` and `month`, plus the existing `deployments` and `dayCostStats`/`monthCostStats`. Add `it.each` over `getUserLimits`/`getUserUsage` (next to the existing `['getUserLimits', '/v1/user/limits']` table) asserting:
  - the result `toEqual`s the SDK payload, budgets in the same order;
  - `budgets: []` comes back as `[]`;
  - a payload without `budgets` comes back `not.toHaveProperty('budgets')`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`
- [x] 1.2 In `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`, add a `USAGE_WITH_BUDGETS` fixture next to `USAGE_WITH_RESETS_AT` with the same coverage as 1.1. Reuse `UNLIMITED_SENTINEL`, and update the fixture header comment. Add `it.each` over `limits`/`usage`, each asserting with supertest:
  - `200`, a body deep-equal to the fixture, and `budgets` order preserved;
  - the `projB` entry has no `priority` key;
  - `deployments` and the top-level `*CostStats` are unchanged;
  - an `{ ...USAGE_WITH_RESETS_AT, budgets: [] }` body keeps `budgets: []`;
  - the legacy `USAGE_WITH_RESETS_AT` body (no `budgets`) has no `budgets` key.
  - **Verification:** `npm run test:file -- apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`

## 2. Publish `budgets` in the Swagger contract

- [x] 2.1 Add a failing OpenAPI contract test `apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts`. Build the document with `UserLimitsController` (a mocked `DeploymentsService`) through `createOpenApiDocument`, following `apps/chat-api/src/openapi/tests/openapi.config.spec.ts`. Assert that:
  - `components.schemas.BudgetStatsDto` exists, and its `required` contains `costObject`, `policy`, `day`, `month` but not `priority`;
  - `priority` has `type: 'integer'`;
  - `day`/`month` `$ref` `LimitStatsDto`;
  - `UserLimitStatsResponseDto.properties.budgets` is an array whose `items` `$ref` `BudgetStatsDto`, and `budgets` is not in that schema's `required`;
  - both `getUserLimits` and `getUserUsage` 200 responses reference `UserLimitStatsResponseDto`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts` (red)
- [x] 2.2 In `apps/chat-api/src/openapi/openapi-response.dto.ts`, add `export class BudgetStatsDto` directly after `LimitStatsDto`, with `@ApiProperty` on every field:
  - `costObject` and `policy` as `string`, with descriptions and examples taken from Core's `BudgetStats` Javadoc;
  - `priority` as `@ApiPropertyOptional({ type: 'integer', description: 'lower first; absent when the policy sets none' })`;
  - `day` and `month` as `@ApiProperty({ type: () => LimitStatsDto, description })`, each naming the current UTC day/month and pointing to `minuteCostStats` for the sentinel.

  It is a response-only class with no `class-validator` decorators, the same as the sibling response DTOs.
  - **Verification:** `npm run test:file -- apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts` (still red until 2.3)
- [x] 2.3 Add `budgets?: BudgetStatsDto[]` to `UserLimitStatsResponseDto` with `@ApiPropertyOptional({ type: () => [BudgetStatsDto], description })`. The description covers:
  - Core's order is preserved, and one cost object may have several entries;
  - the budgets are separate from and not merged into the top-level `*CostStats`;
  - absent (older DIAL Core) differs from `[]` (spending limits off, no matching budget, or API-key caller);
  - a window `total >= 9007199254740992` (2^53) is the `Long.MAX_VALUE` unlimited sentinel.

  Do not change `DeploymentsDetailsService` or `UserLimitsController`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts` (green), then `npm run verify:changed`

## 3. Regenerate the OpenAPI artifact and client

- [x] 3.1 Run `npm run openapi`. It regenerates `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated`; never hand-edit either. Inspect the diff and confirm that:
  - a new `BudgetStatsDto` model is exported from `libs/chat-api-client/src/generated/src/models/index.ts`;
  - `UserLimitStatsResponseDto` has `budgets?: Array<BudgetStatsDto>` with the description as JSDoc;
  - the `getUserLimits`/`getUserUsage` signatures in `libs/chat-api-client/src/generated/src/apis/UserApi.ts` are unchanged apart from the types;
  - no unrelated drift appears. If it does, stop and report it rather than committing it.
  - **Verification:** `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`, `npm exec nx lint chat-api-client`
- [x] 3.2 Confirm the existing `UserLimitStatsResponseDto` consumers compile unchanged: `apps/chat/src/server-api/user-limits.ts` and `libs/chat-hooks/src/usage`. Make no source edits there.
  - **Verification:** `npm run test:file -- apps/chat/src/server-api/tests/user-limits.api.spec.ts`, then `npm run verify:changed`

## 4. Specs and docs

- [x] 4.1 Update the `docs/architecture.md` BFF endpoint rows for `/api/v1/user/limits` and `/api/v1/user/usage` to mention the per-budget `budgets[]` (optional, order-preserving, separate from the global cost figures) in the same commit.
  - **Verification:** `npm run validate:docs`
- [x] 4.2 Run the spec checks for this change's delta (`openspec/changes/add-user-budgets-contract/specs/user-usage-limits-api/spec.md`). Fix any missing path or identifier warning this change introduced.
  - **Verification:** `openspec validate add-user-budgets-contract --strict`, `npm run validate:specs`, `npm run spec:impact`

## 5. Close

- [x] 5.1 Run the full non-mutating verification once.
  - **Verification:** `npm run verify:full`
  - **Result (2026-11-13):** typecheck, lint and format passed. Four test targets failed, none in files this change touches (accepted as unrelated, not re-run on a clean `origin/development`):
    - `attachment-canvas-consumer-fixture:pack-lib` — npm `ETARGET` for `@epam/pdf-highlighter-kit@^0.0.22`;
    - `conversation-input` — two `AddAttachmentButton` tests (that package does not depend on `chat-api-client`);
    - `chat` — `NegativeFeedbackModal.spec.tsx`, which also fails in isolation;
    - `chat-api` — `explicit-environment.spec.ts`, which fails only in the full run (passes in isolation; it likely depends on `process.env` that another test leaves set).

## Follow-ups (out of scope, record only)

- [ ] F.1 Raise the `BudgetStats` optionality in `@epam/ai-dial-typescript-sdk` upstream (the SDK marks every field optional, although Core always serializes `costObject`, `policy`, `day`, `month`). No change in this repo.
- [ ] F.2 The main `user-usage-limits-api` spec's "Known contract divergence" note says the SDK's `CostItemLimitStats` has no `resetsAt`; SDK 0.2.0 now declares `resetsAt?`. Re-check whether the `as unknown as UserLimitStatsResponseDto` cast is still needed in a separate change; do not touch it here.

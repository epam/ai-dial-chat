# Tasks

The slicing is risk-first. The only real unknown is whether the installed `0.3.1`
breaks the chat-api build or tests, so group 1 proves that before anything else is
touched. Groups 2 and 3 depend on group 1's outcome. Commands follow the
`lean-verification` skill. Nx results are run with `--skip-nx-cache`, because a
cached `0.2.1` result would hide a failure.

## 1. Install-and-typecheck spike

- [x] 1.1 Re-check freshness on the current `development` HEAD:
      `apps/chat-api/package.json` still pins `"@epam/ai-dial-typescript-sdk": "0.2.1"`,
      `git grep -n "ai-dial-typescript-sdk" -- '*package.json'` lists no other
      manifest, and no active change under `openspec/changes/` (excluding
      `archive/`) bumps the SDK. **Verify:** if any check fails, stop and report;
      do not continue.
- [x] 1.2 From the repo root, run
      `npm install @epam/ai-dial-typescript-sdk@0.3.1 --save-exact --workspace apps/chat-api`
      (design.md Decision 1). **Verify:** `apps/chat-api/package.json` reads
      `"0.3.1"`, and `git diff --stat` lists only `apps/chat-api/package.json`
      and `package-lock.json`. `git diff package-lock.json` changes only the
      SDK's version, `resolved` and `integrity` in the `apps/chat-api` and
      `node_modules/@epam/ai-dial-typescript-sdk` entries, and
      `node_modules/openapi-fetch` stays `0.17.0`. If unrelated packages move,
      follow design.md "Risks" (restore the lockfile and reinstall from the
      pinned manifest).
- [x] 1.3 Run `npm exec -- nx run-many -t typecheck,test -p chat-api --skip-nx-cache`.
      **Verify:** both targets pass. The dry run in design.md "Pre-planning
      evidence" predicts 0 type errors and no test failures.
- [x] 1.4 Record the spike outcome in design.md "Pre-planning evidence" as a new
      "Spike result" item. If 1.3 passed, write that the installed result
      matches the dry run and mark 2.1 not applicable. If it failed, list each
      error as file : SDK delta (from the contract table) : intended type-level
      fix, and rewrite 2.1 into one task per fix before writing any code. If a
      fix would change a BFF DTO or `libs/chat-api-client/openapi.json`, stop and
      ask the user (design.md Decision 3). **Verify:** design.md states the
      outcome, and tasks.md group 2 matches it.

## 2. Type-level fixes from the spike

- [x] 2.1 (Not applicable — spike clean, see design.md "Spike result".) Apply only the fixes 1.4 recorded, each inside the `apps/chat-api/src`
      file the error names. Use narrowing or a corrected local SDK alias, with no
      DTO, controller or Swagger change and no new casts. If 1.4 found no errors,
      check this off as "not applicable — spike clean". **Verify:**
      `npm run test:file -- <spec next to each fixed file>`. The candidate specs
      are `apps/chat-api/src/common/utils/tests/localized-value.spec.ts`,
      `apps/chat-api/src/common/utils/tests/compose-localized-fields.spec.ts`,
      `apps/chat-api/src/application-schemas/tests/application-schemas.service.spec.ts`,
      `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`,
      `apps/chat-api/src/external-services/tests/external-services.mapper.spec.ts`,
      `apps/chat-api/src/share/utils/tests/share-resource.util.spec.ts` and
      `apps/chat-api/src/dial/tests/dial-client.service.spec.ts`. Then rerun
      `npm exec -- nx run typecheck -p chat-api --skip-nx-cache`.

## 3. Docs

- [x] 3.1 Rewrite the "Known divergence from `@epam/ai-dial-typescript-sdk`" note
      in `libs/chat-api-client/README.md` (design.md Decision 5). It should say
      that the SDK (`0.3.1`, as pinned in `apps/chat-api/package.json`) types
      `CostItemLimitStats.resetsAt` and `ItemLimitStats.resetsAt`; that
      `apps/chat-api/src/deployments/details/deployments-details.service.ts`
      still returns the payload through the
      `as unknown as UserLimitStatsResponseDto` cast; and that the hand-authored
      DTO in `apps/chat-api/src/openapi/openapi-response.dto.ts` stays
      authoritative for the published contract. Prose only: do not touch
      `src/generated/**` or `openapi.json`. **Verify:** `npm run validate:docs`
      passes.
- [x] 3.2 Confirm no other doc needs an edit: `git grep -n "0\.2\.1"` over
      `README.md`, `apps/chat-api/README.md` and `docs/architecture.md` returns
      no SDK citation, and `apps/chat-api/README.md` / `docs/architecture.md`
      still name the package without a version. **Verify:** the grep is empty
      for SDK lines, and no file beyond 3.1 changes.

## 4. Contract and integration checks

- [x] 4.1 Run `npm run openapi && npm run openapi:check`. **Verify:**
      `git status --porcelain libs/chat-api-client` shows no change to
      `openapi.json` or generated sources, so the BFF contract is unchanged and
      no regeneration is needed.
- [x] 4.2 Run `npm exec -- nx run-many -t build,lint -p chat-api --skip-nx-cache`.
      webpack bundles the server with the SDK. **Verify:** both targets pass.
- [x] 4.3 Run `npm run verify:changed`, then `npm run verify:full` exactly once to
      close the change. **Verify:** both pass. The final `git diff --stat`
      touches only `apps/chat-api/package.json`, `package-lock.json`,
      `libs/chat-api-client/README.md`, this change's artifacts, and any file
      2.1 fixed.

## Workflow follow-up

- Out-of-scope follow-up candidates from design.md "Contract deltas" are not
  tracked here: declare `BudgetStats.object` on `BudgetStatsDto`; expose
  external-service `auth_settings.discovery_url` for Core-side dynamic client
  registration; consider the `listDeployments` `fields` param to shrink listing
  payloads. Each one changes the BFF contract and needs its own change.
- Change 02 adopts `createAnalyticsSDK` on top of this pin.
- Archive this change after review (`/opsx:archive`).

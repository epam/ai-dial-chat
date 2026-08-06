## 1. Fix resolveToolsetFolder

- [x] 1.1 In `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, add a `toolset.sharedWithMe` branch to `resolveToolsetFolder` that returns `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]`, placed after computing `segments` and before the existing `public` check.

## 2. Add test coverage

- [x] 2.1 In `apps/chat/src/utils/tests/map-deployment-to-catalog-item.spec.ts`, add tests for a shared, non-public toolset: one with no nested folder (expect `[FolderShared]`, not `[]`) and one with a nested folder (expect `[FolderShared, "team"]`, and assert the raw bucket ID is absent).

## 3. Verify

- [x] 3.1 Run `npm exec nx test chat` to confirm all mapping tests pass.
- [x] 3.2 Run `npm exec nx lint chat` and `npm exec nx build chat` to confirm no regressions.

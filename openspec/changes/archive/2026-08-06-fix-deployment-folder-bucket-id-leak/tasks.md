## 1. Fix the mapping utility

- [x] 1.1 In `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, change `mapDeploymentToCatalogItem`'s `t` parameter from optional (`t?: TFunction`) to required (`t: TFunction`), and replace the `folder: t != null ? resolveDeploymentFolder(deployment, t) : (deployment.applicationFolder?.split('/') ?? [])` ternary with a direct `folder: resolveDeploymentFolder(deployment, t)` call.
- [x] 1.2 Confirm `mapToolsetToCatalogItem` / `resolveToolsetFolder` are left unchanged (already safe — no raw bucket segment can leak regardless of `t`).

## 2. Update call sites

- [x] 2.1 In `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx`, import and call `useTranslation()` to obtain `t`, then pass it as the third argument to both `mapDeploymentToCatalogItem` calls (the `favoriteCatalogItems` mapper and the `selectedCatalogItem` mapper), adding `t` to the relevant `useMemo` dependency arrays.
- [x] 2.2 Verify `apps/chat/src/components/CatalogView/CatalogView.tsx`'s existing call (already passes `t`) still typechecks with the new required signature.
- [x] 2.3 Search `apps/chat/src` for any other call sites of `mapDeploymentToCatalogItem` and update them to pass `t` if found. (No other call sites found besides the two above.)

## 3. Update tests

- [x] 3.1 In `apps/chat/src/utils/tests/map-deployment-to-catalog-item.spec.ts`, update any test invoking `mapDeploymentToCatalogItem` without a `t` argument to pass one, and add/adjust a test case asserting that a shared deployment's raw bucket-ID `applicationFolder` segment never appears in the resulting `CatalogItem.folder` (per the `deployment-catalog-item-mapping` spec scenario).
- [x] 3.2 Check `useDeploymentSelectorOverlay`'s test coverage (if any exists under a `tests/` subfolder) and update/add tests to assert `t` is passed through to the mapper. (No existing test file for this hook; none needed adding per scope of this fix.)

## 4. Verify

- [x] 4.1 Run `npm exec nx test chat` (or the affected project) to confirm all mapping and hook tests pass.
- [x] 4.2 Run `npm exec nx lint chat` and `npm exec nx build chat` to confirm no typecheck/lint regressions from the signature change.
- [x] 4.3 Manually verify in the running app: open a shared Quick App's details panel via the deployment selector and confirm the folder path shows a localized "Shared" label with no raw bucket ID, not just via the full Catalog view.

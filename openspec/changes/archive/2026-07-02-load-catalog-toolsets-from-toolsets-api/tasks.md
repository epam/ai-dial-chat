## 1. Context data loading

- [x] 1.1 In `apps/chat/src/context/DeploymentsContext.tsx`, add `toolsets: DialToolsetDto[]` to `DeploymentsContextType`
- [x] 1.2 Import and call `listToolsets()` from `apps/chat/src/server-api/toolsets.ts` in the provider load flow
- [x] 1.3 Load deployments, application schemas, and toolsets with `Promise.allSettled`
- [x] 1.4 Treat toolset loading failures as non-fatal: log a warning and expose `toolsets: []`
- [x] 1.5 Keep `items` as chat deployments only, loaded via `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`
- [x] 1.6 Enrich backend toolset responses with `isInstalled` from `userConfig.toolsets.installed`
- [x] 1.7 Enrich backend toolset responses with `isMy` from the current session bucket, matching deployments

## 2. Catalog mapping

- [x] 2.1 In `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, add an app-level `mapToolsetToCatalogItem` mapper from `DialToolsetDto` to `CatalogItem`
- [x] 2.2 Ensure the mapper sets `type: CatalogEntityType.Toolset`
- [x] 2.3 Keep generated API DTOs and server-api calls out of `libs/catalog`
- [x] 2.4 Map toolset `isMy` to catalog `isMyApp`
- [x] 2.5 Map installed toolsets to catalog favorite/starred state

## 3. Catalog view integration

- [x] 3.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, read `toolsets` from `useDeployments()`
- [x] 3.2 Build `catalogItems` from deployment catalog items plus toolset catalog items
- [x] 3.3 Add `CatalogEntityType.Toolset` to `titles.tabLabels`
- [x] 3.4 Add the `catalog.tab.toolsets` translation key in `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`
- [x] 3.5 Route toolset favorite toggles to the user-config toolsets installed endpoint

## 4. Tests

- [x] 4.1 Update `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` to mock `listToolsets()`
- [x] 4.2 Add a context test for successful sorted toolset exposure
- [x] 4.3 Add a context test that toolset fetch failure does not fail deployments
- [x] 4.4 Update `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` to assert toolset catalog item inclusion
- [x] 4.5 Update existing `useDeployments()` mocks to include `toolsets: []`
- [x] 4.6 Add backend tests for toolset `isInstalled` / `isMy` enrichment
- [x] 4.7 Add frontend tests for installed toolsets as favorites and toolset favorite routing

## 5. Backend correction

- [x] 5.1 Remove the incorrect custom deployments service filtering that treated MCP toolsets as catalog data
- [x] 5.2 Keep `ToolsetsController` / `listToolsets()` as the catalog toolset source of truth
- [x] 5.3 Filter `.dial_folder` marker toolsets from `ToolsetsService.listToolsets`, matching deployments listing behavior
- [x] 5.4 Update OpenAPI and generated client types for toolset `features`, OAuth `code_challenge`, `isInstalled`, and `isMy`

## 6. Verification

- [x] 6.1 Run `npm exec nx test chat`
- [x] 6.2 Run `npm exec nx lint chat`
- [x] 6.3 Run `npm exec nx test chat-api`
- [x] 6.4 Run `npm exec nx lint chat-api`
- [x] 6.5 Run `npm run openapi:check`

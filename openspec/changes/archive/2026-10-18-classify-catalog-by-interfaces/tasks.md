Slicing strategy: **contract-first, then vertical**. Slice 1 adds the
`catalogTabs` contract to `libs/catalog` with a type-based fallback, so it ships
with zero behavior change. Slice 2 makes `Catalog` and the shared derivations
read it (still no change, nothing sets it yet). Slice 3 makes the mapper set it
and wires the app, which is the first user-visible change. Slice 4 closes docs.

Base: branch from PR #9453 (`fix/9408-hide-non-chat-deployments-in-picker`) or
from `development` after it merges (design D4).

## 1. `CatalogItem.catalogTabs` contract (libs/catalog)

- [x] 1.1 Add `catalogTabs?: readonly CatalogEntityType[]` with an inline JSDoc
  (tabs the item is listed under; defaults to `[type]`) to
  `libs/catalog/src/models/catalog-item.ts`; reword the `type` doc to "Entity
  kind; drives actions and details".
- [x] 1.2 Add `getCatalogItemTabs(item)` to `libs/catalog/src/utils/catalog-tabs.ts`
  (non-empty `catalogTabs`, else `[item.type]`) and export it from
  `libs/catalog/src/index.ts`.
- [x] 1.3 Unit tests in `libs/catalog/src/utils/catalog-tabs.spec.ts`: absent,
  empty and supplied membership (spec `catalog-interface-classification`,
  first requirement).
- [x] 1.4 Architecture guard: `libs/catalog` gains no `interfaces`, DIAL id,
  feature-flag, i18n, or API-client knowledge.

Verification: `npm run test:file -- libs/catalog/src/utils/catalog-tabs.spec.ts`

## 2. Tabs, counts and derivations read membership

- [x] 2.1 `buildCatalogTabs` in `libs/catalog/src/utils/catalog-tabs.ts`: present
  tabs = union of `getCatalogItemTabs` over items; test "tabs are derived from
  membership" in `catalog-tabs.spec.ts`.
- [x] 2.2 `libs/catalog/src/components/Catalog/Catalog.tsx`: `tabFiltered` and
  the per-tab `count` use `getCatalogItemTabs(item).includes(tab)`; Toolbar total
  unchanged.
- [x] 2.3 Tests in `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`:
  a dual item (`catalogTabs: [Agent, Toolset]`) is in both tab grids and both
  counts; an item with `type: Agent, catalogTabs: [Toolset]` is absent from the
  Agents grid; opening the dual item from Toolsets shows the same details as
  from Agents. Query tabs by role `tab` and name, cards by text.
- [x] 2.4 `libs/chat-hooks/src/catalog/catalog-derivations.ts`:
  `deriveAvailableTabIds` uses the membership union;
  `filterCatalogItemsBySelector` keeps an item when membership intersects
  `visibleTypes` and `supportsChat !== false`. Update the JSDoc of both.
- [x] 2.5 Tests in `libs/chat-hooks/src/catalog/tests/catalog-derivations.spec.ts`
  for the three scenarios of the modified "Browse-state derivations"
  requirement (selector omits Toolset-only, keeps dual and no-membership;
  existing `supportsChat` case still passes; available tabs follow membership).
- [x] 2.6 Architecture guard: `libs/chat-hooks` imports `getCatalogItemTabs`
  from `@epam/ai-dial-catalog` only (existing package edge); no new dependency
  in `libs/chat-hooks/package.json`.

Verification:
`npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`,
`npm run test:file -- libs/chat-hooks/src/catalog/tests/catalog-derivations.spec.ts`,
then `npm run verify:changed`.

## 3. Mapper derives membership from interfaces; app wiring

- [x] 3.1 `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`: add
  `isToolsetTabEnabled?: boolean` (default `true`, JSDoc states the default) to
  `MapDeploymentToCatalogItemOptions`; derive `catalogTabs` from
  `deployment.interfaces` per the table in spec
  `catalog-interface-classification` (read `interfaces`, not `features.mcp`;
  omit the field for models, for no `interfaces`, and when no rule matches;
  empty after dropping Toolset → `[Agent]`). Keep `type`, `id`, and the
  one-item-per-deployment contract.
- [x] 3.2 Tests in `libs/chat-hooks/src/catalog/tests/map-deployment-to-catalog-item.spec.ts`
  for every scenario of "Deployment tab membership is derived from DIAL Core
  interfaces" (MCP-only, chat+mcp, custom_ui, no interfaces, flag off ×2).
- [x] 3.3 `apps/chat/src/utils/map-deployment-to-catalog-item.ts`: add
  `isToolsetTabEnabled` to the app wrapper's options and forward it to the lib.
- [x] 3.4 `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`: pass
  `isToolsetTabEnabled: isToolsetsEnabled` to `mapDeploymentToCatalogItem`; add
  `isToolsetsEnabled` to the `catalogItems` memo dependencies.
- [x] 3.5 Tests in `apps/chat/src/hooks/useCatalogItems/tests/useCatalogItems.spec.ts`:
  an MCP-only application gets `catalogTabs: [Toolset]` with toolsets enabled
  and `[Agent]` with them disabled; `availableTabIds` includes Toolset for an
  MCP-only application even with no toolsets loaded.
- [x] 3.6 `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx`
  and `useDeploymentSelectorFieldOverlay.tsx`: pass `isToolsetTabEnabled` from
  the same feature source `CatalogView` uses for `isToolsetsEnabled` (no new
  flag).
- [x] 3.7 `apps/chat/src/components/DeploymentSelector/DeploymentSelectorPanel.tsx`:
  the favorites filter keeps an item when `getCatalogItemTabs(item)` includes
  Model or Agent (memoised as today, before the search query).
- [x] 3.8 Tests in `apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorPanel.spec.tsx`:
  a favorited application with `catalogTabs: [Toolset]` is absent; a favorited
  dual application is present. Query rows by role/name.
- [x] 3.9 Test in `apps/chat/src/components/CatalogView/tests/` (existing
  `CatalogView` spec): an MCP application is listed under the Toolsets tab, and
  favoriting it calls the deployments installed endpoint, not the toolsets one
  (spec `catalog-toolsets`).

Verification:
`npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-to-catalog-item.spec.ts`,
`npm run test:file -- apps/chat/src/hooks/useCatalogItems/tests/useCatalogItems.spec.ts`,
`npm run test:file -- apps/chat/src/components/DeploymentSelector/tests/DeploymentSelectorPanel.spec.tsx`,
the `CatalogView` spec touched in 3.9, then `npm run verify:changed`.

## 4. Docs and close-out

- [x] 4.1 `libs/catalog/README.md`: document `CatalogItem.catalogTabs` and
  `getCatalogItemTabs` (membership vs entity kind, fallback).
- [x] 4.2 `libs/chat-hooks/README.md`: document the `isToolsetTabEnabled` mapper
  option and the interfaces → tabs rule; update the `filterCatalogItemsBySelector`
  description.
- [x] 4.3 `docs/architecture.md`: update only if it describes how catalog tabs
  are derived from `type`; otherwise no change.
- [x] 4.4 `npm run validate:docs` and `npm run validate:specs`.
- [x] 4.5 `npm run verify:full` once.

## 5. Follow-ups (out of scope, record only)

- [ ] 5.1 Product decision: show an MCP application in Toolsets with a tools list
  (map Core `mcp.allowedTools` in the backend) and a toolset-styled badge.
- [ ] 5.2 Product decision: make custom-UI-only applications selectable in the
  "Talk to" picker (drop the `supportsChat` check from
  `filterCatalogItemsBySelector`).

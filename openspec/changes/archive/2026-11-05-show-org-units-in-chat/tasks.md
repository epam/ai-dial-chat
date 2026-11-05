Slicing strategy: **contract-first, then vertical**. Slice 1 fixes the BFF contract and the generated client. Slice 2 lands the pure helpers and the hook. Slices 3 and 4 each bring one surface end to end. Each slice is independently verifiable, and the UI slices depend on slices 1 and 2.

## 1. BFF endpoint `GET /api/v1/org-units` (contract)

- [x] 1.1 Read `apps/chat-api/AGENTS.md` and mirror `apps/chat-api/src/application-schemas/`. Create `apps/chat-api/src/org-units/dto/org-unit.dto.ts` with the `OrgUnitDto` and `OrgUnitsResponseDto` classes, using `@ApiProperty` on every field and the examples from the spec.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts` (after 1.2)
- [x] 1.2 Create `apps/chat-api/src/org-units/org-units.service.ts`. `listOrgUnits(userSub, accessToken)` uses `withCachedDialRequest` (key `org-units:list:<sub>`, TTL 60 s) and calls `dialClient.client.getOrgUnit('public', { params: { query: { recursive: true } }, headers: getBearerAuthHeaders(at) })`. Core 404 → `{ enabled: false, units: [] }`; other errors go through `mapDialHttpStatus`. It flattens `items`, falls back from `displayName` to `name`, and drops malformed items with a `warn`.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts`
- [x] 1.3 Create `apps/chat-api/src/org-units/org-units.controller.ts` (`@ApiTags('org-units')`, `@Controller({ path: 'org-units', version: '1' })`, handler `listOrgUnits`, `@ApiDialCoreErrors()`, `@ApiResponse` for 200/401/403/502/503) and `org-units.module.ts`, and register it in `apps/chat-api/src/app/app.module.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.controller.spec.ts`
- [x] 1.4 Unit tests in `apps/chat-api/src/org-units/tests/org-units.service.spec.ts`:
  - happy path flattening;
  - `displayName` fallback;
  - malformed item dropped;
  - Core 404 → disabled (and cached);
  - 401/403/500/timeout mapping;
  - cache hit;
  - per-user key;
  - errors not cached.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts`
- [x] 1.5 Supertest integration test `apps/chat-api/src/org-units/tests/org-units.controller.integration.spec.ts`, modelled on `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`. Cases: 200 body shape, 200 `enabled:false` on Core 404, 401 without a session, 502 on Core 500, 503 on Core unavailable.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.controller.integration.spec.ts`
- [x] 1.6 Run `npm run openapi` and `npm run openapi:check`. Confirm `listOrgUnits` and both DTOs appear in `libs/chat-api-client/openapi.json` with strong types, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit generated files.
- [x] 1.7 Add an `orgUnitsApi = new OrgUnitsApi(config)` singleton to `apps/chat/src/server-api/api-client.ts`, and add `apps/chat/src/server-api/org-units.api.ts` exporting `listOrgUnits()`, which calls `orgUnitsApi.listOrgUnits()` (normal method, not `Raw`), with a test in `apps/chat/src/server-api/tests/`.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/org-units.api.spec.ts`
- [x] 1.8 Slice check: `npm run verify:changed`.

## 2. Shared helpers, hook and app context

- [x] 2.1 In `libs/chat-shared`, add the `OrgUnit` type and the pure `normalizeOrgUnitFolder`, `toOrgUnitFolderSet` and `isOrgUnitFolder` (type in `libs/chat-shared/src/models/org-unit.ts`, helpers in `libs/chat-shared/src/utils/org-unit.ts`), export them from the package entry, and add JSDoc.
  - Verification: `npm run test:file -- libs/chat-shared/src/utils/tests/org-unit.spec.ts`
- [x] 2.2 Unit tests for 2.1:
  - encoded vs decoded match;
  - leading `public/` stripped;
  - trailing slash optional;
  - subfolder not a unit;
  - `Risk/` vs `Risk2/`;
  - malformed `%` escape kept raw.
  - Verification: `npm run test:file -- libs/chat-shared/src/utils/tests/org-unit.spec.ts`
- [x] 2.3 In `libs/chat-hooks`, add the string enum `OrgUnitsStatus` and `useOrgUnits({ listOrgUnits })` (`libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`): load-once `ensureUnits`, a cancelled flag, memoised `unitFolders`, and a `useCallback` `isOrgUnitFolder`. Export both from `libs/chat-hooks/src/index.ts` and the `./utils` entry point (`libs/chat-hooks/src/entry-points/utils.ts`).
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/useOrgUnits/tests/useOrgUnits.spec.ts`
- [x] 2.4 Unit tests for 2.3:
  - single load across repeated `ensureUnits`;
  - `Idle → Loading → Ready`;
  - `enabled:false` → `Disabled`;
  - rejection → `Error` with no throw;
  - no state update after unmount;
  - `isOrgUnitFolder` is false before `Ready`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/useOrgUnits/tests/useOrgUnits.spec.ts`
- [x] 2.5 Architecture guard for 2.1–2.4: confirm `libs/chat-shared` and `libs/chat-hooks` contain no `/api` path, no `@epam/ai-dial-chat-api-client` import in `chat-shared`, no client construction, no app context, no i18n, and no env or feature-flag access. Run `npm exec nx lint chat-shared` and `npm exec nx lint chat-hooks`, whose module-boundary rules enforce this.
- [x] 2.6 Create `apps/chat/src/context/OrgUnitsContext.tsx` (ThemeContext pattern): `OrgUnitsProvider` wraps `useOrgUnits({ listOrgUnits })`, the value is `useMemo`'d, and `useOrgUnitsContext()` throws outside the provider. Mount it in `apps/chat/src/AppRoot.tsx` with no fetch on mount.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/OrgUnitsContext.spec.tsx`
- [x] 2.7 Tests for 2.6: no request until `ensureUnits`, two consumers trigger one request, and the guard hook throws outside the provider.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/OrgUnitsContext.spec.tsx`
- [x] 2.8 Slice check: `npm run verify:changed`.

## 3. File manager: unit icon in the Organization source

- [x] 3.1 Pin the path conversion first. Add the pure `toOrganizationPublicPath(virtualPath, organizationRootLabel)` to `libs/chat-hooks/src/org-units/org-unit-path.ts` (exported from `index.ts` and `./utils`). It maps a row under the Organization root (its own tab, or its section of the All tab) to its public-bucket path, and returns `undefined` for other roots and for the root itself.
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/tests/org-unit-path.spec.ts`
- [x] 3.2 `libs/chat-shared`:
  - add the presentational `OrgUnitFolderIcon` (`libs/chat-shared/src/components/OrgUnitFolderIcon/`). It wraps `IconSitemap` (`DIAL_ICON_SIZE.MD`, `stroke={DIAL_KIT_ICON_STROKE}`) in `role="img"` with `aria-label` and `title` set to `label` (default `Organization unit`), and the colour comes from `--oufi-icon`;
  - give `DialFileManagerShell` the optional `isOrgUnitFolder?: (item: DialFile) => boolean` prop and `DialFileManagerShellLabels` the optional `orgUnit` field;
  - add a `useCallback` `getItemIcon` that returns the icon for matching folders, passed into both the `gridOptions` and `treeOptions` memos;
  - forward the prop from `FileManagerAttachModal`.
  - Verification: `npm run test:file -- libs/chat-shared/src/components/OrgUnitFolderIcon/tests/OrgUnitFolderIcon.spec.tsx libs/chat-shared/src/file-manager/DialFileManagerShell/tests/DialFileManagerShell.org-units.spec.tsx`
- [x] 3.3 Colour: add an `orgUnitIcon` field to `DialFileManagerShellColors` (`libs/chat-shared/src/file-manager/shell-styles.ts`), forwarded to `OrgUnitFolderIcon`'s `colors.icon`. That component's `.module.scss` reads it as `var(--oufi-icon, var(--text-secondary, #57647a))`. No Tailwind colour class in JSX.
- [x] 3.4 Component tests for 3.2:
  - a unit folder shows an image named `Organization unit` in the tree and grid;
  - a plain folder and a file show none;
  - with no `isOrgUnitFolder` nothing is marked;
  - the host label is the icon's name.
  - Verification: `npm run test:file -- libs/chat-shared/src/file-manager/DialFileManagerShell/tests/DialFileManagerShell.org-units.spec.tsx`
- [x] 3.5 Wire it through the app hook `apps/chat/src/hooks/files/useOrgUnitFolderPredicate.ts`. It reads `useOrgUnitsContext()`, calls `ensureUnits()` in an effect, and returns a memoised `(item) => boolean` built on 3.1. `DialFileManagerPage` and `DialFileManagerModal` call it with their Organization root label and pass `labels.orgUnit = t(DialFileManagerI18nKeys.OrgUnit)`. (`useDialFileManagerHostOptions` only builds `useDialFileManager` options, so the predicate does not live there.)
  - Verification: `npm run test:file -- apps/chat/src/hooks/files/tests/useOrgUnitFolderPredicate.spec.ts`
- [x] 3.6 Host tests: only the unit folder under the Organization root gets the unit icon, the same folder name in My files does not, and when the context matches nothing there is no icon.
  - Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx`
- [x] 3.7 Slice check: `npm run verify:changed`.

## 4. Publish panel: unit icon in the destination tree

- [x] 4.1 `libs/publish-panel`, `PublishFoldersTree`:
  - add the optional `isOrgUnitFolder?: (folderPath: string[], rootKey?: string) => boolean` prop (`rootKey` is set in multi-root mode only) and the optional `orgUnitLabel` (in `libs/publish-panel/src/models/publish-folders-tree.ts`, English default);
  - give `DialFoldersTree` a `useCallback` `getItemIcon` that maps `file.path` back with `fromFolderPathKey`, plus `fromRootedPath` in multi-root mode, and renders `OrgUnitFolderIcon` from `@epam/ai-dial-chat-shared`;
  - forward `isOrgUnitFolder` and the label from `PublishPanel` (`PublishPanelLabels.orgUnitLabel`), `StandalonePublishPanel` and `SaveToFolderPanel` (`SaveToFolderPanelBaseProps.isOrgUnitFolder(folderPath, rootKey)`, `SaveToFolderPanelLabels.orgUnitLabel`).
  - Verification: `npm run test:file -- libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`
- [x] 4.2 Colour: add `orgUnitIcon` to `PublishFoldersTreeColors`, forwarded to `OrgUnitFolderIcon`'s `colors.icon` (its `--oufi-icon` var has a fallback).
- [x] 4.3 Component tests for 4.1:
  - a unit folder shows an image named with the host label;
  - plain folders and the bucket root show none;
  - with no predicate nothing is marked;
  - multi-root mode passes the root key and the path inside it;
  - the RTL case.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`
- [x] 4.4 Architecture guard: `libs/publish-panel` and `libs/catalog` receive only the predicate and the label, with no client, `/api` path, context or i18n import.
- [x] 4.5 Wire it through the app hook `apps/chat/src/hooks/publish/useOrgUnitDestinationPredicate.ts`, which calls `ensureUnits()` when the panel opens and returns the single-root and multi-root (`SaveDestinationRoot.Organization`) predicates. It is used by:
  - `PublishConversationPanelContainer` and `PublishProjectPanelContainer` (`isOrgUnitFolder`);
  - `ResourceSavePanelContainer` (`isOrgUnitFolder` in root);
  - `CatalogView`, through a new `isPublishOrgUnitFolder` prop that `libs/catalog` threads `Catalog` → `DetailsPanel` → `PublishPanel`. The catalog owns its panel's open state, so the read starts with the catalog.

  The label comes from `getPublishPanelCommonLabels` (`orgUnitLabel`) in `apps/chat/src/utils/publish.ts`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/publish/tests/useOrgUnitDestinationPredicate.spec.ts apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx`
- [x] 4.6 Slice check: `npm run verify:changed`.

## 5. i18n, RTL and accessibility

- [x] 5.1 Add the key `dialFileManager.orgUnit` = `Organization unit` to `apps/chat/src/i18n/locales/en.json`, and `OrgUnit = 'dialFileManager.orgUnit'` to `apps/chat/src/constants/translation-keys.ts`.
- [x] 5.2 RTL check (`.claude/rules/rtl.md`): confirm the unit icon is not mirrored, sits at the row start in both trees and the grid, and adds no physical spacing classes. Add an `dir="rtl"` assertion in the shell and publish-tree tests from 3.4 and 4.3.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`
- [x] 5.3 A11y check (`.claude/rules/a11y.md`): confirm the unit icon exposes `role="img"` with the label, and that keyboard navigation and focus order of both trees are unchanged.

## 6. Docs and close-out

- [x] 6.1 Update the READMEs:
  - `libs/chat-shared/README.md`: org-unit helpers, the shell's `isOrgUnitFolder`, the `orgUnit` label and colour;
  - `libs/chat-hooks/README.md`: `useOrgUnits` and `OrgUnitsStatus`;
  - `libs/publish-panel/README.md`: `isOrgUnitFolder` and `orgUnitLabel` on `PublishFoldersTree` / `PublishPanel` / `SaveToFolderPanel`.
- [x] 6.2 Update `docs/architecture.md`: the `org-units/` backend domain, the `/api/v1/org-units` route row and `OrgUnitsContext` in the context list.
- [x] 6.3 Run `npm run validate:docs` and `npm run validate:specs`.
- [x] 6.4 Final: `npm run verify:full` once, and `npm run build:quiet`, because a new provider and lib entry exports affect bundling.

## 7. Follow-ups (out of scope, record only)

- [ ] 7.1 Open a follow-up issue for unit permissions via `GET /v1/user/role-assignments` once `@epam/ai-dial-typescript-sdk` exposes `getUserRoleAssignments`.
- [ ] 7.2 Open a follow-up issue on whether to show `displayName` as the row label in the Organization tab and the publish tree.

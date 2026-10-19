Slicing strategy: **vertical, renderer-first**. Slice 1 makes the catalog lib render divider/header rows correctly; on its own it changes nothing visible, because no host sends those rows yet. Slice 2 makes the hook emit the sections and wires the host label end to end. Slice 3 updates docs and specs.

## 1. Catalog lib renders section rows (`libs/catalog`)

- [x] 1.1 In `libs/catalog/src/utils/create-menu.tsx`, make `highlightDropdownLabels` return `DropdownItemType.Divider` and `DropdownItemType.PlainText` items unchanged (no `Highlight` wrapping) and keep recursing into `children` for items only.
- [x] 1.2 In `libs/catalog/src/components/Catalog/CreateMenuSheet.tsx`, replace the `PlainText` filter with per-type rendering: `Divider` → `<div role="separator">` with the kit separator border token and logical margins; `PlainText` → a non-interactive caption (`px-3 py-2 text-secondary dial-caption-text`); every other item → the existing `MenuItem role="menuitem"`. Keep the `items.length ? … : noResults` branch as it is.
- [x] 1.3 Tests in `libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx`: with `search`, a divider renders as `separator`; the header is visible, is not a `menuitem`, and has no `mark` while matching options do. Without `search` (the `ButtonDropdown` path), a divider and header passed in `options` still render as `separator` and caption. If they don't, apply the fallback recorded in design.md (render that path through `Dropdown`) and test it.
- [x] 1.4 Tests in `libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx`: the sheet shows `separator` and the caption between options; the caption is not a `menuitem`; tapping it does not close the sheet; the Skill drill-in page shows only its two children.
- [x] 1.5 Architecture guard: confirm the `libs/catalog` diff adds no i18n import, route, feature flag, `/api` path, or `@epam/ai-dial-chat-api-client` import, and that the default labels stay plain English props.

Verification:
- `npm run test:file -- libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx`
- `npm run test:file -- libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx`
- `npm run verify:changed` once slice 1 is complete

## 2. Hook emits sections, and the host supplies the header label

- [x] 2.1 Add the i18n key `catalog.create.runners` = "Runners" to `apps/chat/src/i18n/locales/en.json`, under `catalog.create`.
- [x] 2.2 Add `CreateRunners = 'catalog.create.runners'` to `CatalogI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 2.3 In `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts`, add a required `createRunners: string` to `CatalogEditNavigationLabels` with JSDoc ("Header of the Create menu's runner section").
- [x] 2.4 In the same file, rebuild `createOptions` as two sections (design D1–D4). The entity section is `sortByLabel` over toolset, skill group, and prompt. The runner section is `sortByLabel` over custom-app and runners. When both are non-empty, insert `{ key: 'create-sections-divider', type: DropdownItemType.Divider }` and `{ key: 'runners-header', type: DropdownItemType.PlainText, label: labels.createRunners }` between them. Update the `createOptions` JSDoc on `UseCatalogEditNavigationResult`. Leave `createMenuByType` and `createSearch` unchanged.
- [x] 2.5 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, add `createRunners: t(CatalogI18nKeys.CreateRunners)` to `catalogEditNavigationLabels`.
- [x] 2.6 Unit tests in `libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`. Replace the "interleave alphabetically" expectation with the sectioned order from the `catalog-create-app` delta scenario. Add cases for: only runners after search → no divider/header; `HideCustomAppCreation` → no divider/header; query "upload" → only the skill group; no match → `[]`; `createMenuByType` unchanged (Agents still custom-app + runners by label, with no divider).
- [x] 2.7 Update every other test fixture that builds `CatalogEditNavigationLabels` so the required `createRunners` type-checks (find them with `rg "createSkillUpload" --glob "*.spec.*"`).
- [x] 2.8 Architecture guard for `libs/chat-hooks`: the header text arrives only through `labels`; the hook imports no i18n, routing, or app module.

Verification:
- `npm run test:file -- libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`
- `npm exec nx run chat-hooks:typecheck` and `npm exec nx run chat:typecheck`
- `npm run verify:changed` once slice 2 is complete

## 3. RTL and accessibility check

- [x] 3.1 Confirm the divider and caption added in 1.2 use logical classes only (no `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`) and carry no icon to mirror. Confirm the header keeps at least 7:1 contrast through the existing `text-secondary` token, with no hex fallback added.

Verification:
- `npm run test:file -- libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx`

## 4. Docs and specs

- [x] 4.1 `libs/chat-hooks/README.md`: update the `createOptions` row (sectioned order instead of "sorted together alphabetically") and add `createRunners: t('catalog.create.runners')` to the `CatalogEditNavigationLabels` example.
- [x] 4.2 `libs/catalog/README.md`: if it describes how `CreateButton` / `CreateMenuSheet` handles option types, mention divider and plain-text section rows. Otherwise leave it unchanged.
- [x] 4.3 Run `npm run validate:docs` and `npm run validate:specs`, and fix any reported drift.

Verification:
- `npm run validate:docs`
- `npm run validate:specs`

## 5. Close

- [ ] 5.1 Run `npm run verify:full` once.

## Follow-ups (out of scope)

- [ ] F.1 Separate "platform" runners from other registered schemas (config allowlist in `apps/chat-api` or a DIAL Core schema type field). Track as a new issue if the sectioned menu is still not enough.

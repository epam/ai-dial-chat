## 1. Tools tab search and count

- [x] 1.1 Extend `ToolsLabels` (`libs/catalog/src/models/item-details-data.ts`) with `searchPlaceholder`, `searchClearLabel`, `toolCount`, `noResults`.
- [x] 1.2 In `Tools.tsx`, add the `Search` field, the polite count, the filter (design D2) and the no-results `PanelEmptyState`; add `countClassName` and the `.count` style on `--cat-tools-count-text`.
- [x] 1.3 Add `toolsSearchPlaceholder`, `toolsSearchClearLabel`, `toolsCountLabel`, `toolsNoResultsLabel` to `ItemDetailsTexts` and `toolsCountText` to `ItemDetailsColors`; forward them from `DetailsPanel`.
- [x] 1.4 Tests: `Tools.spec.tsx` (count, filter by name/description, no results, host labels); `DetailsPanel.spec.tsx` (texts forwarded to the tab).

## 2. Chat app and docs

- [x] 2.1 `CatalogView` passes the translated strings; add `catalog.details.toolCount_one` / `_other` to `en.json` and `CatalogI18nKeys.DetailsToolCount`.
- [x] 2.2 Document the labels in `libs/catalog/README.md`.
- [x] 2.3 Verify: catalog tests, type-check, lint, `npm run validate:docs`, `npm run validate:specs`.

## Why

Publish UI (`PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`, `usePublishFlow`, and supporting utils/models) lives entirely inside `libs/catalog`, but it has two independent consumers: catalog's own `DetailsPanel` (`libs/catalog/src/components/Details/DetailsPanel.tsx:323-342`) and `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx:1-6`, which imports `StandalonePublishPanel`, `usePublishFlow`, and publish types from `@epam/ai-dial-catalog` purely for reusable publish UX — conversation publish has no relationship to catalog browsing. This forces conversation code to depend on an unrelated, larger library and blurs `libs/catalog`'s purpose (marketplace browsing) with a generic, already-reusable publish flow. The coupling is shallow: of the ~9 extractable files, only `PublishPanel.tsx` and `StandalonePublishPanel.tsx` reference `CatalogItem` (`libs/catalog/src/models/catalog-item.ts`), and only to optionally render `EntityHeader` + a version tag — `PublishConversationPanelContainer.tsx` already proves the whole flow works today using only the catalog-agnostic `PublishResourceSummary` path, with zero `CatalogItem`/`EntityHeader` usage.

## What Changes

- Create a new publishable library, `libs/publish-panel` (`@epam/ai-dial-publish-panel`), scaffolded after `libs/conversation-input` (React + `.tsx`, Vite lib build, `dts()`, `nx.tags: ["publishable"]`).
- Move into the new lib, unchanged in behavior:
  - Components: `PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`
  - Hook/utils: `usePublishFlow`, `derivePublishState`, `publish-folder-tree` helpers (`filterFolderTree`, `collectFolderKeys`, `toFolderPathKey`, `fromFolderPathKey`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName`, `getSiblingFolderNames`), `formatPublishedDate`
  - Models: `PublishFolderNode`, `PublishHistoryEntry`, `PublishResourceSummary`, `PublishCalloutKind`, `PublishDerivationInput`, `PublishDerivedState`, `PublishFlowItem`, `UsePublishFlowOptions`, `UsePublishFlowResult`, all `*Texts`/`*Props` interfaces
  - Co-located tests, moved without behavior changes
- **BREAKING (internal only, lib is private/unpublished)**: `PublishPanel` and `StandalonePublishPanel` drop their `item?: CatalogItem` prop entirely. Callers that need an entity-style header (version tag, entity summary) pass a `renderSummary?: () => ReactNode` slot instead; `DetailsPanel` (or a thin catalog-side wrapper) supplies `EntityHeader` through that slot. The `resource?: PublishResourceSummary` path is unchanged.
- `usePublishFlow`'s generic default flips from `<TItem extends PublishFlowItem = CatalogItem>` to `<TItem extends PublishFlowItem = PublishFlowItem>` — no consumer-visible change since the constraint (`version?: string`) was already all that mattered.
- Update `PublishConversationPanelContainer.tsx` to import from `@epam/ai-dial-publish-panel` instead of `@epam/ai-dial-catalog`.
- Update `DetailsPanel.tsx` to import from `@epam/ai-dial-publish-panel` and supply its `EntityHeader`/version-tag rendering via the new slot prop instead of passing `item`.
- Remove the publish-related re-exports from `libs/catalog/src/index.ts` (lines 54-149 per current file) — no deprecated re-export shim, since the lib is private/unpublished and all in-repo call sites are updated in this same change.
- Register `@epam/ai-dial-publish-panel/*` in `tsconfig.base.json` `compilerOptions.paths`, following the existing pattern.
- Update `openspec/specs/catalog-publish-flow/spec.md` and `openspec/specs/conversation-publish-flow/spec.md` to reflect the new component/hook ownership (implementation detail only — no user-visible requirement changes).

Out of scope: backend publish API/endpoints, GH #7897 (conversation publish history fetch), moving `usePublishFolders` (server-api-dependent, stays in `apps/chat`), refactoring `DetailsPanel`'s non-publish sub-views, new feature flags, and adding i18n inside the new lib (it continues to receive strings via props with English defaults, as `libs/catalog` does today).

## Capabilities

### New Capabilities

- `publish-panel-library`: Package surface, public exports, build/publish wiring, and library-isolation contract for the new `@epam/ai-dial-publish-panel` lib (no `CatalogItem`, no i18n, no server-api, no app contexts).

### Modified Capabilities

- `catalog-publish-flow`: Component/hook ownership moves to `@epam/ai-dial-publish-panel`; `DetailsPanel` supplies the entity summary (version tag, `EntityHeader`) via a render-slot instead of an `item: CatalogItem` prop. User-visible folder/search/history/submit behavior is unchanged.
- `conversation-publish-flow`: Import source for `StandalonePublishPanel`/`usePublishFlow`/publish types moves from `@epam/ai-dial-catalog` to `@epam/ai-dial-publish-panel`. No behavior change.

## Impact

- **New**: `libs/publish-panel/**` (package.json, vite.config.mts, tsconfig*.json, eslint.config.mjs, src/index.ts, moved components/utils/models/tests, README.md)
- **Modified**: `libs/catalog/src/index.ts` (remove publish re-exports), `libs/catalog/src/components/Details/DetailsPanel.tsx` (switch import source, replace `item` prop with summary slot), `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` (switch import source), `tsconfig.base.json` (new path alias)
- **Removed**: `libs/catalog/src/components/PublishPanel/`, `libs/catalog/src/components/PublishFoldersTree/`, `libs/catalog/src/components/PublishHistoryList/`, `libs/catalog/src/utils/use-publish-flow.ts`, `publish-state.ts`, `publish-folder-tree.ts`, `format-published-date.ts`, `libs/catalog/src/models/publish.ts` (all moved, not duplicated)
- **Unaffected**: backend publish endpoints, `usePublishFolders.ts` (only its `PublishFolderNode` import source changes), `CatalogView.tsx` wiring shape (props passed to `Catalog`/`DetailsPanel` are unchanged in name/shape)
- **Verification**: `npm exec nx affected --target=test,lint,build --base=origin/development-1.0` must pass for `catalog`, `chat`, and the new `publish-panel` project

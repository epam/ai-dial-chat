## Context

`libs/catalog` currently owns the whole publish UX: `PublishPanel.tsx`, `StandalonePublishPanel.tsx`, `PublishFooter.tsx`, `PublishFoldersTree.tsx`, `PublishHistoryList.tsx`, `use-publish-flow.ts`, `publish-state.ts`, `publish-folder-tree.ts`, `format-published-date.ts`, and `models/publish.ts`. Of these, only `PublishPanel.tsx` (lines 9, 68, 201-213) and `StandalonePublishPanel.tsx` (lines 4, 30) reference the catalog-specific `CatalogItem` model, and `use-publish-flow.ts` uses it only as a generic default (`<TItem extends PublishFlowItem = CatalogItem>`), not as a hard constraint. `PublishConversationPanelContainer.tsx` already exercises the entire flow today using only `PublishResourceSummary` — it never touches `CatalogItem` or `EntityHeader` — proving the coupling is incidental, not structural.

`DetailsPanel.tsx` (catalog's consumer) renders `<PublishPanel item={item} ... />` (lines 323-342) where `item: CatalogItem`, and `PublishPanel` internally branches: if `item` is set, render `EntityHeader` (catalog-internal, not part of `index.ts`'s barrel) + a version tag; if `resource` is set, render a title-only summary. This is the one seam to design around.

Two existing libs, `libs/conversation-input` (`@epam/ai-dial-conversation-input`) and `libs/chat-overlay` (`@epam/ai-dial-chat-overlay`), are the established scaffold pattern for new Vite-built, `nx.tags: ["publishable"]` libraries with `package.json`-embedded Nx targets (no separate `project.json`). `conversation-input` is the closer model since it ships `.tsx` components and needs the `react()` Vite plugin and `resolve.alias` entries for sibling-lib dev resolution, matching what `publish-panel` will need for `@epam/ai-dial-ui-kit`, `@epam/ai-dial-kit`, `@epam/ai-dial-sidebar`, and `@epam/ai-dial-chat-shared`.

The repo's actual `@nx/enforce-module-boundaries` config uses a single wildcard constraint (`sourceTag: '*' → onlyDependOnLibsWithTags: ['*']`) — there is no `type:ui`/`scope:*` tag enforcement in this codebase today, despite the general architecture note. The only tag in active use is `"publishable"`, which only gates the Nx `publish` target. This design follows the codebase's actual convention (match `conversation-input`/`chat-overlay`/`catalog`), not the aspirational architecture note.

## Goals / Non-Goals

**Goals:**

- Move all nine files (and their tests) to a new `libs/publish-panel` with zero behavior change for both existing consumers.
- Eliminate `PublishPanel`'s and `StandalonePublishPanel`'s dependency on `CatalogItem`/`EntityHeader` so the new lib only knows `PublishResourceSummary` and primitive props.
- Give `DetailsPanel` an equivalent way to render its entity header + version tag without the lib importing catalog models.
- Keep `apps/chat`'s prop contracts with `Catalog`/`DetailsPanel` (names/shapes passed from `CatalogView.tsx`) unchanged, since none of that wiring is server-api-dependent in a way this change should touch.

**Non-Goals:**

- Changing backend publish endpoints or history-fetch behavior (GH #7897 stays open, separate change).
- Moving `usePublishFolders.ts` into the new lib — it depends on `listPublicFiles` (server-api) and `@epam/chat-api-client`, which violates library isolation.
- Introducing `type:ui`/`scope:*` Nx tags or changing the module-boundary lint config — out of scope and not required by the repo's actual enforcement.
- Adding i18n inside the new lib — it keeps receiving strings via `*Texts` props with English defaults, as `libs/catalog` does today.
- Publishing the new lib externally — it stays `private: true`, matching `conversation-input`/`chat-overlay`/`catalog`.

## Decisions

### 1. Library name and scaffold

**Decision**: `libs/publish-panel` → `@epam/ai-dial-publish-panel`, scaffolded from `libs/conversation-input` (package.json field order, `vite.config.mts` with `react()` + `dts()` + `resolve.alias` for cross-lib dev source resolution, `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json` triad, `eslint.config.mjs` spreading root config + `@nx/dependency-checks`).

**Alternatives considered**:
- `@epam/ai-dial-publish` (shorter) — rejected: less discoverable next to `@epam/ai-dial-catalog`'s existing `Publish*` symbol names; `publish-panel` matches the primary exported component name (`PublishPanel`) and avoids ambiguity with a hypothetical future "publish workflow" backend-facing package.
- Scaffold from `libs/chat-overlay` — rejected: `chat-overlay` has no `react()` Vite plugin / JSX handling and only one peer dep; `publish-panel` needs multiple sibling-lib source aliases (`ai-dial-ui-kit`, `ai-dial-kit`, `ai-dial-sidebar`, `ai-dial-chat-shared`), which `conversation-input` already models correctly.

### 2. Decoupling `CatalogItem`/`EntityHeader` from `PublishPanel`

**Decision**: Replace the `item?: CatalogItem` prop with an optional `renderSummary?: () => ReactNode` slot. When provided, `PublishPanel` renders the slot's output in place of the current `EntityHeader` + version-tag block; when absent, it falls back to the existing `resource?: PublishResourceSummary` title-only rendering. `StandalonePublishPanel` forwards the same slot prop through unchanged. `DetailsPanel` (in `libs/catalog`) becomes the sole owner of "how a `CatalogItem` renders as a publish summary" — it passes `renderSummary={() => <EntityHeader item={item} /* + version tag */ />}` into the now-imported-from-`@epam/ai-dial-publish-panel` `PublishPanel`.

**Alternatives considered**:
- *Catalog re-exports the publish lib plus a wrapper component* (e.g. `libs/catalog` exports `CatalogPublishPanel` that wraps the shared `PublishPanel` and maps `CatalogItem` → summary internally) — rejected as the primary approach because it adds an extra indirection layer for a single call site (`DetailsPanel.tsx`) with no other consumer; a slot prop is simpler and keeps the mapping visible exactly where the entity model is used. Documented here as the fallback if a future third consumer needs the same `CatalogItem`-aware wrapper (at that point, promoting the slot usage into a small `libs/catalog`-local wrapper component becomes worth the indirection).
- *Pass `PublishResourceSummary` with an added optional `versionTag?: string` field, no slot* — rejected: still requires the lib to know about "version tags" as a first-class concept and doesn't generalize if `DetailsPanel` ever needs a richer header (icon, badge, tooltip); a render-slot is strictly more flexible and keeps `PublishResourceSummary` minimal (title-only, as `conversation-publish-flow` spec already documents).
- *Keep `CatalogItem` in the lib, just move `EntityHeader` into it too* — rejected: perpetuates the exact coupling this change removes and pulls a catalog-domain component (entity metadata rendering) into a lib whose only job is the publish workflow shell.

### 3. `usePublishFlow` generic default

**Decision**: Change `<TItem extends PublishFlowItem = CatalogItem>` to `<TItem extends PublishFlowItem = PublishFlowItem>`. `DetailsPanel` explicitly instantiates `usePublishFlow<CatalogItem>({...})` after the move (it already imports `CatalogItem` locally), so the default only matters for call sites that don't specify a type argument — none do today outside the hook's own default.

**Alternatives considered**: keeping `CatalogItem` as the default via a re-import from `@epam/ai-dial-catalog` inside the new lib — rejected outright, reintroduces the exact dependency being removed.

### 4. Backward compatibility / re-exports from `libs/catalog`

**Decision**: No deprecated re-export shim. Remove the publish-related exports from `libs/catalog/src/index.ts` (current lines 54-149) in the same change that switches both consumers (`DetailsPanel.tsx`, `PublishConversationPanelContainer.tsx`) to `@epam/ai-dial-publish-panel`. The lib is private/unpublished (`private: true` in every lib's `package.json`), so there is no external npm consumer to protect, and both in-repo call sites are known and get updated as part of this change's tasks.

**Alternatives considered**: temporary `export * from '@epam/ai-dial-publish-panel'` re-exports in `libs/catalog/src/index.ts` marked `@deprecated` — rejected: adds a second import path for the same symbols with no real consumer benefit (no external package boundary to preserve), and risks the re-export silently outliving its usefulness since nothing forces its removal later.

### 5. Task/consumer switch ordering

**Decision**: Scaffold-and-move first (lib builds and has its own passing tests with zero consumers pointed at it), then flip `PublishConversationPanelContainer.tsx` (smaller, single-file blast radius, proves the `resource`-only path end-to-end), then `DetailsPanel.tsx`/`CatalogView.tsx` (larger, exercises the new `renderSummary` slot), then delete the old catalog exports, then update specs and run `nx affected` for `catalog`, `chat`, `publish-panel`.

**Alternatives considered**: switching both consumers in one slice — rejected per the repo's incremental-slice-with-verification convention; splitting lets `nx affected --target=test` catch a regression in the smaller conversation-publish surface before touching the more complex `DetailsPanel` wiring.

## Risks / Trade-offs

- **[Risk] Missing an import site during the catalog barrel cleanup** (e.g. a test file importing `PublishFolderNode` directly from `libs/catalog/src/models/publish` rather than the barrel) → **Mitigation**: `npm exec nx affected --target=lint,test,build --base=origin/development-1.0` after each slice will surface unresolved imports immediately; grep for `from '@epam/ai-dial-catalog'` and for relative `../models/publish`/`../utils/use-publish-flow` imports across `apps/chat` and `libs/catalog` before deleting the old files.
- **[Risk] `renderSummary` slot changes visual/DOM structure enough to break existing RTL/a11y assertions** (e.g. tests asserting `EntityHeader`'s specific DOM position inside `PublishPanel`) → **Mitigation**: keep the slot's render output byte-identical to today's inline `EntityHeader` + version-tag JSX; move (not rewrite) the JSX block into `DetailsPanel`'s `renderSummary` callback so existing snapshot/RTL tests for that block continue to match.
- **[Risk] Vite `resolve.alias`/`tsconfig` path-alias drift** between the new lib and its peers (`ai-dial-ui-kit`, `ai-dial-kit`, `ai-dial-sidebar`, `ai-dial-chat-shared`) if the scaffold doesn't exactly mirror `conversation-input`'s alias list → **Mitigation**: diff the new lib's `vite.config.mts`/`tsconfig.lib.json` against `conversation-input`'s line-by-line during scaffolding (task-tracked), and validate with `npm exec nx build publish-panel`.
- **[Trade-off] No deprecated re-export shim** means any out-of-repo fork or unmerged branch importing `Publish*` from `@epam/ai-dial-catalog` breaks silently — accepted, since the lib is private/unpublished and this repo controls all consumers.

## Migration Plan

1. Scaffold `libs/publish-panel` (package.json, vite/tsconfig/eslint configs, empty `src/index.ts`) and register the `tsconfig.base.json` path alias — verify `npm exec nx build publish-panel` succeeds on an empty lib.
2. Move models/utils (`publish.ts`, `publish-state.ts`, `publish-folder-tree.ts`, `format-published-date.ts`, `use-publish-flow.ts`) and their tests; update the new `src/index.ts` barrel — verify `npm exec nx test publish-panel`.
3. Move components (`PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`) and their tests; replace `item?: CatalogItem` with `renderSummary?: () => ReactNode` in `PublishPanel`/`StandalonePublishPanel`; drop the `CatalogItem` import — verify `npm exec nx test,lint,build publish-panel`.
4. Switch `PublishConversationPanelContainer.tsx` to import from `@epam/ai-dial-publish-panel` — verify `npm exec nx affected --target=test,lint,build` covering `chat`.
5. Switch `DetailsPanel.tsx` to import from `@epam/ai-dial-publish-panel`, supply `renderSummary` for the `CatalogItem` case, instantiate `usePublishFlow<CatalogItem>` explicitly — verify `npm exec nx affected --target=test,lint,build` covering `catalog` + `chat`.
6. Remove publish re-exports from `libs/catalog/src/index.ts` and delete the moved source files from `libs/catalog` — verify no remaining references (`grep`) and full `npm exec nx affected --target=test,lint,build --base=origin/development-1.0`.
7. Update `openspec/specs/catalog-publish-flow/spec.md` and `openspec/specs/conversation-publish-flow/spec.md` to reference the new library ownership.

**Rollback**: revert the single commit/change; no data migration, no backend/API involvement, no persisted state affected.

## Open Questions

- None blocking; naming (`publish-panel` vs. alternatives) and the slot-prop approach are settled above. If a third publish-UI consumer emerges later needing richer `CatalogItem`-style headers, revisit the "catalog wrapper component" alternative from Decision 2.

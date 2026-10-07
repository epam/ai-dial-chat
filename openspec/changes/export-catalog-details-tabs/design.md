## Context

**Today:**

- `libs/catalog/src/index.ts` exports `DetailsPanel`, `ContentTab` and `LimitsTab`. The other details tabs (`About.tsx`, `Overview.tsx`, `Pricing.tsx`, `Tools/Tools.tsx` under `libs/catalog/src/components/Details/TabsContent/`) are internal.
- `DetailsPanel.tsx` computes its tab list in a `tabs` `useMemo`, from `CONTENT_FIRST_ENTITY_TYPES`, `hasConnectableApi` and `item.details`, and pairs each id with a label from `texts`.
- `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` builds Overview sections with 24 English string literals. `useCatalogItemDetails.ts` calls it without labels.
- The precedent for each piece:
  - the `LimitsTab` export (spec `catalog-item-details-fetch`) for exported tabs;
  - `buildCatalogTabs` in `libs/catalog/src/utils/catalog-tabs.ts`, re-exported from `/mapping`, for a pure tab helper;
  - `DeploymentLimitsLabels` / `SkillOverviewLabels` for host-supplied mapper labels.

**Consumer:** the Quick App editor renders these tabs inside its own ui-kit `Popup`. It feeds them `useCatalogItemDetails` / `useSkillItemDetails` from the published `@epam/ai-dial-chat-hooks/catalog` and needs every string translatable.

## Goals / Non-Goals

**Goals:** public, presentation-only tab components; one shared tab rule; injectable Overview labels and Tools headings. Zero change for the chat app and `DetailsPanel`.

**Non-Goals:** a composite tabs component, translating the chat app, the Connect tab export, mapper relocation (see proposal).

## Decisions

### D1. Export by public alias, keep internal names

`index.ts` adds `export { Overview as OverviewTab }`, and likewise `Pricing as PricingTab` and `Tools as ToolsTab`, plus `export { AboutTab }`, all with `…Props` type aliases. The internal names stay, so no internal import churns, and the public names match the existing `ContentTab` / `LimitsTab` convention. `AboutTabProps` becomes exported. The `ToolsLabels` interface goes in `libs/catalog/src/models/item-details-data.ts`, next to `CatalogItemTools`.

_Alternative:_ rename the internal files and components. Rejected: churn with no consumer benefit.

### D2. `ToolsTab` labels

`ToolsProps` gains `labels?: Partial<ToolsLabels>`, merged over a module constant `DEFAULT_TOOLS_LABELS` holding the current literals. The two `DataGrid` `columns` arrays read from the merged object. `DetailsPanel` passes nothing, so its output is unchanged.

`ItemDetailsTexts` does not gain new fields in this change: the panel has no such texts today, and the scope is host embedding. Adding `toolsColumnLabels` to `ItemDetailsTexts` is a natural follow-up.

### D3. `getCatalogDetailsTabs`

A new file `libs/catalog/src/utils/details-tabs.ts` moves in the order logic from the `tabs` memo, together with `CONTENT_FIRST_ENTITY_TYPES` and `hasConnectableApi`. `DetailsPanel` maps the returned ids to `{ id, label }` with its existing `texts` fallbacks, so labels stay a panel concern and the helper stays string-free and headless (no component import). It is exported from `/mapping`, beside `buildCatalogTabs`, and from the root through the existing `export * from './entry-points/mapping'`.

`isConnectHidden` exists because hosts that are not API consumers (the editor) omit Connect. Without the option they would re-filter the list, and the order rule would leak again.

### D4. Entity-details labels

`EntityDetailsLabels` holds every literal as a field. `DEFAULT_ENTITY_DETAILS_LABELS` keeps today's values. `mapEntityDetailsToCatalogDetails(details, labels?)` resolves `{ ...DEFAULT_ENTITY_DETAILS_LABELS, ...labels }` once and threads it into `mapModelDetails`, `mapAgentDetails` and `mapToolsetDetails` as a second parameter.

`useCatalogItemDetails` adds `entityDetailsLabels?: Partial<EntityDetailsLabels>` to `UseCatalogItemDetailsOptions` and to its `useCallback` deps. Callers should memoise it, like the other label objects; the JSDoc says so.

The field names follow the existing `*Label` / `*Title` pattern in `SkillOverviewLabels`, with shorter names because the interface is scoped to one mapper.

_Alternative:_ a single `t(key)` callback. Rejected: every other mapper in this folder takes a typed labels object, and a callback would hide the key set from TypeScript.

### D5. Library isolation

No lib gains host knowledge. `libs/catalog` imports nothing new, and its additions are UI strings passed by the host and a pure function over `CatalogItem`. `libs/chat-hooks` changes only a mapper's string source. Its sanctioned `@epam/ai-dial-chat-api-client` type dependency is untouched, and it still never configures a client.

### D6. Docs

- `libs/catalog/README.md` gains an "Embedding details tabs" section: imports of the six tabs plus `getCatalogDetailsTabs`, and one compiling example rendering a toolset's About/Overview/Tools by tab id.
- `libs/chat-hooks/README.md` documents `entityDetailsLabels` and the two new exports under the catalog entry point.
- `npm run validate:docs` guards the README-to-export agreement.

## Risks / Trade-offs

- [Default drift: a renamed default changes the panel's output] → Snapshot-style assertions on the existing mapper fixtures, plus a test that every `DEFAULT_ENTITY_DETAILS_LABELS` value equals the former literal.
- [`DetailsPanel` tab order regresses during extraction] → A table test over entity types × present fields, plus a `DetailsPanel` test asserting its rendered tab ids equal the helper's result.
- [Packed-package cold-load: new root exports pull extra modules] → The tabs are already in the root bundle via `DetailsPanel`, and the helper is pure. The CI packed checks (`test-packed-smoke`, cold-load probes) run unchanged.

## Migration Plan

Additive, minor bump of `@epam/ai-dial-catalog` and `@epam/ai-dial-chat-hooks` through the normal release. Rollback: revert; no consumer depends on the additions until it opts in.

## Open Questions

- Should `ItemDetailsTexts` also expose the Tools column labels to `DetailsPanel` hosts? Proposed as a follow-up (D2).

Slicing strategy: **contract-first, smallest library first.**

- §1 adds the pure tab rule and switches `DetailsPanel` onto it (refactor, no behaviour change).
- §2 adds the tab exports and `ToolsTab` labels.
- §3 adds the injectable entity-details labels in `chat-hooks`.
- §4 covers docs and full verification.

Each slice is independently verifiable and leaves the catalog's rendered output unchanged. Before starting, read `AGENTS.md` §Library isolation, `.claude/rules/libs.md` and `.claude/rules/docs.md`.

## 1. Shared details-tab rule

- [x] 1.1 Create `libs/catalog/src/utils/details-tabs.ts` exporting `getCatalogDetailsTabs(item, options?)` (design D3). Move `CONTENT_FIRST_ENTITY_TYPES` and `hasConnectableApi` there from `libs/catalog/src/components/Details/DetailsPanel.tsx`. Re-export the function from `libs/catalog/src/entry-points/mapping.ts`.
- [x] 1.2 Make the `tabs` memo in `DetailsPanel.tsx` map `getCatalogDetailsTabs(item)` to `{ id, label }` with its existing `texts` fallbacks. Labels and the first-tab selection stay local.
- [x] 1.3 Tests:
  - `libs/catalog/src/utils/tests/details-tabs.spec.ts`, table-driven over Model/Agent/Toolset/Skill/Prompt × present `details` fields: the order rule, `isConnectHidden`, and a skill with no details → `[Content]`;
  - in `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`, a case asserting the rendered tab names match the helper for a model with overview, pricing and limits.
  - Architecture guard: `details-tabs.ts` imports no component, client, DTO or i18n.
  - Verification: `npm run test:file -- libs/catalog/src/utils/tests/details-tabs.spec.ts`, `npm run test:file -- libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`, then `npm run verify:changed`.

## 2. Public details-tab exports and `ToolsTab` labels

Depends on 1.

- [x] 2.1 Add `ToolsLabels` to `libs/catalog/src/models/item-details-data.ts`. Add `labels?: Partial<ToolsLabels>` to `ToolsProps` in `libs/catalog/src/components/Details/TabsContent/Tools/Tools.tsx`, merged over a `DEFAULT_TOOLS_LABELS` constant holding `'Name'`, `'Type'`, `'Required'`, `'Key'` and `'Value'`. Export `AboutTabProps` from `About.tsx`.
- [x] 2.2 In `libs/catalog/src/index.ts`, export `AboutTab`, `Overview as OverviewTab`, `Pricing as PricingTab` and `Tools as ToolsTab`, plus the `AboutTabProps`, `OverviewTabProps`, `PricingTabProps`, `ToolsTabProps` and `ToolsLabels` types (design D1).
- [x] 2.3 Tests:
  - `libs/catalog/src/components/Details/TabsContent/Tools/tests/Tools.spec.tsx`: default headings unchanged; `labels={{ inputName: 'Nom' }}` changes only that heading.
  - A root-export smoke test, `libs/catalog/src/tests/index-exports.spec.ts`, asserting the four new exports are functions. Create the file if it is absent.
  - The existing `DetailsPanel.spec.tsx` stays green unchanged.
  - Architecture guard: the four tab files import no client, DTO, `react-i18next` or `Intl` date constructor.
  - Verification: `npm run test:file -- libs/catalog/src/components/Details/TabsContent/Tools/tests/Tools.spec.tsx`, `npm run verify:changed`.

## 3. Host-supplied entity-details labels (`chat-hooks`)

Independent of 1–2.

- [x] 3.1 In `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`:
  - add and export `EntityDetailsLabels` and `DEFAULT_ENTITY_DETAILS_LABELS` (design D4, every current literal);
  - give `mapEntityDetailsToCatalogDetails` a `labels?: Partial<EntityDetailsLabels>` parameter;
  - thread the merged labels into `mapModelDetails`, `mapAgentDetails` and `mapToolsetDetails`, replacing each literal.
- [x] 3.2 In `libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`, add `entityDetailsLabels?: Partial<EntityDetailsLabels>` to `UseCatalogItemDetailsOptions` (JSDoc: memoise it), pass it to `mapEntityDetailsToCatalogDetails`, and add it to the `onFetchDetails` deps.
- [x] 3.3 Tests:
  - `libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`: existing fixtures unchanged with no labels; every `DEFAULT_ENTITY_DETAILS_LABELS` value equals the former literal; overriding `specificationTitle` and `hostedBy` changes only those strings for model, agent and toolset.
  - The `useCatalogItemDetails` test (existing file under `libs/chat-hooks/src/catalog/tests/`): forwarded labels appear in a toolset's `overview`.
  - Architecture guard: no new imports in `chat-hooks` beyond what it already depends on.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-entity-details-to-catalog.spec.ts`, `npm run verify:changed`.

## 4. Docs and final verification

Depends on 1–3.

- [x] 4.1 `libs/catalog/README.md`: an "Embedding details tabs" section with a compiling example (imports of `AboutTab`, `OverviewTab`, `PricingTab`, `ToolsTab`, `LimitsTab`, `ContentTab` and `getCatalogDetailsTabs`), plus `ToolsTab` `labels`. `libs/chat-hooks/README.md`: `entityDetailsLabels`, `EntityDetailsLabels` and `DEFAULT_ENTITY_DETAILS_LABELS`.
- [x] 4.2 Final checks:
  - `npm run validate:docs`, `npm run validate:specs`;
  - `npm exec nx run-many -- -t build -p @epam/ai-dial-catalog @epam/ai-dial-chat-hooks`;
  - `npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke`;
  - `npm run verify:full`;
  - `openspec validate export-catalog-details-tabs --strict`.

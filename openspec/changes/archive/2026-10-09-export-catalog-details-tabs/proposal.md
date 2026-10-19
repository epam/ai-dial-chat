## Why

The DIAL Quick App editor (ai-dial-quickapps-frontend) shows details popups for the skills, toolsets, agents and models an app uses. They must show the same per-entity content as this catalog's details panel. The data side is already public:

- `@epam/ai-dial-chat-hooks/catalog` exports `useCatalogItemDetails`, `useSkillItemDetails` and every mapper, with an injected `CatalogDetailsApi`.

The rendering side is not:

- `@epam/ai-dial-catalog` exports `ContentTab` and `LimitsTab` (`libs/catalog/src/index.ts`), but not the About, Overview, Pricing or Tools tab components.
- Which tabs show, and in what order, is private inside `DetailsPanel` (`libs/catalog/src/components/Details/DetailsPanel.tsx`, the `tabs` memo with `CONTENT_FIRST_ENTITY_TYPES` and `hasConnectableApi`).

A host that embeds the content in its own surface must therefore copy components and the tab rule, and they drift.

Two strings problems block a localised host:

- `mapEntityDetailsToCatalogDetails` (`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`) hardcodes its 24 Overview section titles and spec labels in English (`'Capabilities'`, `'Specification'`, `'Provider'`, `'Hosted by'`, …). The limits and skill mappers already take label objects (`DeploymentLimitsLabels`, `SkillOverviewLabels`), so this one is inconsistent with them. It is also why this app's own Overview is English-only today.
- The Tools tab hardcodes its grid column headings (`libs/catalog/src/components/Details/TabsContent/Tools/Tools.tsx`: `'Name'`, `'Type'`, `'Required'`, `'Key'`, `'Value'`).

## What Changes

- **`@epam/ai-dial-catalog` exports four more details tabs.** Following the `LimitsTab` precedent (`openspec/specs/catalog-item-details-fetch`, "`LimitsTab` is a public, reusable export"):
  - `AboutTab`, `OverviewTab`, `PricingTab` and `ToolsTab`;
  - their props types (`AboutTabProps`, `OverviewTabProps`, `PricingTabProps`, `ToolsTabProps`);
  - `ToolsLabels`.

  The components stay presentation-only. `OverviewTab` and `PricingTab` are public aliases of the internal `Overview` / `Pricing` (internal names unchanged). `ToolsTab` is the internal `Tools`, with a new optional `labels` prop for its column headings, defaulting to today's English. The details panel's output is unchanged.
- **`@epam/ai-dial-catalog/mapping` exports `getCatalogDetailsTabs`.** `getCatalogDetailsTabs(item, options?)` returns the ordered `CatalogDetailsTab[]` the details panel shows for an item:
  - About, unless content-first;
  - Content;
  - Overview, Pricing, Limits and Tools, each when its data is present;
  - Connect, when connectable, unless `options.isConnectHidden`.

  `DetailsPanel` builds its tab list from it, so the panel and any host share one rule.
- **`@epam/ai-dial-chat-hooks` makes entity-details labels injectable:**
  - `mapEntityDetailsToCatalogDetails(details, labels?)` takes `labels?: Partial<EntityDetailsLabels>`, merged over `DEFAULT_ENTITY_DETAILS_LABELS` (today's English strings);
  - `useCatalogItemDetails` takes `entityDetailsLabels?: Partial<EntityDetailsLabels>` and forwards it;
  - `EntityDetailsLabels` and `DEFAULT_ENTITY_DETAILS_LABELS` are exported.

  Omitted labels keep today's output byte for byte, so the chat app is unchanged.
- **READMEs:** `libs/catalog/README.md` and `libs/chat-hooks/README.md` document the new exports with compiling examples.

## Non-goals

- Translating the chat app's own Overview labels. The chat app keeps the English defaults. Passing translated `entityDetailsLabels` from `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts` with new `en.json` keys is a follow-up.
- Localising the input-modality labels (`mimeTypesToExtensionLabels`) or pricing-key labels, which are data-derived. Follow-up.
- Exporting `ApiDetails` (the Connect tab) or the publish / credentials sub-views.
- Any change to `DetailsPanel` behaviour, to the details fetch, or to the BFF.

## Alternatives considered

- **Export a composite `CatalogDetailsTabs` component** (tab row + panels from a `CatalogItem`). Simpler for a host, but it would own the tab row's markup, focus handling and styling, which hosts with their own popup shells (the Quick App editor uses ui-kit 2.0 `Tabs`) can't reuse. Individual tabs plus a pure tab-rule helper cover both cases. Rejected as the primary; it can be added on top later.
- **Move the mappers from `chat-hooks` into `@epam/ai-dial-catalog/mapping`.** Rejected: §Library isolation forbids `libs/catalog` from depending on `@epam/ai-dial-chat-api-client` DTOs. `chat-hooks` is the sanctioned home, and it is already published with optional peers.
- **Hosts copy the components** (conservative baseline). Duplicates code that drifts on every catalog change. Rejected.

## Acceptance criteria

- A host can `import { AboutTab, OverviewTab, PricingTab, ToolsTab, LimitsTab, ContentTab } from '@epam/ai-dial-catalog'` and `import { getCatalogDetailsTabs } from '@epam/ai-dial-catalog/mapping'`, and render a `CatalogItem`'s details without `DetailsPanel`.
- `getCatalogDetailsTabs` returns exactly the tab ids `DetailsPanel` renders for model, agent, toolset, skill and prompt items, with and without each data field. Its Connect entry is dropped with `isConnectHidden`.
- `DetailsPanel`'s rendered tabs and every existing catalog test are unchanged.
- `mapEntityDetailsToCatalogDetails(details)` output is unchanged, and `mapEntityDetailsToCatalogDetails(details, { specificationTitle: 'Spécification' })` renames only that title.
- `ToolsTab` renders translated column headings when `labels` is passed, and today's English otherwise.
- `npm run validate:docs`, `npm run validate:specs`, lint, test, and the packed-library checks (`test-packed-smoke`, cold-load probes) pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-item-details-fetch`: adds requirements for the four public details-tab exports with `ToolsTab` labels, the public `getCatalogDetailsTabs` rule shared with `DetailsPanel`, and host-supplied entity-details labels in `chat-hooks`.

## Impact

- **Code:**
  - `libs/catalog/src/index.ts`, `libs/catalog/src/entry-points/mapping.ts`;
  - a new `libs/catalog/src/utils/details-tabs.ts`;
  - `libs/catalog/src/components/Details/DetailsPanel.tsx` (uses the helper);
  - `libs/catalog/src/components/Details/TabsContent/{About,Overview,Pricing}.tsx` (exported props) and `Tools/Tools.tsx` (`labels`);
  - `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`, `libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`;
  - tests next to each, and both READMEs.
- **Library isolation:** no lib gains host knowledge. All new inputs are strings the host passes: tab labels, column headings and Overview labels. `chat-hooks` keeps its sanctioned client-type dependency; `libs/catalog` gains no DTO or client import.
- **APIs / BFF:** none.
- **i18n:** no new user-visible strings in the chat app. The libraries only accept host-supplied strings, with today's English as defaults.
- **RTL:** none. The exported components are the ones the panel already renders.
- **Feature flags:** none.
- **Compatibility:** additive, minor-version bump for both packages. Rollback: revert; no consumer is affected because every addition is optional.

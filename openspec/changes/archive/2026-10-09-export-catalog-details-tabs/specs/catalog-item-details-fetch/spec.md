## ADDED Requirements

### Requirement: About, Overview, Pricing and Tools tabs are public, reusable exports of `@epam/ai-dial-catalog`

`libs/catalog/src/index.ts` SHALL export these, so a host can render a `CatalogItem`'s details inside its own surface, without `DetailsPanel`:

- `AboutTab` (`libs/catalog/src/components/Details/TabsContent/About.tsx`);
- `OverviewTab`, a public alias of the internal `Overview` (`libs/catalog/src/components/Details/TabsContent/Overview.tsx`);
- `PricingTab`, a public alias of the internal `Pricing` (`libs/catalog/src/components/Details/TabsContent/Pricing.tsx`);
- `ToolsTab`, a public alias of the internal `Tools` (`libs/catalog/src/components/Details/TabsContent/Tools/Tools.tsx`);
- the props types `AboutTabProps`, `OverviewTabProps`, `PricingTabProps`, `ToolsTabProps`, and `ToolsLabels`.

`ContentTab` and `LimitsTab` stay exported as before. The module-private `AboutTabProps` interface SHALL become exported.

`ToolsTab` SHALL accept `labels?: Partial<ToolsLabels>` for the grid column headings that are hardcoded today:

- `inputName`, `inputType` and `inputRequired`, defaulting to `'Name'`, `'Type'` and `'Required'`;
- `annotationKey` and `annotationValue`, defaulting to `'Key'` and `'Value'`.

The defaults SHALL leave the details panel's rendered output unchanged.

The four components SHALL remain presentation-only. They SHALL NOT import a generated API client, a DIAL Core DTO, an endpoint path, `react-i18next`, a locale, or a date/time `Intl` constructor, and SHALL receive every visible string from their props (with English defaults where a default exists today).

`libs/catalog/README.md` SHALL document the four exports with a minimal, compiling usage example, and `npm run validate:docs` SHALL pass.

#### Scenario: A host renders the details content without the panel

- **WHEN** an application imports `AboutTab`, `OverviewTab`, `PricingTab` and `ToolsTab` from `@epam/ai-dial-catalog` and passes them a `CatalogItem`'s `description`/`topics` and `details.overview`/`details.pricing`/`details.tools`
- **THEN** each renders its content with no `DetailsPanel`, catalog shell or catalog item callback involved

#### Scenario: Tools column headings are host-supplied

- **WHEN** `ToolsTab` is rendered with `labels={{ inputName: 'Nom' }}` for a tool with input parameters
- **THEN** the parameters grid heading reads "Nom", and the other headings keep their English defaults

#### Scenario: The details panel is unchanged

- **WHEN** `DetailsPanel` renders a toolset with tools
- **THEN** its Tools tab output is identical to before the change, including the "Name", "Type", "Required", "Key" and "Value" headings

#### Scenario: Architecture guard — the tabs stay presentation-only

- **WHEN** `libs/catalog`'s details tab components are linted and type-checked
- **THEN** none of them imports a generated API client, a backend DTO, `react-i18next` or a date/time `Intl` constructor, and the module-boundary lint passes

### Requirement: The details tab list is a public rule shared with `DetailsPanel`

`libs/catalog/src/utils/details-tabs.ts` SHALL export `getCatalogDetailsTabs(item: CatalogItem, options?: { isConnectHidden?: boolean }): CatalogDetailsTab[]`. It SHALL be re-exported from `@epam/ai-dial-catalog/mapping` (`libs/catalog/src/entry-points/mapping.ts`) and from the package root. It SHALL return, in this order:

1. `About`, unless the item's type is content-first (`Prompt`, `Skill`);
2. `Content`, when the item is content-first or `details.promptContent` is present;
3. `Overview`, when `details.overview` is present;
4. `Pricing`, when `details.pricing` is present;
5. `Limits`, when `details.limits` is present;
6. `Tools`, when `details.tools` is present;
7. `Api` (Connect), when `details.api` names a connectable endpoint (an `endpointUrl` or a non-empty `endpoints` list), unless `options.isConnectHidden` is `true`.

`DetailsPanel` SHALL build its tab list from `getCatalogDetailsTabs`, keeping only the labels and the first-tab selection logic local. The function SHALL be pure and SHALL import no UI component, so `/mapping` stays headless.

#### Scenario: Toolset with tools

- **WHEN** `getCatalogDetailsTabs` receives a toolset item whose details carry `overview` and `tools`
- **THEN** it returns `[About, Overview, Tools]`

#### Scenario: Model with everything

- **WHEN** it receives a model item whose details carry `overview`, `pricing`, `limits` and a connectable `api`
- **THEN** it returns `[About, Overview, Pricing, Limits, Api]`, and `[About, Overview, Pricing, Limits]` with `{ isConnectHidden: true }`

#### Scenario: Skill before details resolve

- **WHEN** it receives a skill item with no `details`
- **THEN** it returns `[Content]`, so the tab a skill opens on never shifts as its details load

#### Scenario: The panel and the helper agree

- **WHEN** `DetailsPanel` renders any item
- **THEN** the ids of its tabs, in order, equal `getCatalogDetailsTabs(item)`

### Requirement: Entity-details Overview labels are host-supplied

`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL export:

- an `EntityDetailsLabels` interface with one field per Overview section title and spec label it renders:
  - section titles: `capabilitiesTitle`, `specificationTitle`, `configurationTitle`;
  - spec labels: `tools`, `parallelToolCalls`, `reasoningEfforts`, `skills`, `provider`, `vendor`, `license`, `knowledgeCutoffDate`, `parameters`, `hostedBy`, `releaseDate`, `contextWindow`, `maxOutputTokens`, `inputModalities`, `inputAttachments`, `routes`, `configurationSchema`, `authentication`, `authorizationEndpoint`, `tokenEndpoint`, `oauthScopes`;
- `DEFAULT_ENTITY_DETAILS_LABELS`, holding today's English strings.

`mapEntityDetailsToCatalogDetails(details, labels?)` SHALL accept `labels?: Partial<EntityDetailsLabels>` and merge it over the defaults. `useCatalogItemDetails` (`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`) SHALL accept `entityDetailsLabels?: Partial<EntityDetailsLabels>` in its options and forward it. Callers that pass nothing SHALL get output identical to today.

The labels SHALL be the only strings the host supplies: section and row order, omit-when-absent rules, value formatting and the input-modality and pricing-key labels stay as they are. The chat app SHALL keep passing nothing; translating its Overview is a follow-up.

#### Scenario: Defaults are unchanged

- **WHEN** `mapEntityDetailsToCatalogDetails(details)` runs on the existing test fixtures
- **THEN** every section title and spec label equals today's English output

#### Scenario: A host overrides one label

- **WHEN** a host passes `{ specificationTitle: 'Spécification', hostedBy: 'Hébergé par' }`
- **THEN** only those two strings change in the returned Overview sections

#### Scenario: The hook forwards labels

- **WHEN** `useCatalogItemDetails` is called with `entityDetailsLabels` and its `onFetchDetails` resolves a toolset
- **THEN** the returned `overview` uses the supplied labels

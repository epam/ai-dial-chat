## MODIFIED Requirements

### Requirement: `libs/catalog` exposes an `onFetchDetails` callback prop

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain an optional `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemDetailsFetchResult | undefined>` field, documented with JSDoc per `libs/*` conventions. `Catalog.tsx` SHALL own the fetch-trigger state: when the details panel opens for an item and `onFetchDetails` is provided, it SHALL call `onFetchDetails(item)`, track a new `isDetailsLoading` boolean while pending, and store the resolved result in new local state.

`CatalogItemDetailsFetchResult` (`libs/catalog/src/models/item-details-data.ts`, exported from the lib's entry point) is the fetch-shaped counterpart of `CatalogItemTabData` — the type a host returns, distinct from the type the panel renders.

Note: this is the only async fetch-on-open mechanism in `Catalog.tsx`. An earlier `onFetchAboutContent`/`aboutContent`/`isAboutLoading` prop existed for the since-removed Summary section but was dropped as dead code (`CatalogView`'s implementation always resolved `undefined`); the `About` tab reads the static `item.description` synchronously, with no fetch or loading state of its own.

The lib MUST remain host-agnostic: `onFetchDetails` accepts only a `CatalogItem` and returns only the lib's own result type — it MUST NOT know about DIAL Core endpoint paths, `@epam/ai-dial-chat-api-client`, or any backend DTO shape. All of that knowledge lives in the app-level adapter (`apps/chat/src/components/CatalogView/CatalogView.tsx`) and in the host-agnostic mappers it calls.

When `onFetchDetails` resolves data, it SHALL **replace** any statically-provided `item.details` for the currently open item wholesale — fetched data is considered more current, and the panel does not merge the two. A host whose fetch covers only part of the panel must therefore rebuild the rest of the sections it still wants shown; the prompt branch below is the worked example. When `onFetchDetails` is not provided, or resolves `undefined`, behavior is unchanged from today: the panel falls back to `item.details` if present, otherwise hides the corresponding tabs.

`CatalogItemTabData` SHALL support an optional `limits?: CatalogItemLimits` field. When present, `DetailsPanel` SHALL add a `Limits` tab after `Pricing` and before `API`; when absent, the tab is hidden. `CatalogItemLimits` SHALL contain app-resolved progress rows only (`label`, `used`, `total`, optional `isUnlimited`, `valueLabel`, `usedLabel`, `totalLabel`, `noteLabel`, `captionLabel`, `ariaLabel`, `resetLabel`, `resetIsoValue`, `resetAriaLabel`) so `libs/catalog` remains host-agnostic and never imports generated API clients, server-api wrappers, DIAL Core DTOs, auth/session state, route knowledge, or endpoint paths. Every visible string on a row is preformatted by the app; the lib formats nothing itself.

The three reset fields are optional and SHALL be treated as a present-or-all-absent trio. They carry
preformatted display strings only: `resetLabel` is the visible line, `resetIsoValue` is the original
UTC instant for a `<time dateTime>` attribute, and `resetAriaLabel` is the spoken expansion. A row
that omits them SHALL render exactly as it did before they existed. The catalog's own adapter
(`mapDeploymentLimitsDtoToCatalogLimits`) sets them on every token row whose `resetsAt` the
host-supplied `DeploymentLimitsLabels.formatResetTime` formats successfully (see
`chat-hooks-deployment-limits-mapping`), so the details panel's `Limits` tab shows a reset line per
row exactly as the conversation-input popover does. The catalog adapter sets no `captionLabel`: the
deployment-limits response carries no per-deployment spend.

#### Scenario: Details panel fetches on open

- **WHEN** a user opens the details panel for a `CatalogItem` and `onFetchDetails` is provided
- **THEN** `Catalog.tsx` calls `onFetchDetails(item)`, shows a loading state via `isDetailsLoading`, and renders the resolved `CatalogItemTabData` once the promise settles

#### Scenario: Fetched details override static details for the open item

- **WHEN** an item has both a static `details` field and a successful `onFetchDetails` resolution
- **THEN** the panel renders the `onFetchDetails` result, not the static `details`

#### Scenario: Fetch resolves undefined

- **WHEN** `onFetchDetails(item)` resolves `undefined`
- **THEN** the panel falls back to `item.details` if present, or hides the Overview/Pricing/Limits/API/Tools tabs that would have depended on it

#### Scenario: No `onFetchDetails` provided

- **WHEN** `CatalogProps.onFetchDetails` is not passed
- **THEN** the panel behaves exactly as before this change — no new fetch is attempted, no loading state is shown

#### Scenario: Prop is optional and additive

- **WHEN** an existing consumer of `Catalog` does not pass `onFetchDetails`
- **THEN** it continues to compile and render without change

#### Scenario: A row without reset fields is unchanged

- **WHEN** a `CatalogItemLimits` row omits `resetLabel`, `resetIsoValue`, and `resetAriaLabel`
- **THEN** the rendered row is identical to its pre-change rendering, with no reset element in the
  DOM

#### Scenario: The catalog details panel shows a reset line per token row

- **WHEN** a user opens a model's details panel, the `Limits` tab renders, and the deployment's
  `dayTokenStats` / `weekTokenStats` / `monthTokenStats` each carry a `resetsAt` that formats
- **THEN** each of the Today / This week / This month rows shows its own reset line in a
  `<time dateTime>` element, and no row shows a "$X spent" caption

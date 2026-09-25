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
(`mapDeploymentLimitsDtoToCatalogLimits`) does not set them, so the details panel's `Limits` tab is
unaffected by their addition.

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

#### Scenario: The catalog details panel is unaffected

- **WHEN** a user opens a model's details panel and the `Limits` tab renders
- **THEN** its DOM is identical to the pre-change rendering, because the catalog's adapter sets none
  of the reset fields

## ADDED Requirements

### Requirement: `LimitsTab` is a public, reusable export of `@epam/ai-dial-catalog`

`libs/catalog/src/index.ts` SHALL export the `LimitsTab` component and the `LimitsTabProps` and
`LimitsTabColors` types, so a host can render a `CatalogItemLimits` value outside the catalog
details panel. `LimitsTabColors` (`libs/catalog/src/models/limits-props.ts`) SHALL be changed from a
module-private interface to an exported one.

`LimitRow` and `LimitGroupSection` SHALL remain internal: the public contract is the whole list, not
an individual row, so row-level markup stays free to change without a breaking release.

`LimitsTab` SHALL remain presentation-only. It SHALL NOT import a generated API client, a DIAL Core
DTO, an endpoint path, `react-i18next`, a locale, a timezone, or a date/time `Intl` constructor. It
SHALL receive every visible string preformatted by its host, and SHALL continue to render `null`
when `limits` is absent or every group has no rows.

`libs/catalog/README.md` SHALL document the new export with a minimal, compiling usage example and
SHALL list the three new optional row fields. `npm run validate:docs` SHALL pass, which requires the
README and `src/index.ts` to agree in both directions.

#### Scenario: A host outside the catalog renders the tab

- **WHEN** an application imports `LimitsTab` from `@epam/ai-dial-catalog` and passes it a
  `CatalogItemLimits` value
- **THEN** it renders the groups and rows without the details panel, the catalog shell, or any
  catalog item being involved

#### Scenario: Empty input renders nothing

- **WHEN** `LimitsTab` is given `undefined`, or a `limits` value whose every group has zero rows
- **THEN** it renders `null`

#### Scenario: Architecture guard — the component stays presentation-only

- **WHEN** `libs/catalog`'s limits components are linted and type-checked
- **THEN** no file among them imports a generated API client, a backend DTO, `react-i18next`, or a
  date/time `Intl` constructor, and the module-boundary lint passes

#### Scenario: README and exports agree

- **WHEN** `npm run validate:docs` runs
- **THEN** it confirms that every name `libs/catalog/README.md` imports from the package is actually
  exported, including `LimitsTab`

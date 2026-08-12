# catalog-item-details-fetch Specification

## Purpose
TBD - created by archiving change add-catalog-item-details-fetch. Update Purpose after archive.
## Requirements
### Requirement: `libs/catalog` exposes an `onFetchDetails` callback prop

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain an optional `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemTabData | undefined>` field, documented with JSDoc per `libs/*` conventions. `Catalog.tsx` SHALL own the fetch-trigger state: when the details panel opens for an item and `onFetchDetails` is provided, it SHALL call `onFetchDetails(item)`, track a new `isDetailsLoading` boolean while pending, and store the resolved `CatalogItemTabData` in new local state.

Note: this is the only async fetch-on-open mechanism in `Catalog.tsx`. An earlier `onFetchAboutContent`/`aboutContent`/`isAboutLoading` prop existed for the Summary section but was removed as dead code (`CatalogView`'s implementation always resolved `undefined`); the Summary section now reads the static `item.description` synchronously, with no fetch or loading state of its own.

The lib MUST remain host-agnostic: `onFetchDetails` accepts only a `CatalogItem` and returns only the lib's own `CatalogItemTabData` type — it MUST NOT know about DIAL Core endpoint paths, `@epam/chat-api-client`, or any backend DTO shape. All of that knowledge lives in the app-level adapter (`apps/chat/src/components/CatalogView/CatalogView.tsx`).

When `onFetchDetails` resolves data, it SHALL take precedence over any statically-provided `item.details` for the currently open item (fetched data is considered more current). When `onFetchDetails` is not provided, or resolves `undefined`, behavior is unchanged from today: the panel falls back to `item.details` if present, otherwise hides the corresponding tabs.

`CatalogItemTabData` SHALL support an optional `limits?: CatalogItemLimits` field. When present, `DetailsPanel` SHALL add a `Limits` tab after `Pricing` and before `API`; when absent, the tab is hidden. `CatalogItemLimits` SHALL contain app-resolved progress rows only (`label`, `used`, `total`, optional `isUnlimited`, `valueLabel`, `ariaLabel`) so `libs/catalog` remains host-agnostic and never imports generated API clients, server-api wrappers, DIAL Core DTOs, auth/session state, route knowledge, or endpoint paths.

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

---

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL implement `onFetchDetails` by calling a new `apps/chat/src/server-api` wrapper (e.g. `getDeploymentDetails(id)` in `apps/chat/src/server-api/deployments.ts`, following the same pattern as the existing `getDeploymentConfiguration` wrapper) that in turn calls the generated `@epam/chat-api-client` `DeploymentsApi.getDeploymentDetails` method — never `fetch` directly and never a new `base.ts` helper.

`CatalogView.tsx` SHALL convert the returned `DeploymentDetailsDto` into the appropriate `EntitySpecificDetails` variant (`apps/chat/src/types/entity-details.ts`) via `mapDeploymentDetailsDtoToEntityDetails(dto: DeploymentDetailsDto): EntitySpecificDetails`, which switches on `dto.type` — the discriminator the backend has already resolved server-side — not on the `CatalogItem`'s own `type` field. The result is then passed through the existing `mapEntityDetailsToCatalogDetails` (`apps/chat/src/utils/map-entity-details-to-catalog.ts`) to produce the core `CatalogItemTabData`.

For model catalog items only, `CatalogView.tsx` SHALL also call the existing `getDeploymentLimits(item.id)` wrapper from `apps/chat/src/server-api/deployment-limits.ts` in parallel with `getDeploymentDetails(item.id)`. The returned `DeploymentLimitsResponseDto` SHALL be converted by an app-level mapper (for example `mapDeploymentLimitsDtoToCatalogLimits`) into `CatalogItemLimits` and merged into the returned `CatalogItemTabData` as `limits`. This mapper is the only place that knows DIAL Core's limit-stat field names (`minuteTokenStats`, `dayCostStats`, etc.); `libs/catalog` receives only resolved display data and numeric progress values.

The `onFetchDetails` callback SHALL be wrapped in `useCallback` (dependencies: app-level adapter inputs such as `isAdmin` and `t`) to satisfy the design's memoisation requirement and avoid re-triggering `Catalog`'s fetch effect on unrelated `CatalogView` re-renders.

If the details server-api call rejects (network error or a mapped HTTP exception surfaced by the base client), `onFetchDetails` SHALL catch the error, resolve `undefined`, and log nothing beyond what the shared API client already logs — it MUST NOT throw out of the callback and break the details panel. If the model limits call rejects, the details result SHALL still be returned without `limits`; a limits-specific failure MUST NOT hide Overview/Pricing/API data.

#### Scenario: Successful detail fetch renders structured tabs

- **WHEN** a user opens a model's details panel and `getDeploymentDetails` resolves a `DeploymentDetailsDto` with `type: 'model'` and populated `modelDetails`
- **THEN** `CatalogView` maps it to `{ type: 'MODEL', data: ModelEntityDetails }` and then to `CatalogItemTabData`, and the panel renders the Overview/Pricing/API tabs with that data

#### Scenario: Model limits fetch renders Limits tab

- **WHEN** a user opens a model's details panel and `getDeploymentLimits` resolves a `DeploymentLimitsResponseDto` with at least one usable stats field
- **THEN** `CatalogView` maps the response into `CatalogItemLimits`, returns it as `details.limits`, and the panel renders the `Limits` tab

#### Scenario: Model limits fetch failure does not hide other details

- **WHEN** `getDeploymentDetails` resolves successfully but `getDeploymentLimits` rejects
- **THEN** `onFetchDetails` resolves the mapped detail tabs without `limits`, and the panel still renders any available Overview/Pricing/API tabs

#### Scenario: Unlimited limit stats

- **WHEN** DIAL Core returns an effectively-unlimited `total` value (for example Java `Long.MAX_VALUE` rounded in JSON/JavaScript)
- **THEN** the app-level mapper marks the row as unlimited, formats the visible value as `Unlimited`, preserves the numeric `used`/`total` for progress rendering, and still includes the row in the `Limits` tab

#### Scenario: Toolset detail fetch renders the Tools tab

- **WHEN** a user opens a toolset's details panel and `getDeploymentDetails` resolves `type: 'toolset'` with populated `toolsetDetails`
- **THEN** `CatalogView` maps it to `{ type: 'TOOLSET', data: ToolsetEntityDetails }`, and the panel's Overview tab reflects the toolset's `authSettings.authenticationType`

#### Scenario: Backend error does not crash the panel

- **WHEN** `getDeploymentDetails` rejects (e.g. mapped 502/503/404 from the backend)
- **THEN** `onFetchDetails` resolves `undefined`, and the panel falls back to `item.details` or hides the dependent tabs, without throwing

#### Scenario: Applications and toolset-created catalog items both dispatch through the same wrapper

- **WHEN** the opened item's `type` is `CatalogEntityType.Model`, `CatalogEntityType.Agent`, or `CatalogEntityType.Toolset`
- **AND** the additional `getDeploymentLimits(item.id)` call is made only for `CatalogEntityType.Model`
- **THEN** `onFetchDetails` calls the same `getDeploymentDetails(item.id)` wrapper regardless of type, and only the DTO → `EntitySpecificDetails` mapping branches on type

---

### Requirement: Generated-client and state-ownership contract for the new endpoint

The `getDeploymentDetails` endpoint SHALL satisfy the following generated-client, state-ownership, i18n, RTL, feature-flag, memoisation, accessibility, and observability contract:

- **State ownership**: no new React Context or hook is introduced. The fetch is triggered by `libs/catalog`'s `Catalog` component (owns `isDetailsLoading`/fetched-details state) and resolved by `CatalogView.tsx`'s `onFetchDetails` callback (owns the DTO→domain mapping); no state is lifted into `DeploymentsContext` since detail data is panel-scoped and not shared across the app.
- **Generated-client impact**: OpenAPI `operationId: 'getDeploymentDetails'` on the new controller method, exposed on the generated `DeploymentsApi` as `getDeploymentDetails({ deployment })`. Request: path param `deployment: string`. Response DTO: `DeploymentDetailsDto`. The frontend wrapper uses the normal (non-`Raw`) generated method, matching the existing `getDeploymentConfiguration`/`getDeploymentLimits` wrapper pattern. Model usage limits reuse the already-existing `getDeploymentLimits` generated method through `apps/chat/src/server-api/deployment-limits.ts`; no generated client changes are required for the UI tab.
- **i18n**: the Limits tab introduces user-visible strings for `catalog.details.tabLimits`, period labels such as `catalog.details.limits.tokensPerDay`, `catalog.details.limits.value`, `catalog.details.limits.unlimitedValue`, and `catalog.details.limits.progressAriaLabel`. These keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced via `CatalogI18nKeys`.
- **RTL / direction impact**: the Limits tab UI MUST use logical/flexible layout utilities only; it MUST NOT introduce physical left/right classes or directional icons. Progress rows contain text and a progress bar, so no icon mirroring is required.
- **Feature flag**: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is a data-completeness fix for an existing, already-shipped catalog details panel, not a new feature surface.
- **Memoisation**: `onFetchDetails` in `CatalogView.tsx` MUST be wrapped in `useCallback`; the DTO-to-`EntitySpecificDetails` mapping functions and deployment-limits mapper MUST remain pure functions (no new memoisation needed beyond the callback itself, consistent with `mapEntityDetailsToCatalogDetails` today).
- **Accessibility**: `isDetailsLoading` renders its own `role="status"` indicator next to the tab row (`texts.detailsLoadingAriaLabel`, default `'Loading details'`). It is the panel's only loading indicator — the Summary section (`item.description`) is always available synchronously and has no loading state. Every limits row progress bar MUST receive an accessible label naming the limit and the used/total value; rows formatted as `Unlimited` still render a progress bar and MUST keep an accessible label.
- **Observability**: no new metrics/telemetry are required; failures are absorbed into `onFetchDetails` resolving `undefined` (per the Non-Goals in design.md, no new logging beyond what `apps/chat/src/server-api`'s shared client already emits on error). On the backend, `deployments.service.ts` logs raw-toolset and mapped-response payloads at debug level (secrets redacted) to aid diagnosing field-mapping gaps — this is diagnostic logging, not user-facing observability.

#### Scenario: No new context or global state

- **WHEN** the details panel closes
- **THEN** no fetched detail data persists outside `Catalog`'s local component state — reopening re-fetches; deployment details may be subject to the backend's 60s cache, while model limits follow the no-cache deployment-limits API contract

### Requirement: Only the About tab reads `item.description`; the Summary section shows topics and usage limits

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL NOT define an `intro` field.
The dedicated `About` tab (`CatalogDetailsTab.About`, `libs/catalog/src/types/detail-tab.ts`)
SHALL display `item.description` via the shared `AboutTab` component
(`libs/catalog/src/components/Details/TabsContent/About.tsx`), which takes an explicit
`content: string` prop rather than deriving its own fallback. The `About` tab is the only
`DetailsPanel` surface that renders `item.description`; it uses no async fetch, callback prop,
or loading state for this content.

The details panel's always-visible Summary section (rendered by `Summary`) SHALL NOT render
`item.description` or any `AboutTab` content. `Summary` SHALL render only the item's topics
(when `item.topics.length > 0`) and usage-limit summary (when `item.summary` is non-null);
when both are absent, `Summary` SHALL render nothing.

The `About` tab SHALL always be present in the tab row, as the first entry, regardless of
whether `item.details` is populated — unlike `Overview`/`Pricing`/`Api`/`Tools`, which only
appear when their corresponding `item.details` field is non-null.

The `apps/chat` adapter (`mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` in
`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL NOT read or map any `intro`
field from `DeploymentItemDto`/`DialToolsetDto`.

#### Scenario: Only the About tab renders the description
- **WHEN** the details panel opens for any `CatalogItem`
- **THEN** the About tab renders `item.description`, and the Summary section does not render
  `item.description` anywhere

#### Scenario: Summary section renders topics and usage limits only
- **WHEN** the details panel opens for a `CatalogItem` with a non-empty `topics` array and a
  non-null `summary`
- **THEN** the Summary section renders the topic tags and the usage-limit summary, and
  nothing else

#### Scenario: Summary section renders nothing when topics and summary are both absent
- **WHEN** the details panel opens for a `CatalogItem` with an empty `topics` array and no
  `summary`
- **THEN** the Summary section renders no content

#### Scenario: About tab is always first
- **WHEN** the details panel opens for any `CatalogItem`, regardless of which of
  `item.details.overview`/`pricing`/`limits`/`api`/`tools` are populated
- **THEN** the tab row's first entry is `About`

#### Scenario: Limits tab is shown only when usage limits are present
- **WHEN** `item.details.limits` is populated with one or more progress rows
- **THEN** the details panel includes a `Limits` tab after `Pricing` and renders those rows with progress bars

#### Scenario: Limits tab is hidden when usage limits are absent
- **WHEN** `item.details.limits` is `undefined`
- **THEN** the details panel does not render the `Limits` tab

#### Scenario: Deployment mapper does not populate an intro field
- **WHEN** `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` map a
  `DeploymentItemDto`/`DialToolsetDto` into a `CatalogItem`
- **THEN** the resulting `CatalogItem` has no `intro` property


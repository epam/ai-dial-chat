# Spec: catalog-item-details-fetch

## Requirements

### Requirement: `libs/catalog` exposes an `onFetchDetails` callback prop

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain an optional `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemTabData | undefined>` field, documented with JSDoc per `libs/*` conventions. `Catalog.tsx` SHALL own the fetch-trigger state: when the details panel opens for an item and `onFetchDetails` is provided, it SHALL call `onFetchDetails(item)`, track a new `isDetailsLoading` boolean while pending, and store the resolved `CatalogItemTabData` in new local state.

Note: this is the only async fetch-on-open mechanism in `Catalog.tsx`. An earlier `onFetchAboutContent`/`aboutContent`/`isAboutLoading` prop existed for the Intro section but was removed as dead code (`CatalogView`'s implementation always resolved `undefined`); the Intro section now reads the static `item.intro ?? item.description` synchronously, with no fetch or loading state of its own.

The lib MUST remain host-agnostic: `onFetchDetails` accepts only a `CatalogItem` and returns only the lib's own `CatalogItemTabData` type — it MUST NOT know about DIAL Core endpoint paths, `@epam/chat-api-client`, or any backend DTO shape. All of that knowledge lives in the app-level adapter (`apps/chat/src/components/CatalogView/CatalogView.tsx`).

When `onFetchDetails` resolves data, it SHALL take precedence over any statically-provided `item.details` for the currently open item (fetched data is considered more current). When `onFetchDetails` is not provided, or resolves `undefined`, behavior is unchanged from today: the panel falls back to `item.details` if present, otherwise hides the corresponding tabs.

#### Scenario: Details panel fetches on open

- **WHEN** a user opens the details panel for a `CatalogItem` and `onFetchDetails` is provided
- **THEN** `Catalog.tsx` calls `onFetchDetails(item)`, shows a loading state via `isDetailsLoading`, and renders the resolved `CatalogItemTabData` once the promise settles

#### Scenario: Fetched details override static details for the open item

- **WHEN** an item has both a static `details` field and a successful `onFetchDetails` resolution
- **THEN** the panel renders the `onFetchDetails` result, not the static `details`

#### Scenario: Fetch resolves undefined

- **WHEN** `onFetchDetails(item)` resolves `undefined`
- **THEN** the panel falls back to `item.details` if present, or hides the Overview/Pricing/API/Tools tabs that would have depended on it

#### Scenario: No `onFetchDetails` provided

- **WHEN** `CatalogProps.onFetchDetails` is not passed
- **THEN** the panel behaves exactly as before this change — no new fetch is attempted, no loading state is shown

#### Scenario: Prop is optional and additive

- **WHEN** an existing consumer of `Catalog` does not pass `onFetchDetails`
- **THEN** it continues to compile and render without change

---

### Requirement: Intro section reads `item.intro`, falling back to `item.description`; the About tab always reads `item.description`

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL gain an optional `intro?: string` field, distinct from the existing required `description: string`. The details panel's always-visible Intro section (rendered by `Summary`) SHALL display `item.intro ?? item.description`. A dedicated `About` tab (`CatalogDetailsTab.About`, `libs/catalog/src/types/detail-tab.ts`) SHALL display `item.description` unconditionally, even when `item.intro` is present. Both surfaces render through the shared `AboutTab` component (`libs/catalog/src/components/Details/TabsContent/About.tsx`), which takes an explicit `content: string` prop rather than deriving its own fallback — each caller (`Summary`, `DetailsPanel`) is responsible for choosing which field to pass. Neither location uses an async fetch, callback prop, or loading state for this content.

The `About` tab SHALL always be present in the tab row, as the first entry, regardless of whether `item.details` is populated — unlike `Overview`/`Pricing`/`Api`/`Tools`, which only appear when their corresponding `item.details` field is non-null.

The `apps/chat` adapter SHALL populate `CatalogItem.intro` from the corresponding backend field when mapping a deployment or toolset into a `CatalogItem` (`mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` in `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, from `DeploymentItemDto.intro`/`DialToolsetDto.intro`).

#### Scenario: Intro field present

- **WHEN** `item.intro` is a non-null string
- **THEN** the Intro section renders `item.intro`, and the About tab renders `item.description` (not `item.intro`)

#### Scenario: Intro field absent

- **WHEN** `item.intro` is `undefined`
- **THEN** the Intro section renders `item.description`, and the About tab also renders `item.description` — the two surfaces show the same text only in this case, incidentally, not by design

#### Scenario: About tab is always first

- **WHEN** the details panel opens for any `CatalogItem`, regardless of which of `item.details.overview`/`pricing`/`api`/`tools` are populated
- **THEN** the tab row's first entry is `About`

#### Scenario: Deployment mapper forwards intro from the backend DTO

- **WHEN** `DeploymentItemDto.intro` or `DialToolsetDto.intro` is a non-null string
- **THEN** `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` set `CatalogItem.intro` to that value

---

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL implement `onFetchDetails` by calling a new `apps/chat/src/server-api` wrapper (e.g. `getDeploymentDetails(id)` in `apps/chat/src/server-api/deployments.ts`, following the same pattern as the existing `getDeploymentConfiguration` wrapper) that in turn calls the generated `@epam/chat-api-client` `DeploymentsApi.getDeploymentDetails` method — never `fetch` directly and never a new `base.ts` helper.

`CatalogView.tsx` SHALL convert the returned `DeploymentDetailsDto` into the appropriate `EntitySpecificDetails` variant (`apps/chat/src/types/entity-details.ts`) via `mapDeploymentDetailsDtoToEntityDetails(dto: DeploymentDetailsDto): EntitySpecificDetails`, which switches on `dto.type` — the discriminator the backend has already resolved server-side — not on the `CatalogItem`'s own `type` field. The result is then passed through the existing `mapEntityDetailsToCatalogDetails` (`apps/chat/src/utils/map-entity-details-to-catalog.ts`) to produce `CatalogItemTabData`. No new tab-shaping logic SHALL be added outside `mapEntityDetailsToCatalogDetails` — only the new DTO → `EntitySpecificDetails` conversion step.

The `onFetchDetails` callback SHALL be wrapped in `useCallback` (dependency: none beyond the stable wrapper import) to satisfy the design's memoisation requirement and avoid re-triggering `Catalog`'s fetch effect on unrelated `CatalogView` re-renders.

If the server-api call rejects (network error or a mapped HTTP exception surfaced by the base client), `onFetchDetails` SHALL catch the error, resolve `undefined`, and log nothing beyond what the shared API client already logs — it MUST NOT throw out of the callback and break the details panel.

#### Scenario: Successful detail fetch renders structured tabs

- **WHEN** a user opens a model's details panel and `getDeploymentDetails` resolves a `DeploymentDetailsDto` with `type: 'model'` and populated `modelDetails`
- **THEN** `CatalogView` maps it to `{ type: 'MODEL', data: ModelEntityDetails }` and then to `CatalogItemTabData`, and the panel renders the Overview/Pricing/API tabs with that data

#### Scenario: Toolset detail fetch renders the Tools tab

- **WHEN** a user opens a toolset's details panel and `getDeploymentDetails` resolves `type: 'toolset'` with populated `toolsetDetails`
- **THEN** `CatalogView` maps it to `{ type: 'TOOLSET', data: ToolsetEntityDetails }`, and the panel's Overview tab reflects the toolset's `authSettings.authenticationType`

#### Scenario: Backend error does not crash the panel

- **WHEN** `getDeploymentDetails` rejects (e.g. mapped 502/503/404 from the backend)
- **THEN** `onFetchDetails` resolves `undefined`, and the panel falls back to `item.details` or hides the dependent tabs, without throwing

#### Scenario: Applications and toolset-created catalog items both dispatch through the same wrapper

- **WHEN** the opened item's `type` is `CatalogEntityType.Model`, `CatalogEntityType.Application`, or `CatalogEntityType.Toolset`
- **THEN** `onFetchDetails` calls the same `getDeploymentDetails(item.id)` wrapper regardless of type, and only the DTO → `EntitySpecificDetails` mapping branches on type

---

### Requirement: Generated-client and state-ownership contract for the new endpoint

- **State ownership**: no new React Context or hook is introduced. The fetch is triggered by `libs/catalog`'s `Catalog` component (owns `isDetailsLoading`/fetched-details state) and resolved by `CatalogView.tsx`'s `onFetchDetails` callback (owns the DTO→domain mapping); no state is lifted into `DeploymentsContext` since detail data is panel-scoped and not shared across the app.
- **Generated-client impact**: OpenAPI `operationId: 'getDeploymentDetails'` on the new controller method, exposed on the generated `DeploymentsApi` as `getDeploymentDetails({ deployment })`. Request: path param `deployment: string`. Response DTO: `DeploymentDetailsDto`. The frontend wrapper uses the normal (non-`Raw`) generated method, matching the existing `getDeploymentConfiguration`/`getDeploymentLimits` wrapper pattern.
- **i18n**: no new user-visible strings are introduced by this change — `CatalogView.tsx`'s existing `detailsTexts` (`CatalogI18nKeys.DetailsTabTools`, `DetailsDailyLimit`, `DetailsApiResourceSection`, etc.) already cover the labels the newly-populated tabs render into; only the underlying data changes from empty/undefined to populated.
- **RTL / direction impact**: none — this change adds a data-fetch path and DTO mapping only; it does not add or modify any JSX/markup in `libs/catalog` or `CatalogView.tsx` beyond wiring an existing prop, so no new logical-property or icon-mirroring work is needed.
- **Feature flag**: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is a data-completeness fix for an existing, already-shipped catalog details panel, not a new feature surface.
- **Memoisation**: `onFetchDetails` in `CatalogView.tsx` MUST be wrapped in `useCallback`; the DTO→`EntitySpecificDetails` mapping functions MUST remain pure functions (no new memoisation needed beyond the callback itself, consistent with `mapEntityDetailsToCatalogDetails` today).
- **Accessibility**: `isDetailsLoading` renders its own `role="status"` indicator next to the tab row (`texts.detailsLoadingAriaLabel`, default `'Loading details'`). It is the panel's only loading indicator — the Intro section (`item.intro ?? item.description`) is always available synchronously and has no loading state.
- **Observability**: no new metrics/telemetry are required; failures are absorbed into `onFetchDetails` resolving `undefined` (per the Non-Goals in design.md, no new logging beyond what `apps/chat/src/server-api`'s shared client already emits on error). On the backend, `deployments.service.ts` logs raw-toolset and mapped-response payloads at debug level (secrets redacted) to aid diagnosing field-mapping gaps — this is diagnostic logging, not user-facing observability.

#### Scenario: No new context or global state

- **WHEN** the details panel closes
- **THEN** no fetched detail data persists outside `Catalog`'s local component state — reopening re-fetches (subject to the backend's 60s cache)

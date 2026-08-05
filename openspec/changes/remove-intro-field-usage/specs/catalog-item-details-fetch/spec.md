## REMOVED Requirements

### Requirement: Intro section reads `item.intro`, falling back to `item.description`; the About tab always reads `item.description`

**Reason**: The `intro` field duplicated `description` at every consumer that read it (both the
Summary section and the About tab fell back to `description` whenever `intro` was absent), so
it was removed as a distinct field from `CatalogItem` and its backing DTOs/mappers. See the
`remove-intro-field-usage` proposal.

**Migration**: Consumers that previously read `item.intro` now read `item.description`
directly; there is no fallback expression to preserve because there is only one field left.
The `apps/chat` adapter no longer populates any `intro` value when mapping a deployment or
toolset into a `CatalogItem`.

## ADDED Requirements

### Requirement: Summary section and About tab both read `item.description`

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL NOT define an `intro` field.
The details panel's always-visible Summary section (rendered by `Summary`) SHALL display
`item.description` directly. The dedicated `About` tab (`CatalogDetailsTab.About`,
`libs/catalog/src/types/detail-tab.ts`) SHALL also display `item.description`. Both surfaces
render through the shared `AboutTab` component
(`libs/catalog/src/components/Details/TabsContent/About.tsx`), which takes an explicit
`content: string` prop rather than deriving its own fallback — each caller (`Summary`,
`DetailsPanel`) passes `item.description`. Neither location uses an async fetch, callback
prop, or loading state for this content.

The `About` tab SHALL always be present in the tab row, as the first entry, regardless of
whether `item.details` is populated — unlike `Overview`/`Pricing`/`Api`/`Tools`, which only
appear when their corresponding `item.details` field is non-null.

The `apps/chat` adapter (`mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` in
`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL NOT read or map any `intro`
field from `DeploymentItemDto`/`DialToolsetDto`.

#### Scenario: Summary and About both render the description
- **WHEN** the details panel opens for any `CatalogItem`
- **THEN** the Summary section renders `item.description`, and the About tab also renders
  `item.description`

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

## MODIFIED Requirements

### Requirement: Generated-client and state-ownership contract for the new endpoint

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

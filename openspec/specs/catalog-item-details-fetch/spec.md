# catalog-item-details-fetch Specification

## Purpose

How the catalog details panel fetches an item's tab data on open: the lib's host-agnostic `onFetchDetails` contract, the app-level dispatch to the right backend wrapper per entity kind, and how partial or failed fetches degrade.
## Requirements
### Requirement: `libs/catalog` exposes an `onFetchDetails` callback prop

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain an optional `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemDetailsFetchResult | undefined>` field, documented with JSDoc per `libs/*` conventions. `Catalog.tsx` SHALL own the fetch-trigger state: when the details panel opens for an item and `onFetchDetails` is provided, it SHALL call `onFetchDetails(item)`, track a new `isDetailsLoading` boolean while pending, and store the resolved result in new local state.

`CatalogItemDetailsFetchResult` (`libs/catalog/src/models/item-details-data.ts`, exported from the lib's entry point) is the fetch-shaped counterpart of `CatalogItemTabData` — the type a host returns, distinct from the type the panel renders.

Note: this is the only async fetch-on-open mechanism in `Catalog.tsx`. An earlier `onFetchAboutContent`/`aboutContent`/`isAboutLoading` prop existed for the since-removed Summary section but was dropped as dead code (`CatalogView`'s implementation always resolved `undefined`); the `About` tab reads the static `item.description` synchronously, with no fetch or loading state of its own.

The lib MUST remain host-agnostic: `onFetchDetails` accepts only a `CatalogItem` and returns only the lib's own result type — it MUST NOT know about DIAL Core endpoint paths, `@epam/ai-dial-chat-api-client`, or any backend DTO shape. All of that knowledge lives at the app edge (the `CatalogDetailsApi` adapter built in `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`) and in `useCatalogItemDetails` and its mappers in `libs/chat-hooks/src/catalog/`.

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

---

### Requirement: `LimitsTab` is a public, reusable export of `@epam/ai-dial-catalog`

`libs/catalog/src/index.ts` SHALL export the `LimitsTab` component, the `LimitsTabProps` and
`LimitsTabColors` types, and the `LimitRowLayout` enum, so a host can render a `CatalogItemLimits`
value outside the catalog details panel. `LimitsTabColors`
(`libs/catalog/src/models/limits-props.ts`) SHALL be changed from a module-private interface to an
exported one.

`LimitsTab` SHALL accept `layout?: LimitRowLayout`, defaulting to `LimitRowLayout.Inline` — the
arrangement the details panel already renders, with the label column beside a fixed-width column
holding the used/total pair above a narrow progress bar. `LimitRowLayout.Stacked` SHALL instead put
the label and the value on one line, followed by a full-width progress bar and then the reset
caption, and SHALL color the value through the `valueDanger` token once the row has reached its
limit. The default SHALL leave the details panel's rendered output unchanged.

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

#### Scenario: The default layout leaves the details panel unchanged

- **WHEN** `LimitsTab` is rendered without a `layout` prop
- **THEN** each row renders the inline arrangement the details panel shipped before the prop existed

#### Scenario: The stacked layout moves the bar under the label line

- **WHEN** `LimitsTab` is rendered with `LimitRowLayout.Stacked`
- **THEN** each row shows its label and a single combined value on one line, a full-width progress
  bar beneath them, and the reset caption below that

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
---

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL take `onFetchDetails` (together with `onLoadContentFile` and `onLoadSkillDetailsFile`) from the app hook `useCatalogItems` (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`) and pass it to `Catalog`; it SHALL NOT contain the entity dispatch or mapping itself. `useCatalogItems` SHALL build a memoised `CatalogDetailsApi` adapter from the existing `apps/chat/src/server-api` wrappers — `getDeploymentDetails` (`deployments.ts`), `getDeploymentLimits` (`deployment-limits.ts`), `getPrompt`/`getPublicPrompt` (`prompts.api.ts`), and `downloadSkillFile`/`listSkillFiles`/`getSkillMetadata` (`skills.api.ts`) — and pass it, with `skills` (personal + shared + public), `isAdmin`, `dialCoreExternalUrl`, and the translated `skillOverviewLabels`/`promptOverviewLabels`/`deploymentLimitsLabels`, to `useCatalogItemDetails` from `@epam/ai-dial-chat-hooks` (`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`). All wrappers call generated `@epam/ai-dial-chat-api-client` methods — never `fetch` directly — and the hook never constructs a client. The hook's `onFetchDetails` SHALL dispatch on the opened item's `type`, prompt first, then skill, then the shared deployment path, and SHALL be wrapped in `useCallback` (dependencies: `api`, `isAdmin`, `deploymentLimitsLabels`, `dialCoreExternalUrl`, `promptOverviewLabels`, `onFetchSkillDetails`) so `Catalog`'s fetch effect is not re-triggered by unrelated re-renders.

**Deployment-backed items (`Model`, `Agent`, `Toolset`).** The hook SHALL call `api.getDeploymentDetails(item.id)` and convert the returned `DeploymentDetailsDto` into an `EntitySpecificDetails` variant (`libs/chat-hooks/src/catalog/entity-details.ts`) via `mapDeploymentDetailsDtoToEntityDetails`, which switches on `dto.type` — the discriminator the backend resolved — not on the `CatalogItem`'s `type`. The result is passed through `mapEntityDetailsToCatalogDetails` (same module, `map-entity-details-to-catalog.ts`). The returned `api` section is overridden by the Connect endpoint data (see `catalog-connect-action`), and toolsets additionally get `credentials` from `mapToolsetCredentials(item.id, data, isAdmin)`.

For `CatalogEntityType.Model` only, the hook SHALL call `api.getDeploymentLimits(item.id)` in parallel (its rejection caught to `undefined`) and set `limits` to `mapDeploymentLimitsDtoToCatalogLimits(limitsDto, deploymentLimitsLabels)` (`libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`; see `chat-hooks-deployment-limits-mapping`). That mapper is the only place that knows DIAL Core's limit-stat field names; it reads only `dayTokenStats`, `weekTokenStats`, and `monthTokenStats` and never reads the response's cost stats (they are the caller's account-wide budget, not this deployment's spend). `libs/catalog` receives only resolved display data and numeric progress values.

**Prompt items (`CatalogEntityType.Prompt`).** The hook SHALL branch before the deployment path: an organisation prompt (`isOrganisationPromptItem`) calls `api.getPublicPrompt` with the bucket-relative sub-path parsed by `parsePromptResourceUrl`; a personal or shared prompt calls `api.getPrompt(item.id)` with the full `prompts/{bucket}/{path}` id unmodified. The result SHALL be `{ promptContent: { content: dto.content }, overview: buildPromptOverview(dto, promptOverviewLabels) }`. The `overview` is not optional decoration: because a fetch result replaces `item.details` wholesale, returning only `promptContent` would make the Overview tab the list mapper had already populated disappear once the panel finished loading. A prompt MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`.

**Skill items (`CatalogEntityType.Skill`).** The hook SHALL delegate to `useSkillItemDetails` (`libs/chat-hooks/src/catalog/useSkillItemDetails.ts`), which parses `{ bucket, path }` from `item.id` with `parseSkillResourceUrl`, records it in a ref (the Content tab's file picker reports back only a file's own path, and the panel shows one item at a time), and runs three requests with `Promise.allSettled`:

- `downloadSkillFile(bucket, path, SKILL_MANIFEST_FILE)` — read as text, size-capped, then parsed by the shared manifest parser, producing the Content body plus whatever summary and Specification section the manifest declares;
- `listSkillFiles({ bucket, path, filePath: '', recursive: true })` — an options object — used for the `overview` (author, last-updated, file count, one row per file) and the Content tab's file tree;
- `getSkillMetadata(bucket, path)` — when it fulfils, it is the authoritative source of the overview's skill metadata; the matching entry from the `skills` listing is used only when it rejects.

A manifest that downloads but fails to parse is not a failure: the parser hands back the raw text as the body. The content and overview halves are independently optional; when neither is available the result is `undefined`. An `item.id` that `parseSkillResourceUrl` rejects SHALL resolve `undefined` with no request issued. A skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`.

If a details call rejects, `onFetchDetails` SHALL catch the error, resolve `undefined`, and log nothing beyond what the shared API client already logs — it MUST NOT throw. A model limits rejection SHALL still return the details without `limits`. For a prompt, resolving `undefined` leaves the panel showing the `promptContent` the list mapper already seeded. For a skill, a partial failure returns whichever half succeeded.

#### Scenario: Successful detail fetch renders structured tabs

- **WHEN** a user opens a model's details panel and `getDeploymentDetails` resolves a `DeploymentDetailsDto` with `type: 'model'` and populated `modelDetails`
- **THEN** `useCatalogItemDetails` maps it to `{ type: 'MODEL', data: ModelEntityDetails }` and then to `CatalogItemTabData`, and the panel renders the Overview/Pricing/API tabs with that data

#### Scenario: Model limits fetch renders Limits tab

- **WHEN** a user opens a model's details panel and `getDeploymentLimits` resolves a `DeploymentLimitsResponseDto` with at least one usable token stat
- **THEN** the hook returns the mapped `CatalogItemLimits` as `details.limits`, and the panel renders the `Limits` tab

#### Scenario: Model limits fetch failure does not hide other details

- **WHEN** `getDeploymentDetails` resolves successfully but `getDeploymentLimits` rejects
- **THEN** `onFetchDetails` resolves the mapped detail tabs without `limits`, and the panel still renders any available Overview/Pricing/API tabs

#### Scenario: Unlimited limit stats

A row counts as unlimited when `total >= Number.MAX_SAFE_INTEGER`
(`UNLIMITED_TOTAL_THRESHOLD` in `map-deployment-limits-to-catalog.ts`), which is
how DIAL Core's Java `Long.MAX_VALUE` arrives once JSON has rounded it.

- **WHEN** DIAL Core returns an effectively-unlimited `total` for a token limit stat
- **THEN** the mapper sets `isUnlimited: true`, preserves the numeric `used`/`total` on the row, and still includes the row in the `Limits` tab
- **AND** the row's `valueLabel` is the formatted **`used`** amount alone — the visible value never reads `Unlimited`, and there is no `unlimitedValue` i18n key
- **AND** `noteLabel` is `catalog.details.limits.followsCostLimit` ("Follows cost limit"), rendered under the value, and `ariaLabel` reads "{label}: {used} used. Follows cost limit."
- **AND** the row carries no `captionLabel` — the mapper never sets one
- **AND** the row renders as a plain value with no progress bar, since a bar drawn against an effectively-infinite total carries no information

So a Limits tab whose rows are all unlimited reads as "{used} / Follows cost
limit" per row (e.g. "0 / Follows cost limit"), with zero `role="progressbar"`
nodes and the word `Unlimited` nowhere on screen. That is the correct rendering, not a fixture in
an unexpected shape.

#### Scenario: Limit stat with no usable total

- **WHEN** a limit stat's `total` is zero, negative, or not finite
- **THEN** `isUsableLimitStats` rejects it and no row is emitted for it — an uncapped stat is not rendered as a zero-capacity bar

#### Scenario: Toolset detail fetch renders the Tools tab

- **WHEN** a user opens a toolset's details panel and `getDeploymentDetails` resolves `type: 'toolset'` with populated `toolsetDetails`
- **THEN** the hook maps it to `{ type: 'TOOLSET', data: ToolsetEntityDetails }`, the panel's Overview tab reflects the toolset's `authSettings.authenticationType`, and `credentials` come from `mapToolsetCredentials`

#### Scenario: Backend error does not crash the panel

- **WHEN** `getDeploymentDetails` rejects (e.g. mapped 502/503/404 from the backend)
- **THEN** `onFetchDetails` resolves `undefined`, and the panel falls back to `item.details` or hides the dependent tabs, without throwing

#### Scenario: Applications and toolset-created catalog items both dispatch through the same wrapper

- **WHEN** the opened item's `type` is `CatalogEntityType.Model`, `CatalogEntityType.Agent`, or `CatalogEntityType.Toolset`
- **AND** the additional `getDeploymentLimits(item.id)` call is made only for `CatalogEntityType.Model`
- **THEN** `onFetchDetails` calls the same `getDeploymentDetails(item.id)` operation regardless of type, and only the DTO → `EntitySpecificDetails` mapping branches on type

#### Scenario: Personal prompt detail fetch renders the Content tab

- **WHEN** a user opens a personal prompt's details panel
- **THEN** `onFetchDetails` calls `getPrompt(item.id)` and resolves both `promptContent` and a rebuilt `overview`, and the panel renders the `Content` tab with the prompt's body alongside its Overview

#### Scenario: Organisation prompt detail fetch uses the public wrapper

- **WHEN** a user opens the details panel for a prompt from the organisation bucket
- **THEN** `onFetchDetails` calls `getPublicPrompt` with the prompt's bucket-relative sub-path and no personal-prompt request is dispatched

#### Scenario: Shared prompt detail fetch preserves the owner bucket

- **WHEN** a user opens `prompts/owner-bucket/Work/summarize`
- **THEN** `onFetchDetails` calls `getPrompt('prompts/owner-bucket/Work/summarize')` with the full qualified id

#### Scenario: Prompt fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Prompt`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Prompt fetch failure degrades to seeded content

- **WHEN** `getPrompt` rejects and the list mapper had already seeded `details.promptContent`
- **THEN** `onFetchDetails` resolves `undefined`, the panel keeps rendering the seeded body, and nothing throws

#### Scenario: Skill detail fetch renders Content and Overview

- **WHEN** a user opens a skill's details panel and `downloadSkillFile('SKILL.md')`, `listSkillFiles` and `getSkillMetadata` resolve
- **THEN** `onFetchDetails` resolves `{ promptContent, overview }` with the overview built from the fetched metadata, and the panel renders the manifest text and the file inventory

#### Scenario: Skill metadata failure falls back to the listing entry

- **WHEN** `getSkillMetadata` rejects while `listSkillFiles` resolves
- **THEN** the overview is built from the skill's entry in the combined `skills` listing

#### Scenario: Skill fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Skill`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Skill partial failure returns the half that succeeded

- **WHEN** `downloadSkillFile` rejects with a 404 and `listSkillFiles` resolves
- **THEN** `onFetchDetails` resolves an `overview` with no `promptContent`, and nothing throws

#### Scenario: An unparseable manifest still renders its raw text

- **WHEN** `downloadSkillFile` resolves but the manifest does not parse
- **THEN** the Content tab renders the raw text as the body, with no summary and no Specification section, and the fetch is not treated as failed

#### Scenario: Unparseable skill id issues no request

- **WHEN** a skill item's `id` is not a well-formed `skills/{bucket}/{path}` URL
- **THEN** `onFetchDetails` resolves `undefined` without calling any skills operation

---

### Requirement: Generated-client and state-ownership contract for the new endpoint

The `getDeploymentDetails` endpoint SHALL satisfy the following generated-client, state-ownership, i18n, RTL, feature-flag, memoisation, accessibility, and observability contract:

- **State ownership**: no new React Context or hook is introduced. The fetch is triggered by `libs/catalog`'s `Catalog` component (owns `isDetailsLoading`/fetched-details state) and resolved by the `onFetchDetails` callback of `useCatalogItemDetails` in `libs/chat-hooks` (owns the DTO→domain mapping), which `CatalogView` receives through `useCatalogItems`; no state is lifted into `DeploymentsContext` since detail data is panel-scoped and not shared across the app.
- **Generated-client impact**: OpenAPI `operationId: 'getDeploymentDetails'` on the new controller method, exposed on the generated `DeploymentsApi` as `getDeploymentDetails({ deployment })`. Request: path param `deployment: string`. Response DTO: `DeploymentDetailsDto`. The frontend wrapper uses the normal (non-`Raw`) generated method, matching the existing `getDeploymentConfiguration`/`getDeploymentLimits` wrapper pattern. Model usage limits reuse the already-existing `getDeploymentLimits` generated method through `apps/chat/src/server-api/deployment-limits.ts`; no generated client changes are required for the UI tab.
- **i18n**: the Limits tab's user-visible strings are `catalog.details.tabLimits` and `catalog.details.limits.*` — `tokenGroup`, `value`, `followsCostLimit`, `followsCostLimitAriaLabel`, and `progressAriaLabel` (there is no `unlimitedValue` or `spentLabel` key). These keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced via `CatalogI18nKeys`. The day/week/month row labels (`DeploymentLimitsLabels.tokensPerDay`/`tokensPerWeek`/`tokensPerMonth`) reuse the Usage page's `UsageI18nKeys.TodayTitle`/`ThisWeekTitle`/`ThisMonthTitle`, resolved in `useCatalogItems`.
- **RTL / direction impact**: the Limits tab UI MUST use logical/flexible layout utilities only; it MUST NOT introduce physical left/right classes or directional icons. Progress rows contain text and a progress bar, so no icon mirroring is required.
- **Feature flag**: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is a data-completeness fix for an existing, already-shipped catalog details panel, not a new feature surface.
- **Memoisation**: `onFetchDetails` in `useCatalogItemDetails` MUST be wrapped in `useCallback`, and the `CatalogDetailsApi` adapter and labels objects in `useCatalogItems` in `useMemo`; the DTO-to-`EntitySpecificDetails` mapping functions and deployment-limits mapper MUST remain pure functions (no new memoisation needed beyond the callback itself, consistent with `mapEntityDetailsToCatalogDetails` today).
- **Accessibility**: `isDetailsLoading` renders its own `role="status"` indicator next to the tab row (`texts.detailsLoadingAriaLabel`, default `'Loading details'`). It is the panel's only loading indicator — the `About` tab's `item.description` is always available synchronously and has no loading state. Every capped limits row's progress bar MUST receive an accessible label naming the limit and the used/total value. An unlimited row renders no progress bar at all, so there is no bar to label: its `ariaLabel` ("{label}: {used} used. Follows cost limit.") carries the whole meaning, and a panel whose rows are all unlimited legitimately mounts zero `role="progressbar"` nodes.
- **Observability**: no new metrics/telemetry are required; failures are absorbed into `onFetchDetails` resolving `undefined` (per the Non-Goals in design.md, no new logging beyond what `apps/chat/src/server-api`'s shared client already emits on error). On the backend, `apps/chat-api/src/deployments/details/deployments-details.service.ts` logs raw-toolset and mapped-response payloads at debug level (secrets redacted) to aid diagnosing field-mapping gaps — this is diagnostic logging, not user-facing observability.

#### Scenario: No new context or global state

- **WHEN** the details panel closes
- **THEN** no fetched detail data persists outside `Catalog`'s local component state — reopening re-fetches; deployment details may be subject to the backend's 60s cache, while model limits follow the no-cache deployment-limits API contract

### Requirement: Only the active details request may update panel state

`Catalog.tsx` SHALL identify each in-flight `onFetchDetails` call by a
monotonically increasing request token held in a ref, and SHALL apply
`setFetchedDetails` and `setIsDetailsLoading` only while the token captured at
call time is still the current one. Comparing the opened item's `id` alone is
insufficient: closing the panel clears the pending-item ref and reopening the
same item re-assigns the same `id`, so a still-pending earlier response would
pass an id-only guard and overwrite the newer request's result.

Closing the details panel SHALL invalidate the current token, so a response that
arrives after the panel closed updates no state and cannot resurrect a closed
panel.

The existing pending-item-id ref SHALL be retained for the post-authentication
retry loop's between-attempt bail-out ("is the same item still open?"), which is
genuinely an item-identity question and whose attempts are awaited sequentially
and therefore never overlap.

The equivalent guarantee SHALL hold for the headless skill-details panel
pipeline (`useSkillDetailsPanelData` in `@epam/ai-dial-chat-hooks`), whose
effect-scoped cancellation flag SHALL be paired with the same captured-token
check so a close-and-reopen of the same skill cannot let the earlier response
land. That effect SHALL continue to key on the opened item's `id` only, so a
favorite toggle or a listings refresh rebuilds the `CatalogItem` without
triggering another details fetch.

This requirement adds a race guarantee only. It changes no prop, no returned
value, and no rendered output, and it is independent of which detail requests a
given entity branch issues.

#### Scenario: Close and reopen the same item while a request is pending

- **WHEN** a user opens an item's details, closes the panel before the fetch
  settles, reopens the same item, and the first request then resolves
- **THEN** the first response is discarded and the panel renders only the second
  request's result

#### Scenario: Response arriving after close is dropped

- **WHEN** the details panel is closed while a fetch is in flight and that fetch
  later resolves
- **THEN** neither the fetched details nor the loading flag is updated and the
  panel stays closed

#### Scenario: Switching to a different item

- **WHEN** a user opens item A's details and opens item B before A's fetch
  settles
- **THEN** A's response is discarded and the panel renders B's result

#### Scenario: Post-authentication retry still bails out on close

- **WHEN** the user closes the panel, or opens a different item, while a
  login/logout retry sequence is between attempts
- **THEN** the retry loop stops rather than re-fetching for the no-longer-open
  item

#### Scenario: Unrelated rerenders trigger no refetch

- **WHEN** the open panel rerenders because a favorite was toggled or the
  listings were refreshed, with the opened item's `id` unchanged
- **THEN** no additional details fetch is issued

### Requirement: Model catalog properties are exposed in Overview Specification

The BFF SHALL support DIAL Core model, application, and toolset details that contain
`catalog_properties`. The installed `@epam/ai-dial-typescript-sdk` represents this field
identically as `catalog_properties?: MapStringObject` on the model, application, and toolset
response schemas, where `MapStringObject` is `Record<string, unknown>`; the meaning of its keys
is schema-specific and is identified by `catalogSchemaId`/`catalog_schema_id`, not by entity
type. The BFF MUST therefore treat this object as untrusted, open-ended input for all three
entity types and allow-list only the following string-valued properties, using one shared
mapping helper so the allow-list and omit-when-empty behavior cannot drift between entity types:

- `provider`
- `vendor`
- `license`
- `knowledgeCutoffDate`
- `parameters` — the entity's parameter count for catalog display (e.g. `"100B"`); a free-form
  string, not parsed or validated as a number/unit pair

`GET /api/v1/deployments/:deployment/details` SHALL expose the recognized values as the optional
`catalogProperties` object in `DeploymentDetailsDto`, using `ModelCatalogPropertiesDto` with the
same five optional camelCase string fields, on all three per-type branches:
`modelDetails.catalogProperties`, `applicationDetails.catalogProperties`, and
`toolsetDetails.catalogProperties`. Unknown keys and recognized keys with non-string values MUST
be omitted. When no recognized string value remains, `catalogProperties` MUST be omitted from
that branch rather than returned as an empty object.

This is an additive response change. OpenAPI `operationId: getDeploymentDetails`, its path
parameter, authentication, status codes, rate limit, and the normal (non-`Raw`) generated
`DeploymentsApi.getDeploymentDetails({ deployment })` call remain unchanged. Regenerating
`@epam/ai-dial-chat-api-client` SHALL add the optional `catalogProperties` property to
`ApplicationDetailsDto` and `ToolsetDetailsDto` (it already exists on `ModelDetailsDto`).
Representative successful response fragments:

```json
{
  "id": "als-regre-19-adapter",
  "type": "model",
  "modelDetails": {
    "catalogProperties": {
      "provider": "Provider",
      "vendor": "Vendor",
      "license": "License",
      "knowledgeCutoffDate": "2026-08-17",
      "parameters": "100B"
    }
  }
}
```

```json
{
  "id": "applications/als-test-catalog",
  "type": "application",
  "applicationDetails": {
    "catalogProperties": {
      "provider": "Provider",
      "vendor": "Vendor",
      "license": "License",
      "knowledgeCutoffDate": "2026-08-17",
      "parameters": "100B"
    }
  }
}
```

```json
{
  "id": "toolsets/ALS-OauthToolset-copy",
  "type": "toolset",
  "toolsetDetails": {
    "catalogProperties": {
      "provider": "Provider",
      "vendor": "Vendor",
      "license": "License",
      "knowledgeCutoffDate": "2026-08-17",
      "parameters": "100B"
    }
  }
}
```

The frontend DTO mapper in `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL
copy these values into `ModelSpecification`, `AgentSpecification`, and `ToolsetSpecification`
respectively (all three gain the same five optional fields). The domain-to-section mapping SHALL
render every present value as a separate row in the corresponding details panel under `Overview`
→ `Specification`, in this order: Provider, Vendor, License, Knowledge cutoff date, Parameters —
for Model (`mapModelDetails`), Application (`mapAgentDetails`), and Toolset (`mapToolsetDetails`)
alike. Missing values SHALL NOT create empty rows.

The five rows SHALL use the fixed English labels "Provider", "Vendor", "License", "Knowledge
cutoff date" and "Parameters" for all three entity types. No i18n keys exist for them: the mapper
lives in `libs/chat-hooks`, which cannot import the app's `CatalogI18nKeys`, and there is no
`catalog.details.modelSpecification.*` lookup.

A valid date-only `knowledgeCutoffDate` in `YYYY-MM-DD` form SHALL be parsed as a local calendar
date and formatted with the same locale-sensitive `toLocaleDateString()` path as the existing
Release date row, for all three entity types. It MUST NOT be parsed as UTC, which could shift the
displayed calendar day in negative-offset time zones. A non-date or invalid date string SHALL
remain visible verbatim rather than being dropped or normalized to an invalid date.

This metadata is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It uses the existing
user-scoped deployment-details cache (`deployments:details:<userSub>:<deployment>`, 60-second TTL)
and existing invalidation behavior, unchanged for all three entity types. It introduces no new
metrics, analytics, or targeted raw deployment-payload debug logging. The rows are non-interactive
and reuse the existing Overview semantics and responsive layout; they add no keyboard interaction
or ARIA contract. The content is direction-agnostic, requires no directional icons, and MUST
inherit the existing LTR/RTL layout without physical-direction overrides. No new React state or
memoisation is required.

#### Scenario: All supported properties render in Specification for a model

- **WHEN** DIAL Core returns the five recognized string values shown in the example above for a model
- **THEN** the BFF returns them under `modelDetails.catalogProperties`
- **AND** the model details panel renders Provider, Vendor, License, Knowledge cutoff date, and Parameters as five rows under `Overview` → `Specification`

#### Scenario: All supported properties render in Specification for an application

- **WHEN** DIAL Core returns the five recognized string values shown in the example above for an application with `catalogSchemaId: "https://dial.epam.com/catalog-schemas/agent"`
- **THEN** the BFF returns them under `applicationDetails.catalogProperties`
- **AND** the application's Overview tab renders Provider, Vendor, License, Knowledge cutoff date, and Parameters as five rows under `Overview` → `Specification`

#### Scenario: All supported properties render in Specification for a toolset

- **WHEN** DIAL Core returns the five recognized string values shown in the example above for a toolset with `catalogSchemaId: "https://dial.epam.com/catalog-schemas/toolset"`
- **THEN** the BFF returns them under `toolsetDetails.catalogProperties`
- **AND** the toolset's Overview tab renders Provider, Vendor, License, Knowledge cutoff date, and Parameters as five rows under `Overview` → `Specification`

#### Scenario: Knowledge cutoff date uses the Release date display format

- **WHEN** `knowledgeCutoffDate` is `2026-08-17` on a model, application, or toolset
- **THEN** it is displayed through the same locale-sensitive date formatter as Release date, without changing the calendar day because of timezone conversion

#### Scenario: Unknown and non-string properties are ignored

- **WHEN** `catalog_properties` contains `provider: "Provider"`, `schemaSpecificExtra: true`, and `license: { "name": "License" }` on any of the three entity types
- **THEN** the corresponding `catalogProperties` field contains only `provider: "Provider"`
- **AND** no rows are rendered for `schemaSpecificExtra` or the non-string `license`

#### Scenario: Application or toolset with no catalog properties omits the field entirely

- **WHEN** DIAL Core returns an application or toolset whose response has no `catalog_properties`, or one where none of the five keys are present as strings
- **THEN** `applicationDetails.catalogProperties` / `toolsetDetails.catalogProperties` is omitted rather than returned as an empty object
- **AND** the Overview tab renders no Specification rows for provider/vendor/license/knowledge cutoff date/parameters

#### Scenario: Existing clients remain compatible

- **WHEN** a client ignores the optional `catalogProperties` field on any of the three branches
- **THEN** all pre-existing deployment-details response fields and behavior remain unchanged

### Requirement: Input modalities render as friendly labels, and internal-only capability flags are hidden

`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL render a model's and application's
`inputAttachmentTypes` (surfaced as `ModelSpecification.inputTypes` and
`AgentConfiguration.inputAttachmentTypes`) as human-readable labels via `mimeTypesToExtensionLabels` (`@epam/ai-dial-attachment-input`) rather
than the raw MIME type strings DIAL Core returns. A wildcard major type (`image/*`, `audio/*`,
`video/*`, `text/*`) SHALL render as `"<Major> files"` (e.g. `"Image files"`); the catch-all
wildcard `*/*` SHALL render as `"All files"` rather than falling through to the generic
`"<major> files"` template (which would otherwise render the nonsensical `"* files"`); a
known concrete MIME type SHALL render as its uppercased extension from `MIME_TYPE_EXT_MAP`
(e.g. `application/pdf` → `"PDF"` and
`application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `"DOCX"`), while
an unknown concrete MIME type SHALL fall back to its uppercased subtype.
The model's `Specification` section SHALL render this as an `Input modalities` row and the
application's `Configuration` section as an `Input attachments` row, both with the same
`mimeTypesToExtensionLabels` formatting and both labelled with hard-coded English literals (no
i18n keys). Output attachment types are not mapped onto `ModelSpecification`/`AgentConfiguration`
and no output row is rendered.

The model, application, and toolset `Capabilities` sections built by `mapModelDetails`/
`mapAgentDetails`/`mapToolsetDetails` SHALL NOT render rows for `hasMcp`, `hasCaching`,
`hasUrlAttachments`, `hasFolderAttachments`, `hasSeed`, `hasSystemPrompt`, or `hasResume`, even
though the backend continues to return these flags (`DeploymentFeaturesDetailsDto.mcp`/`cache`/
`urlAttachments`/`folderAttachments`/`seed`/`systemPrompt`/`allowResume`) and the frontend
`ModelCapabilities`/`AgentCapabilities`/`ToolsetCapabilities` types continue to carry them —
they are collected but intentionally unrendered, kept for a future or other consumer. A
toolset's `Capabilities` section — which, before this change, only ever rendered a subset of
these now-hidden flags — SHALL therefore never render at all (its `specs` array is always
empty). Model and application `Capabilities` sections continue to render `Tools`, `Parallel
tool calls`, `Reasoning efforts` (model only), and `Configuration schema` (application only),
and SHALL additionally render a `Skills` row driven by a new `hasSkills` flag, mapped from
`DeploymentFeaturesDetailsDto.skillsSupported` via `mapFeaturesToCapabilities`. Unlike the
seven flags above, `hasSkills` is not deliberately hidden: it SHALL be added to
`ModelCapabilities` and `AgentCapabilities` and rendered as the last row of each entity's
`Capabilities` section, following the same plain-string-literal, boolean Yes/No row pattern as
the existing rows. `ToolsetCapabilities` SHALL NOT gain a `hasSkills` field, since the
toolset `Capabilities` section never renders.

**Feature flag:** Not gated. **RTL impact:** None (label text only). **i18n impact:** None — the
`Input modalities`/`Input attachments` labels are untranslated literals, and no
`catalog.details.modelSpecification.*` keys exist in `translation-keys.ts`/`en.json`; the seven hidden capability rows had no i18n keys to remove
(they were untranslated string literals); the new `Skills` row likewise uses a plain,
untranslated string literal, consistent with the other rows in this section.

#### Scenario: Wildcard MIME types render as group labels

- **WHEN** a model's `input_attachment_types` is `["text/*", "image/*"]`
- **THEN** the `Specification` section's Input modalities row renders `"Text files, Image files"`

#### Scenario: The catch-all wildcard renders as "All files"

- **WHEN** a model's `input_attachment_types` is `["*/*"]`
- **THEN** the Input modalities row renders `"All files"`, not `"* files"`

#### Scenario: A known concrete MIME type renders as its extension label

- **WHEN** an application's `input_attachment_types` is `["application/pdf"]`
- **THEN** the `Configuration` section's Input attachments row renders `"PDF"`

#### Scenario: A structured vendor MIME type does not render as a raw subtype

- **WHEN** a model's `input_attachment_types` is `["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]`
- **THEN** the `Specification` section's Input modalities row renders `"DOCX"`

#### Scenario: Toolset Capabilities section never renders

- **WHEN** a toolset's `features` includes `mcp: true`, `cache: false`, and `systemPrompt: true`
- **THEN** the toolset's Overview tab data contains no `Capabilities` section at all

#### Scenario: Model Capabilities section omits the seven hidden flags

- **WHEN** a model's `features` includes `mcp`, `cache`, `urlAttachments`, `folderAttachments`,
  `seed`, `systemPrompt`, `allowResume`, `tools: true`, and `parallelToolCalls: true`
- **THEN** the model's `Capabilities` section renders only `Tools` and `Parallel tool calls`
  (plus `Reasoning efforts` when present, plus `Skills` when `skillsSupported` is present),
  with no rows for the seven hidden flags

#### Scenario: Model Capabilities section renders Skills when supported

- **WHEN** a model's `features` includes `skillsSupported: true`
- **THEN** the model's `Capabilities` section renders a `Skills` row with value `true`, after
  the `Tools`, `Parallel tool calls`, and `Reasoning efforts` rows

#### Scenario: Agent Capabilities section renders Skills when supported

- **WHEN** an application's `features` includes `skillsSupported: true`
- **THEN** the application's `Capabilities` section renders a `Skills` row with value `true`,
  after the `Tools`, `Parallel tool calls`, and `Configuration schema` rows

#### Scenario: Skills row is omitted when the backend does not report the flag

- **WHEN** a model's or application's `features` omits `skillsSupported` entirely
- **THEN** the entity's `Capabilities` section renders no `Skills` row, consistent with how
  every other optional Capabilities row is omitted when its backing flag is absent

#### Scenario: Toolset Capabilities section still never renders, even with skillsSupported present

- **WHEN** a toolset's `features` includes `skillsSupported: true`
- **THEN** the toolset's Overview tab data contains no `Capabilities` section at all, since
  `ToolsetCapabilities` does not carry `hasSkills`

### Requirement: The About tab is the only surface that reads `item.description`

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL NOT define an `intro` field.
The dedicated `About` tab (`CatalogDetailsTab.About`, `libs/catalog/src/types/detail-tab.ts`)
SHALL display `item.description` via the shared `AboutTab` component
(`libs/catalog/src/components/Details/TabsContent/About.tsx`), which takes an explicit
`content: string` prop rather than deriving its own fallback. The `About` tab is the only
`DetailsPanel` surface that renders `item.description`; it uses no async fetch, callback prop,
or loading state for this content.

`DetailsPanel` SHALL NOT render an always-visible summary section. The `Summary` component
(`libs/catalog/src/components/Details/Summary/`) and the `CatalogItem.summary` and
`CatalogItem.intro` fields it read were removed in the 1.0 redesign; nothing in
`libs/catalog` renders them today, and they MUST NOT be reintroduced as a second surface
for the same text. `AboutTab` SHALL carry what that section used to show that is still
in the model — it renders `content` followed by `item.topics` as `TopicTag`s — so the
description and the topic tags live on exactly one surface. Usage limits live in their own
`Limits` tab (see above), not in a summary strip.

The panel does still render `item.description` in the `Content` tab for long-form entities,
but only as the `CatalogItemPromptContent.description` fallback (`promptContent?.description ??
item.description`), which is a different tab and never visible at the same time as `About`.
The catalog grid card (`libs/catalog/src/components/CardGrid/Card.tsx`) also shows the
description; the "only surface" rule is scoped to `DetailsPanel`, not to the whole catalog.

`AboutTab` SHALL render `content` as Markdown via the shared `MarkdownRenderer`
(`@epam/ai-dial-chat-shared`) — the same renderer used for chat message content — rather than
a bespoke plain-text/bullet parser. Heading elements (`h1`–`h6`) and body elements (`p`/`ul`/`ol`)
SHALL use `detailsStyles?.typography?.contentHeadingClassName` (default `'dial-small-semi-text'`)
and `detailsStyles?.typography?.contentClassName` (default `'dial-small-text'`) respectively,
matching the typography this tab already exposed before switching renderers. This applies
uniformly to every entity type that supplies a description (models, applications, toolsets,
prompts, skills) since `content` is the same `item.description` string regardless
of type.

The `About` tab SHALL always be present in the tab row, as the first entry, regardless of
whether `item.details` is populated — unlike `Overview`/`Pricing`/`Api`/`Tools`, which only
appear when their corresponding `item.details` field is non-null.

The `apps/chat` adapter (`mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` in
`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`) SHALL NOT read or map any `intro`
field from `DeploymentItemDto`/`DialToolsetDto`.

#### Scenario: Only the About tab renders the description
- **WHEN** the details panel opens for any `CatalogItem`
- **THEN** the About tab renders `item.description`, and no other visible region of the
  panel repeats it

#### Scenario: Description renders as Markdown, not plain text
- **WHEN** `item.description` contains Markdown syntax (e.g. `**bold**`, a `-`/`*` bullet list,
  a fenced code block, or a link)
- **THEN** the About tab renders it through `MarkdownRenderer` with full formatting (bold text,
  a real `<ul>`/`<ol>` list, a syntax-highlighted code block, a clickable link) rather than the
  raw Markdown source or a heuristic bullet-only parse

#### Scenario: Topics render inside the About tab
- **WHEN** the details panel opens for a `CatalogItem` with a non-empty `topics` array
- **THEN** the About tab renders the description followed by the topic tags, and no separate
  summary strip renders above the tab row

#### Scenario: About tab renders topics only when present
- **WHEN** the details panel opens for a `CatalogItem` with an empty `topics` array
- **THEN** the About tab renders the description alone, with no empty tag row

#### Scenario: About tab is always first
- **WHEN** the details panel opens for any `CatalogItem`, regardless of which of
  `item.details.overview`/`pricing`/`limits`/`api`/`tools` are populated
- **THEN** the tab row's first entry is `About`

#### Scenario: Limits tab is shown only when usage limits are present
- **WHEN** `item.details.limits` is populated with one or more progress rows
- **THEN** the details panel includes a `Limits` tab after `Pricing` and renders each row, with a progress bar on the capped rows and a plain value on the unlimited ones

#### Scenario: Limits tab is hidden when usage limits are absent
- **WHEN** `item.details.limits` is `undefined`
- **THEN** the details panel does not render the `Limits` tab

#### Scenario: Deployment mapper does not populate an intro field
- **WHEN** `mapDeploymentToCatalogItem`/`mapToolsetToCatalogItem` map a
  `DeploymentItemDto`/`DialToolsetDto` into a `CatalogItem`
- **THEN** the resulting `CatalogItem` has no `intro` property


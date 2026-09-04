# catalog-item-details-fetch Specification

## Purpose

How the catalog details panel fetches an item's tab data on open: the lib's host-agnostic `onFetchDetails` contract, the app-level dispatch to the right backend wrapper per entity kind, and how partial or failed fetches degrade.
## Requirements
### Requirement: `libs/catalog` exposes an `onFetchDetails` callback prop

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain an optional `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemDetailsFetchResult | undefined>` field, documented with JSDoc per `libs/*` conventions. `Catalog.tsx` SHALL own the fetch-trigger state: when the details panel opens for an item and `onFetchDetails` is provided, it SHALL call `onFetchDetails(item)`, track a new `isDetailsLoading` boolean while pending, and store the resolved result in new local state.

`CatalogItemDetailsFetchResult` (`libs/catalog/src/models/item-details-data.ts`, exported from the lib's entry point) is the fetch-shaped counterpart of `CatalogItemTabData` — the type a host returns, distinct from the type the panel renders.

Note: this is the only async fetch-on-open mechanism in `Catalog.tsx`. An earlier `onFetchAboutContent`/`aboutContent`/`isAboutLoading` prop existed for the since-removed Summary section but was dropped as dead code (`CatalogView`'s implementation always resolved `undefined`); the `About` tab reads the static `item.description` synchronously, with no fetch or loading state of its own.

The lib MUST remain host-agnostic: `onFetchDetails` accepts only a `CatalogItem` and returns only the lib's own result type — it MUST NOT know about DIAL Core endpoint paths, `@epam/ai-dial-chat-api-client`, or any backend DTO shape. All of that knowledge lives in the app-level adapter (`apps/chat/src/components/CatalogView/CatalogView.tsx`) and in the host-agnostic mappers it calls.

When `onFetchDetails` resolves data, it SHALL **replace** any statically-provided `item.details` for the currently open item wholesale — fetched data is considered more current, and the panel does not merge the two. A host whose fetch covers only part of the panel must therefore rebuild the rest of the sections it still wants shown; the prompt branch below is the worked example. When `onFetchDetails` is not provided, or resolves `undefined`, behavior is unchanged from today: the panel falls back to `item.details` if present, otherwise hides the corresponding tabs.

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

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL implement `onFetchDetails` by dispatching on the opened item's `type` to the wrapper appropriate for that entity kind, branching prompt first, then skill, then the shared deployment path. All wrappers live in `apps/chat/src/server-api` and call generated `@epam/ai-dial-chat-api-client` methods — never `fetch` directly and never a new `base.ts` helper. The DTO-to-catalog mappers it calls are host-agnostic and live in `libs/chat-hooks/src/catalog/`.

**Deployment-backed items (`Model`, `Agent`, `Toolset`).** `CatalogView.tsx` SHALL call `getDeploymentDetails(id)` in `apps/chat/src/server-api/deployments.ts`, following the same pattern as the existing `getDeploymentConfiguration` wrapper, which in turn calls the generated `DeploymentsApi.getDeploymentDetails` method.

`CatalogView.tsx` SHALL convert the returned `DeploymentDetailsDto` into the appropriate `EntitySpecificDetails` variant (`libs/chat-hooks/src/catalog/entity-details.ts`) via `mapDeploymentDetailsDtoToEntityDetails(dto: DeploymentDetailsDto): EntitySpecificDetails`, which switches on `dto.type` — the discriminator the backend has already resolved server-side — not on the `CatalogItem`'s own `type` field. The result is then passed through `mapEntityDetailsToCatalogDetails`, in the same `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` module, to produce the core detail sections.

For model catalog items only, `CatalogView.tsx` SHALL also call the existing `getDeploymentLimits(item.id)` wrapper from `apps/chat/src/server-api/deployment-limits.ts` in parallel with `getDeploymentDetails(item.id)`. The returned `DeploymentLimitsResponseDto` SHALL be converted by an app-level mapper (for example `mapDeploymentLimitsDtoToCatalogLimits`) into `CatalogItemLimits` and merged into the returned `CatalogItemTabData` as `limits`. This mapper is the only place that knows DIAL Core's limit-stat field names (`minuteTokenStats`, `dayCostStats`, etc.); `libs/catalog` receives only resolved display data and numeric progress values.

**Prompt items (`CatalogEntityType.Prompt`).** `CatalogView.tsx` SHALL branch before the deployment path and resolve the item's body through the prompts wrappers in `apps/chat/src/server-api/prompts.api.ts`: `getPublicPrompt` with the parsed bucket-relative sub-path for the organisation source, and `getPrompt(item.id)` for a personal or shared prompt (the full `prompts/{bucket}/{path}` id passed unmodified, whether the prompt is the caller's own or shared with them). The result SHALL be returned as `{ promptContent: { content: dto.content }, overview }`. The `overview` is **not** optional decoration: because a fetch result replaces `item.details` wholesale, returning only `promptContent` would make the Overview tab the list mapper had already populated disappear the moment the panel finished loading. It is therefore rebuilt from the same DTO through a dedicated prompt-overview builder.

A prompt MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a prompt path.

**Skill items (`CatalogEntityType.Skill`).** `CatalogView.tsx` SHALL branch before the deployment path, parse `{ bucket, path }` out of `item.id` with `parseSkillResourceUrl` (`libs/chat-hooks/src/skill/skill-types.ts`), and resolve the panel's data through the skills wrappers in `apps/chat/src/server-api/skills.api.ts` with `Promise.allSettled`:

- `downloadSkillFile(bucket, path, SKILL_MANIFEST_FILE)` — read as text, size-capped, then run through the shared manifest parser, producing the Content body plus whatever summary and Specification section the manifest declares;
- `listSkillFiles({ bucket, path, filePath: '', recursive: true })` — an options object, not positional arguments — mapped to an `overview` section carrying author, last-updated, file count, and one row per file.

A manifest that downloads but fails to **parse** is not a failure: the parser hands back the raw text as the body, so the Content tab still renders, simply without a summary or Specification section.

The branch SHALL also record the opened skill's `{ bucket, path }` in a ref, because the Content tab's file picker reports back only a file's own path and needs to know which skill it belongs to. The panel shows one item at a time, so a single ref, rewritten on each open, is sufficient.

Each result is independently optional: either may be omitted when its request fails, and both failing resolves `undefined`. An `item.id` that `parseSkillResourceUrl` rejects SHALL resolve `undefined` with no request issued. A skill MUST NOT trigger `getDeploymentDetails` or `getDeploymentLimits`, since neither endpoint accepts a skill resource URL.

The `onFetchDetails` callback SHALL be wrapped in `useCallback` (dependencies: app-level adapter inputs such as `isAdmin` and `t`) to satisfy the design's memoisation requirement and avoid re-triggering `Catalog`'s fetch effect on unrelated `CatalogView` re-renders.

If a details server-api call rejects (network error or a mapped HTTP exception surfaced by the base client), `onFetchDetails` SHALL catch the error, resolve `undefined`, and log nothing beyond what the shared API client already logs — it MUST NOT throw out of the callback and break the details panel. If the model limits call rejects, the details result SHALL still be returned without `limits`; a limits-specific failure MUST NOT hide Overview/Pricing/API data. For a prompt, resolving `undefined` leaves the panel showing the `promptContent` the list mapper already seeded, so a failed refresh degrades to slightly stale content rather than an empty tab. For a skill, a partial failure returns whichever half succeeded rather than discarding both.

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
- **THEN** the app-level mapper marks the row as unlimited, formats the visible value as `Unlimited`, preserves the numeric `used`/`total` on the row, and still includes the row in the `Limits` tab
- **AND** the row renders as a plain value with no progress bar, since a bar drawn against an effectively-infinite total carries no information

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

#### Scenario: Personal prompt detail fetch renders the Content tab

- **WHEN** a user opens a personal prompt's details panel
- **THEN** `onFetchDetails` calls `getPrompt(item.id)` and resolves both `promptContent` and a rebuilt `overview`, and the panel renders the `Content` tab with the prompt's body alongside its Overview

#### Scenario: Organisation prompt detail fetch uses the public wrapper

- **WHEN** a user opens the details panel for a prompt from the organisation bucket
- **THEN** `onFetchDetails` calls `getPublicPrompt` with the prompt's bucket-relative sub-path and no personal-prompt request is dispatched

#### Scenario: Shared prompt detail fetch preserves the owner bucket

- **WHEN** a user opens `prompts/owner-bucket/Work/summarize`
- **THEN** `onFetchDetails` calls `getPrompt('prompts/owner-bucket/Work/summarize')`

#### Scenario: Prompt fetch never reaches the deployment endpoints

- **WHEN** the opened item's `type` is `CatalogEntityType.Prompt`
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Prompt fetch failure degrades to seeded content

- **WHEN** `getPrompt` rejects and the list mapper had already seeded `details.promptContent`
- **THEN** `onFetchDetails` resolves `undefined`, the panel keeps rendering the seeded body, and nothing throws

#### Scenario: Skill detail fetch renders Content and Overview

- **WHEN** a user opens a skill's details panel and both `downloadSkillFile('SKILL.md')` and `listSkillFiles` resolve
- **THEN** `onFetchDetails` resolves `{ promptContent: { content }, overview }` and the panel renders the manifest text and the file inventory

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
- **THEN** `onFetchDetails` resolves `undefined` without calling any skills wrapper

---

### Requirement: Generated-client and state-ownership contract for the new endpoint

The `getDeploymentDetails` endpoint SHALL satisfy the following generated-client, state-ownership, i18n, RTL, feature-flag, memoisation, accessibility, and observability contract:

- **State ownership**: no new React Context or hook is introduced. The fetch is triggered by `libs/catalog`'s `Catalog` component (owns `isDetailsLoading`/fetched-details state) and resolved by `CatalogView.tsx`'s `onFetchDetails` callback (owns the DTO→domain mapping); no state is lifted into `DeploymentsContext` since detail data is panel-scoped and not shared across the app.
- **Generated-client impact**: OpenAPI `operationId: 'getDeploymentDetails'` on the new controller method, exposed on the generated `DeploymentsApi` as `getDeploymentDetails({ deployment })`. Request: path param `deployment: string`. Response DTO: `DeploymentDetailsDto`. The frontend wrapper uses the normal (non-`Raw`) generated method, matching the existing `getDeploymentConfiguration`/`getDeploymentLimits` wrapper pattern. Model usage limits reuse the already-existing `getDeploymentLimits` generated method through `apps/chat/src/server-api/deployment-limits.ts`; no generated client changes are required for the UI tab.
- **i18n**: the Limits tab introduces user-visible strings for `catalog.details.tabLimits`, period labels such as `catalog.details.limits.tokensPerDay`, `catalog.details.limits.value`, `catalog.details.limits.unlimitedValue`, and `catalog.details.limits.progressAriaLabel`. These keys MUST live in `apps/chat/src/i18n/locales/en.json` and be referenced via `CatalogI18nKeys`.
- **RTL / direction impact**: the Limits tab UI MUST use logical/flexible layout utilities only; it MUST NOT introduce physical left/right classes or directional icons. Progress rows contain text and a progress bar, so no icon mirroring is required.
- **Feature flag**: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is a data-completeness fix for an existing, already-shipped catalog details panel, not a new feature surface.
- **Memoisation**: `onFetchDetails` in `CatalogView.tsx` MUST be wrapped in `useCallback`; the DTO-to-`EntitySpecificDetails` mapping functions and deployment-limits mapper MUST remain pure functions (no new memoisation needed beyond the callback itself, consistent with `mapEntityDetailsToCatalogDetails` today).
- **Accessibility**: `isDetailsLoading` renders its own `role="status"` indicator next to the tab row (`texts.detailsLoadingAriaLabel`, default `'Loading details'`). It is the panel's only loading indicator — the `About` tab's `item.description` is always available synchronously and has no loading state. Every limits row progress bar MUST receive an accessible label naming the limit and the used/total value. Rows formatted as `Unlimited` render no progress bar at all, so there is no bar to label: their value text carries the whole meaning, and a panel whose rows are all unlimited legitimately mounts zero `role="progressbar"` nodes.
- **Observability**: no new metrics/telemetry are required; failures are absorbed into `onFetchDetails` resolving `undefined` (per the Non-Goals in design.md, no new logging beyond what `apps/chat/src/server-api`'s shared client already emits on error). On the backend, `deployments.service.ts` logs raw-toolset and mapped-response payloads at debug level (secrets redacted) to aid diagnosing field-mapping gaps — this is diagnostic logging, not user-facing observability.

#### Scenario: No new context or global state

- **WHEN** the details panel closes
- **THEN** no fetched detail data persists outside `Catalog`'s local component state — reopening re-fetches; deployment details may be subject to the backend's 60s cache, while model limits follow the no-cache deployment-limits API contract

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

The five rows reuse the same label strings already used for the Model row order ("Provider",
"Vendor", "License", "Knowledge cutoff date", "Parameters"); no new i18n keys are introduced, and
the existing app-level `CatalogI18nKeys` lookup (`catalog.details.modelSpecification.*`) that
translates those label strings continues to apply unchanged to the Application and Toolset rows.

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

### Requirement: Input/Output modalities render as friendly labels, and internal-only capability flags are hidden

`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL render a model's and application's
`inputAttachmentTypes`/`outputAttachmentTypes` (surfaced as `ModelSpecification.inputTypes`/
`outputTypes` and `AgentConfiguration.inputAttachmentTypes`/`outputAttachmentTypes`) as
human-readable labels via `mimeTypesToExtensionLabels` (`@epam/ai-dial-attachment-input`) rather
than the raw MIME type strings DIAL Core returns. A wildcard major type (`image/*`, `audio/*`,
`video/*`, `text/*`) SHALL render as `"<Major> files"` (e.g. `"Image files"`); the catch-all
wildcard `*/*` SHALL render as `"All files"` rather than falling through to the generic
`"<major> files"` template (which would otherwise render the nonsensical `"* files"`); a
known concrete MIME type SHALL render as its uppercased extension from `MIME_TYPE_EXT_MAP`
(e.g. `application/pdf` → `"PDF"` and
`application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `"DOCX"`), while
an unknown concrete MIME type SHALL fall back to its uppercased subtype.
The `Specification` section's row labels for these two fields SHALL use the i18n keys
`catalog.details.modelSpecification.inputModalities` / `.outputModalities`
(`CatalogI18nKeys.DetailsModelInputModalities` / `DetailsModelOutputModalities`), replacing the
previous untranslated `'Input type'`/`'Output type'` literals. The `Configuration` section's
`Input attachments`/`Output attachments` rows (Agent only) SHALL use the same
`mimeTypesToExtensionLabels` formatting for their values, keeping their existing labels.

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
tool calls`, `Reasoning efforts` (model only), and `Configuration schema` (application only).

**Feature flag:** Not gated. **RTL impact:** None (label text only). **i18n impact:** New keys
`catalog.details.modelSpecification.inputModalities`/`.outputModalities` added to
`translation-keys.ts`/`en.json`; the seven hidden capability rows had no i18n keys to remove
(they were untranslated string literals).

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
  (plus `Reasoning efforts` when present), with no rows for the seven hidden flags

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

---

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`CatalogView` SHALL create a stable app-level `CatalogDetailsApi` adapter from
the existing `apps/chat/src/server-api` wrappers, pass it with resolved labels,
configuration and skill metadata to `useCatalogItemDetails` from
`@epam/ai-dial-chat-hooks`, and pass the returned stable `onFetchDetails`
callback to `Catalog`. It SHALL NOT retain the entity dispatch/mapping algorithm
inline or add direct `fetch`/client construction.

**Deployment-backed items (`Model`, `Agent`, `Toolset`).** The controller SHALL
call the injected deployment-details operation and reuse the current
`mapDeploymentDetailsDtoToEntityDetails` and
`mapEntityDetailsToCatalogDetails` pipeline. It SHALL preserve DTO-discriminator
mapping, application MCP/connect endpoint precedence, credentials, admin-only
data and all currently rendered sections. Models alone SHALL request limits in
parallel and reuse the current `chat-hooks` deployment-limits mapper; a limits
failure SHALL not hide otherwise successful details.

**Prompts.** The controller SHALL branch before deployments and call the
injected public operation for organisation prompts, personal operation for
personal prompts, or the personal/shared operation with parsed owner bucket for
qualified shared ids. Because fetched data replaces static details wholesale,
the result SHALL contain both prompt content and the rebuilt overview. Prompt
failure SHALL resolve `undefined` to preserve seeded list content. Prompts SHALL
not call deployment operations.

**Skills.** The controller SHALL parse `{ bucket, path }` from the qualified id,
store it only in a private ref for subsequent file loads, and execute manifest
download and recursive file listing with `Promise.allSettled`. Each half SHALL
be independently optional; both failures or an invalid id resolve `undefined`,
and invalid ids issue no request. A downloaded but unparseable manifest SHALL
return raw text rather than fail. Skills SHALL not call deployment operations.

All callbacks SHALL be `useCallback`-stable for stable inputs. Rejected details
operations SHALL resolve `undefined` and SHALL NOT log or throw beyond the
configured client's existing behavior.

#### Scenario: Successful model fetch renders structured tabs

- **WHEN** model details resolve with the model DTO discriminator
- **THEN** the controller returns mapped Overview/Pricing/API data

#### Scenario: Model limits render the Limits tab

- **WHEN** model limits contain a usable stats field
- **THEN** the existing hook-layer mapper supplies `details.limits`

#### Scenario: Model limits failure preserves other details

- **WHEN** details resolve and limits reject
- **THEN** details return without limits

#### Scenario: Unlimited limits remain accessible

- **WHEN** DIAL Core returns its effectively unlimited total
- **THEN** the existing mapper preserves the numeric values and the resolved
  unlimited visible/accessibility labels, which the row renders without a
  progress bar

#### Scenario: Toolset details preserve credentials

- **WHEN** toolset details resolve with authentication settings
- **THEN** the mapped overview and credential/admin data match current behavior

#### Scenario: Application endpoint precedence is unchanged

- **WHEN** application details contain MCP and connect interface data
- **THEN** the same current MCP/connect endpoint and credential precedence is
  returned

#### Scenario: Backend error does not crash the panel

- **WHEN** a deployment detail operation rejects
- **THEN** `onFetchDetails` resolves `undefined` and Catalog falls back to its
  static details

#### Scenario: All deployment types use the same operation

- **WHEN** a Model, Agent, or Toolset is opened
- **THEN** the injected deployment-details operation is used, and only Model
  also requests limits

#### Scenario: Personal prompt renders content and overview

- **WHEN** a personal prompt is opened
- **THEN** the personal operation receives `item.id` and the returned fetched
  data includes Content and rebuilt Overview

#### Scenario: Organisation prompt uses the public operation

- **WHEN** an organisation prompt is opened
- **THEN** only the public prompt operation is used

#### Scenario: Shared prompt preserves owner bucket

- **WHEN** `prompts/owner-bucket/Work/summarize` is opened
- **THEN** the shared read receives `('Work/summarize', 'owner-bucket')`

#### Scenario: Prompt never reaches deployments

- **WHEN** a Prompt is opened
- **THEN** neither deployment details nor limits is requested

#### Scenario: Prompt failure degrades to seeded content

- **WHEN** prompt refresh rejects and list mapping seeded content
- **THEN** the callback resolves `undefined` and seeded content remains

#### Scenario: Skill details combine manifest and inventory

- **WHEN** manifest download and recursive listing both resolve
- **THEN** returned data contains manifest content/specification and overview
  inventory matching current mapping

#### Scenario: Skill partial failure returns the successful half

- **WHEN** one of manifest or inventory rejects
- **THEN** the other half is returned without throwing

#### Scenario: Unparseable manifest renders raw text

- **WHEN** manifest download succeeds but parsing fails
- **THEN** raw manifest text remains Content without summary/specification

#### Scenario: Invalid skill id issues no request

- **WHEN** a skill id cannot be parsed
- **THEN** the callback resolves `undefined` without invoking a skill operation

## MODIFIED Requirements

### Requirement: Model catalog properties are exposed in Overview Specification

The BFF SHALL support DIAL Core model, application, and toolset details that contain
`catalog_properties`. The installed `@epam/ai-dial-typescript-sdk` represents this field
identically as `catalog_properties?: MapStringObject` on the model, application, and toolset
response schemas, where `MapStringObject` is `Record<string, unknown>`; the meaning of its keys
is schema-specific and is identified by `catalogSchemaId`/`catalog_schema_id`, not by entity
type. The BFF MUST therefore treat this object as untrusted, open-ended input for all three
entity types and allow-list only the following string-valued properties, using one shared
mapping helper so the allow-list and omit-when-empty behavior cannot drift between entity types:

- `vendor`
- `license`
- `knowledgeCutoffDate`
- `parameters` — the entity's parameter count for catalog display (e.g. `"100B"`); a free-form
  string, not parsed or validated as a number/unit pair

`catalog_properties.provider` SHALL NOT be read for any entity type, as if it had never been part of
the allow-list. DIAL Core now sends a model's provider as the top-level `provider` field (see "Model
Overview shows the top-level provider and lifecycle dates"). Applications and toolsets have no
provider at all, because Core added that field to models only.

`GET /api/v1/deployments/:deployment/details` SHALL expose the recognized values as the optional
`catalogProperties` object in `DeploymentDetailsDto`, using `ModelCatalogPropertiesDto` with the
four optional camelCase string fields `vendor`, `license`, `knowledgeCutoffDate` and `parameters`, on all three per-type branches:
`modelDetails.catalogProperties`, `applicationDetails.catalogProperties`, and
`toolsetDetails.catalogProperties`. Unknown keys and recognized keys with non-string values MUST
be omitted. When no recognized string value remains, `catalogProperties` MUST be omitted from
that branch rather than returned as an empty object.

This was an additive response change. Removing `provider` from `ModelCatalogPropertiesDto` is not
additive: clients that read `catalogProperties.provider` lose it on every branch. OpenAPI `operationId: getDeploymentDetails`, its path
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
    "provider": "Provider",
    "catalogProperties": {
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
respectively (all three carry the same four optional fields). `ModelSpecification.provider` SHALL
be copied from `modelDetails.provider`; `AgentSpecification` and `ToolsetSpecification` have no
`provider` field. The domain-to-section mapping SHALL
render every present value as a separate row in the corresponding details panel under `Overview`
→ `Specification`, in this order: Vendor, License, Knowledge cutoff date, Parameters (for a model,
preceded by the top-level Provider row) —
for Model (`mapModelDetails`), Application (`mapAgentDetails`), and Toolset (`mapToolsetDetails`)
alike. Missing values SHALL NOT create empty rows.

The rows SHALL take their labels from `EntityDetailsLabels` (`provider`, `vendor`, `license`,
`knowledgeCutoffDate`, `parameters`), whose English defaults are "Provider", "Vendor",
"License", "Knowledge cutoff date" and "Parameters". The mapper lives in `libs/chat-hooks`,
which cannot import the app's `CatalogI18nKeys`, so `apps/chat` fills them with `t()` in
`buildEntityDetailsLabels` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) from the
`catalog.entityDetails.*` i18n keys.

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

- **WHEN** DIAL Core returns a model with top-level `provider: "Provider"` and the four recognized string values shown in the example above
- **THEN** the BFF returns `modelDetails.provider` and the four values under `modelDetails.catalogProperties`
- **AND** the model details panel renders Provider, Vendor, License, Knowledge cutoff date, and Parameters as five rows under `Overview` → `Specification`, with Provider taken from `modelDetails.provider`

#### Scenario: All supported properties render in Specification for an application

- **WHEN** DIAL Core returns the four recognized string values shown in the example above for an application with `catalogSchemaId: "https://dial.epam.com/catalog-schemas/agent"`
- **THEN** the BFF returns them under `applicationDetails.catalogProperties`
- **AND** the application's Overview tab renders Vendor, License, Knowledge cutoff date, and Parameters as four rows under `Overview` → `Specification`, and no Provider row

#### Scenario: All supported properties render in Specification for a toolset

- **WHEN** DIAL Core returns the four recognized string values shown in the example above for a toolset with `catalogSchemaId: "https://dial.epam.com/catalog-schemas/toolset"`
- **THEN** the BFF returns them under `toolsetDetails.catalogProperties`
- **AND** the toolset's Overview tab renders Vendor, License, Knowledge cutoff date, and Parameters as four rows under `Overview` → `Specification`, and no Provider row

#### Scenario: Knowledge cutoff date uses the Release date display format

- **WHEN** `knowledgeCutoffDate` is `2026-08-17` on a model, application, or toolset
- **THEN** it is displayed through the same locale-sensitive date formatter as Release date, without changing the calendar day because of timezone conversion

#### Scenario: Unknown and non-string properties are ignored

- **WHEN** `catalog_properties` contains `provider: "Provider"`, `vendor: "Vendor"`, `schemaSpecificExtra: true`, and `license: { "name": "License" }` on any of the three entity types
- **THEN** the corresponding `catalogProperties` field contains only `vendor: "Vendor"`
- **AND** no rows are rendered for `provider`, `schemaSpecificExtra` or the non-string `license`

#### Scenario: Application or toolset with no catalog properties omits the field entirely

- **WHEN** DIAL Core returns an application or toolset whose response has no `catalog_properties`, or one where none of the four keys are present as strings (a `provider`-only object counts as none)
- **THEN** `applicationDetails.catalogProperties` / `toolsetDetails.catalogProperties` is omitted rather than returned as an empty object
- **AND** the Overview tab renders no Specification rows for vendor/license/knowledge cutoff date/parameters

#### Scenario: Existing clients remain compatible

- **WHEN** a client ignores the optional `catalogProperties` field on any of the three branches
- **THEN** all pre-existing deployment-details response fields and behavior remain unchanged

### Requirement: Entity-details Overview labels are host-supplied

`libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL export:

- an `EntityDetailsLabels` interface with one field per Overview section title and spec label it renders:
  - section titles: `capabilitiesTitle`, `specificationTitle`, `configurationTitle`;
  - spec labels: `tools`, `parallelToolCalls`, `reasoningEfforts`, `skills`, `provider`, `vendor`, `license`, `knowledgeCutoffDate`, `parameters`, `hostedBy`, `releaseDate`, `deprecationDate`, `endOfService`, `contextWindow`, `maxOutputTokens`, `inputModalities`, `inputAttachments`, `routes`, `configurationSchema`, `authentication`, `authorizationEndpoint`, `tokenEndpoint`, `oauthScopes`;
- `DEFAULT_ENTITY_DETAILS_LABELS`, holding the English strings, including `deprecationDate: 'Deprecation date'` and `endOfService: 'End of service'`. `provider` is used only by the model Overview.

`mapEntityDetailsToCatalogDetails(details, labels?)` SHALL accept `labels?: Partial<EntityDetailsLabels>` and merge it over the defaults. `useCatalogItemDetails` (`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`) SHALL accept `entityDetailsLabels?: Partial<EntityDetailsLabels>` in its options and forward it. Callers that pass nothing SHALL get output identical to today.

The labels SHALL be the only strings the host supplies: section and row order, omit-when-absent rules, value formatting and the input-modality and pricing-key labels stay as they are. The chat app SHALL pass every label translated, built by `buildEntityDetailsLabels` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) and memoised on `t` in `useCatalogItems` (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`). Each label uses a `CatalogI18nKeys` member (`apps/chat/src/constants/translation-keys.ts`); `deprecationDate` and `endOfService` use `catalog.entityDetails.deprecationDate` and `catalog.entityDetails.endOfService`.

#### Scenario: Defaults are unchanged

- **WHEN** `mapEntityDetailsToCatalogDetails(details)` runs on the existing test fixtures
- **THEN** every section title and spec label equals the English defaults, including "Deprecation date" and "End of service" when those rows render

#### Scenario: A host overrides one label

- **WHEN** a host passes `{ specificationTitle: 'Spécification', hostedBy: 'Hébergé par' }`
- **THEN** only those two strings change in the returned Overview sections

#### Scenario: The hook forwards labels

- **WHEN** `useCatalogItemDetails` is called with `entityDetailsLabels` and its `onFetchDetails` resolves a toolset
- **THEN** the returned `overview` uses the supplied labels

## ADDED Requirements

### Requirement: Model Overview shows the top-level provider and lifecycle dates

`ModelSpecification` (`libs/chat-hooks/src/catalog/entity-details.ts`) SHALL carry
`deprecationDate?: string` and `endOfService?: string`, each with an inline JSDoc. Its existing
`provider?` keeps its type and now holds DIAL Core's top-level model `provider`.
`mapModelDetailsDto` in `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` SHALL copy
`modelDetails.provider`, `modelDetails.deprecationDate` and `modelDetails.endOfService` from the
generated `DeploymentDetailsDto` into them. A model's `specification` SHALL be built when any of
the three is present, even if no other specification field is.

`mapModelDetails` SHALL render "Deprecation date" (`labels.deprecationDate`) and "End of service"
(`labels.endOfService`) as rows under `Overview` → `Specification`, directly after Release date
and before Context window. The full model row order is: Provider, Vendor, License, Knowledge cutoff
date, Parameters, Hosted by, Release date, Deprecation date, End of service, Context window, Max
output tokens, Input modalities. A field that is absent SHALL render no row. Both dates SHALL be
formatted by the same `formatCatalogDate` path as Knowledge cutoff date: a valid `YYYY-MM-DD`
value is parsed as a local calendar date and shown with `toLocaleDateString()`, and any other
string is shown verbatim. The rows are plain informational text. They SHALL NOT add a warning,
badge, colour, sort order or block based on the dates.

Application (`mapAgentDetails`) and toolset (`mapToolsetDetails`) Overviews SHALL get no lifecycle
rows. They have no Provider row either (see "Model catalog properties are exposed in Overview
Specification").

`libs/catalog` SHALL NOT change: it renders the `OverviewSection` rows it receives. All
host-owned knowledge stays outside the libs. The labels arrive through `EntityDetailsLabels`,
the data arrives as the already-fetched `DeploymentDetailsDto`, and neither lib reads i18n,
locale settings or endpoint paths.

State is owned by the existing `useCatalogItemDetails` hook
(`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`). No context, state or memoisation is
added. The `entityDetailsLabels` object stays memoised on `t` in `useCatalogItems`. The feature is
not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It adds no telemetry and no cache: the
values ride on the existing deployment-details cache.

The two new i18n keys are `catalog.entityDetails.deprecationDate` ("Deprecation date") and
`catalog.entityDetails.endOfService` ("End of service"). They are declared as
`CatalogI18nKeys.EntityDetailsDeprecationDate` and `CatalogI18nKeys.EntityDetailsEndOfService`.

RTL: the rows reuse the existing Overview label/value markup. They are direction-agnostic text
with no icon, so they need no mirroring and add no physical-direction class. Accessibility: the rows
are non-interactive, add no ARIA contract and keep the Overview's existing semantics.

#### Scenario: Model Overview shows all three fields

- **WHEN** `modelDetails` carries `provider: "Azure"`, `deprecationDate: "2026-12-31"` and `endOfService: "2027-03-31"`
- **THEN** the Specification section shows Provider "Azure", then, after Release date, Deprecation date and End of service, each formatted like Release date

#### Scenario: Absent lifecycle dates render no rows

- **WHEN** `modelDetails` carries `provider: "Azure"` and neither date
- **THEN** the Specification section shows a Provider row and no Deprecation date or End of service row

#### Scenario: A lifecycle date alone creates the Specification section

- **WHEN** `modelDetails` carries only `endOfService: "2027-03-31"` among the specification fields
- **THEN** the Overview has a Specification section with a single End of service row

#### Scenario: A non-ISO date is shown verbatim

- **WHEN** `modelDetails.deprecationDate` is `"Q4 2026"`
- **THEN** the Deprecation date row shows `Q4 2026`

#### Scenario: The calendar day does not shift across time zones

- **WHEN** `modelDetails.endOfService` is `"2027-03-31"` and the browser is in a negative-offset time zone
- **THEN** the End of service row shows 31 March 2027 in the browser's locale format

#### Scenario: The host translates the new labels

- **WHEN** a host passes `{ deprecationDate: 'Date de dépréciation', endOfService: 'Fin de service' }`
- **THEN** the two rows use those labels and every other row is unchanged

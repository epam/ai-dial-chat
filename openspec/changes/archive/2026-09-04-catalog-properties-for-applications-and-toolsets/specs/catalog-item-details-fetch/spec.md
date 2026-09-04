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

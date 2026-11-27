## MODIFIED Requirements

### Requirement: Session-protected model catalog list endpoint

The BFF SHALL expose `GET /api/v1/model-catalog`. A `ModelCatalogController` (`@Controller({ path: 'model-catalog', version: '1' })`, `@ApiTags('models')`) SHALL be registered in `ModelsModule` (`apps/chat-api/src/models/models.module.ts`). The route lists the DIAL Core models visible to `MODEL_CATALOG_API_KEY`'s roles, for display to any signed-in user.

The endpoint:

- MUST require a valid BFF session (the global `SessionGuard`, with no `@Public()`). An unauthenticated request SHALL be rejected with `401` before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured, without calling DIAL Core
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models` through the `@epam/ai-dial-typescript-sdk` client's `getModels` (`DialClientService`), sending `Api-Key: <MODEL_CATALOG_API_KEY>` and never the session's bearer token
- SHALL return `200 OK` with `{ "data": ModelCatalogEntryDto[] }` (`ModelCatalogListResponseDto` in `apps/chat-api/src/models/dto/model-catalog-response.dto.ts`). Each entry SHALL carry only the display fields listed in `MODEL_CATALOG_ENTRY_FIELDS`, copied from Core's entry, plus the separately projected `catalog_properties` and `supportedInterfaces` described below. Core's invocation settings (`defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`), `catalog_schema_id`, and any raw Core field neither the copy list nor an explicit projection names SHALL be dropped, because the catalog shows models the caller cannot use. `ModelCatalogEntryDto` is a `PickType` of `DialModelDto` over the same list, so the Swagger schema and the runtime projection of the copied fields cannot drift. Core entries that are not objects or have no string `id` SHALL be dropped with a `warn` log. It SHALL NOT add per-user fields (for example an `accessible` flag), filter by the caller's roles, or merge in the caller's own model list
- SHALL copy Core's top-level `provider`, `deprecation_date` and `end_of_service` as Core sends them. All three are members of `MODEL_CATALOG_ENTRY_FIELDS`, and each SHALL be absent from an entry whose Core model does not carry it. The BFF SHALL NOT parse, validate or default them: `provider` is free-form text and the two dates are documented by Core as `YYYY-MM-DD`, but Core does not validate them. They are display data, so they fit the catalog's display-only rule
- SHALL reduce Core's `catalog_properties` with `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), the allowlist that `deployment-details-api` already uses, and return the result as `catalog_properties` typed `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`). Only `vendor`, `license`, `knowledgeCutoffDate` and `parameters` with string values SHALL be kept. `catalog_properties.provider` is not part of the allowlist: the top-level `provider` is the model's provider. Unknown keys and non-string values SHALL be dropped. `catalog_properties` SHALL be omitted when Core sends none, sends a value that is not an object, or sends no recognised string key (a `provider`-only object counts as none). `catalog_properties` is not a member of `MODEL_CATALOG_ENTRY_FIELDS`. `ModelCatalogEntryDto` declares it on its own as `@ApiPropertyOptional({ type: () => ModelCatalogPropertiesDto })`
- SHALL expose optional `supportedInterfaces: string[]` containing only normalized canonical supported API names, without copying `interface_configs`, its defaults or its default headers; this is a separately projected field on `ModelCatalogEntryDto`, not a member of the Core-field copy list
- MUST set `Cache-Control: private, max-age=300` on a `200` response
- SHALL have the OpenAPI `operationId` `listModelCatalog`. The generated SDK method is `ModelsApi.listModelCatalog()`, there is no request DTO, and the response DTO is `ModelCatalogListResponseDto`. Its generated `ModelCatalogEntryDto` SHALL include `provider?: string`, `deprecationDate?: string`, `endOfService?: string` and `catalogProperties?: ModelCatalogPropertiesDto`, plus `supportedInterfaces?: string[]`, whose catalog-properties type has no `provider` (the generated client camelCases property names; the wire names are `provider`, `deprecation_date`, `end_of_service` and `catalog_properties`; the new `supportedInterfaces` field has the same name on the wire and in the generated DTO; normal methods preserve the JSON object without case conversion)

`DialModelDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) SHALL declare `catalog_properties` as an optional free-form object (`type: 'object', additionalProperties: true`), and `provider`, `deprecation_date` and `end_of_service` as optional strings with `@ApiPropertyOptional` descriptions and examples (`'Azure'`, `'2026-12-31'`, `'2027-03-31'`), so `PickType` can name them and the `GET /api/v1/models` schema documents what that route already forwards. The runtime body of `GET /api/v1/models` SHALL NOT change: it keeps forwarding Core's model objects as sent, including any `catalog_properties.provider`.

Example:

```http
GET /api/v1/model-catalog HTTP/1.1
Cookie: <session cookie>
```

```json
{
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "display_name": "GPT-4o",
      "description": "Restricted to the research role",
      "pricing": { "unit": "token", "prompt": "0.000005", "completion": "0.000015" },
      "provider": "Azure",
      "deprecation_date": "2026-12-31",
      "end_of_service": "2027-03-31",
      "catalog_properties": {
        "vendor": "OpenAI",
        "knowledgeCutoffDate": "2023-10-01"
      }
    }
  ]
}
```

#### Scenario: Signed-in user sees models they cannot access

- **GIVEN** `MODEL_CATALOG_API_KEY` is set, its role can see `gpt-4o` and `claude-opus`, and the signed-in user's roles allow only `claude-opus`
- **WHEN** the user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `200` with both `gpt-4o` and `claude-opus` in `data`, each reduced to its display fields

#### Scenario: Invocation settings are not exposed

- **GIVEN** DIAL Core returns `gpt-4o` with `defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`, `catalog_schema_id` and a field the BFF does not know
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries its display fields and none of those six

#### Scenario: Catalog properties are allowlisted

- **GIVEN** DIAL Core returns `gpt-4o` with `catalog_properties: { "provider": "Azure", "vendor": "OpenAI", "knowledgeCutoffDate": "2023-10-01", "license": { "name": "MIT" }, "internalNote": "x" }`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries `catalog_properties: { "vendor": "OpenAI", "knowledgeCutoffDate": "2023-10-01" }`, with no `provider`, no `license` and no `internalNote`

#### Scenario: Entry without catalog properties omits the field

- **GIVEN** DIAL Core returns `gpt-4o` with no `catalog_properties`, `claude-opus` with `catalog_properties: { "internalNote": "x" }`, and `gemini-pro` with `catalog_properties: { "provider": "Google" }`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** none of the three entries has a `catalog_properties` key

#### Scenario: Provider and lifecycle dates are copied as Core sends them

- **GIVEN** DIAL Core returns `gpt-4o` with `provider: "Azure"`, `deprecation_date: "Q4 2026"` and `end_of_service: "2027-03-31"`, and `claude-opus` with none of the three
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the `gpt-4o` entry carries the three values unchanged, including the non-ISO `deprecation_date`
- **AND** the `claude-opus` entry has no `provider`, `deprecation_date` or `end_of_service` key

#### Scenario: Unauthenticated request is rejected

- **WHEN** `GET /api/v1/model-catalog` is called without a session cookie
- **THEN** the BFF returns `401` and makes no DIAL Core request

#### Scenario: Key not configured

- **GIVEN** `MODEL_CATALOG_API_KEY` is unset
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** the BFF returns `404` and makes no DIAL Core request

#### Scenario: Existing user-scoped list is unchanged

- **GIVEN** `MODEL_CATALOG_API_KEY` is set
- **WHEN** the same user calls `GET /api/v1/models`
- **THEN** the BFF still proxies with the session's bearer token, uses cache key `models:list:<user.sub>` with a 30-second TTL, and returns only the models the user's roles allow, each with the `catalog_properties` Core sent, unfiltered, and with `provider`, `deprecation_date` and `end_of_service` when Core sent them

### Requirement: Model catalog detail endpoint reads from the cached list

The BFF SHALL expose `GET /api/v1/model-catalog/:modelName` on `ModelCatalogController`. It returns the single catalog entry whose `id` equals `modelName`, resolved from the same cached list (and the same in-flight fetch) as `GET /api/v1/model-catalog`. It MUST NOT call DIAL Core `GET /openai/models/{model_name}`.

The endpoint:

- MUST require a valid BFF session, as the list route does
- MUST validate `modelName` with `GetModelDto` (`apps/chat-api/src/models/dto/get-model.dto.ts`) and return `400 Bad Request` for a name that fails its allowlist `@Matches`, before any catalog work
- SHALL return `404 Not Found` when `MODEL_CATALOG_API_KEY` is not configured
- SHALL return `404 Not Found` when no catalog entry has `id === modelName`. That includes a model that exists in Core but is hidden from the key's roles
- SHALL return `200 OK` with the cached entry (`ModelCatalogEntryDto`), already reduced to its display fields, including `provider`, `deprecation_date`, `end_of_service`, the allowlisted `catalog_properties`, and the normalized `supportedInterfaces` when present
- MUST set `Cache-Control: private, max-age=300` on a `200` response
- SHALL return the list route's errors unchanged when the underlying catalog fetch fails
- SHALL have the OpenAPI `operationId` `getModelCatalogEntry`. The generated SDK method is `ModelsApi.getModelCatalogEntry({ modelName })`, the request DTO is the `GetModelDto` path parameter, and the response DTO is `ModelCatalogEntryDto`, including optional generated `supportedInterfaces?: string[]`; normal generated calls suffice and no `Raw` call is required

Example:

```http
GET /api/v1/model-catalog/gpt-4o HTTP/1.1
Cookie: <session cookie>
```

```json
{
  "id": "gpt-4o",
  "object": "model",
  "display_name": "GPT-4o",
  "provider": "Azure",
  "end_of_service": "2027-03-31",
  "catalog_properties": { "vendor": "OpenAI" }
}
```

#### Scenario: Model present in the catalog

- **GIVEN** the cached catalog contains `gpt-4o`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF returns `200` with the `gpt-4o` entry and makes no DIAL Core request

#### Scenario: Detail entry carries provider, lifecycle dates and catalog properties

- **GIVEN** DIAL Core returned `gpt-4o` with `provider: "Azure"`, `end_of_service: "2027-03-31"` and `catalog_properties: { "provider": "Legacy", "vendor": "OpenAI", "internalNote": "x" }` when the catalog was cached
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the entry carries `provider: "Azure"`, `end_of_service: "2027-03-31"` and `catalog_properties: { "vendor": "OpenAI" }`

#### Scenario: Model not in the catalog

- **GIVEN** the catalog does not contain `secret-model`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/secret-model`
- **THEN** the BFF returns `404`, whether or not `secret-model` exists in DIAL Core

#### Scenario: Invalid model name

- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/bad%2Fname`
- **THEN** the BFF returns `400` and makes no DIAL Core request

#### Scenario: Cold cache fetches the list once

- **GIVEN** an empty catalog cache
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog/gpt-4o`
- **THEN** the BFF fetches `GET /openai/models` once with the catalog key, caches the list, and answers from it

### Requirement: Model catalog contract is unchanged when no tag is configured

With `HIDDEN_ENTITY_TAGS` unset or empty, both catalog routes SHALL retain the same access, entry visibility, caching and error behavior. The OpenAPI operations `listModelCatalog` and `getModelCatalogEntry`, the request DTO `GetModelDto`, the response DTO identities `ModelCatalogListResponseDto` / `ModelCatalogEntryDto` and the `Cache-Control` header SHALL NOT change. The additive normalized `supportedInterfaces` response property SHALL apply regardless of whether hidden tags are configured. No `ENABLED_FEATURES` gate, UI, i18n key or metric is added.

#### Scenario: Empty tag list changes nothing

- **GIVEN** `HIDDEN_ENTITY_TAGS` is unset or empty, and the key sees `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/model-catalog`
- **THEN** `gpt-4o` and every other entry with a string `id` are returned, as today

## ADDED Requirements

### Requirement: Model catalog exposes a minimal normalized supported-interface list

GET /api/v1/model-catalog and GET /api/v1/model-catalog/{modelName} SHALL expose optional `supportedInterfaces`: string[] on each projected model entry, using the same declaration interpretation as deployment-details-api. The list SHALL be derived from `interface_configs` canonical keys with object descriptors, or equivalent declared API names when `interface_configs` is unavailable. Empty object descriptors SHALL count as advertisements; null/array/primitive descriptors SHALL NOT.

The current canonical normalized values SHALL be `openaiChatCompletions`, `openaiEmbeddings`, `openaiResponses` and `anthropicMessages`, emitted once each in that order when supported. Unknown names, categorical interfaces such as chat/mcp, and invalid values SHALL be ignored, without throwing or inferring support from the ID/provider.

When declaration metadata is absent or malformed and no usable equivalent API declarations exist, the normalized list SHALL fall back to boolean legacy `features.chat_completion`/`features.responses_api` for their respective OpenAI names only. An explicitly empty valid declaration map/array SHALL produce an empty normalized list, not restore legacy flags into it. Unknown-only object declaration metadata SHALL produce an empty known-interface list. A nonempty interfaces array containing no canonical API names SHALL be unusable and retain the legacy fallback. When neither usable declarations nor boolean legacy OpenAI flags exist, `supportedInterfaces` SHALL be omitted; absence means unavailable metadata, not inferred Messages support.

The list/detail request bodies remain absent. Both routes SHALL require a valid BFF session, and only the existing list fetch SHALL use `MODEL_CATALOG_API_KEY`. Existing 400 validation, 401 session, 404 unconfigured/missing/hidden model, 429 limits, 502 upstream/malformed catalog body and 503 key-rejected/unavailable errors SHALL remain unchanged; no declaration-parsing error status is added. The operationIds remain `listModelCatalog` and `getModelCatalogEntry`, request parameters remain unchanged, and generated normal `ModelsApi` methods SHALL expose `supportedInterfaces?: string[]` with the same wire field name and no runtime case conversion. SDK artifacts SHALL be generated from Swagger source, never edited manually.

Raw `interface_configs` and any nested defaults/`default_headers`/headers/upstream addresses SHALL NOT appear in either catalog response as part of this projection. Existing display-data allowlists, catalog-property normalization, hidden-model filtering and prevention of hidden model existence disclosure SHALL remain unchanged.

List and detail SHALL share the already-projected five-minute per-instance catalog entry and in-flight request. Detail SHALL NOT fetch Core's single-model endpoint, and both routes SHALL keep Cache-Control: private, max-age=300 on success only. TTL expiration remains the only cache invalidation; restart clears the boot-configured cache. No new cache key, new frontend context/hook, UI/localization/RTL/a11y surface, telemetry event or `ENABLED_FEATURES` gate is introduced by this metadata projection.

Example requests:

```http
GET /api/v1/model-catalog HTTP/1.1
Cookie: <session cookie>

GET /api/v1/model-catalog/messages-only HTTP/1.1
Cookie: <session cookie>
```

Relevant list response:

```json
{"data":[{"id":"messages-only","object":"model","supportedInterfaces":["anthropicMessages"]}]}
```

Relevant detail response:

```json
{"id":"messages-only","object":"model","supportedInterfaces":["anthropicMessages"]}
```

#### Scenario: Mixed model metadata is normalized and projected

- **WHEN** Core's catalog entry declares `anthropicMessages`, `openaiResponses` and `openaiChatCompletions` with object descriptors
- **THEN** both BFF routes expose `supportedInterfaces`: ["openaiChatCompletions", "openaiResponses", "anthropicMessages"] for that model

#### Scenario: Messages-only metadata survives without legacy fields

- **WHEN** the Core model has `interface_configs`: { "anthropicMessages": {} } and no interfaces/features field
- **THEN** the projected entry carries `supportedInterfaces`: ["anthropicMessages"]

#### Scenario: Embeddings remain a distinct advertised interface

- **WHEN** a model declares only `openaiEmbeddings`
- **THEN** `supportedInterfaces` contains only `openaiEmbeddings` and no generation API is invented

#### Scenario: Detail metadata is identical to the cached list entry

- **GIVEN** the shared catalog cache contains a Messages-capable projected model
- **WHEN** its detail route is called
- **THEN** `supportedInterfaces` equals that list entry's value and no separate Core `getModel` call is made

#### Scenario: Legacy payloads preserve independent OpenAI metadata

- **WHEN** a model lacks usable declarations but `features.chat_completion` is true and `features.responses_api` is false
- **THEN** `supportedInterfaces` contains only `openaiChatCompletions`

#### Scenario: Missing metadata is not fabricated

- **WHEN** a model has no usable declarations or boolean legacy OpenAI flags, even if its ID begins anthropic.
- **THEN** `supportedInterfaces` is omitted and the existing display fields are returned

#### Scenario: Explicitly empty declarations remain empty

- **WHEN** Core sends `interface_configs`: {} or an explicitly empty equivalent interfaces array
- **THEN** `supportedInterfaces` is [] without a legacy OpenAI union

#### Scenario: Unknown and malformed interface descriptors are safe

- **WHEN** Core sends unknown keys or null/array/primitive canonical descriptors
- **THEN** no such descriptor becomes a supported API, the response remains successful, and other model display fields remain intact

#### Scenario: Interface defaults and headers are excluded

- **WHEN** a supported interface descriptor includes defaults, `default_headers` or other nested settings
- **THEN** list and detail expose only its normalized name, not raw `interface_configs` or the nested settings

#### Scenario: Hidden model metadata is not disclosed

- **WHEN** Core returns a Messages-capable model with a configured hidden tag
- **THEN** its model-catalog list entry is absent and its catalog detail remains 404

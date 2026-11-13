## Why

The model catalog (`GET /api/v1/model-catalog`, `GET /api/v1/model-catalog/{modelName}`, added in #9781 / #9842) drops DIAL Core's `catalog_properties`. `ModelCatalogEntryDto` is a `PickType` of `DialModelDto` over `MODEL_CATALOG_ENTRY_FIELDS`, and `DialModelDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) does not declare the field, so it cannot be listed. Models Garden reads `catalog_properties.provider`, `.vendor` and `.knowledgeCutoffDate` for the Provider column and filter, the "by …" creator line and filter, and the knowledge cutoff on the model page. Catalog-only models therefore show "—" and drop out of both filters (issue #9846).

## What Changes

- `DialModelDto` declares an optional free-form `catalog_properties` (`type: 'object', additionalProperties: true`), the same shape `defaults` uses today. This only documents what `GET /api/v1/models` already forwards. The runtime response of that route does not change.
- Catalog entries carry `catalog_properties` reduced by the existing allowlist `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), typed as the existing `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`): `provider`, `vendor`, `license`, `knowledgeCutoffDate` and `parameters`, strings only. Unknown keys and non-string values are dropped. The field is omitted when no recognised string remains, and also when Core sends none.
- `ModelCatalogEntryDto` declares `catalog_properties?: ModelCatalogPropertiesDto` on top of its `PickType`. The field is not added to `MODEL_CATALOG_ENTRY_FIELDS`, because that list means "copied as Core sends it".
- `catalog_schema_id` stays excluded from the catalog.
- The OpenAPI spec and `@epam/ai-dial-chat-api-client` are regenerated: `DialModelDto.catalogProperties?: { [key: string]: unknown }` and `ModelCatalogEntryDto.catalogProperties?: ModelCatalogPropertiesDto` (the client camelCases property names; the wire name stays `catalog_properties`).

No change is **BREAKING**. Both changes add an optional field.

## Non-goals

- Pass `catalog_properties` through to the catalog untouched. The user chose the allowlist instead (see Alternatives).
- Change `GET /api/v1/models`, `GET /api/v1/models/{modelName}` or `GET /api/v1/deployments/details`.
- Add any frontend consumer in this repo. Models Garden lives outside it and reads the generated client.

## Alternatives considered

- **Free-form pass-through (the issue's first option).** Simplest, but the catalog shows models the caller cannot use. Every key a deployment keeps in `catalog_properties` would reach those users, which goes against the catalog's "display data only" rule. It would also give the same Core field two different contracts: free-form here, allowlisted in `deployment-details-api`. Rejected.
- **A new catalog-specific allowlist of the three keys the frontend needs.** Narrower, but it would be a second list that drifts from `mapCatalogProperties`, and Models Garden would see `license`/`parameters` on the details route but never in the catalog. Rejected.
- **Reuse `mapCatalogProperties` and `ModelCatalogPropertiesDto` (chosen).** This is one allowlist for one Core field across both BFF surfaces. Nothing new is written beyond the DTO property and one line in the projection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-catalog`: catalog entries carry allowlisted `catalog_properties`. The list-endpoint requirement now names it as the one field that is projected rather than copied, and `DialModelDto` documents the free-form field.

## Impact

- **Code:** `apps/chat-api/src/openapi/openapi-response.dto.ts` (`DialModelDto`), `apps/chat-api/src/models/dto/model-catalog-response.dto.ts` (`ModelCatalogEntryDto`, doc comment), `apps/chat-api/src/models/catalog/model-catalog.service.ts` (`toCatalogEntry`), and `apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`. The `models` domain imports `mapCatalogProperties` and `ModelCatalogPropertiesDto` from `deployments`. That is a plain TS import with no Nest module dependency.
- **API / client:** two new optional fields in the OpenAPI document and in `libs/chat-api-client` (generated, regenerated with `npm run openapi`, not hand-edited). Existing clients are unaffected.
- **Docs:** the `apps/chat-api/README.md` "Model catalog" section, and the `model-catalog` spec through this delta. `docs/architecture.md` describes the route as "display data only" and needs no edit.
- **Libs:** no hand-authored `libs/*` change. Only the generated client changes.
- **i18n / UI / RTL / a11y:** none. The change adds no user-visible string and no UI.
- **Security:** fewer keys are exposed than with a pass-through. The allowlist is the same one already served to users through `/deployments/details`.
- **Rollback:** revert the commit and regenerate the client. Consumers already treat the field as optional.

## Acceptance criteria

- A catalog entry whose Core deployment has `catalog_properties` with any of the five recognised string keys returns those keys, and only those, under `catalog_properties` on both catalog routes.
- An entry whose Core deployment has no `catalog_properties`, or none of the recognised string keys, omits the field.
- `catalog_schema_id` never appears in a catalog entry.
- `DialModelDto.catalog_properties` (free-form) and `ModelCatalogEntryDto.catalog_properties` (`ModelCatalogPropertiesDto`) appear in the OpenAPI document and the generated client, and `npm run openapi:check` passes.
- `GET /api/v1/models` returns the same body as before.
- Unit tests, the `model-catalog` spec and the README are updated.

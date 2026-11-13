## Context

`ModelCatalogService` (`apps/chat-api/src/models/catalog/model-catalog.service.ts`) projects each Core entry with `toCatalogEntry`. The function copies only the keys in `MODEL_CATALOG_ENTRY_FIELDS` (`apps/chat-api/src/models/dto/model-catalog-response.dto.ts`), and `ModelCatalogEntryDto` is `PickType(DialModelDto, MODEL_CATALOG_ENTRY_FIELDS)`. Because the list is typed `satisfies readonly (keyof DialModelDto)[]`, a field `DialModelDto` does not declare cannot be listed. `catalog_properties` is in that position. The SDK types it `MapStringObject` and `GET /api/v1/models` forwards it unchanged (`ModelsService.listModels` returns Core's `data` as is), but neither DTO declares it.

The same Core field already has a BFF contract elsewhere. `GET /api/v1/deployments/details` reduces it with `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) to `ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`): five optional strings, omitted when none is present. The `catalog-item-details-fetch` and `deployment-details-api` specs describe that contract.

The user chose to reuse that allowlist for the catalog rather than pass Core's object through (proposal, "Alternatives considered").

## Goals / Non-Goals

**Goals:**

- Catalog entries on both routes carry `catalog_properties` with the same allowlist and DTO as `/deployments/details`.
- `DialModelDto` documents the free-form field `/models` already returns.
- The Swagger schema and the runtime projection still agree, and the regenerated client exposes both fields.

**Non-Goals:**

- Changing the `/models`, `/models/{name}` or `/deployments/details` runtime bodies.
- Exposing `catalog_schema_id`.
- Moving `mapCatalogProperties` or `ModelCatalogPropertiesDto` out of `deployments/`.

## Decisions

### 1. `catalog_properties` is projected, not picked

`ModelCatalogEntryDto` keeps its `PickType` over `MODEL_CATALOG_ENTRY_FIELDS` and adds its own property:

```ts
export class ModelCatalogEntryDto extends PickType(DialModelDto, MODEL_CATALOG_ENTRY_FIELDS) {
  @ApiPropertyOptional({ type: () => ModelCatalogPropertiesDto })
  catalog_properties?: ModelCatalogPropertiesDto;
}
```

`toCatalogEntry` copies the listed fields as today, then sets `catalog_properties` from `mapCatalogProperties(model.catalog_properties)` only when the result is defined. That keeps an absent field absent, rather than present with the value `undefined`.

*Alternative:* add `'catalog_properties'` to `MODEL_CATALOG_ENTRY_FIELDS`. That would inherit `DialModelDto`'s free-form schema and copy Core's object verbatim, which is exactly the pass-through the user rejected. Overriding the type on a picked key would also make the "same list drives both" comment false. The doc comment on `MODEL_CATALOG_ENTRY_FIELDS` is updated to say that the list is the copied fields and `catalog_properties` is the one projected field.

### 2. Reuse `mapCatalogProperties` and `ModelCatalogPropertiesDto` from `deployments/`

`models/` imports both from `deployments/`. This is a plain TypeScript import of a pure function and a Swagger class. It adds no Nest module import or provider, so `ModelsModule` stays independent of `DeploymentsModule`. One allowlist for one Core field means a key added for the Overview panel shows up in the catalog too, which is the behaviour Models Garden wants.

*Alternative:* move both into `apps/chat-api/src/common/`. That is cleaner ownership, but it touches the deployments domain and its spec references for no behaviour gain. Leave it until a third consumer appears.

`mapCatalogProperties` returns an object whose unrecognised slots are `undefined` (for example `{ provider: 'Azure', vendor: undefined, … }`). `JSON.stringify` drops them, so the wire body matches the spec. Unit tests compare with `toEqual`, which also ignores `undefined` properties. The cached value is shared by reference and never serialised internally, so nothing else depends on it.

### 3. `DialModelDto.catalog_properties` is free-form

Add `@ApiPropertyOptional({ type: 'object', additionalProperties: true }) catalog_properties?: Record<string, unknown>` next to `defaults`/`responses_defaults`. This describes `/models` truthfully: it forwards whatever Core sends, and the user can access those models anyway. The generated client gains `catalogProperties?: { [key: string]: unknown }` on `DialModelDto` (the client camelCases property names, as it does for `responsesDefaults`). Nothing in `apps/chat` or `libs/chat-hooks` imports `DialModelDto` today.

### 4. Caching is unchanged

Projection happens in `fetchCatalog` before the value is cached, so the single per-instance entry (5-minute TTL, TTL-only invalidation, shared in-flight request) holds the already-filtered properties. No new key, TTL or invalidation event is added.

## Authorization

Unchanged. Both catalog routes still require a BFF session (global `SessionGuard`) and no role. `/models` is unchanged.

## Risks / Trade-offs

- [A deployment keeps a sensitive value under one of the five recognised keys] → It reaches users without access to the model. The same is already true on `/deployments/details` for users who can see the deployment. The keys are named for display (`provider`, `vendor`, `license`, `knowledgeCutoffDate`, `parameters`), and the README states that the catalog shows them.
- [Models Garden later needs a key outside the five] → Extend `mapCatalogProperties` and `ModelCatalogPropertiesDto` once. Both surfaces pick it up, and the change goes through the `deployment-details-api` and `model-catalog` specs.
- [`models/` → `deployments/` import grows into coupling] → The import is limited to one pure function and one DTO. Decision 2 records the move to `common/` as the follow-up if a third consumer appears.
- [Swagger drift between `ModelCatalogEntryDto` and the projection] → The property is declared once on the DTO and set once in `toCatalogEntry`. A service unit test asserts the projected value, and `npm run openapi:check` catches any client drift.

## Migration Plan

Additive. Deploy the BFF and publish the regenerated `@epam/ai-dial-chat-api-client`. Old clients ignore the new optional field. To roll back, revert the commit and regenerate the client. No data or config migration is needed, and there is no new env variable or feature flag.

## Open Questions

None.

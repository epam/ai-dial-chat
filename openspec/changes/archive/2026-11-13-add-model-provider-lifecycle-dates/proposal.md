## Why

DIAL Core added three optional, informational fields to models (epam/ai-dial-core#2276, fixes epam/ai-dial-core#2275): `provider`, `deprecation_date` and `end_of_service` on `ModelData` (`GET /openai/models`, `GET /openai/models/{id}`). Core omits a field that is not set, does not validate it, and adds it to models only. An alias carries its target's values. Chat drops all three today (issue #9857):

- Model details (`GET /api/v1/deployments/{deployment}/details`, `modelDetails`) take the provider only from `catalog_properties.provider`, through `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`), the allowlist that applications and toolsets share.
- `DialModelDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) declares none of the three, so `MODEL_CATALOG_ENTRY_FIELDS` (`apps/chat-api/src/models/dto/model-catalog-response.dto.ts`) cannot list them and both model catalog routes drop them.
- `mapModelDetailsDto` in `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` reads `catalogProperties.provider` for the Overview row, and nothing reads the two dates.

The SDK blocker (epam/ai-dial-typescript-sdk#67) is closed. `@epam/ai-dial-typescript-sdk@0.3.0-dev.3` types all three fields on `ModelData`, and on the Configuration API `Model` as `provider`, `deprecationDate` and `endOfService`. This branch already pins it in `apps/chat-api/package.json`.

## What Changes

- **SDK.** `apps/chat-api` pins `@epam/ai-dial-typescript-sdk` at `0.3.0-dev.3`, up from `0.2.0`. `typecheck` and `lint` for `chat-api` pass on it unchanged. The only failing `chat-api` test is `explicit-environment.spec.ts`, and only when a local `apps/chat-api/.env.local` leaks into the run. It passes in isolation, and the archived `add-catalog-properties-to-model-catalog` change records the same leak.
- **Model details.** `ModelDetailsDto` gains `provider?`, `deprecationDate?` and `endOfService?` (strings), copied from the typed SDK fields `provider`, `deprecation_date` and `end_of_service` with no cast.
- **`provider` leaves `catalog_properties` everywhere, as if it had never been there** (the user chose this; see Alternatives). `mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) no longer reads it, and `ModelCatalogPropertiesDto` no longer declares it. No new DTO is added. This applies to models, applications and toolsets alike, because they share the allowlist. A model's provider now comes only from Core's top-level `provider`. Applications and toolsets have no provider at all, because Core added the top-level field to models only.
- **Model catalog.** `DialModelDto` declares optional `provider`, `deprecation_date` and `end_of_service` with Swagger metadata, and `MODEL_CATALOG_ENTRY_FIELDS` lists them, so both catalog routes copy them as Core sends them. They are display data, which the catalog's "display data only" rule allows. The runtime body of `GET /api/v1/models` does not change, because that route already forwards Core's object as is.
- **Catalog Overview.** `ModelSpecification` (`libs/chat-hooks/src/catalog/entity-details.ts`) gains `deprecationDate?` and `endOfService?`, and `AgentSpecification` / `ToolsetSpecification` lose `provider`. `mapModelDetailsDto` reads `provider` from `modelDetails.provider`. Application and toolset Overviews no longer render a Provider row. `mapModelDetails` renders "Deprecation date" and "End of service" rows after "Release date", formatted by the existing `formatCatalogDate`. A field that is absent renders no row. `EntityDetailsLabels` gains `deprecationDate` and `endOfService` with English defaults. `apps/chat` fills them with `t()` through `buildEntityDetailsLabels` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`).
- **Contract.** The OpenAPI document and `@epam/ai-dial-chat-api-client` are regenerated with `npm run openapi`.

**BREAKING (contract):** `catalogProperties.provider` (on all three details branches) and `catalog_properties.provider` (model catalog) are no longer returned, and `ModelCatalogPropertiesDto` in the generated client no longer has `provider`. A model consumer, such as Models Garden's Provider column and filter on the catalog, must switch to the top-level `provider`. For applications and toolsets there is no replacement. In this repo the readers were `mapModelDetailsDto`, `mapApplicationDetailsDto` and `mapToolsetDetailsDto`, and this change updates all three.

## Non-goals

- Warning banners, badges, sorting or blocking of deprecated or end-of-service models. That needs design (issue: out of scope).
- `lifecycle_status`. Core leaves it unchanged.
- Validating or normalising the date strings in the BFF. Core does not validate them either. A value that is not `YYYY-MM-DD` reaches the UI verbatim, as `knowledgeCutoffDate` already does.
- Adding the fields to applications, routers or toolsets.
- Showing the dates in the catalog list cards or the model selector. Only the details Overview changes.
- Moving the SDK pin to a non-prerelease `0.3.0`. That is a follow-up once it is published (see tasks).

## Alternatives considered

- **Fallback: top-level `provider` ?? `catalog_properties.provider`.** No deployment that has not migrated loses its provider. But the BFF would carry the same value in two places for models, and Models Garden would keep reading the old key forever. Rejected by the user.
- **Fallback, and strip `catalog_properties.provider`.** The contract is clean and the transition is soft. But the BFF would invent a value Core did not send under the new field's name, and the "source of truth" would depend on which field happens to be set. Rejected together with the plain fallback.
- **Remove `provider` from models' `catalog_properties` only, with a model-specific `ModelCatalogPropertiesWithoutProviderDto`.** Applications and toolsets would keep their Provider row, but this adds a second DTO and mapper for one field. The user rejected it ("no new DTO"), and it was briefly implemented and then reverted.
- **Strip `provider` for models at runtime only and keep the shared DTO.** This needs no new type, but the generated client would still advertise a property that never arrives on models. Rejected for the same reason.
- **Remove `provider` from the shared allowlist and DTO everywhere (chosen).** There is one source per field, no new type, and the smallest diff. The cost is that applications and toolsets lose their Provider row, and that a model which only sets `catalog_properties.provider` shows no provider until its operator sets Core's `provider`. Both are recorded under Impact.
- **Read the new fields off the raw object with `getString`.** That is how `mapCatalogProperties` reads untyped input. The SDK now types these three fields, so the issue's "no local casts" criterion is met by reading `raw.provider` and the like directly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment-details-api`: `ModelDetailsDto` gains `provider`, `deprecationDate` and `endOfService`. `ModelCatalogPropertiesDto` loses `provider` on every branch.
- `model-catalog`: entries copy `provider`, `deprecation_date` and `end_of_service`. `catalog_properties` loses `provider`. `DialModelDto` documents the three fields.
- `catalog-item-details-fetch`: the model Overview takes Provider from the top-level field and shows Deprecation date and End of service. The catalog-properties allowlist drops `provider` for all entity types, and application and toolset Overviews lose their Provider row. `EntityDetailsLabels` gains two labels. The stale statements that no i18n keys exist for the Overview rows and that the app passes no labels are corrected: `buildEntityDetailsLabels` already exists.

## Impact

- **Code (chat-api):** `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` (`ModelDetailsDto`, `ModelCatalogPropertiesDto`), `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts` (`mapCatalogProperties`), `apps/chat-api/src/deployments/details/deployments-details.service.ts` (`buildModelDetails`), `apps/chat-api/src/openapi/openapi-response.dto.ts` (`DialModelDto`), `apps/chat-api/src/models/dto/model-catalog-response.dto.ts` (`MODEL_CATALOG_ENTRY_FIELDS`), and their specs.
- **Code (libs):** `libs/chat-hooks/src/catalog/entity-details.ts` and `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`. These are a shared lib (scope flag). The change stays inside the existing DTO-to-display mapper, which already depends on the generated client's types under the `chat-hooks` exception in `AGENTS.md`. No host knowledge enters the lib: labels arrive through `EntityDetailsLabels` and dates use the existing `formatCatalogDate`. `libs/catalog` is unchanged, because it renders the `OverviewSection` rows it is given.
- **Code (app):** `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **i18n:** two new user-visible strings: `catalog.entityDetails.deprecationDate` ("Deprecation date") and `catalog.entityDetails.endOfService` ("End of service"). `en.json` is the only locale file.
- **API / client:** additive fields on `ModelDetailsDto`, `DialModelDto` and `ModelCatalogEntryDto`. `ModelCatalogPropertiesDto` loses `provider`, which is the breaking removal described above.
- **Data visibility:** a model whose operator set only `catalog_properties.provider` loses its Provider row until the operator sets Core's `provider`. Applications and toolsets lose their Provider row with no replacement.
- **Docs:** `apps/chat-api/README.md` ("Model catalog"), `libs/chat-hooks/README.md` (`EntityDetailsLabels`), and the three specs through this change's deltas. `docs/architecture.md` describes the catalog as "display data only" and lists no fields, so it needs no edit.
- **RTL / a11y:** the two rows reuse the existing Overview row markup. They are direction-agnostic text with no icons and no interaction.
- **Rollback:** revert the commit, regenerate the client, and pin the SDK back to `0.2.0`. Core's fields stay optional, so an older BFF keeps ignoring them.

## Acceptance criteria

- `apps/chat-api/package.json` pins `@epam/ai-dial-typescript-sdk` at the version that contains epam/ai-dial-typescript-sdk#67 (`0.3.0-dev.3`), and no cast reads the three fields.
- `GET /api/v1/deployments/{model}/details` returns `modelDetails.provider`, `modelDetails.deprecationDate` and `modelDetails.endOfService` when Core sends them, and omits each when Core does not.
- No `catalogProperties` (details, any branch) and no model catalog `catalog_properties` carries `provider`. Each is omitted when nothing else recognised remains. Application and toolset Overviews show no Provider row.
- `GET /api/v1/model-catalog` and `GET /api/v1/model-catalog/{modelName}` return `provider`, `deprecation_date` and `end_of_service` when Core sends them, and omit them otherwise.
- The catalog model Overview shows Provider (top-level), Deprecation date and End of service, each only when present, with the dates formatted like Release date and the labels translated through `t()`.
- `npm run openapi` and `npm run openapi:check` pass, and `@epam/ai-dial-chat-api-client` is regenerated and not hand-edited.
- Unit tests cover the mapper, the details service, the catalog projection and the `chat-hooks` mapping. `npm run validate:docs` and `npm run validate:specs` pass.

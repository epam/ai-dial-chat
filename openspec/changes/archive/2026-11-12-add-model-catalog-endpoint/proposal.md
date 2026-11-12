## Why

A frontend served by the BFF (Models Garden) needs to show the deployment's whole model catalog and mark the models the signed-in user cannot use. The BFF only lists models with the session access token today (`GET /api/v1/models`, `apps/chat-api/src/models/models.service.ts:22`), so a user sees only the models their roles allow, and a browser must never hold a DIAL API key that could list the rest. Tracked in [epam/ai-dial-chat#9781](https://github.com/epam/ai-dial-chat/issues/9781).

## Problem

- `GET /api/v1/models[/:modelName]` proxies Core `GET /openai/models[/{name}]` with `getBearerAuthHeaders(session.at)`, cached per user (30 s / 60 s). Core lists a model only when its `userRoles` is unset or shares a role with the caller, so a restricted model is invisible to a user without that role, and the lookup route answers `403` for it.
- `DIAL_API_KEY` (`apps/chat-api/src/config/env/dial.env.ts:47`) is used only for utility-model conversation naming (`apps/chat-api/src/conversations/naming/conversation-naming.service.ts:285`). The README states that it is not used for user-scoped routes.
- No route lists models with server credentials. The frontend cannot build the catalog itself.

## Solution

1. **New optional server-only secret `MODEL_CATALOG_API_KEY`** on `DialEnv`, sent to Core as `Api-Key` (`getApiKeyAuthHeaders`, `apps/chat-api/src/common/utils/auth-header.ts:7`). It is separate from `DIAL_API_KEY`: the catalog key's role must be granted access to every catalog model, while the naming key needs only `UTILITY_MODEL`. A blank or whitespace-only value counts as unset. The issue suggests `MODELS_CATALOG_API_KEY` as an example name. We use the singular form so the variable, the `model-catalog` route and the `modelCatalogAvailable` flag share one stem.
2. **`GET /api/v1/model-catalog`**: session-protected (no `@Public()`). It returns Core's `GET /openai/models` list for the catalog key, with each entry reduced to its display fields (`{ data: ModelCatalogEntryDto[] }`, a subset of `DialModelDto`). It keeps one server-side cache entry shared by all users per BFF instance, with a 5-minute TTL. Concurrent cache misses share one in-flight Core request. When the key is unset, it returns `404`.
3. **`GET /api/v1/model-catalog/:modelName`**: returns one entry from the same cached list without a separate Core call. It validates the name with `GetModelDto` (`400`) and returns `404` for a name that is not in the catalog. A per-model Core call would answer `403` for a hidden model and so reveal that the model exists.
4. **Error policy**: Core errors are mapped as in `ModelsService` (`mapDialHttpStatus`), except that a Core `401`/`403` for the catalog key becomes `503`. That status means the server is misconfigured, not that the user's session has expired. The frontend's unauthorized middleware signs the user out on any `401`. The key never appears in logs or responses.
5. **`config.modelCatalogAvailable`** on `GET /api/v1/client-config`. It is `true` when the key is set and is assembled by `AppConfigService` from `ConfigService`, as `aiTextRefinementAvailable` is (`apps/chat-api/src/app-config/app-config.service.ts:107`). The frontend therefore does not need a probe request.

The new controller and service follow the existing `ModelsController` / `ModelsService` pattern (`apps/chat-api/src/models/models.controller.ts`) and live in the `models` domain, so they reuse `GetModelDto` and `DialModelDto`. The single-flight follows `ImmutableResourceStore` (`apps/chat-api/src/celebrations/immutable-resource.store.ts:63`).

## What Changes

- New env var `MODEL_CATALOG_API_KEY` (optional), documented in `apps/chat-api/README.md` and `apps/chat-api/.env.template`, and added to the `environment-composition.spec.ts` snapshot.
- New routes `GET /api/v1/model-catalog` and `GET /api/v1/model-catalog/:modelName`, with OpenAPI operations `listModelCatalog` / `getModelCatalogEntry` and a regenerated `@epam/ai-dial-chat-api-client`.
- New optional field `ClientConfigDto.modelCatalogAvailable` (`boolean`). It is always emitted, and a missing value means `false`.
- `docs/architecture.md` (API surface and the Models & Deployments endpoint table) and the README's versioned-domains table list the new base path.
- No change to `GET /api/v1/models[/:modelName]`, its caching or authorization, or `DIAL_API_KEY` behaviour.

## Capabilities

### New Capabilities

- `model-catalog`: the API-key-backed, session-protected catalog list and detail routes, their shared cache and single-flight, the error policy (`401`/`403` → `503`, unset key → `404`), the `MODEL_CATALOG_API_KEY` secret and its secrecy rules.

### Modified Capabilities

- `client-config-endpoint`: adds the `config.modelCatalogAvailable` field (a new ADDED requirement. Existing requirements are unchanged).

`model-listing` and `model-lookup` are deliberately unchanged. They still decide what a user can use, and the catalog is display data only.

## Non-goals

- Any frontend in this repository. `apps/chat` has no model-listing caller today (see `model-listing`), and Models Garden lives outside this repo. No `apps/chat/src/server-api/` wrapper, context or UI is added.
- A per-user `accessible` flag or a merged list on the BFF. The frontend unions the two lists by `id`.
- Shared/distributed caching across BFF instances, negative caching of Core failures, or cache invalidation on events. The catalog expires by TTL only.
- Provisioning the Core role or key. That is an operator task, documented in the README.

## Alternatives considered

- **Reuse `DIAL_API_KEY`.** Rejected. Its role would then need access to every restricted model, which widens what the naming path can invoke, and operators could not enable naming without also exposing the catalog.
- **`GET /api/v1/models/catalog`.** Rejected. The path collides with `GET /models/:modelName` and would shadow a model named `catalog`.
- **Detail via Core `GET /openai/models/{name}` with the key.** Rejected. Core answers `403` for a model the key cannot see, which reveals that the model exists, and it adds a Core call per model view.
- **Pass Core `401`/`403` through.** Rejected. A revoked or rotated key would sign every user out through the unauthorized middleware.

## Acceptance criteria

- With the key set, `GET /api/v1/model-catalog` returns the models visible to the key's roles to any signed-in user, including models the user cannot access.
- Without a session the route returns `401`. Without the key it returns `404`, and `config.modelCatalogAvailable` is `false`.
- `GET /api/v1/model-catalog/:modelName` returns a model from the cached catalog. It returns `404` for a model that is not in the catalog and `400` for an invalid name, and it makes no Core call of its own.
- A Core `401`/`403` for the catalog key returns `503`, and the user stays signed in.
- All users share one catalog cache entry per BFF instance, and concurrent misses produce one Core request. `GET /api/v1/models` is unchanged.
- The key is never logged or returned, and `DIAL_API_KEY` behaviour is unchanged.
- Unit and supertest tests, the OpenAPI spec and generated client, the README, `.env.template`, `docs/architecture.md` and the specs are updated, and `npm run validate:docs` / `npm run validate:specs` pass.

## Impact

- **Code:** `apps/chat-api/src/models/` (new `catalog/` concern registered in `ModelsModule`), `apps/chat-api/src/config/env/dial.env.ts`, `apps/chat-api/src/app-config/` (service, mapper `Omit`, DTO).
- **API / client:** two new GET operations and one optional client-config field. This is additive, with no breaking change for existing callers. `libs/chat-api-client` is regenerated, never hand-edited. No hand-authored `libs/*` is touched.
- **Security / privacy:** opt-in per deployment. With the key set, signed-in users see names, descriptions, pricing and limits of models they cannot use. Product/security should confirm this before a deployment enables it. Core has no list-only permission, so the key can also invoke those models. The README tells operators to give its role minimal limits and to store the key as a secret.
- **Performance:** at most one Core list call per BFF instance per 5 minutes in steady state.
- **i18n / RTL / a11y:** none. There are no user-visible strings and no UI.
- **Rollback:** unset `MODEL_CATALOG_API_KEY` to disable the feature at runtime (routes answer `404`, and the flag is `false`), or revert the change. The new field and routes are additive, so reverting breaks no existing caller.

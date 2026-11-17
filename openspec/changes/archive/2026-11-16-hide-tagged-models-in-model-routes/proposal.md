# Proposal

Source: [#9875](https://github.com/epam/ai-dial-chat/issues/9875) — [Chat API] Apply `HIDDEN_ENTITY_TAGS` to the model and model catalog routes.

## Why

`HIDDEN_ENTITY_TAGS` hides a model from the Chat Catalog, but only the deployments routes read it. Models Garden builds its library from `GET /api/v1/models` and `GET /api/v1/model-catalog`, which return hidden models unchanged, so a model an operator hides stays visible in Garden. When the catalog key is configured, users without access also see it there, marked "No access". Nothing in those responses lets a frontend tell that a model is hidden.

## Problem

- `HIDDEN_ENTITY_TAGS` (`apps/chat-api/src/config/env/client-ui.env.ts:100`) is read only by `DeploymentsListingService` (`apps/chat-api/src/deployments/listing/deployments-listing.service.ts:52`) and `DeploymentsLookupService` (`apps/chat-api/src/deployments/lookup/deployments-lookup.service.ts:34`). Each builds its own `Set`, and `mapToDeploymentItem` computes `isHidden` inline (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:295`).
- `ModelsService.listModels` / `getModel` (`apps/chat-api/src/models/models.service.ts:45`, `:72`) forward Core's answer as is, hidden models included.
- `ModelCatalogService.fetchCatalog` (`apps/chat-api/src/models/catalog/model-catalog.service.ts:170`) caches and returns every entry, hidden models included. The detail route reads the same list (`:108`), so it returns hidden models too.
- `GET /api/v1/client-config` does not expose the tags, so a frontend cannot filter by itself, and it should not have to.

## Solution

Filter hidden models out in the BFF, using the same tag match as `isHidden`:

- Extract one shared helper next to the deployment mapper. It reads `HIDDEN_ENTITY_TAGS` into a `Set` and tests a model's `description_keywords` against it. `mapToDeploymentItem`, both deployments services, `ModelsService` and `ModelCatalogService` all use it, so the Chat Catalog and Garden always agree.
- `GET /api/v1/models` drops hidden models inside the cached `fetch`, so the per-user 30-second entry holds the filtered list.
- `GET /api/v1/models/:modelName` answers `404 Not Found` for a hidden model, as if it did not exist.
- `GET /api/v1/model-catalog` drops hidden models before it caches its shared 5-minute entry. `GET /api/v1/model-catalog/:modelName` reads that filtered list, so a hidden model answers `404`.
- Update Swagger route descriptions, the `HIDDEN_ENTITY_TAGS` row and the "Model catalog" section in `apps/chat-api/README.md`, and regenerate the OpenAPI artifacts.

The pattern to follow is the existing `isHidden` mapping in `deployment-mapper.util.ts` and the catalog's own projection step (`toCatalogEntry`), which already filters entries before caching.

**Alternatives considered.** (1) Keep hidden models and add an `is_hidden` field to the model routes. Rejected: it changes a pass-through contract, and it would still send hidden models, with their descriptions and pricing, to every signed-in user in a catalog deployment. (2) Expose the tags in `client-config` and let frontends filter. Rejected: every consumer would have to repeat the match, and the hidden models would still go over the wire. (3) Do nothing and ask operators to remove the catalog key's role from hidden models. Rejected: it does not cover `GET /api/v1/models`, and it couples hiding to access control.

## Non-goals

- Access control. Hiding only affects the BFF's listings. A user with Core access can still call the model with an API key, as with the Chat Catalog today.
- `/api/v1/deployments` and `/api/v1/deployments/*`. They keep listing hidden deployments with `isHidden: true` for the Quick App 2.0 form and existing conversations.
- Completion, share and publish guards (`assertModelNotHidden`, `hidden-model-conversations`). They stay as they are.
- Any frontend change in `apps/chat`. It does not call these routes.
- Hiding applications or toolsets through the model routes. Core's `/openai/models` lists models only.

## What Changes

- New shared helper for reading `HIDDEN_ENTITY_TAGS` and matching `description_keywords`. The deployments mapper and services switch to it with no behavior change.
- `GET /api/v1/models`: hidden models are omitted from `data`.
- `GET /api/v1/models/:modelName`: a hidden model answers `404`.
- `GET /api/v1/model-catalog`: hidden models are omitted, and the shared cache entry holds the filtered list.
- `GET /api/v1/model-catalog/:modelName`: a hidden model answers `404`.
- Swagger descriptions for the four routes, `apps/chat-api/README.md`, `docs/architecture.md` (route table), regenerated OpenAPI spec and client. Response DTOs, operation ids and SDK method names do not change.

No breaking change for the default configuration: with `HIDDEN_ENTITY_TAGS` empty, every route behaves exactly as today. With tags set, clients of the model routes stop receiving hidden models, which is the intended behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-listing`: `GET /api/v1/models` omits models whose `description_keywords` contain a `HIDDEN_ENTITY_TAGS` tag.
- `model-lookup`: `GET /api/v1/models/:modelName` answers `404` for such a model.
- `model-catalog`: `GET /api/v1/model-catalog` omits such models before caching, and `GET /api/v1/model-catalog/:modelName` answers `404` for them.

## Acceptance criteria

- With `HIDDEN_ENTITY_TAGS=HIDDEN`, a model whose `description_keywords` includes `HIDDEN` is absent from `GET /api/v1/models` and `GET /api/v1/model-catalog`.
- `GET /api/v1/models/:modelName` and `GET /api/v1/model-catalog/:modelName` return `404` for that model, never `403`.
- Models without a hidden tag, and all models when the variable is empty, are returned as today.
- `/api/v1/deployments` still returns that model with `isHidden: true`.
- Unit tests cover both services and the shared helper. The README, `docs/architecture.md` and the three specs are updated. `npm run openapi:check` passes.

## Impact

- **Code:** `apps/chat-api/src/models/models.service.ts`, `apps/chat-api/src/models/catalog/model-catalog.service.ts`, both controllers (Swagger text only), `apps/chat-api/src/deployments/utils/` (new helper plus mapper), both deployments services, and their specs. `ModelsService` gains a `ConfigService` dependency (`ConfigModule` is global).
- **API:** response shapes, operation ids and status codes stay the same. `404` on the detail routes gains one more cause. Generated client changes are limited to descriptions.
- **Libs:** none. No `libs/*` code is touched, and no host integration knowledge moves into a lib.
- **i18n / UI / RTL / a11y:** none. No user-visible strings.
- **Feature flags:** not gated by `ENABLED_FEATURES`. `HIDDEN_ENTITY_TAGS` is the only switch.
- **Rollback:** revert the commit. There is no data migration and no cache format change. Caches expire within 5 minutes after a restart, and a restart empties them anyway.

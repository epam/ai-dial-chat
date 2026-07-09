## Why

Thirteen `apps/chat-api` domain services extend `apps/chat-api/src/app/app.service.ts` purely to inherit a DIAL Core SDK client, creating **13 separate `createSDK({ baseUrl })` instances** for the same `DIAL_CORE_URL` instead of one shared client. Five of those services also duplicate the same cache → SDK call → error-map → cache-set pattern for list/single reads. This inheritance-for-injection anti-pattern makes the SDK client hard to mock in isolation, wastes a client instance per service, and spreads copy-pasted caching logic that will drift as it is edited five separate times. Replacing it with proper NestJS dependency injection and a shared cache helper is a pure internal refactor with no user-visible or contract-visible effect.

## What Changes

- Add a new `apps/chat-api/src/dial/` module: `DialCoreModule` (global NestJS module) providing/exporting a single `DialClientService`.
- `DialClientService` creates exactly one `createSDK({ baseUrl })` instance from `DIAL_CORE_URL`/`DIAL_API_VERSION` (via `ConfigService<EnvironmentVariables>` with `{ infer: true }`) and exposes `client`, `baseUrl`, and `dialApiVersion` to consumers.
- Migrate all 13 services currently extending `AppService` (`ConversationService`, `ConversationNamingService`, `FilesService`, `ChatService`, `RateService`, `TranscriptionService`, `ModelsService`, `DeploymentsService`, `ApplicationsService`, `ApplicationSchemasService`, `ToolsetsService`, `UserConfigService`, `BucketService`) to inject `DialClientService` instead of extending a base class.
- Add `withCachedDialRequest` helper (`apps/chat-api/src/dial/cached-dial-request.helper.ts`) that extracts the repeated cache-hit/cache-miss/error-map/cache-set flow, and migrate the four simple callers (`ModelsService.listModels`, `ModelsService.getModel`, `ApplicationsService.listApplications`, `ApplicationSchemasService.listApplicationSchemas`) to use it. `DeploymentsService.listDeployments` and `ToolsetsService.listToolsets`/`getToolset` keep their current hand-written caching logic unless the helper can be extended without changing observed behavior.
- Remove `AppService` from `AppModule.providers` and delete `apps/chat-api/src/app/app.service.ts` once no references remain.
- Update `apps/chat-api/AGENTS.md` guidance from "extend AppService" to "inject DialClientService".
- **BREAKING (internal only)**: any test currently mocking `AppService`/spying on `createSDK` inheritance must be updated to mock `DialClientService`. No effect on any public contract.

## Capabilities

This change does not alter any user-facing or client-facing behavior — the specs below pin down the internal equivalence contracts the new shared client and cache helper must uphold, not new product capabilities.

### New Capabilities

- `dial-core-client`: the single shared DIAL Core SDK client contract (`DialClientService`/`DialCoreModule`) that every `chat-api` domain service consumes instead of each creating its own `createSDK` instance.
- `cached-dial-list-request`: the shared cache-hit/cache-miss/error-map/cache-set contract (`withCachedDialRequest`) used by simple DIAL list/single-item read methods.

### Modified Capabilities

- `applications-listing`: the "Applications domain structure" requirement's implementation-detail bullet for `applications.service.ts` is updated from "`ApplicationsService extends AppService`" to "injects `DialClientService`" — no behavioral or scenario change.
- `deployments-api`: the "Deployments domain structure" requirement's implementation-detail bullet for `deployments.service.ts` is updated from "extends `AppService`" to "injects `DialClientService`" — no behavioral or scenario change.

No REST endpoint, request/response shape, status code, cache TTL, or DIAL Core URL behavior changes for any existing capability (including these two, plus `chat-api-backend`, `model-listing`, `toolset-listing`, `dial-error-mapping`). This is an implementation-only refactor of how backend services obtain their DIAL SDK client and structure repeated caching code; all existing spec-level requirements continue to hold unchanged except for the two documentation corrections above.

## Impact

- **Affected code**: `apps/chat-api/src/app/app.service.ts` (deleted), new `apps/chat-api/src/dial/` module, and the constructors/imports of all 13 listed domain services plus their `*.module.ts` registrations and `*.spec.ts` test mocks.
- **Affected APIs**: none — no route, DTO, status code, or OpenAPI contract changes; no `npm run openapi` regeneration needed.
- **Dependencies**: no new npm packages; continues to use `@epam/ai-dial-typescript-sdk`, `@nestjs/cache-manager`, existing `common/dial/dial-error.mapper.ts`.
- **Systems**: none outside `apps/chat-api` — no frontend, no `chat-api-client`, no infra changes.

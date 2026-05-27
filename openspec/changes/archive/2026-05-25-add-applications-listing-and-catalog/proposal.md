## Why

The DIAL Core platform exposes an Applications API alongside the existing Models API, but the chat frontend currently has no way to discover or display applications. Users need a unified view of all deployable items (models and applications) to select from in the conversation flow, and the backend must expose both as first-class resources with consistent auth, caching, and error semantics.

## What Changes

- **New** `GET /api/v1/applications` endpoint — proxies DIAL Core Applications API, fetches all pages, returns a strongly typed list of applications for the authenticated session user.
- **New** `GET /api/v1/catalog` endpoint — returns models and applications merged into a single typed list; drives the unified deployment/selection UI. This replaces the role of the legacy unversioned `GET /api/deployments` for new consumers; the legacy endpoint is kept as-is for backward compatibility (not removed, not extended).
- **New** `ApplicationsController`, `ApplicationsService` in `apps/chat-api/src/applications/`.
- **New** `CatalogController`, `CatalogService` in `apps/chat-api/src/catalog/`.
- **New** Swagger DTOs: `ApplicationDto`, `ApplicationsResponseDto`, `CatalogItemDto`, `CatalogResponseDto`.
- **New** per-user server-side cache entries: `applications:list:<userSub>`, `catalog:list:<userSub>` (TTL 30 s, `Cache-Control: private, max-age=30`).
- **New** `apps/chat/src/server-api/applications.ts` and `apps/chat/src/server-api/catalog.ts` — thin wrappers around generated `@epam/chat-api-client` methods.
- **New** `CatalogContext` in `apps/chat/src/context/` — owns the unified list of catalog items (models + applications); replaces direct `ModelsContext` usage in conversation-flow model selection.
- **New** i18n keys for any user-visible strings introduced by the catalog/applications UI.
- Regenerated `@epam/chat-api-client` with `listApplications` and `listCatalogItems` methods.
- `GET /api/v1/models` and `ModelsContext` are **retained unchanged**.

## Capabilities

### New Capabilities

- `applications-listing`: Backend endpoint and service that proxies DIAL Core Applications API with full pagination exhaustion, per-user caching, rate limiting, and typed error mapping.
- `unified-catalog`: Backend endpoint and service that merges models and applications into a single sorted, typed list; frontend context and server-api wrapper that replaces models-only selection in the conversation flow.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. ModelsContext and GET /api/v1/models remain unmodified. -->

## Impact

- **apps/chat-api**: new `applications/` and `catalog/` domain folders; `AppModule` gains two new feature modules; `@epam/ai-dial-typescript-sdk` used where it covers the Applications API, otherwise raw fetch with `AbortController` and timeout.
- **apps/chat**: new server-api wrappers, new `CatalogContext`; conversation-flow model/application selection updated to consume `CatalogContext` instead of `ModelsContext` alone.
- **libs/chat-api-client** (generated): two new typed methods added to the generated client; `npm run openapi` and `npm run openapi:check` must pass.
- **Legacy `GET /api/deployments`**: no changes; kept for backward compatibility; marked as deprecated in Swagger.
- **No auth/session changes**, **no DIAL Core API changes**, **no UI redesign** beyond wiring catalog selection.

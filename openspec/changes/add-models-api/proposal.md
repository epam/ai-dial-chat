## Why

The SPA needs to display available AI models to authenticated users but currently has no BFF-mediated model listing API. Fetching models directly from DIAL Core would require exposing the DIAL API key to the browser, which violates the security boundary established by the BFF session architecture.

## What Changes

- New `models` domain under `apps/chat-api/src/models/` with two authenticated endpoints:
  - `GET /api/v1/models` — list all available deployments, proxied from `GET /openai/models`
  - `GET /api/v1/models/:modelName` — fetch a single deployment by name, proxied from `GET /openai/models/{model_name}`
- Both endpoints sit behind the existing `SessionGuard` (no public access, no API key leakage to the browser)
- The BFF forwards the caller's DIAL access token (from session) as the `Authorization: Bearer <at>` header to DIAL Core
- `DIAL_API_KEY` has been removed from the project — all DIAL Core calls now use the session user's access token; `AppService` no longer passes an API key to `createSDK`
- Response shapes mirror DIAL Core exactly: list returns `{ data: DialModel[] }`, single returns `DialModel`
- Short-lived server-side cache (30 s for list, 60 s for single) to reduce upstream load
- Frontend `server-api` helper added in `apps/chat/src/server-api/models.ts`

## Capabilities

### New Capabilities

- `model-listing`: BFF proxy endpoint `GET /api/v1/models` that returns the list of available DIAL deployments for the authenticated session user
- `model-lookup`: BFF proxy endpoint `GET /api/v1/models/:modelName` that returns a single DIAL deployment by name for the authenticated session user

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **New files**: `apps/chat-api/src/models/` (controller, service, module, DTOs, tests)
- **Modified**: `apps/chat-api/src/app/app.service.ts` — removed `apiKey` from `createSDK`; all services now use session access tokens
- **Modified**: `apps/chat-api/src/app/app.module.ts` — register `ModelsModule`
- **Modified**: `apps/chat-api/src/config/environment.config.ts` — removed `DIAL_API_KEY` and `DIAL_CORE_TIMEOUT_MS`
- **Modified**: `apps/chat-api/src/deployments/` — `DeploymentsService` and `DeploymentsController` updated to accept and forward per-user access token; switched to `SDKResponse` error handling
- **New lib types**: `libs/chat-shared/src/models/dial-model.ts` — `DialModel` and `DialModelListResponse`
- **New file**: `apps/chat/src/server-api/models.ts` — typed helpers for both endpoints
- **Breaking change**: `DIAL_API_KEY` env var is no longer read; deployments that relied on it must be reconfigured to use session-based auth

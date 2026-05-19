## Why

The SPA needs to display available AI models to authenticated users but currently has no BFF-mediated model listing API. Fetching models directly from DIAL Core would require exposing the DIAL API key to the browser, which violates the security boundary established by the BFF session architecture.

## What Changes

- New `models` domain under `apps/chat-api/src/models/` with two authenticated endpoints:
  - `GET /api/v1/models` — list all available deployments, proxied from `GET /openai/models`
  - `GET /api/v1/models/:modelName` — fetch a single deployment by name, proxied from `GET /openai/models/{model_name}`
- Both endpoints sit behind the existing `SessionGuard` (no public access, no API key leakage to the browser)
- The BFF forwards the caller's DIAL access token (from session) as the `Authorization: Bearer <at>` header to DIAL Core; the `DIAL_API_KEY` env var is never used on these routes
- Response shapes mirror DIAL Core exactly: list returns `{ data: DialModel[] }`, single returns `DialModel`
- Short-lived server-side cache (30 s for list, 60 s for single) to reduce upstream load
- New `DIAL_CORE_TIMEOUT_MS` env var (default 10 000 ms) for upstream fetch timeout
- Frontend `server-api` helper added in `apps/chat/src/server-api/models.ts`

## Capabilities

### New Capabilities

- `model-listing`: BFF proxy endpoint `GET /api/v1/models` that returns the list of available DIAL deployments for the authenticated session user
- `model-lookup`: BFF proxy endpoint `GET /api/v1/models/:modelName` that returns a single DIAL deployment by name for the authenticated session user

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **New files**: `apps/chat-api/src/models/` (controller, service, module, DTOs, tests)
- **Modified**: `apps/chat-api/src/config/environment.config.ts` — add `DIAL_CORE_TIMEOUT_MS`
- **Modified**: `apps/chat-api/src/app/app.module.ts` — register `ModelsModule`
- **New file**: `apps/chat/src/server-api/models.ts` — typed fetch helpers for both endpoints
- **No shared-lib changes** — `DialModel` type may be added to `libs/chat-shared/` if reused by other domains; otherwise defined locally in the models domain
- **No breaking changes** — purely additive

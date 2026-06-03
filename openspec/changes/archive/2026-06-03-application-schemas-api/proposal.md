## Why

The frontend needs to discover available DIAL Core application type schemas so it can render application builders and viewers with the correct schema-driven UI. DIAL Core exposes these schemas via `/v1/application_type_schemas/schemas` and `/v1/application_type_schemas/schema?id={id}`, but there are no BFF endpoints proxying them today, and the SDK already supports both operations.

## What Changes

- Add `GET /api/v1/application-schemas` — lists all application type schemas visible to the authenticated user; returns a normalised list DTO with stable camelCase field names derived from upstream DIAL Core dollar-prefixed and colon-prefixed fields.
- Add `GET /api/v1/application-schemas/:id` — fetches one application type schema by its `$id`; returns the raw JSON schema object typed as `Record<string, unknown>`.
- Extend `ApplicationsService` (or introduce a focused `ApplicationSchemasService` in the same domain folder) to implement both operations using `this.client.listCustomApplicationSchemas` and `this.client.getCustomApplicationSchema` from `@epam/ai-dial-typescript-sdk`.
- Extend `ApplicationsController` (or introduce `ApplicationSchemasController`) with the two new routes, Swagger annotations, `@Throttle`, and per-user server-side caching.
- Regenerate `libs/chat-api-client` so `ApplicationsApi` gains `listApplicationSchemas()` and `getApplicationSchema({ id })` generated methods.
- Add a thin frontend wrapper `apps/chat/src/server-api/application-schemas.ts` that delegates to the generated client.

## Capabilities

### New Capabilities

- `application-schemas-list`: List all DIAL Core application type schemas for the authenticated user (`GET /api/v1/application-schemas`).
- `application-schemas-get`: Fetch a single application type schema by id (`GET /api/v1/application-schemas/:id`).

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **Backend** (`apps/chat-api`): new routes extend the `applications` domain; no new domain folder needed. `ApplicationsModule` registers the new controller/service additions.
- **Generated client** (`libs/chat-api-client`): regenerated after Swagger update; two new generated methods appear in `ApplicationsApi`. No hand-edits to generated files.
- **Frontend server-api** (`apps/chat/src/server-api/`): new file `application-schemas.ts`; `api-client.ts` exports a new `applicationSchemasApi` singleton (or reuses `applicationsApi` if the generator places both under the same tag).
- **SDK**: `@epam/ai-dial-typescript-sdk` already supports both operations — no raw `fetch` needed.
- **No library changes**: `libs/chat-shared` and `libs/conversation-input` are untouched.
- **No i18n changes**: these are data-only API endpoints with no user-visible strings.
- **No breaking changes** to existing endpoints.

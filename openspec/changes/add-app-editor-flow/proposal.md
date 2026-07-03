## Why

Users can browse and favourite apps in the Catalog but have no way to create new ones. The "Create Quick App" and "Create Toolset" buttons exist in `CatalogView` as stubs with empty handlers. Unblocking app creation is the next step in making the Catalog a full self-service surface for app authors.

## What Changes

- Expose `schemas: ApplicationSchemaSummaryDto[]` from `DeploymentsContext` so the catalog and editor can look up schemas (including `editorUrl`) without an extra fetch.
- Wire the two stub `createOptions` in `CatalogView` to navigate to a new `/apps-editor` route, passing the matching schema ID, `returnUrl`, and `isCreating=1` as query params.
- Add a new `/apps-editor` page with two steps:
  - **Step 1 — General**: name, description, icon URL fields. On submit, calls `POST /api/v1/applications` to create the app and advances to step 2.
  - **Step 2 — Settings**: renders an `<iframe>` pointed at `schema.editorUrl` with auth params; shows a placeholder for schema types that have no `editorUrl` yet (Toolset).
- Add `POST /api/v1/applications` backend endpoint that proxies the DIAL Core "create application" call using the session access token.
- Update the generated `@epam/chat-api-client` with the new `createApplication` method.

## Capabilities

### New Capabilities

- `application-create-api`: `POST /api/v1/applications` NestJS endpoint — request DTO, DIAL Core proxy, error mapping, cache invalidation.
- `app-editor-flow`: Two-step `/apps-editor` React page — routing, General form with validation, Settings step with iframe embed and postMessage listener.
- `catalog-create-app`: `CatalogView` entry-point wiring — schema lookup from context, navigation to editor, schema-to-option matching for QuickApp 2.0 and Toolset types.

### Modified Capabilities

- `deployments-context`: Add `schemas: ApplicationSchemaSummaryDto[]` to the context value so consumers can resolve schema metadata (particularly `editorUrl`) without a new API call.

## Impact

- **Backend**: `apps/chat-api/src/applications/` — new DTO, updated service and controller.
- **Generated client**: `libs/chat-api-client/openapi.json` and generated `ApplicationsApi.ts` — new `createApplication` method.
- **Frontend — new files**: `apps/chat/src/pages/AppsEditor/` (page, general form, settings step, iframe component), `apps/chat/src/constants/apps-editor.ts`.
- **Frontend — modified files**: `DeploymentsContext.tsx`, `CatalogView.tsx`, `app.tsx`, `types/routes.ts`, `i18n/locales/en.json`.
- **No new dependencies** — uses existing React Hook Form, Zod, `@epam/ai-dial-ui-kit`, and `@tabler/icons-react`; no `@epam/ai-dial-visualizer-connector` required.

## Context

The Catalog page (`/catalog`) already renders a `CreateButton` from `@epam/ai-dial-catalog` with two stub entries — "Create Quick App" and "Create Toolset" — whose `onClick` handlers are empty. `DeploymentsContext` already fetches `ApplicationSchemaSummaryDto[]` from `GET /api/v1/application-schemas` on mount but does not expose them in its context value. `GET /api/v1/applications` and the full Application schemas listing are already in the generated `@epam/chat-api-client`. There is no write path for applications anywhere in the stack yet.

The development-1.0 branch uses **React Context + hooks** (no Redux), **Vite SPA with React Router v6** (no Next.js file router), and a **NestJS BFF** at `apps/chat-api`. The access token is held in an encrypted server-side session cookie; the only auth info available to client JS is what `GET /api/v1/auth/me` returns (`sub`, `providerId`, `claims`, `bucket`).

## Goals / Non-Goals

**Goals:**
- Enable users to create a new Quick App or Toolset from the Catalog.
- Provide a two-step creation flow: General metadata (name, description, icon) → Settings (schema-specific editor embedded in an iframe).
- Add `POST /api/v1/applications` to the BFF, which proxies creation to DIAL Core.
- Expose `schemas` from `DeploymentsContext` so both `CatalogView` and the editor page can look up schema metadata without additional fetches.

**Non-Goals:**
- Implementing the iframe content itself — the Quick App and Toolset editors are separate applications.
- Editing or deleting existing applications.
- Porting the full `QuickApp2Form` React form from the development branch.
- Supporting any schema type beyond Quick App 2.0 and Toolset in this change.
- Token-passing to the iframe beyond `authProvider` — the external editor authenticates independently using the same OIDC provider.

## Decisions

### 1 — Expose schemas from `DeploymentsContext`, not a new context
`DeploymentsContext` already fetches `ApplicationSchemaSummaryDto[]` inside `loadDeployments`. Adding `schemas: ApplicationSchemaSummaryDto[]` to the existing context value costs one field and zero extra network calls. A dedicated `ApplicationSchemasContext` would duplicate the fetch and add provider nesting.

**Alternative considered**: Fetch schemas inside the `/apps-editor` page on mount. Rejected — it would re-fetch on every editor navigation and complicate the entry-point routing in `CatalogView` (which needs schemas to find the right schema ID before navigating).

### 2 — Local `useState` / `useReducer` for editor state, no new context
The two-step editor is a self-contained page. Step index, form values, and `appId` after creation are page-scoped state. Lifting them into a context would add boilerplate for a single-page flow.

URL search params (`useSearchParams`) carry the durable query params (`step`, `schema`, `returnUrl`, `isCreating`, `appId`) so deep-link and refresh work correctly — the same pattern used by the development branch.

### 3 — Plain `<iframe>` with `window.addEventListener('message')`, no VisualizerConnector
`@epam/ai-dial-visualizer-connector` is not installed on this branch. A plain `<iframe>` with a `message` event listener is sufficient to:
- Embed the external editor.
- Respond to `updatedApplicationSuccess` events from the iframe (schema display-name-prefixed).

**Alternative considered**: Installing `@epam/ai-dial-visualizer-connector`. Rejected — adds a dependency for a thin feature; the postMessage protocol is straightforward enough to own directly.

### 4 — Only `authProvider` param passed to iframe (no explicit token)
`GET /api/v1/auth/me` returns `providerId` to the client. The iframe URL is built as:
```
${schema.editorUrl}?authProvider=${providerId}&id=${encodeURIComponent(appId)}&theme=${themeId}
```
The external editor initiates its own OIDC flow using the `authProvider` hint. Passing the BFF session access token to the iframe would require a new `/api/v1/auth/token` endpoint and expose the token to a third-party origin — out of scope and a security concern.

### 5 — Manually extend generated `ApplicationsApi.ts` for `createApplication`
Running the full OpenAPI generator for a single new method disrupts the generated-file diff and requires generator config tuning. The pattern used for `ToolsetsApi.ts` was hand-authored. We follow the same approach: add `createApplicationRaw` + `createApplication` methods directly to `libs/chat-api-client/src/generated/src/apis/ApplicationsApi.ts` and add the request/response models to `libs/chat-api-client/src/generated/src/models/`. Update `openapi.json` to stay in sync.

**Alternative considered**: Running `openapi-generator`. Rejected — would regenerate all files, adding noise and requiring the full generator toolchain. The codebase already has precedent for hand-authoring (ToolsetsApi).

### 6 — `POST /api/v1/applications` invalidates the `applications:list` cache
After a successful create, the cached application list is stale. The service SHALL delete `applications:list:<userSub>` via `cacheManager.del` after the DIAL Core call succeeds, mirroring the cache invalidation pattern in other services. The TTL is 30 000 ms (same as `listApplications`).

### 7 — Schema identification by ID suffix (same as development branch)
The development branch uses `schemaId.endsWith(type)` where `type` is the schema ID with `https://` stripped. We use the same approach: find the Quick App 2.0 schema with `schema.id?.includes('quickapps2')` and the Toolset schema with `schema.id?.includes('toolset')`. These suffix checks are resilient to server-side schema ID prefix variation.

## Risks / Trade-offs

- **DIAL Core create-application API contract unknown** → The BFF proxies the request body verbatim, so shape errors surface as DIAL Core 4xx responses forwarded to the frontend. The `CreateApplicationBodyDto` mirrors the fields from the development branch's `ApplicationService.create()` payload: `name`, `description`, `iconUrl`, `type` (schema ID), `version`. *Mitigation*: Map DIAL Core error codes to standard HTTP responses; surface them in the UI.
- **iframe auth with only `authProvider`** → If the external editor requires an explicit bearer token (not just provider hint), step 2 will silently stall or show an auth error inside the iframe. *Mitigation*: The `AppEditorIframe` component should display a visible spinner until `readyToInteract` and surface a fallback message if the iframe fails to load within a timeout.
- **Schema suffix check brittleness** → If DIAL Core returns a schema whose `id` coincidentally contains `quickapps2` or `toolset` in a segment other than the terminal one, the wrong schema is matched. *Mitigation*: This is the same risk accepted in the development branch; revisit when the schema registry is more stable.
- **Cache invalidation race** → Between the POST response and the next `GET /api/v1/applications`, a stale cache hit is possible (max 30 s). *Mitigation*: Cache is invalidated on success; the 30-s TTL is acceptable for UX.

## Open Questions

- **DIAL Core create-application payload** — Does `POST /openai/applications` accept `{ name, description, iconUrl, type, version }` directly, or does it expect a different envelope? Needs verification against DIAL Core docs or the development branch's `DataService.createApplication` implementation.
- **Toolset schema in `GET /api/v1/application-schemas`** — Is the Toolset schema type served as an `ApplicationSchemaSummaryDto` (with `editorUrl`) from the same endpoint, or is it a separate concept? If no schema exists with a `toolset`-containing ID, the "Create Toolset" button should be hidden or disabled.

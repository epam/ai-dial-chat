## Why

The ToolsetEditor (a multi-step form for creating and editing MCP-style **toolsets** —
endpoint, transport protocol, allowed tools, and authentication) exists in the v1
`ai-dial-chat` repo but has no equivalent in this React 19 / Vite / NestJS rebuild. The
backend currently only exposes read endpoints (`GET /api/v1/toolsets`,
`GET /api/v1/toolsets/:name`), so users can list toolsets but cannot create, edit, or
authenticate them. This change adds the editor using the app's established React 19
local-state conventions.

A hard constraint is to **minimise overlap with shared files** — new code lives in
dedicated, self-contained folders and edits to shared files (routes, translation keys,
router registration, the toolsets backend module) are kept small and append-only to avoid
large merge conflicts later.

## What Changes

- **New `/toolset-editor` route and page** (`apps/chat/src/pages/ToolsetEditor/`) — a
  two-step wizard (General / Settings) with a live preview pane.
- **General step**: name (with auto-generated conflict-free default), version, icon URL
  (plain text input — no file-manager wiring), description, topics (free-entry tags).
- **Settings step**: endpoint URL, transport protocol (HTTP/SSE) select, allowed-tools tag
  input, copy-endpoint-URL action, and the authentication section.
- **Authentication section** (the most complex part): a list-style single-select between
  `NONE` / `API_KEY` / `OAUTH`, conditional credential fields driven by a single
  `authenticationType` + `WithLogin` state, login/logout with a confirmation dialog, and an
  **OAuth redirect callback** flow handed off via `sessionStorage`.
- **Redux → local state**: all toolset state becomes `useState` per field plus plain
  `async` load/save functions; no Redux, no sagas, no new React Context.
- **No new npm dependencies**: reuse `@epam/ai-dial-ui-kit` components, manual `if`-guard
  validation, and local string enums — `react-hook-form`, `zod`, and `@epam/ai-dial-shared`
  are NOT added.
- **Backend write endpoints** added to the existing `apps/chat-api/src/toolsets/` module:
  `POST /api/v1/toolsets`, `PATCH`/`DELETE /api/v1/toolsets/:name`, and
  `POST /api/v1/toolsets/:name/login` + `/logout`, each proxying DIAL Core and following the
  `applications.service.ts` create pattern.
- **OpenAPI + generated client** regenerated to expose the new endpoints to the frontend.

## Capabilities

### New Capabilities
- `toolset-authoring`: Frontend capability to create and edit a toolset through a
  multi-step wizard — general metadata, connection settings, validation, live preview,
  step routing, and unique-name generation.
- `toolset-authentication`: Frontend capability to configure a toolset's authentication
  (None / API Key / OAuth), submit credentials, run the OAuth redirect/callback handshake,
  and log out, including the disabled/logged-in states.
- `toolset-write-api`: Backend capability exposing create/update/delete and login/logout
  endpoints for toolsets, proxying DIAL Core with versioned, validated, rate-limited,
  Swagger-documented routes.

### Modified Capabilities
<!-- No existing spec-level requirements change; the existing read endpoints are unaffected. -->

## Impact

- **New frontend code** (self-contained, low conflict risk): `pages/ToolsetEditor/**`,
  `types/toolsets.ts`, `constants/toolsets.ts`, an OAuth callback route component, and a
  `getStorageSafeUniqueToolsetName` util.
- **New backend code** (additive within an existing module): write methods + DTOs in
  `apps/chat-api/src/toolsets/` and new completion/login proxies.
- **Small shared-file edits** (kept minimal/append-only to limit merge conflicts):
  `types/routes.ts` (one enum member), `constants/translation-keys.ts` +
  `i18n/locales/en.json` (a new dedicated key block), the React Router registration, and
  the toolsets controller/module.
- **Generated artifacts**: `npm run openapi` output and `libs/chat-api-client` regeneration
  — highest conflict risk; regenerate late and once.
- **Dependencies**: none added.
- **Server-side API client adapter** in `apps/chat/src/server-api/` for the new endpoints.

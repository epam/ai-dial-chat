## Context

The v1 `ai-dial-chat` implements toolset creation/editing with `react-hook-form` + `zod`,
a Redux slice with sagas, and shared enums from `@epam/ai-dial-shared`. The target app uses 
different conventions — **local `useState`, `useSearchParams` step routing, and no external
state library** — so the port re-expresses the same flow on that stack
(`toolset-editor-migration.md`).

Current target state:
- Backend `apps/chat-api/src/toolsets/` exposes only `GET /toolsets` and
  `GET /toolsets/:toolsetName`, both proxying DIAL Core via `AppService` + the generated
  SDK client, with per-user caching and secret redaction (`redactToolsetSecrets`).
- Frontend has no toolset editor page and no `/toolset-editor` route.

Hard constraint from the requester: **minimise file overlap** to avoid large merge
conflicts at integration time.

## Goals / Non-Goals

**Goals:**
- Port the toolset create/edit experience (general info, settings, authentication) to the
  React 19 / local-state architecture.
- Add the backend write + auth endpoints the editor needs, proxying DIAL Core.
- Keep the public read-endpoint behavior unchanged.
- Add **zero** new npm dependencies.
- Isolate new code in dedicated folders; keep shared-file edits small and append-only.

**Non-Goals:**
- File-manager-based icon picking (use a plain URL text input instead).
- Redux / saga parity — state becomes local `useState` + `async` functions.
- Admin-review variants (`isAdminReview`) of the form, unless trivially free.
- Reworking or "improving" the existing read endpoints or their caching.
- A shared `@epam/ai-dial-shared` package — enums live locally in the chat app.

## Decisions

### D1. State: local `useState` + `async` functions, no Redux/Context
Each form field is `useState` in its step component; load/save are plain `async` functions
with `try`/`catch`/`finally` on the page component. Child components (e.g. the auth section)
receive `onLogin`/`onLogout` callbacks as props rather than reading a context.
- **Why over Redux/Context**: a single call site needs no global store, and this matches the
  app's existing local-state convention. Fewer files touched → lower conflict risk.
- **Alternative considered**: a `ToolsetEditorContext`. Rejected — adds shared surface and
  a provider in `app.tsx`, increasing conflict risk for no benefit at one call site.

### D2. Validation: manual `if`-guard per field, no zod/react-hook-form
Replace the zod schema (`form.ts`) with explicit guards that set per-field error state and
i18n error keys. The endpoint URL check ports the v1 regex/`new URL()` logic into a small
local validator util.
- **Why**: avoids two new dependencies; consistent with the app's existing form code.

### D3. Types & enums local to the chat app
Define `ToolsetAuthTypes`, `ToolsetTransportType`, `WithLogin`, `ToolsetCredentialsLevel`,
`ToolsetEditorSteps`, and `ToolsetEditorQuery` in **new** files `types/toolsets.ts` and
`constants/toolsets.ts` (string enums per the repo enum rule). The `ToolsetModel`/auth-payload
shapes are ported there too.
- **Why local files**: brand-new files have near-zero merge conflict risk, unlike editing a
  shared barrel.

### D4. Step routing via `useSearchParams`
A `ToolsetEditorQuery.Step` search param drives the `DialSteps` header. `id` (edit mode) and
`returnUrl` are also search params; create mode is inferred purely from the absence of `id`,
so no separate `isCreating` flag is needed. On mount: `id` present → load toolset; absent →
create mode with a default form.

### D5. UI components — ui-kit first
Map v1 custom inputs to ui-kit (`Input`, `Textarea`, `DialTagInput`, `Select`,
`DialSteps`, `DialConfirmationPopup`, `DialTooltip`) per migration §5. Only two need custom
work: the auth type **list** single-select (a plain button list, single-open driven by
`authenticationType` state) and a copy-endpoint-URL button (`DialIconButton` + clipboard).
Confirm every prop signature via the `@epam/ai-dial-ui-kit` MCP before use.

### D6. OAuth callback via dedicated route + `sessionStorage` handshake
For OAuth `WithConfig`: save the OAuth config, get an auth URL back, persist
`{ toolsetId, credentialsLevel, callbackUrl }` to `sessionStorage`, redirect to the
provider. A dedicated callback route reads the stored state and calls the login endpoint
with `code` + `redirectUri`, then returns to the editor.
- **Why a separate route**: the editor component unmounts during the external redirect;
  a thin callback route is the cleanest re-entry point and is a new, isolated file.
- **Alternative**: a popup window with `postMessage`. Rejected for v1 — redirect is what the
  source models and is simpler to reason about; popup can be a later enhancement.

### D7. Backend — additive write methods in the existing toolsets module
Add `createToolset`, `updateToolset`, `deleteToolset`, `loginToolset`, `logoutToolset` to
`ToolsetsService`, and corresponding `@Post`/`@Patch`/`@Delete` handlers to
`ToolsetsController`, following the `applications.service.ts` create pattern (resolve user
bucket, `PUT`/proxy to DIAL Core, invalidate the per-user list cache, map DIAL HTTP status
via the existing `mapDialHttpStatus`/`handleDialFetchError`). Reuse `redactToolsetSecrets`
on responses. New DTOs go in `apps/chat-api/src/toolsets/dto/`.
- **Why additive in-module**: appending to the toolsets files is low-conflict and keeps the
  change localised; reusing the established proxy helpers keeps it consistent with
  `nestjs-best-practices.md`.

### D8. Frontend API access via server-api adapter + generated client
Expose the new endpoints through the generated `@epam/chat-api-client` and a thin
`apps/chat/src/server-api/` adapter (per AGENTS.md), not `base.ts`. Secrets (`apiKey`,
`clientSecret`) are write-only — never rendered back from a GET response.

### D9. Merge-conflict minimisation strategy
- New code → new files/folders only (`pages/ToolsetEditor/`, `types/toolsets.ts`,
  `constants/toolsets.ts`, callback route, util, server-api adapter, backend DTOs).
- Shared-file edits kept to single, append-style additions: one `ROUTES` enum member, one
  contiguous block of translation keys + en.json keys, one router `<Route>` registration,
  controller/service method additions at the end of the class.
- Regenerate OpenAPI + `chat-api-client` **once, late** (after backend endpoints settle),
  since generated diffs are the largest conflict surface.

## Risks / Trade-offs

- **OAuth redirect/callback handshake** → most complex area. Mitigation: design and build
  the callback route + `sessionStorage` contract before wiring `AuthField`; cover with a
  spec scenario and a unit test for the state round-trip.
- **DIAL Core write contract uncertainty** (exact create/update body shape) → Mitigation:
  follow the verified `applications.service.ts` proxy shape; validate against a real DIAL
  Core instance; keep the DTO mapping in one place.
- **Generated-client merge conflicts** → Mitigation: regenerate once at the end; never
  hand-edit generated files (AGENTS.md).
- **Auth-type toggle race while saving** → Mitigation: track `isSaving` state and disable
  the auth section + type selector during save.
- **Secret leakage** → Mitigation: never return `apiKey`/`clientSecret` to the client;
  reuse `redactToolsetSecrets`; never log credential payloads (nestjs rules).
- **Topics source** → low; `AppConfigContext` already provides topics; pass as a prop to
  `GeneralForm` and confirm availability at the route.

## Migration Plan

1. Add types/constants/route enum + translation keys (new files + minimal shared edits).
2. Backend: add write + login/logout methods, DTOs, controller handlers, tests.
3. Regenerate OpenAPI + `chat-api-client`; add the server-api adapter.
4. Frontend: page + `DialSteps` header + view/preview, GeneralForm, SettingsForm.
5. Auth section: type list + login form + OAuth callback route.
6. Verify per slice (`nx test/lint/build chat-api`, `nx test chat`, `npm run openapi:check`).

Rollback: the route is additive and feature-isolated; removing the `<Route>` registration
and the route enum member hides the editor with no impact on existing read flows. Backend
endpoints are additive and independently revertible.

## Open Questions

- Exact DIAL Core request/response shape for toolset create/update and login/logout — verify
  against the target instance before finalising DTOs.
- Whether `WithConfig` OAuth requires PKCE (`codeChallenge`/`codeChallengeMethod`) end-to-end
  in this target, or only the basic `code`/`redirectUri` exchange.
- Whether a delete entry point belongs in this change or is deferred to a list/manage UI
  (the endpoint is added regardless for parity).

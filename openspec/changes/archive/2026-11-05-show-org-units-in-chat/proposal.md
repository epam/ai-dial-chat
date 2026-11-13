## Why

DIAL Core org units own folders under `public/` (for example `public/Acme/Risk/`), but the chat has no idea which folders are units. Later work needs that answer: reading what the user may do in a unit, and publishing without an admin request where the user may write. GitHub issue #9757 started as "mark unit folders with their own icon". The team then decided not to draw a distinct icon, so this change keeps only the data side: read the units once and tell which folders are units.

## What Changes

- **Problem:** the chat cannot tell a unit folder from a plain folder, so nothing can treat them differently.
- **Solution:**
  - New BFF endpoint `GET /api/v1/org-units`. It reads DIAL Core `GET /v1/org-units/public?recursive=true` through the SDK (`getOrgUnit`) with the caller's token. The result is a flat list of the units the caller may see, or `enabled: false` when Core has org units off (404). It sits behind the client-visible flag `features.orgUnitsEnabled` (env `ORG_UNITS_ENABLED`, off by default).
  - Pure helpers in `libs/chat-shared` that match a unit's `folder` against a public-bucket path. A load-once `useOrgUnits` hook in `libs/chat-hooks`. An `OrgUnitsProvider` in `apps/chat/src/context/`, so all consumers share one request.
  - No screen consumes the answer yet and nothing in the UI changes.
- **Non-goals:**
  - A distinct unit icon in the file manager or the publish trees (decided against).
  - Unit permissions: `GET /v1/user/role-assignments`, `canWriteAt`, and hiding or disabling actions by role.
  - Showing `displayName` instead of the folder name in rows.
  - Creating, renaming or deleting units, or managing role assignments. That stays in the admin panel.
  - Finding the unit that owns a nested folder (longest `folder` prefix). `isOrgUnitFolder` matches a unit's own folder only; the permission work adds the owner lookup.
- **Acceptance criteria:**
  - `GET /api/v1/org-units` is documented in OpenAPI and present in the regenerated client. It has unit and supertest coverage for 200, Core 404 → `enabled: false`, 401, 403 while the flag is off, and Core 5xx → 502/503.
  - With the flag off, no request is made and the endpoint answers 403. With org units off in Core, or when loading fails, `isOrgUnitFolder` returns `false` and nothing is shown.
  - One request per app session (server cache 60 s per user), shared by all consumers.
  - READMEs of `chat-shared` and `chat-hooks` and `docs/architecture.md` are updated. `validate:docs` and `validate:specs` pass.

**Alternatives considered:**
- Read `GET /v1/user/role-assignments` instead: it needs an SDK re-sync (the method is missing in `0.2.0-dev.23`) and carries permissions we don't use yet. Rejected for now. The DTO leaves room to add roles later.
- Call Core straight from the browser: not possible, because the BFF owns the token. Rejected.

**Rollback / compat:** additive and non-breaking. The flag is off by default, and the endpoint answers 403 until it is turned on.

## Capabilities

### New Capabilities
- `org-units-api`: BFF `GET /api/v1/org-units`, which proxies DIAL Core's caller-scoped org-unit tree as a flat list with a disabled state.
- `org-units-client-state`: the pure unit-folder helpers, the load-once `useOrgUnits` hook and the shared `OrgUnitsProvider` state in the chat.

### Modified Capabilities
<!-- None. -->

## Impact

- **Backend:** new domain `apps/chat-api/src/org-units/` (controller, service, module, DTOs, tests). It follows `apps/chat-api/src/application-schemas/application-schemas.service.ts:26` (`withCachedDialRequest` + SDK + `mapDialHttpStatus`).
- **Generated client:** new `OrgUnitsApi.listOrgUnits` in `libs/chat-api-client`, and an `orgUnitsApi` singleton in `apps/chat/src/server-api/api-client.ts`.
- **Shared libs:** `chat-shared` gets the `OrgUnit` model and helpers, `chat-hooks` gets the hook. Neither learns the endpoint: the app passes a `listOrgUnits` function into the hook, the same way `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts:143` receives `listPublicFiles`.
- **Global provider:** adds `OrgUnitsProvider` to the app provider stack. Loading is lazy: it starts only when the first consumer calls `ensureUnits()`.
- **Docs:** `docs/architecture.md` (backend domain, route table, context list) and the `chat-shared` and `chat-hooks` READMEs.

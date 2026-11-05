## Why

DIAL Core org units own folders under `public/` (for example `public/Acme/Risk/`), but the chat draws them as plain folders. A user browsing organisation files, or choosing where to publish, can't tell which folders are an organisation's units, so a publication can easily land in the wrong place. The admin panel already marks unit folders with their own icon ([ai-dial-admin-frontend#5323](https://redirect.github.com/epam/ai-dial-admin-frontend/pull/5323)). GitHub issue #9757 asks for the same in the chat.

## What Changes

- **Problem:** in the file manager's Organization tab and in the publish destination tree, unit folders look the same as plain folders.
- **Solution:**
  - New BFF endpoint `GET /api/v1/org-units`. It reads DIAL Core `GET /v1/org-units/public?recursive=true` through the SDK (`getOrgUnit`) with the caller's token. The result is a flat list of the units the caller may see, or `enabled: false` when Core has org units off (404).
  - Pure helpers in `libs/chat-shared` that match a unit's `folder` against a public-bucket path. A load-once `useOrgUnits` hook in `libs/chat-hooks`. An `OrgUnitsProvider` in `apps/chat/src/context/`, so both surfaces share one request.
  - The file-manager shell (`libs/chat-shared`) and `PublishFoldersTree` (`libs/publish-panel`) each take an optional `isOrgUnitFolder` predicate plus a label. A matching folder shows Tabler `IconSitemap` instead of the folder icon, in the tree, the grid and the compact list. The file manager wires it through the installed `@epam/ai-dial-react-file-manager@0.4.0` `getItemIcon`.
  - New user-visible string: `Organization unit` (the icon's accessible name and tooltip).
- **Non-goals:**
  - Unit permissions: `GET /v1/user/role-assignments`, `canWriteAt`, and hiding or disabling actions by role. Today's buttons and destinations stay as they are.
  - Showing `displayName` instead of the folder name in rows. It goes into the icon's tooltip only, so rename, search and sorting keep working on real folder names.
  - Creating, renaming or deleting units, or managing role assignments. That stays in the admin panel.
  - Breadcrumbs and the publish panel's "Change folder" button. These render a path string or a fixed action icon, not a folder row.
- **Acceptance criteria:**
  - `GET /api/v1/org-units` is documented in OpenAPI and present in the regenerated client. It has unit and supertest coverage for 200, Core 404 → `enabled: false`, 401, and Core 5xx → 502/503.
  - Unit folders show `IconSitemap` in the Organization tab (tree and list, including the All tab's Organization section) and in the publish destination tree. Plain folders keep `IconFolder`.
  - With org units off, or when loading fails, both surfaces render exactly as today, with no toast.
  - One request per app session (server cache 60 s per user). Expanding folders never refetches.
  - The label comes from a `*Labels` prop with an English default and is filled with `t()` in `apps/chat`. The icon works in RTL (no mirroring) and meets the a11y rules.
  - READMEs of `chat-shared`, `chat-hooks` and `publish-panel` and `docs/architecture.md` are updated. `validate:docs` and `validate:specs` pass.

**Alternatives considered:**
- Read `GET /v1/user/role-assignments` instead: it needs an SDK re-sync (the method is missing in `0.2.0-dev.23`) and carries permissions we don't use yet. Rejected for now. The DTO leaves room to add roles later.
- Call Core straight from the browser: not possible, because the BFF owns the token. Rejected.
- Mark units inside `useDialFileManager` listing data: this couples org units to every file listing and mutation path. Rejected in favour of a render-time predicate.

**Rollback / compat:** additive and non-breaking. Every new prop is optional. Reverting the app wiring alone restores today's UI, and the endpoint can stay unused.

## Capabilities

### New Capabilities
- `org-units-api`: BFF `GET /api/v1/org-units`, which proxies DIAL Core's caller-scoped org-unit tree as a flat list with a disabled state.
- `org-unit-folder-indicator`: the shared load-once org-unit state in the chat and the distinct unit icon in the file manager and the publish destination tree.

### Modified Capabilities
<!-- None: existing file-manager-tabs and publish-panel-library requirements keep their behaviour; the indicator is additive and specified in org-unit-folder-indicator. -->

## Impact

- **Backend:** new domain `apps/chat-api/src/org-units/` (controller, service, module, DTOs, tests). It follows `apps/chat-api/src/application-schemas/application-schemas.service.ts:26` (`withCachedDialRequest` + SDK + `mapDialHttpStatus`).
- **Generated client:** new `OrgUnitsApi.listOrgUnits` in `libs/chat-api-client`, and an `orgUnitsApi` singleton in `apps/chat/src/server-api/api-client.ts`.
- **Shared libs (scope note):** touches three published libs. `chat-shared`, the file-manager shell, gets the props and helpers. `chat-hooks` gets the hook. `publish-panel` gets the tree prop. None of them learns the endpoint: the app passes a `listOrgUnits` function into the hook and an `isOrgUnitFolder` predicate into the components. The hook follows `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts:143`, which receives `listPublicFiles` the same way.
- **Global provider:** adds `OrgUnitsProvider` to the app provider stack. Loading is lazy: it starts only when the first consumer calls `ensureUnits()`.
- **i18n:** one new key, `dialFileManager.orgUnit` (`Organization unit`), reused by the publish tree.
- **Docs:** `docs/architecture.md` (backend domain, route table, context list) and the three lib READMEs.

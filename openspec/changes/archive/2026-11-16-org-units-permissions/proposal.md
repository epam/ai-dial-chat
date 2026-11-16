# Proposal

## Why

PR #9766 taught the chat which public folders are DIAL Core org units, but nothing uses the user's rights in them. Every folder in the save and publish trees looks usable, the only "write permission" check is a placeholder (`hasPublishFolderWriteAccess` in `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts` returns `false` for any folder path that has a segment named `Production`), and a user who may write into a unit still has to wait for someone to approve a request. Core already says who may do what in each unit (`GET /v1/user/role-assignments`), so the chat can disable folders the user cannot use and let a unit writer save without a request.

## What Changes

One change, three task groups. They are sequential: each needs the one before.

1. **Permissions data (no UI change).** Read the caller's rights per unit through the existing BFF endpoint `GET /api/v1/org-units`, whose Core source changes to `getUserRoleAssignments` and whose response gains per-unit `permissions` and the admin flag (one endpoint, one hook, no separate `/access`), behind `features.orgUnitsEnabled`. A pure helper in `libs/chat-shared` finds the owning unit of a folder and answers `canWriteAt` / `canReadAt` per Core namespace. The one `useOrgUnits` hook in `libs/chat-hooks` loads the data, and `OrgUnitsProvider` exposes it. Dead code from the first org-units change (`isOrgUnitFolder`, `toOrgUnitFolderSet`) is removed in the same group; `normalizeOrgUnitFolder` stays. When the flag is on and the rights are `Ready`, this check replaces the `Production` heuristic; otherwise the heuristic still applies.
2. **Disabled folders.** In every panel with a folder tree (save panels: Quick App, toolset, prompt, skill; publish panels: catalog items, conversations, projects), a row the user cannot use is disabled and carries a typed tooltip, for example "You have no access to save your QuickApp to this folder."
3. **Direct save inside a unit.** A user with `write` on the type's namespace in the owning unit saves into that unit folder directly, with no request. Publications stay as today (a request). Plain `public/` keeps today's admin-approval flow.

Details of the rights and per-type limits are in `design.md`. They come from reading `ai-dial-core` and the admin frontend on 2026-11-16; the claims that are not proven are listed in `design.md` under Risks.

- **BREAKING**: none for callers. With `ORG_UNITS_ENABLED` off (the default) nothing changes: the endpoint answers 403, no request is made, and no row is disabled. With the flag on and the rights `Ready`, the publish panels use the unit rights instead of the `Production` heuristic (a folder named `Production` outside every unit becomes selectable again unless Core says otherwise). With the flag off, or while the rights are not `Ready`, the heuristic still applies unchanged.
- Rollback: turn `ORG_UNITS_ENABLED` off (the `Production` heuristic then applies again), or revert the slices; no data migration, no persisted state.

## Known risks

- **Core rules for a non-admin copy into a unit** (not handled by the chat): Core resets `forward_auth_token` on the copy, keeps interceptors but does not add new ones, and drops the admin consent of declared `resource_dependencies`. Today the chat never copies into the shared space directly, so users meet these rules for the first time with direct save.
- **A Core without the `role-assignments` route** answers 404, which the chat reads as "org units off", so the feature disables silently. Accepted: the admin panel already uses the route, so supported deployments have it.
- **Rights are advice, Core is the judge.** Until the rights are loaded, or if the read fails, no folder is disabled (today's behaviour).

## Non-goals

- A unit admin publishing through `createPublication` followed by an immediate approve (two calls). To be decided later and confirmed with the team. Not a task here.
- The File storage page and file-manager modals (`DialFileManagerShell`). Separate estimate later.
- Plain `public/` outside every unit. It stays admin-only for writes and approval-based for publications.
- Any change to ai-dial-core. Where Core does not allow something, `design.md` states the constraint plainly.
- A new feature flag. The same `ORG_UNITS_ENABLED` gates all three groups.
- Org-unit icons (issue #9757 icon part).
- Editing an item that lives in a unit folder from the chat catalog. Seen on a real DIAL Core: an application saved directly into a unit shows no Edit action, even for a user with `write` there, because `isEditable` needs ownership or a share with WRITE (`map-deployment-to-catalog-item.ts`, `resource-ownership.ts`) and unit rights are not considered; today the way to change it is the admin panel or saving a new version from the author's personal copy. Follow-up, to be decided later and raised with the team. Not a task here.

## Alternatives considered

- **A sibling `GET /api/v1/org-units/access` endpoint and a second hook**: rejected by the user. It would leave the first change's endpoint and hook unused and call Core twice for one answer. The existing endpoint is reshaped instead (see `design.md`, D1; role-assignments `items` is a superset of the old list for the same caller).
- **Let Core refuse and show the 403** (no client-side check): the conservative baseline. Rejected: the user finds out only after pressing Save, which is what the mockup (greyed rows) is meant to avoid. Core stays the authority; the client check only advises.
- **Three separate OpenSpec changes**: rejected; the groups share one rights model and one rule source, and splitting would duplicate the design.

## Capabilities

### New Capabilities
- `org-units-folder-permissions`: what the save and publish folder trees allow per org unit: disabled rows with a typed tooltip, and the direct save inside a unit (Groups 2 and 3).

### Modified Capabilities
- `org-units-api`: the list endpoint reads `getUserRoleAssignments` and returns `permissions` per unit and `hasAdminAccess`.
- `org-units-client-state`: removes `isOrgUnitFolder` and `toOrgUnitFolderSet`; the one hook and the context gain the rights answers; adds the pure owner and rights helpers and the conditional replacement of the `Production` heuristic (flag on and rights `Ready` only).
- `publish-panel-library`: `PublishFoldersTree` gains a per-row disabled state with a tooltip.
- `resource-save-panel`: the Change folder view may disable rows, and Save sequencing gains the direct-save row for a unit folder.

## Impact

- `apps/chat-api/src/org-units/` (controller, service, DTO, tests), `libs/chat-api-client` (regenerated, not hand-edited), `apps/chat/src/server-api/org-units.api.ts`, `apps/chat/src/context/OrgUnitsContext.tsx`.
- `libs/chat-shared` (models and pure helpers), `libs/chat-hooks` (`useOrgUnits`, the folder-guard function, `usePublishFolders`, `useResourceSavePanel`, `resource-save`), `libs/publish-panel` (`PublishFoldersTree`, `SaveToFolderPanel`), `libs/catalog` (threading only).
- `apps/chat` panel containers: `ResourceSavePanelContainer`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `CatalogView`, and the editors that pass the save adapter.
- Libraries: libs never learn the endpoint, the flag or the context. The app passes resolved callbacks (`canUseFolder`, `getDisabledReason`) and labels (`*Labels` props with English defaults, `t()` in `apps/chat`). `libs/chat-hooks` already may call the generated client types and takes a configured client function from the host, as `useOrgUnits` does today.
- i18n: new keys for the tooltip per resource type and for direct-save notifications (Group 2 and 3). Group 1 adds none.
- Docs: `docs/architecture.md` (context table, endpoint table), `apps/chat-api/README.md` (`ORG_UNITS_ENABLED` text), READMEs of `libs/chat-shared`, `libs/chat-hooks`, `libs/publish-panel`; `npm run validate:docs` and `npm run validate:specs` pass in every slice.
- Closest existing models: `apps/chat-api/src/org-units/org-units.controller.ts` (endpoint), `libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts` (hook), `libs/chat-shared/src/utils/org-unit.ts` (helpers), `apps/chat/src/context/OrgUnitsContext.tsx` (context).

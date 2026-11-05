## Context

DIAL Core exposes org units under `/v1/org-units/{path}` (preview API). `GET /v1/org-units/public?recursive=true` (SDK `getOrgUnit`) works for any user. Core filters the tree by visibility (`OrgUnitService.read`: an admin sees everything, everyone else only visible units) and answers 404 while org units are off. Each unit's `folder` is a url-encoded `public/...` path with a trailing slash.

What the chat does today:
- **File manager, Organization tab.** It lists the public bucket through `filesApi.listPublicFiles` (`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`). The rows are rendered by `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`), which builds `gridOptions` / `treeOptions` for `@epam/ai-dial-react-file-manager@0.4.0`. That package version already accepts `getItemIcon` on both the grid and `treeOptions`. The admin panel uses the same hook for its `UnitFolderIcon`.
- **Publish destination tree.** `PublishFoldersTree` (`libs/publish-panel`) renders `DialFoldersTree` from the same package, which also takes `getItemIcon`. Its folders come from `usePublishFolders`, keyed by segments relative to the public bucket.
- **Nothing in the chat reads org units yet.** The admin panel's pattern is an `OrgUnitsContext` with a load-once `ensureUnits()` and helpers that compare normalised folders (`toUnitMap`, `isUnitFolder`). We mirror it.

## Goals / Non-Goals

**Goals:**
- One BFF read of the caller-visible units, cached per user.
- One lazily-started frontend load, shared by the file manager and the publish panel.
- Unit folders in both trees and the file grid show `IconSitemap` with an accessible label. Every other folder is unchanged.

**Non-Goals:**
- Permissions (`/v1/user/role-assignments`) and action gating.
- Showing `displayName` as the row name.
- Breadcrumbs.
- Managing units.

## Decisions

1. **Source: `getOrgUnit('public', recursive)`, not `getUserRoleAssignments`.** We only need the list for now, and the SDK installed (`0.2.0-dev.23`) has `getOrgUnit` but not `getUserRoleAssignments`. The response DTO keeps `id` / `folder`, so roles can be joined later without changing the contract.
2. **Core 404 becomes `200 { enabled: false }`.** "Off" is a normal deployment state. Turning it into an error would make every consumer special-case a status code. The BFF answers 200 so the generated client's normal method resolves. Other errors keep `mapDialHttpStatus` (see `apps/chat-api/AGENTS.md`, error handling).
3. **Server cache: `org-units:list:<sub>`, 60 s,** following `application-schemas`. The list is user-specific (visibility), so the key includes `sub`. TTL-only invalidation is enough because the chat never mutates units.
4. **Flatten in the BFF.** Core returns `items` already ordered parents-first. The frontend needs membership checks, not hierarchy, so a flat `units[]` keeps the DTO simple.
5. **Keep `folder` raw and normalise in `chat-shared`.** One pure `normalizeOrgUnitFolder` does decode → strip `public/` → trailing slash. The admin panel's matching bug class (`Risk/` vs `Risk2/`, encoded spaces) is then covered by unit tests in one place, and any host gets the same rule.
6. **Render-time predicate, not data tagging.** The libs take `isOrgUnitFolder` and return an icon from `getItemIcon`. Listing, search, rename and selection code stays untouched. The alternative was to add `isOrgUnit` to listing rows in `useDialFileManager`, which would have to touch every listing and mutation path. Rejected.
7. **Shared state in an app context with lazy load.** `useOrgUnits` (chat-hooks) owns load-once and status. `OrgUnitsProvider` (`apps/chat/src/context/OrgUnitsContext.tsx`, ThemeContext pattern: `useMemo` value, throwing guard hook) makes it one load for both surfaces. Consumers call `ensureUnits()` in an effect. The alternative was each surface calling the hook on its own, which means two requests and duplicate state. Rejected.
8. **Library isolation.** None of the libs imports the generated client or knows `/api/v1/org-units`. The app adapter is `apps/chat/src/server-api/org-units.api.ts` (`listOrgUnits` → `orgUnitsApi.listOrgUnits()`), passed into `useOrgUnits({ listOrgUnits })` in the same way `usePublishFolders({ listPublicFiles })` gets its function. Each component receives a resolved predicate and a label.
9. **Virtual path → public path conversion lives in the app.** The shell's Organization rows carry the file manager's virtual paths. The host converts them with the existing Organization-root helpers before calling `isOrgUnitFolder`, so `chat-shared` never learns the virtual root names. The publish tree passes segments that are already public-relative.
10. **One icon component.** `OrgUnitFolderIcon` lives in `libs/chat-shared`, which both the shell and `libs/publish-panel` already use, so the icon, its label and its colour var are defined once.
11. **Multi-root trees pass the root.** In the save-to-folder tree, only the Organization root holds units. So the tree's predicate takes `rootKey`, and the app checks `SaveDestinationRoot.Organization`.
12. **Catalog plumbing.** The catalog renders its own `PublishPanel` inside `DetailsPanel`. `libs/catalog` therefore threads one more optional prop, `isPublishOrgUnitFolder`, in the same way it threads `publishFolderItems`.
13. **Icon and colour.** Tabler `IconSitemap` matches the admin panel's `UnitFolderIcon`, so both products read the same. Colour comes from a new `*Colors` var with a fallback in each lib's `.module.scss` (lib-theming rule), not from `text-secondary` in JSX. The icon is not decorative: `role="img"`, `aria-label` and `title` carry `Organization unit`, because the icon is the only signal that tells a unit apart.

**Authorization:** `GET /api/v1/org-units` is behind the global session guard (any authenticated user). Core does the per-unit visibility filtering. The BFF adds no role check.

**States:**
- Loading: plain folder icons until `Ready`, with no spinner. The icon is an enhancement, and the folders are already usable.
- Empty or disabled: unchanged UI.
- Error: unchanged UI and a `warn` log in the BFF. No toast, because the user has nothing to act on.

## Risks / Trade-offs

- **[Risk] Core changes the preview API (`x-preview`).** → Mitigation: one service maps Core to our DTO, and malformed items are dropped and logged rather than failing the list.
- **[Risk] The Organization tab's virtual path form differs from public-relative segments in some section (for example, the All tab).** → Mitigation: a dedicated task pins the conversion with tests for the Organization tab and the All tab's Organization section, before the wiring lands.
- **[Trade-off] Up to 60 s staleness after an admin creates or deletes a unit.** This is acceptable for a visual marker that grants no access.
- **[Trade-off] A large org (hundreds of units) means one larger response.** That is still a single cached read, and the membership check is a `Set` lookup per row.
- **[Risk] `getItemIcon` changes the memo deps of the grid and tree options.** → Mitigation: `useCallback` over the memoised `unitFolders` set, so the options only change when the units load.

## Migration Plan

The change is additive, with no data migration. Deploy order doesn't matter: an old frontend ignores the endpoint, and a new frontend against a Core without org units gets `enabled: false`. To roll back, revert the app wiring: the icons disappear and the endpoint stays harmless.

## Open Questions

- Should a later change show `displayName` as the row label, which needs rename/search handling? That is not needed for #9757.
- Should a later change move to `GET /v1/user/role-assignments` once the SDK exposes it, so that permissions and the list come from one read?

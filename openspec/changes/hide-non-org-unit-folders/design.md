## Context

The org-units work gave the client one shared answer about the public bucket. The pieces:
- `OrgUnitsContext`, a wrapper over `useOrgUnits` in `libs/chat-hooks`, loads the units lazily.
- The pure helpers in `libs/chat-shared/src/utils/org-unit.ts` find a path's owning unit.
- `buildFolderGuards` disables rows the user has no rights for.

Plain public folders, those under no unit, are explicitly left alone.

Public folders reach the UI through two listing hooks, both in `libs/chat-hooks`:

| Hook | Surfaces | Node path |
|---|---|---|
| `usePublishFolders` (`catalog/usePublishFolders`) | publish panels: catalog Details, conversation, project; the Save panel's Organization root | `PublishFolderNode.path: string[]`, decoded, relative to `public/`; `[]` is the Organization root |
| `useDialFileListing` via `useDialFileManager` / `useDialFileManagerSections` | File storage page, `DialFileManagerModal` (attachment, project, skill, avatar pickers), the file manager's Copy/Move destination panel | virtual `DialFile.path` `/<rootLabel>/<decoded segments>/`; recursive search returns files with a decoded `parentPath` |

Both hooks list one level at a time (a per-path cache). Search in the publish tree runs client-side over the loaded tree (`filterFolderTree`). File-manager search is a separate recursive listing.

Constraints:
- Libraries stay host-agnostic (AGENTS.md "Library isolation"): no context, flag or endpoint knowledge inside a lib.
- `@epam/ai-dial-react-file-manager` lives in a sibling repo and has no hide prop.

## Goals / Non-Goals

**Goals**
- One rule, in one place, decides whether a public folder is visible. Every listing surface applies it.
- Missing data never hides anything. This is the same unknown-means-today rule `useOrgUnits` already applies to rights.
- No folder is created only to disappear.

**Non-Goals**
- Server-side filtering, catalog items, Personal/Shared roots, and the selectability of the Organization root (see the proposal).

## Decisions

### D1. The visibility rule is a pure helper next to `findOwningOrgUnit`

`isOrgUnitTreeFolder(units, publicPath): boolean` in `libs/chat-shared/src/utils/org-unit.ts`:
- `publicPath` empty (the public root): `true`. The root is a container, never a hidden folder.
- `findOwningOrgUnit(units, publicPath) != null` (the folder is a unit or inside one): `true`.
- Otherwise `true` when the folder (`joinFolder(segments)`) is a segment-boundary prefix of some normalised unit folder, i.e. an ancestor of a unit. Otherwise `false`.

The helper uses the same normalisation and the same `WeakMap` memo of `getUnitFolders`, so a tree asking per row costs one string compare per unit.

`hasAdminAccess` is ignored on purpose. The rule describes the folder kind, not a right, and an admin already receives every unit from Core.

Alternatives:
- Put it in `chat-hooks`: rejected. The siblings (`findOwningOrgUnit`, `canAccessAt`) live in `chat-shared`, and the BFF mirror (`apps/chat-api/src/org-units/org-unit-rights.util.ts`) may want it later.
- Name it `isOrgUnitFolder`: rejected. That name was removed earlier with a different meaning ("is exactly a unit"), and reusing it would mislead.

### D2. `useOrgUnits` answers `isPublicFolderVisible(publicPath)`, `true` until `Ready`

The hook adds `isPublicFolderVisible: (publicPath: string) => boolean`, a `useCallback` over `isReady` and `access`, following `canSaveAt` and `canPublishAt`. In `Idle`, `Loading`, `Disabled` and `Error` it returns `true`.

`OrgUnitsContext` forwards it. While `features.orgUnitsEnabled` is off it already never loads, so the answer stays `true`.

No new state, no new request, no cache: it reads the units already loaded and refreshed by `refreshUnits`.

### D3. Libraries take an optional predicate; `apps/chat` supplies it

| Lib API | New optional input | Applied |
|---|---|---|
| `usePublishFolders` (`libs/chat-hooks`) | `isFolderVisible?: (folderPath: string[]) => boolean` | Prune `folderItems` after `mergeFolderPaths`, dropping a node and its subtree when the predicate is `false`. Pruning after the merge matters: remembered destinations (`localStorage`) and locally created folders are merged in from outside the listing cache and must not bring a hidden folder back. The prune is memoised with `folderItems` and the predicate identity. |
| `useDialFileManager` → `useDialFileListing` (`libs/chat-hooks`) | `isPublicFolderVisible?: (publicPath: string) => boolean` | Only when `activeTab` is Organization: prune folder `DialFile`s, with their subtrees, from `items`; drop search results whose decoded parent folder is hidden; and treat a current path inside a hidden folder as the section root. The Copy/Move destination panel and the All tab read the same `items`, so they are covered. |
| `PublishFoldersTree`, `PublishPanel`, `StandalonePublishPanel`, `SaveToFolderPanel` / `StandaloneSaveToFolderPanel` (`libs/publish-panel`); forwarded by `Catalog` → `DetailsPanel` → `DetailsPublishContent` (`libs/catalog`) as `canCreatePublishFolderIn`, next to `getPublishDisabledReason` | `canCreateFolderIn?: (destination: FolderDestination) => boolean` | `canCreateUnder` also requires `canCreateFolderIn` to be `true`, so the trailing "Create new folder" and the per-row "Add child" / "Add sibling" items are not offered where the new folder would be hidden. |

The app adapters fill these from `useOrgUnitsContext()`:
- `apps/chat/src/hooks/publish/usePublishFolders.ts` passes `isFolderVisible = (path) => isPublicFolderVisible(path.join('/'))`.
- `useOrgUnitFolderGuards` (`apps/chat/src/hooks/publish/useOrgUnitFolderGuards.ts`) returns `canCreateFolderIn`. For an Organization destination, the new child must itself be visible: the parent lies inside a unit (`findOwningOrgUnit`), or the rule is not `Ready`. Other roots answer `true`. The containers forward it next to `getDisabledReason`.
- `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts` adds `isPublicFolderVisible` to the shared host options, and calls `ensureUnits()`, so the page and the modal both get it.

Every predicate is memoised with `useCallback` on the context answer, so the lib memos invalidate only when the units change.

Alternatives:
- Filter in the containers instead of the hooks: rejected. The file manager's search, path and Copy/Move all read the hook's arrays, so the hook is the one choke point.
- Derive `canCreateFolderIn` inside the lib from `isFolderVisible`: rejected. A child of a visible ancestor-only folder is hidden while its parent is visible, so "parent visible" is not "child visible". The rule needs the unit list, which only the host has.

### D4. What stays selectable

Hiding removes rows. It does not change which visible rows can be selected:
- An ancestor-only folder (`Acme/` above unit `Acme/Risk/`) and the Organization root stay selectable as destinations when they are today. Under the current guards that means always for Save and Publish outside units.
- Disabling rows inside units keeps working exactly as `org-units-folder-permissions` describes.

Recorded as an open question, not decided silently.

### D5. Loading order

- The trees already call `ensureUnits()` through `useOrgUnitFolderGuards` while the panel is active. The file-manager host options add the same call.
- Until `Ready`, the full listing shows. Once units arrive, plain folders drop out in one render. Accepted as a one-time reflow per session: the units are cached for the session and `GET /api/v1/org-units` is cached 60 s per user by the BFF. It matches how the disable-guards already behave.
- Showing nothing until `Ready` was rejected, as the user chose "hide nothing" for unknown data.

## Risks / Trade-offs

- **[Flash of plain folders before units load]** → `ensureUnits()` starts as soon as a picker opens. The org-units read is usually cached, and the trees keep their lazy loading indicators.
- **[A unit the user cannot see makes its folder look plain]** → Core decides visibility, so a hidden unit's folder is hidden too. That is intended: the user has no role there. An admin gets every unit.
- **[Deep link or remembered path into a hidden folder]** → The publish tree prunes remembered paths after the merge. The file manager resets a hidden current path to the section root. Core access is unchanged, because this is not a security control.
- **[An admin creates a plain folder in the file manager]** → The file manager's "New folder" is not gated by this change, since only DIAL admins can write outside units. An admin who creates a plain folder will not see it in the Organization section. Documented in the spec, and the follow-up lives in Open Questions.
- **[Branch drift]** → Issue #8825 merged first and replaced `PublishFoldersTree` and `SaveToFolderPanel` with `FolderDestinationPanel` from `@epam/ai-dial-react-file-manager`, which has no per-parent creation gate. The hiding (D1–D3, the file manager) is unaffected, since it prunes the data the panels receive. The creation gate (`canCreateFolderIn`) needs a new prop in that external package or another approach; tasks section 3 is blocked until one is chosen.
- **[Lib API growth]** → All inputs are optional and default to today's behaviour. READMEs document them, and `npm run validate:docs` checks them.

## Migration Plan

- No data migration, no endpoint change, no new environment variable. The feature rides the existing `ORG_UNITS_ENABLED` flag.
- Rollout: deploy with the flag as it is. Environments with org units on get the hiding immediately.
- Rollback:
  - Fastest: turn `ORG_UNITS_ENABLED` off. Nothing is hidden, but the disable-guards are lost too.
  - Targeted: revert the app adapters so they stop passing the predicates. The libs keep their optional props unused.

## Open Questions

1. Should the Organization root and ancestor-only folders stop being selectable destinations? That would force every save and publish into a unit. Today they stay selectable (D4).
2. Should the file manager's "New folder" in the Organization section be disabled outside units, as the trees are? This matters for admins only.
3. Plain files that sit directly in the public root or in an ancestor-only folder stay listed, because the rule hides folders only. Confirm this is wanted.

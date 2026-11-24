## Why

With org units on, the public bucket mixes two kinds of folders: org-unit folders, where DIAL Core grants rights per unit, and plain folders left over from the old "publish anywhere" model. Every folder picker lists both side by side, so users publish and save into plain folders that no unit owns and nobody in their org manages. Each surface that lists public folders should show only the org-unit structure.

## Problem

`usePublishFolders` (`libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts:245`) and the file manager listing (`libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts:336`) render every public folder Core returns. The org-unit rule added by `org-units-folder-permissions` only **disables** rows inside a unit without rights. It deliberately leaves plain folders enabled ("plain `public/` folders keep today's save-then-request and request flows"). No surface can hide a folder today: the only hide prop, the file manager's `excludedPaths`, covers its Copy/Move panel alone.

## Solution

Hide every public folder that is neither inside an org unit nor on the path to one, on every surface that lists public folders:

- Publish panel trees: catalog, conversations, projects.
- The Organization root of the Save / Change folder tree.
- The Organization section of the File storage page and of the file-manager modals: tree, grid, Copy/Move destination and search results.

A folder stays visible when one of these holds:
- it is a unit folder or lies inside one (`Acme/`, `Acme/Reports/`);
- it is an ancestor of a unit folder (`Acme/` when only `Acme/Risk/` is a unit), so the tree can reach the unit.

Every other public folder and its subtree is hidden.

- The rule is decided once, by a pure helper in `libs/chat-shared` next to `findOwningOrgUnit` (`libs/chat-shared/src/utils/org-unit.ts:68`).
- `useOrgUnits` exposes it as `isPublicFolderVisible(publicPath)`. It follows the hook's existing unknown-means-today rule: `true` for every path until the status is `Ready`, so nothing is hidden while the flag is off, while loading, or after a failed read.
- Libraries receive it as an optional predicate:
  - `isFolderVisible` on `usePublishFolders`;
  - `isPublicFolderVisible` on the file-manager hooks;
  - `canCreateFolderIn` on the folder tree, so the tree never creates a folder that would immediately be hidden.
- `apps/chat` fills the predicates from `useOrgUnitsContext()` at the existing app adapters: `apps/chat/src/hooks/publish/usePublishFolders.ts` and `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`. This follows the `canPublishTo` pattern already used there.

## What Changes

- `libs/chat-shared` adds the pure function `isOrgUnitTreeFolder(units, publicPath)`.
- `libs/chat-hooks`:
  - `useOrgUnits` adds `isPublicFolderVisible`;
  - `usePublishFolders` adds the optional param `isFolderVisible`, which prunes `folderItems` after remembered and locally created folders are merged in;
  - `useDialFileManager` / `useDialFileListing` add the optional `isPublicFolderVisible`, applied to the Organization tab's `items` and `searchResults`, and resetting a current path that is hidden.
- `libs/publish-panel`: `PublishFoldersTree`, `PublishPanel`, `StandalonePublishPanel` and the save panel gain the optional `canCreateFolderIn(destination)`. With it, "Create new folder", "Add child" and "Add sibling" are offered only where the new folder would stay visible.
- `apps/chat`:
  - `OrgUnitsContext` exposes `isPublicFolderVisible` (`true` while the flag is off);
  - the publish-folder and file-manager adapters pass it in and call `ensureUnits()` when a public listing is first shown.
- The catalog and marketplace are unchanged. They have no folder tree or filter, and published items stay listed wherever they live (decision recorded with the user).
- No new endpoint, no BFF change, no new user-visible string.

## Capabilities

### New Capabilities
- `org-units-folder-visibility`: which public folders are visible when org units are on, the shared rule and its unknown-means-show fallback, and how every folder-listing surface applies it: publish trees, the save tree, the file manager tree, grid, search and Copy/Move, and folder creation.

### Modified Capabilities
- `org-units-folder-permissions`: the "Every folder tree applies the same unit rights" requirement no longer promises that plain `public/` folders stay listed and usable. With the rule `Ready`, they are hidden instead.
- `org-units-client-state`: an added requirement. The pure helper `isOrgUnitTreeFolder` is new, and `useOrgUnits` / `useOrgUnitsContext()` return one more answer, `isPublicFolderVisible`. Existing requirements are unchanged.

## Non-goals

- Server-side filtering of `GET /api/v1/files/public`. Hiding is a UX rule, not access control. Plain folders stay readable through Core, and a URL or a remembered path is not an authorization bypass.
- Hiding published items in the catalog or marketplace, or the publish history and unpublish lists that show where an item already lives.
- Making the Organization root or an ancestor-only folder unselectable as a destination. Their selectability is unchanged (see design Open Questions).
- The Personal, Shared and My files roots, and conversation-panel sections.
- Any change in `@epam/ai-dial-react-file-manager` (sibling repo): filtering happens before items reach it.

## Alternatives considered

| Option | Correctness | Cost / risk | Verdict |
|---|---|---|---|
| A. Conservative baseline: keep showing plain folders and only disable them (reuse `getDisabledReason`) | The folders stay visible, which is not what was asked | Smallest | Rejected: does not hide |
| B. Client-side predicate at the existing adapters (chosen) | Same rule source as the disable-guards. Unknown rights hide nothing | Touches 3 libs, all optional props. No new request | **Picked**: matches `org-units-folder-permissions` and keeps libs host-agnostic |
| C. BFF filters `listPublicFiles` by the caller's units | Covers search and deep links in one place | Couples every public listing to the org-units flag and to a second Core read. A failed unit read must fall back to unfiltered. Changes the response for any other host of the API | Rejected: shifts a UX rule into the API contract |
| D. Add a hide prop to `@epam/ai-dial-react-file-manager` | Correct for the file manager only | Needs a sibling-repo release and still leaves the publish and save trees | Rejected: B covers it without a package release |

## Acceptance criteria

- With `features.orgUnitsEnabled` on and units `Ready`:
  - publish trees, the save tree's Organization root and the file manager Organization section show only unit folders, folders inside them, and the ancestors needed to reach them;
  - plain folders such as `Shared/` are absent from tree, grid, search results and the Copy/Move destination.
- Flag off, status `Loading` / `Error` / `Disabled`: every surface lists exactly what it lists today.
- No surface creates a folder that the rule would hide.
- Catalog and marketplace listings are unchanged.
- `npm run verify:changed`, `npm run validate:specs` and `npm run validate:docs` pass. Lib READMEs document the new optional props.

## Impact

- **Libs:**
  - `libs/chat-shared`: a pure helper;
  - `libs/chat-hooks`: `useOrgUnits`, `usePublishFolders`, the file-manager listing hooks;
  - `libs/publish-panel`: the optional `canCreateFolderIn` on its tree and panels;
  - `libs/catalog`: a forwarding prop `canCreatePublishFolderIn` on `Catalog` / `DetailsPanel`, next to `getPublishDisabledReason`.

  Every addition is an optional prop or param, so existing hosts are unaffected. The libs learn no endpoint, flag or context: `apps/chat` passes a resolved predicate.
- **App:** `apps/chat/src/context/OrgUnitsContext.tsx`, `apps/chat/src/hooks/publish/usePublishFolders.ts`, `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`, and the containers that render the trees: `CatalogView`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `ResourceSavePanelContainer`.
- **Shared providers:** `OrgUnitsContext` gains a value. Scope creep is limited to that context and the four libs above.
- **API / backend:** none. There is no OpenAPI or generated-client change.
- **i18n:** none. No new user-visible string. The hidden rows simply do not render.
- **RTL / a11y:** no new UI. The trees keep their roles and keyboard order, just with fewer rows.
- **Rollback:** not breaking. Reverting the app adapters, which stop passing the predicates, restores today's listing. Turning `ORG_UNITS_ENABLED` off has the same effect at runtime.

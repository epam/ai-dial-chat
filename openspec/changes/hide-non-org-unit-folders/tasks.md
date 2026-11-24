Slicing strategy: vertical. Slice 1 builds the rule and its app answer. Each later slice wires one surface end to end (lib predicate → app adapter → container), so each can be verified and shipped without the rest. Order: publish and save trees, folder creation, file manager, then docs.

Architecture guard for every slice that touches `libs/*`: the lib receives only a resolved predicate. It does not import `OrgUnitsContext`, read `features.orgUnitsEnabled`, call `/api/v1/org-units` or `@epam/ai-dial-chat-api-client`, or touch storage. Check with `npm exec nx lint` on each touched lib (module-boundary rules) and by reading the diff.

## 1. Visibility rule and its app answer

- [x] 1.1 `libs/chat-shared/src/utils/org-unit.ts`: add `isOrgUnitTreeFolder(units, publicPath)` as a const arrow function with JSDoc, per design D1:
  - root → `true`;
  - `findOwningOrgUnit` owner → `true`;
  - segment-boundary ancestor of a normalised unit folder → `true`;
  - otherwise → `false`.

  Reuse `getUnitFolders` / `joinFolder` / `toSegments`. Export it from the lib entry that already exports `findOwningOrgUnit`. In `libs/chat-shared/src/utils/tests/org-unit.spec.ts`, cover unit, inside, ancestor, plain sibling, `Ac`/`Acme2` non-segment prefixes, an encoded folder (`US%20Risk`), the empty root, and an empty units list.
  - Verification: `npm run test:file -- libs/chat-shared/src/utils/tests/org-unit.spec.ts`
- [x] 1.2 `libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`: add `isPublicFolderVisible` to `UseOrgUnitsResult`. It is a `useCallback` returning `!isReady || isOrgUnitTreeFolder(access.units, publicPath)` and is included in the memoised result. Update `useOrgUnits.spec.ts`: `true` in `Idle`/`Loading`/`Disabled`/`Error`, the rule in `Ready`, and a refresh that changes the units changes the answer.
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/useOrgUnits/tests/useOrgUnits.spec.ts`
- [x] 1.3 `apps/chat/src/context/OrgUnitsContext.tsx`: forward `isPublicFolderVisible` in the memoised value, answering `true` while `orgUnitsEnabled` is off. Update `apps/chat/src/context/tests/OrgUnitsContext.spec.tsx` for flag off, `Ready` and failure.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/OrgUnitsContext.spec.tsx`

## 2. Publish panels and Save tree hide plain folders

- [x] 2.1 `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts`: add the optional `isFolderVisible?: (folderPath: string[]) => boolean` to `UsePublishFoldersParams`. Prune `folderItems` after `mergeFolderPaths` by dropping a node and its subtree, inside the same `useMemo` keyed on the predicate. The pruning helper is module-private (`pruneFolderTree`), so `libs/publish-panel` gains no export for it. Extend `libs/chat-hooks/src/catalog/usePublishFolders/tests/usePublishFolders.spec.ts`:
  - a listed plain folder is hidden;
  - a remembered `localStorage` key and a locally created folder inside a hidden folder are not listed;
  - an ancestor of a unit stays;
  - no predicate → unchanged output.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/usePublishFolders/tests/usePublishFolders.spec.ts`
- [x] 2.2 `apps/chat/src/hooks/publish/usePublishFolders.ts`: read `isPublicFolderVisible` from `useOrgUnitsContext()` and pass `isFolderVisible = useCallback((path) => isPublicFolderVisible(path.join('/')), …)`. Update `apps/chat/src/hooks/publish/tests/usePublishFolders.spec.ts`. This covers `CatalogView`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer` and the Organization root of `ResourceSavePanelContainer`, which all call this wrapper.
  - Verification: `npm run test:file -- apps/chat/src/hooks/publish/tests/usePublishFolders.spec.ts`
- [x] 2.3 Container coverage. Every container test (`CatalogView`, `PublishConversationPanelContainer`, `PublishProjectPanelContainer`, `ResourceSavePanelContainer`) mocks `apps/chat/src/hooks/publish/usePublishFolders.ts` as a whole, so a hiding assertion there would test only the mock. Coverage therefore comes from the wrapper test (2.2), with the real lib hook and the context answer, plus the fact that all four containers call that wrapper. The `UseOrgUnitsResult` fixtures in `ResourceSavePanelContainer.spec.tsx` and `useOrgUnitFolderGuards.spec.ts` gain `isPublicFolderVisible`. The Personal root is unaffected by construction: the predicate is only passed to the Organization listing.
  - Verification: `npx vitest run` in `apps/chat` over `src/hooks/publish`, `src/context/tests/OrgUnitsContext.spec.tsx` and the four container folders (18 files, 244 tests).
- [x] 2.4 Slice check, run in the worktree: `nx run-many -t typecheck lint` for `@epam/ai-dial-chat-shared` and `@epam/ai-dial-chat-hooks`, `tsc -p apps/chat/tsconfig.{app,spec}.json --noEmit`, prettier, and eslint on the touched app files. `verify:changed` itself is replaced here: the affected set is the whole graph, and the full run is task 6.3.

## 3. Folder creation never produces a hidden folder

- [ ] 3.1 `libs/publish-panel/src/components/PublishFoldersTree/PublishFoldersTree.tsx`: add the optional `canCreateFolderIn?: (destination: FolderDestination) => boolean`, and make `canCreateUnder` require it. Thread it through:
  - `PublishPanel` and `StandalonePublishPanel` (`libs/publish-panel/src/components/PublishPanel/`);
  - `SaveToFolderPanel` / `StandaloneSaveToFolderPanel` (`libs/publish-panel/src/components/SaveToFolderPanel/`). If `feat/file-destintaion-side-panel` (Issue #8825) has merged first, thread it through `FolderDestinationPanel` instead.

  Add cases to `libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`: trailing "Create new folder", "Add child" and "Add sibling" are hidden for a parent the predicate refuses, and offered when no predicate is given.
  - Verification: `npm run test:file -- libs/publish-panel/src/components/PublishFoldersTree/tests/PublishFoldersTree.spec.tsx`
- [ ] 3.2 `libs/catalog`: add `canCreatePublishFolderIn` next to `getPublishDisabledReason`:
  - in `libs/catalog/src/models/catalog-props.ts` and `libs/catalog/src/models/item-details-props.ts`;
  - forwarded by `Catalog` → `DetailsPanel` → `DetailsPublishContent` to `PublishPanel` as `canCreateFolderIn`.

  Add one forwarding case to `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`.
  - Verification: `npm run test:file -- libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`
- [ ] 3.3 `apps/chat/src/hooks/publish/useOrgUnitFolderGuards.ts`: return `canCreateFolderIn`. For an Organization destination it is `true` only when the parent lies inside a unit; it is also `true` while the rule is not `Ready`, and for other roots. Pass it from:
  - `CatalogView` as `canCreatePublishFolderIn`;
  - `PublishConversationPanelContainer`, `PublishProjectPanelContainer` and `ResourceSavePanelContainer` (the latter through `libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts` if the panel props flow from there).

  Extend `apps/chat/src/hooks/publish/tests/useOrgUnitFolderGuards.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/publish/tests/useOrgUnitFolderGuards.spec.ts`, `npm run test:file -- libs/chat-hooks/src/catalog/useResourceSavePanel/tests/useResourceSavePanel.spec.ts`
- [ ] 3.4 Slice check: `npm run verify:changed`.

## 4. File manager Organization section

- [x] 4.1 `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`: add the optional `isPublicFolderVisible?: (publicPath: string) => boolean` to `UseDialFileListingOptions`, applied only when `activeTab` is Organization:
  - prune hidden folder `DialFile`s and their subtrees in the `items` memo (public path = the virtual path without its `/<rootLabel>` segment);
  - drop `searchResults` whose decoded parent folder is hidden;
  - make `currentFolder` / the effective path fall back to the section root when the current path is inside a hidden folder.

  Thread the option through `UseDialFileManagerOptions` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`). `useDialFileManagerSections` already spreads it to every section. Extend `libs/chat-hooks/src/files/useDialFileListing/tests/useDialFileListing.spec.tsx`:
  - tree pruning on the Organization tab;
  - the My files tab is untouched;
  - search filtering;
  - a hidden current path → root;
  - no predicate → unchanged.
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileListing/tests/useDialFileListing.spec.tsx`, `npm run test:file -- libs/chat-hooks/src/files/useDialFileManager/tests/useDialFileManager.spec.tsx`
- [x] 4.2 `apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`: add `isPublicFolderVisible` from `useOrgUnitsContext()` to the host options (`DialFileManagerHostOptions` pick), and call `ensureUnits()` in an effect. `DialFileManagerPage` and `DialFileManagerModal` both read these options. Add a case to `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` or a new `tests/useDialFileManagerHostOptions.spec.ts`: a plain Organization folder is not rendered once units are `Ready`, and is rendered while they load.
  - Verification: `npm run test:file --` the touched spec file(s)
- [ ] 4.3 Slice check: `npm run verify:changed`. Done in the worktree: typecheck and lint for chat-hooks, `tsc` and eslint for the app, and the chat-hooks `src/files` tests (638 passed). The app's test run was skipped at the user's request, because the shared `node_modules` made vitest mocks fail intermittently, including on untouched specs.

## 5. Docs

- [ ] 5.1 Update the lib READMEs for the new public API:
  - `libs/chat-shared/README.md`: `isOrgUnitTreeFolder`;
  - `libs/chat-hooks/README.md`: `isPublicFolderVisible` on `useOrgUnits`, `isFolderVisible` on `usePublishFolders`, `isPublicFolderVisible` on `useDialFileManager`;
  - `libs/publish-panel/README.md`: `canCreateFolderIn`;
  - `libs/catalog/README.md`: `canCreatePublishFolderIn`.

  Then run `npm run validate:docs`.
- [ ] 5.2 Update `docs/architecture.md`:
  - the `OrgUnitsContext` row (new `isPublicFolderVisible` answer);
  - the Save-panel/folder-tree paragraph: plain public folders are hidden once rights are `Ready`, and creation is offered only inside units;
  - the file-manager Organization section.

  Then run `npm run validate:docs`.
- [ ] 5.3 Run `npm run validate:specs` and `npm run spec:impact` for the three delta specs.

## 6. Close

- [ ] 6.1 `npm run build:quiet` (lib public APIs changed in four libs).
- [ ] 6.2 Five-axis review (`code-review-and-quality`).
- [ ] 6.3 `npm run verify:full` once.

## Follow-ups (out of scope, record only)

- [ ] F.1 Decide design Open Question 1: whether the Organization root and ancestor-only folders should stop being selectable destinations.
- [ ] F.2 Decide design Open Question 2: whether file-manager "New folder" in the Organization section should be gated outside units (admins only).

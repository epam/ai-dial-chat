## 1. Dependency baseline

- [x] 1.1 Upgrade `@epam/ai-dial-react-file-manager` to `0.2.0-dev.7` in `package.json` and `package-lock.json`, resolving its compatible `@epam/ai-dial-ui-kit` peer.
- [x] 1.2 Verify the installed File Manager is a normal workspace dependency rather than a sibling-repository symlink, so it resolves the workspace's React instance.

## 2. Cache-derived popup tree state

- [x] 2.1 In `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`, track exact destination-popup virtual paths and include cache-backed popup candidates in derived `loadedPaths`.
- [x] 2.2 Preserve trailing slashes from `DialFile.path` in popup loading/loaded state and clean up that same exact path for both popup-owned and outer-tree-owned requests.
- [x] 2.3 Verify the library-isolation guard: keep File Manager rendering props and app integration outside `libs/chat-hooks`, with no app context, route, environment, transport configuration, or host-owned API path added to the library.

## 3. Application adapter

- [x] 3.1 In `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`, pass `folderPopupLoadingPaths` as `treeOptions.loadingPaths` alongside `loadedPaths`.
- [x] 3.2 Compare destination loading state using the exact selected `DialFile.path` representation.

## 4. Regression coverage and documentation

- [x] 4.1 Extend `libs/chat-hooks/src/files/useDialFileManager/tests/useDialFileManager.spec.tsx` for pending and successful-empty popup listings with trailing-slash paths, including a popup joining an outer-tree request.
- [x] 4.2 Extend `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` for loaded/loading `treeOptions` forwarding and exact destination loading state.
- [x] 4.3 Update `libs/chat-hooks/README.md` and `dial-file-manager.types.ts` to document cache-derived destination-popup paths.

## 5. Verification

- [x] 5.1 Run the focused `@epam/ai-dial-chat-hooks` and `@epam/chat` regression test targets against File Manager `0.2.0-dev.7`.
- [x] 5.2 Build and lint `@epam/ai-dial-chat-hooks`, then typecheck `@epam/ai-dial-chat-hooks` and `@epam/chat` through Nx.
- [x] 5.3 Run `npm run validate:docs`, validate the OpenSpec change, and run `git diff --check`.

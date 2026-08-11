## Context

`@epam/ai-dial-react-file-manager` is a straight extraction of the file-manager UI (components, hooks-facing types, models, actions) that used to live inside `@epam/ai-dial-ui-kit`. The public API is unchanged — only the package origin moves. Confirmed current-repo import sites (via grep) are exactly the files listed in proposal.md's Impact section: `DialFileManagerShell/`, `DialFileManagerModal/` (including `OperationLoaderModal.tsx`, `UploadProgressModal.tsx`, `types/attach-result.ts`), all of `hooks/files/*.ts` (util + hook files, including `useGridEditingScroll.ts` which also references `@epam/ai-dial-ui-kit` in a comment), `utils/file-name.ts`, `utils/attachment-types.ts`, and `libs/publish-panel/src/components/PublishFoldersTree/PublishFoldersTree.tsx`.

## Goals / Non-Goals

**Goals:**
- Every file-manager symbol imported from `@epam/ai-dial-ui-kit` today resolves instead from `@epam/ai-dial-react-file-manager`, with identical runtime behavior.
- Non-file-manager ui-kit imports (`PrimaryButton`, `Spinner`, `DialPopup`, `NotificationVariant`, `PopupSize`, `NeutralButton`, `DialFileName` if it stays a general-purpose component) are untouched or verified against the new package's actual export list before moving.
- `libs/publish-panel` gains a second peer dependency (`@epam/ai-dial-react-file-manager`) for `DialFile`/`DialFileNodeType`/`DialFoldersTree` only, keeping the lib-isolation boundary intact (no app-owned knowledge enters the lib).

**Non-Goals:**
- No behavior, prop, or i18n key changes to any file-manager flow.
- No relocation of `DialFileManagerShell` or `hooks/files/**` into a new lib.
- No ui-kit major/minor version bump beyond what's needed for peer compatibility.

## Decisions

**Migrate file-by-file, not symbol-by-symbol across the whole repo in one edit.** Each touched file gets its `@epam/ai-dial-ui-kit` import statement split: file-manager symbols move to a new `@epam/ai-dial-react-file-manager` import line, remaining symbols stay on the ui-kit line (or the ui-kit import is deleted if nothing remains). This keeps each diff reviewable and lets `nx lint`/`tsc` catch a wrong split immediately. Rejected alternative: a single repo-wide codemod/find-replace on the string `@epam/ai-dial-ui-kit` — rejected because several files (`DialFileManagerShell.tsx`, `DialFileManagerModal.tsx`, `dial-file-manager.types.ts`, `useDialFileMutations.ts`, `useDialFileListing.ts`, `useDialFileManager.ts`, `PublishFoldersTree.tsx`) import a mix of file-manager and non-file-manager symbols in one `import { ... } from '@epam/ai-dial-ui-kit'` block, so a blind replace would either move symbols that don't exist in the new package or leave file-manager symbols on the old import.

**Import map (old → new), derived from the actual grep above:**

| File | Symbols moving to `@epam/ai-dial-react-file-manager` | Symbols staying on `@epam/ai-dial-ui-kit` |
|---|---|---|
| `components/DialFileManagerShell/types/labels.ts` | `DialFileManagerTabs` (type), `DialFileManager` | — |
| `components/DialFileManagerShell/DialFileManagerShell.tsx` | `DialFileManagerActions`, `DialFileManagerTabs`, `GridSelectionMode`, `NOT_ALLOWED_SYMBOLS_REGEXP`, `DialFileAcceptType`, `FileManagerGridRow` | `PrimaryButton`, `Spinner` |
| `components/DialFileManagerModal/DialFileManagerModal.tsx` | `DialFileManagerTabs`, `DialFileNodeType`, `useDialFileManagerTabs`, `DialFile`, `FileManagerGridRow`, `NOT_ALLOWED_SYMBOLS`, `NOT_ALLOWED_SYMBOLS_REGEXP` | `DialPopup`, `PrimaryButton`, `NotificationVariant`, `PopupSize` |
| `components/DialFileManagerModal/OperationLoaderModal.tsx` | — | `DialPopup`, `NeutralButton`, `Spinner` |
| `components/DialFileManagerModal/UploadProgressModal.tsx` | — (verify `DialFileName`; if it's file-manager-specific it moves) | `DialPopup`, `NeutralButton` |
| `components/DialFileManagerModal/types/attach-result.ts` | `DialFile` (type) | — |
| `hooks/files/dial-file-manager.types.ts` | file-manager types block (verify exact names against package export list) | any residual non-file-manager type, if present |
| `hooks/files/dial-file-manager.model.ts` | `DialFilePermission`, `FileManagerColumnKey` | — |
| `hooks/files/dial-file-manager-path.util.ts` | `DialFile` (type), `DialFileNodeType`, `DialFilePermission` | — |
| `hooks/files/dial-file-manager-mapping.util.ts` | `DialFile` (type), `DialFileManagerTabs`, `DialFileNodeType` | — |
| `hooks/files/dial-file-manager-copy-move.util.ts` | `DialCopiedItem` (type), `DialFileNodeType` | — |
| `hooks/files/useDialFileManager.ts` | file-manager symbol block (verify against current multi-symbol import) | — |
| `hooks/files/useDialFileListing.ts` | `DialFile` (type) + symbol block | — |
| `hooks/files/useDialFileMutations.ts` | two symbol blocks (verify exact names) | — |
| `hooks/files/useDialFileUploadBatch.ts` | `DialFile`, `DialUploadFileItem` (types), `DialFileManagerTabs` | `NotificationVariant` |
| `hooks/files/useDialFileMetadata.ts` | `DialFile` (type) | `NotificationVariant` |
| `hooks/files/useDialFileSharing.ts` | `DialFile` (type) | `NotificationVariant` |
| `hooks/files/useDialFileManagerTabConfig.ts` | `DialFileManagerTabs`, `TabModel` (type) | — |
| `hooks/files/useGridEditingScroll.ts` | `FileManagerGridRow` | — (also update the stale `@epam/ai-dial-ui-kit`-referencing code comment) |
| `utils/file-name.ts` | `NOT_ALLOWED_SYMBOLS_REGEXP` | — |
| `utils/attachment-types.ts` | `DialFileAcceptType` (type) | — |
| `libs/publish-panel/.../PublishFoldersTree.tsx` | `DialFile`, `DialFileNodeType`, `DialFoldersTree` | `DropdownItem` and other non-file-manager ui-kit imports; also update the stale doc comment referencing `@epam/ai-dial-ui-kit`'s `FileManager` |

Any symbol not found under `@epam/ai-dial-react-file-manager`'s actual exports during implementation is a delta from this table — fix the table (and add a minimal adapter only if truly unavoidable) rather than silently leaving it on ui-kit.

**Styles load order is ui-kit first, then file-manager**, per the new package's own docs — the file-manager stylesheet likely layers on top of ui-kit design tokens/resets:

```ts
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-file-manager/styles.css';
```

**Peer dependency check, not blind pinning.** Declared peer today: file-manager `0.1.0-dev.13` expects `@epam/ai-dial-ui-kit@0.13.0-dev.25`; repo currently pins `^0.13.0-dev.26`. Since `^` peer ranges commonly tolerate a higher patch/dev build, verify via `npm ls @epam/ai-dial-ui-kit` and a clean install that no peer-dep warning/error surfaces; if the new package's peer range is strict and rejects `dev.26`, bump to the latest `0.1.0-dev.*` release of the file-manager package that declares compatibility, rather than downgrading ui-kit.

**`libs/publish-panel` isolation stays intact.** Adding `@epam/ai-dial-react-file-manager` as a peer dependency is acceptable under the library-isolation rule because the lib only consumes presentational tree components/types (`DialFoldersTree`, `DialFile`, `DialFileNodeType`) — no REST paths, app context, or auth knowledge is introduced. This mirrors the existing `@epam/ai-dial-ui-kit` peer relationship the lib already has.

## Risks / Trade-offs (discovered during implementation)

- **[Risk] `@epam/ai-dial-react-file-manager@0.1.0-dev.13` ships broken relative import paths in its declaration files.** Nearly every component's `.d.ts` (e.g. `FileManager.d.ts`, `FoldersTree.d.ts`) imports `FC`/`ReactNode`/`GridApi` etc. via a relative path like `'../../../../../node_modules/react'`, computed relative to the source file's *pre-publish* location inside the package's own dev tree. Once installed as a dependency, that relative path resolves to a non-existent nested `node_modules` folder inside the installed package (e.g. `node_modules/@epam/ai-dial-react-file-manager/dist/node_modules/react`), not the consuming project's `react`. This silently degrades the affected components' prop types, which surfaces downstream as `noImplicitAny` (`TS7006`) errors on any un-annotated inline callback passed to `DialFileManager`/`DialFoldersTree` props (e.g. `onRenameValidate`, `getContextMenuItems`, array `.map()` over captured mock props in tests). **Mitigation applied:** added explicit parameter type annotations at each affected call site (`libs/publish-panel/src/components/PublishFoldersTree/PublishFoldersTree.tsx` and its test file) rather than patching `node_modules` (never hand-edit generated/vendor output) or blocking the migration. This should be reported upstream; a fixed release would let these explicit annotations be removed (they are harmless but redundant once the package's own types resolve correctly).

- **[Risk] A symbol assumed 1:1-portable turns out renamed or absent in `@epam/ai-dial-react-file-manager`** (e.g. `DialFileName` in `UploadProgressModal.tsx`, or one of the multi-symbol blocks in `useDialFileMutations.ts`/`useDialFileManager.ts`/`dial-file-manager.types.ts` marked "verify" above) → **Mitigation:** resolve each "verify" row against the package's actual type definitions/README during task 2 before editing; if a symbol is missing, document the delta inline in this file's Open Questions and add the smallest possible local adapter (re-export or thin wrapper) rather than blocking the whole migration.
- **[Risk] Peer dependency mismatch between file-manager's declared `@epam/ai-dial-ui-kit` peer (`0.13.0-dev.25`) and the repo's installed `^0.13.0-dev.26`** → **Mitigation:** verify with a clean `npm install` before merging; bump the file-manager package version if a compatible dev release exists, rather than downgrading ui-kit.
- **[Risk] ui-kit removes the file-manager re-exports before this change lands**, breaking the build for anyone still on old imports → **Mitigation:** land the whole migration in one PR/commit rather than splitting app and lib migration across separate merges.
- **[Trade-off] Test mocks must be updated in the same commit as source imports** (mocking `@epam/ai-dial-ui-kit` for a symbol that no longer lives there silently no-ops instead of failing) — mitigated by running the full targeted test suite (task 4) immediately after each import slice, not only at the end.

## Migration Plan

1. Add dependency + stylesheet import (task 1) — build must still compile with old imports present (no behavior change yet).
2. Migrate `apps/chat` imports component-by-component, then hook-by-hook, then util-by-util (tasks 2), verifying the import-map table per file.
3. Migrate `libs/publish-panel` + its peer dependency (task 3).
4. Update all affected test mocks (task 4) in lockstep with each source slice, not as a separate pass at the end.
5. Update documentation-only spec import references (task 5).
6. Final lint/test/build + manual smoke checklist (task 6).

**Rollback:** revert the dependency addition and the import-path edits; no persisted data, API contract, or i18n key changes are made, so rollback is a pure code revert with no follow-up migration.

## Open Questions (resolved during implementation)

Confirmed by extracting the published package (`npm pack @epam/ai-dial-react-file-manager@0.1.0-dev.13`) and reading `dist/src/index.d.ts`. The following symbols are **not** re-exported by the new package and stay on `@epam/ai-dial-ui-kit`:

- `NOT_ALLOWED_SYMBOLS`, `NOT_ALLOWED_SYMBOLS_REGEXP` — used internally by the package's own validation but not part of its public API.
- `TabModel` — the package's own `DialFileManagerToolbar`/`useDialFileManagerTabs` types still import `TabModel` from `@epam/ai-dial-ui-kit` internally; it is a general ui-kit type, not file-manager-specific.
- `DialFileName` — confirmed a general-purpose ui-kit component, not part of the file-manager package.
- `NotificationVariant` — general ui-kit notification type, not file-manager-specific.

All other symbols in the import map table above were confirmed present with unchanged names in `dist/src/index.d.ts`.

**Peer dependency conflict (real, not hypothetical):** `@epam/ai-dial-react-file-manager@0.1.0-dev.13` has only one published version, and its peer dependency pins an *exact* version (`@epam/ai-dial-ui-kit@"0.13.0-dev.25"`), not a range. The repo runs `^0.13.0-dev.26`. `npm install` fails with `ERESOLVE` by default. Per user decision, resolved with `npm install --force` (which still auto-installs ordinary peer dependencies like `@floating-ui/react`) rather than `--legacy-peer-deps` (which silently drops real transitive peer deps and briefly broke the `@epam/ai-dial-kit` build in this session). ui-kit was **not** downgraded. This should be revisited once a file-manager release compatible with `dev.26`+ is published upstream.

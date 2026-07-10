## Why

[add-file-manager-copy-move](../archive/2026-07-08-add-file-manager-copy-move/proposal.md) wired `onCopyFiles`/`onMoveToFiles` and added `DialFileManagerActions.Copy`/`.Move` to `actionLabels`. Live testing after that slice shipped revealed that `@epam/ai-dial-ui-kit`'s `DialFileManager` **already renders its own destination-folder popup internally** the moment Copy/Move actions are present — `FileManagerContext` exposes `handleOpenDestinationFolderPopup`/`handleCopyTo`/`handleMoveTo` and mounts `DialDestinationFolderPopup` on click, which then calls back through the exact `onCopyFiles`/`onMoveToFiles` props already wired. Confirmed against the installed package's `.d.ts` (`FileManager.d.ts`, `FileManagerContext.d.ts`) and by the reporter directly exercising the popup: it already shows folders-only, has a working "Add folder" button and hidden-files toggle.

This means the originally-planned step 10 (row 3/46 of the #7503 roadmap) — "build a `SelectFolderModal` wrapping `DialDestinationFolderPopup`" — is **not needed**: the picker mechanism already exists and already works end-to-end. What actually remains is a compliance/polish gap: `DialFileManagerShell` never passes `destinationFolderPopupOptions`, so the popup runs on ui-kit's hardcoded English defaults (`"Copy"`, `"Move"`, `"Add folder"`, `"Show hidden files"`), which violates this repo's rule that every user-visible string goes through `react-i18next`. There are also a few UX gaps the default popup doesn't handle for us (dynamic count-aware title, disabling the source folder as a Move destination).

## What Changes

- **`DialFileManagerShell`** gains a `destinationFolderPopupOptions` prop passed to `DialFileManager`, built from i18n-translated labels supplied by each host (`DialFileManagerPage` today).
- **`DialFileManagerShellLabels`** gains the fields needed to build that options object: `copyLabel`/`moveLabel`/`addFolderLabel`/`hiddenFilesSwitcherLabel` (reusing the already-added `copyLabel`/`moveLabel` where the popup and the action-label set can share a translation), `getCopyHeader(count, name)`/`getMoveHeader(count, name)` render functions (mirrors the existing `deleteConfirmTitle(names)` pattern), `disabledPathTooltip`, and folder-picker empty-state copy.
- **`useDialFileManager`** gains no new handler — `onCopyFiles`/`onMoveToFiles` already receive the correct `destinationFolder` from the popup's internal confirm action; this change only affects what the popup *displays*, not what it *calls*.
- **`sourceFolder`** is threaded into `destinationFolderPopupOptions` for Move mode so DIAL Core's `moveResource` no-op case (moving a folder into itself) is prevented client-side with a tooltip, not just left to a 409 round-trip.
- **Verification, not new code**: confirm the popup's `onCreateFolder`/`onCreateFolderValidate` fallback (inherited from the outer `DialFileManagerProps`, per `DialFileManagerDestinationFolderPopupOptions`'s type shape) creates the folder inside the popup's own currently-browsed path, not the outer grid's path — add a regression test rather than new production code if this already works.
- **Non-breaking**: no new components, no new BFF endpoints, no new `DialFileManagerVariant`/`DialFileManagerActionProfile` values. `DialFileManagerVariant.FolderPicker` and `DialFileManagerActionProfile.Full` remain reserved and unimplemented — see Non-Goals.

## Capabilities

### New Capabilities

- `file-manager-folder-picker`: documents the ui-kit-native destination-folder popup that already fires on Copy/Move, plus this change's i18n wiring, dynamic header, and source-folder-disable behavior. This capability did not exist as a spec before — the popup shipped as an undocumented side effect of `file-manager-copy-move`'s action-label wiring, so this proposal captures the full existing + new behavior in one spec rather than leaving it undocumented.

### Modified Capabilities

_None._ `file-manager-tabs`'s Copy/Move action-visibility rows are unchanged — this change does not alter which tabs/permissions expose Copy/Move, only what the resulting popup looks like.

## Impact

- **Frontend only**: `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`, `apps/chat/src/components/DialFileManagerShell/types/labels.ts`, `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, i18n keys in `apps/chat/src/i18n/locales/en.json` + `apps/chat/src/constants/translation-keys.ts`.
- **No backend changes.** No new BFF endpoints, no OpenAPI regeneration — `add-file-manager-copy-move`'s `/copy` and `/move` endpoints are already sufficient and unchanged.
- **No new components.** `apps/chat/src/components/SelectFolderModal/` (as originally scoped in the #7503 roadmap) is not created — see Why.
- **Docs**: this is the first spec for the folder-picker capability; `openspec/specs/file-manager-folder-picker/` will be created on archive.

## Non-Goals

- Building a standalone `SelectFolderModal` / wrapping `DialDestinationFolderPopup` directly — superseded by the ui-kit-native mechanism (see Why).
- Implementing `DialFileManagerVariant.FolderPicker` / `DialFileManagerActionProfile.Full` — these remain reserved for a genuinely different future need (e.g. a picker invoked outside a Copy/Move item-selection context, such as a #7504 share-destination flow) and are not required for #7503's picker requirement, which the existing Copy/Move mechanism already satisfies. Implementing them now would be speculative.
- Rename/Delete row actions inside the destination-folder popup — confirmed via live testing and the installed ui-kit's type definitions (`DialFileManagerDestinationFolderPopupOptions` exposes no `actionLabels` for the popup's internal tree) that the current ui-kit version does not support this. The legacy Redux-era `SelectFolderModal` had this; current ui-kit does not expose the hook to replicate it. Tracked as a known gap, not fixed here — revisit if/when ui-kit adds the capability.
- Cross-tab destination selection (e.g. picking a Shared or Organization folder as a copy/move destination) — the popup browses the same `items` tree already loaded for the active tab; multi-tab picker scope is not part of #7503.

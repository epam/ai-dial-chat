## Why

GitHub issue #7644: renaming a file/folder in the File Manager to a name with a prohibited symbol (e.g. `:`) is accepted with no inline validation at all — the symbol can be typed freely and the rename saves successfully. Root cause: `useDialFileManager`'s `onRenameValidate` only flags forbidden symbols when its `forbiddenSymbolsRegExp` option is set, but neither real call site (`DialFileManagerPage.tsx`, the standalone "DIAL File System" page reproduced in the issue, and `DialFileManagerModal.tsx`, the attach-file modal) passes it — only `DialFileManagerShell` passes the regex to the ui-kit for the separate static "existing invalid name" list indicator. As a secondary issue, once the regex is wired in, the branch that catches it returns the generic `DialFileManagerI18nKeys.RenameInvalidChars` ("Name contains invalid characters") instead of naming the actual prohibited symbols, even though the app already has that exact message (`dialFileManager.forbiddenSymbolsTooltip`, "File names cannot contain: : ; , = / { } % & \"") used elsewhere for the same symbol set.

## What Changes

- Wire `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` (from `@epam/ai-dial-ui-kit`) into the `useDialFileManager({...})` call in `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, so `onRenameValidate`'s forbidden-symbols branch actually runs on both surfaces.
- In `apps/chat/src/hooks/files/useDialFileManager.ts`, change the `forbiddenSymbolsRegExp.test(value)` branch of `onRenameValidate` to return `DialFileManagerI18nKeys.ForbiddenSymbolsTooltip` instead of `DialFileManagerI18nKeys.RenameInvalidChars`, so the user sees the actual list of prohibited symbols.
- Keep `RenameInvalidChars` ("Name contains invalid characters") for the `/`/`\` path-separator check, which is a distinct rule from the forbidden-symbols set and already has its own message.
- No change to validation order, empty-name/reserved-name/length/duplicate checks, or the save (`onMoveToFiles`) flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `file-manager-rename-ui`: the "onRenameValidate — client-side inline validation" requirement's forbidden-symbol rule must (a) actually receive `forbiddenSymbolsRegExp` from every real caller of `useDialFileManager`, and (b) return the specific forbidden-symbols message instead of the generic `dialFileManager.renameInvalidChars` message.

## Impact

- `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`: pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` to `useDialFileManager`.
- `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`: pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` to `useDialFileManager`.
- `apps/chat/src/hooks/files/useDialFileManager.ts` (`onRenameValidate`, ~line 1358-1390): change the returned message for the forbidden-symbols branch.
- No i18n key additions needed — `dialFileManager.forbiddenSymbolsTooltip` already exists (`apps/chat/src/i18n/locales/en.json:348`) and is already used elsewhere for the same symbol set.
- No backend/API impact.
- Existing unit tests for `useDialFileManager` covering the forbidden-symbols rename-validation scenario need updating to assert the new message; `DialFileManagerPage`/`DialFileManagerModal` tests use `expect.objectContaining` so they remain valid without changes.

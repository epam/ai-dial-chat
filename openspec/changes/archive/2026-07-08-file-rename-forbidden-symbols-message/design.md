## Context

`useDialFileManager`'s `onRenameValidate` (apps/chat/src/hooks/files/useDialFileManager.ts:1358-1390) has a forbidden-symbols branch keyed on its `forbiddenSymbolsRegExp` option, and the ui-kit renders whatever string `onRenameValidate` returns as a live inline tooltip while the user types (confirmed by reading the ui-kit's compiled rename-input logic: `validate` is invoked on every `onChange`). However, neither real caller of the hook — `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` (the standalone "DIAL File System" page, the exact surface reproduced in issue #7644) nor `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` (the attach-file modal) — passes `forbiddenSymbolsRegExp` to the hook. Only `DialFileManagerShell.tsx` passes `NOT_ALLOWED_SYMBOLS_REGEXP` down to the ui-kit's `<DialFileManager>` component directly, but that wiring only drives a *different* feature: a static warning icon/tooltip on already-existing items whose stored name contains a forbidden symbol. It never reaches `onRenameValidate`. Confirmed live: renaming to `::::` shows no tooltip at all and the rename is saved on blur — matching the issue exactly.

Once `forbiddenSymbolsRegExp` is wired in, the branch that catches a match returns `DialFileManagerI18nKeys.RenameInvalidChars` ("Name contains invalid characters"), which is also reused for the unrelated `/`/`\` path-separator check. The app already has a message that names the actual prohibited symbols — `DialFileManagerI18nKeys.ForbiddenSymbolsTooltip` ("File names cannot contain: : ; , = / { } % & \"") — used for the upload/create-folder forbidden-symbols tooltip (see `file-manager-filename-sanitization` spec) — but it isn't reused here.

## Goals / Non-Goals

**Goals:**
- Pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` into every `useDialFileManager(...)` call so the forbidden-symbols branch of `onRenameValidate` actually runs.
- When it detects a forbidden symbol, return the specific `ForbiddenSymbolsTooltip` message instead of the generic `RenameInvalidChars` message.

**Non-Goals:**
- No change to the `/`/`\` path-separator check, which keeps returning `RenameInvalidChars` — it's a distinct rule (path separators aren't part of the "forbidden symbols" set shown in the tooltip).
- No change to validation order, empty-name/reserved-name/length/duplicate rules, or the save (`onMoveToFiles`) flow.
- No new i18n keys — reuse the existing `ForbiddenSymbolsTooltip` key/string.
- No change to `DialFileManagerShell`'s existing `forbiddenSymbolsRegExp`/`forbiddenSymbolsTooltip` props passed to the ui-kit component — that wiring for the static invalid-name indicator is already correct and unrelated to this fix.

## Decisions

- **Wire the same `NOT_ALLOWED_SYMBOLS_REGEXP` constant at both hook call sites**, rather than centralizing a default inside `useDialFileManager` itself. Keeping the option explicit at the call site matches how `DialFileManagerShell` already receives it as a prop, and avoids the hook silently assuming a default regex that callers can't see or override.
- **Reuse `ForbiddenSymbolsTooltip` rather than introduce a new key.** The string is identical to what the issue's expected result asks for and is already used for the same symbol set (upload sanitization, create-folder). Keeping one message avoids drift between the two forbidden-symbols surfaces.
- **Check order stays the same** (empty → reserved → path separators → forbidden symbols → length → duplicate). Only the returned message for the forbidden-symbols branch changes.

## Risks / Trade-offs

- [Existing unit tests may assert the old `RenameInvalidChars` string for forbidden-symbol input] → Update those assertions in `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx` as part of this change.
- [Low risk of message conflation if a name has both a path separator and a forbidden symbol] → The `/`/`\` check runs first and returns early, so this case is unambiguous and unaffected by the change.
- [Tests for `DialFileManagerPage`/`DialFileManagerModal` mock `useDialFileManager` entirely and assert call args with `expect.objectContaining`, so adding the new option is a non-breaking addition] → No test changes needed at those two call sites.

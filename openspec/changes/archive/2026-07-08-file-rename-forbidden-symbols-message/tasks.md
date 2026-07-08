## 1. Wire forbiddenSymbolsRegExp into real callers (root cause)

- [x] 1.1 In `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`, import `NOT_ALLOWED_SYMBOLS_REGEXP` from `@epam/ai-dial-ui-kit` and pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` to `useDialFileManager`.
- [x] 1.2 In `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, import `NOT_ALLOWED_SYMBOLS_REGEXP` from `@epam/ai-dial-ui-kit` and pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` to `useDialFileManager`.

## 2. Fix validation message

- [x] 2.1 In `apps/chat/src/hooks/files/useDialFileManager.ts`, change the `forbiddenSymbolsRegExp.test(value)` branch of `onRenameValidate` to return `t(DialFileManagerI18nKeys.ForbiddenSymbolsTooltip)` instead of `t(DialFileManagerI18nKeys.RenameInvalidChars)`.
- [x] 2.2 Confirm the `/`/`\` path-separator check above it is unaffected and still returns `RenameInvalidChars`.

## 3. Update tests

- [x] 3.1 Update `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx` so the forbidden-symbol rename-validation scenario asserts the `forbiddenSymbolsTooltip` message instead of the generic invalid-characters message.
- [x] 3.2 Add/confirm a scenario for the `/`/`\` case still returning the generic `renameInvalidChars` message, to lock in the distinction between the two rules.
- [x] 3.3 Confirm `DialFileManagerPage`/`DialFileManagerModal` tests (which mock `useDialFileManager` and assert with `expect.objectContaining`) still pass unmodified with the new option added.

## 4. Verify

- [x] 4.1 Run `npm exec nx test chat` and confirm `useDialFileManager`, `DialFileManagerPage`, and `DialFileManagerModal` specs all pass.
- [x] 4.2 Run eslint on the four changed files.
- [x] 4.3 Manually reproduce in the running app: open the standalone File Manager ("DIAL File System" / `/files`), rename a file, type a forbidden symbol (e.g. `:` alone, not `/`), and confirm the inline tooltip now reads `"File names cannot contain: : ; , = / { } % & \""` and the rename is blocked on blur.

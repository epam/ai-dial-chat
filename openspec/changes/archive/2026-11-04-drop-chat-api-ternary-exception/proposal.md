## Why

`finish-backend-refactor` turned `no-nested-ternary` into an error for `apps/chat-api` and allowed one temporary exception: the archive-upload result mapping in `files/upload/files-upload.service.ts`, carrying an `eslint-disable-next-line`. That exception was to last until the archive-upload extraction (#9703) moved the code.

#9703 has merged, and the follow-up the plan called B10 has already landed with it:

- the mapping is now `getArchiveEntryUploadError` in `apps/chat-api/src/files/upload/archive-upload.ts`, an `if`/`return` helper;
- the abort check is `throwIfUploadAborted` in `apps/chat-api/src/files/upload/upload-abort.ts`, so the archive-specific name is gone;
- `apps/chat-api/src` contains no `eslint-disable` for `no-nested-ternary`.

The main spec `chat-api-code-conventions` still describes the exception as current. Per the docs rule ("describe what the code does"), this is drift.

## What Changes

- `chat-api-code-conventions`, "chat-api forbids nested ternaries": remove the allowed exception. The requirement now states that `apps/chat-api/src` has no `no-nested-ternary` disable, and adds a scenario for it.

Spec-only. No code, test, doc or contract change.

### Non-goals

Any code change. The code already matches the corrected requirement.

### Acceptance criteria

- `git grep -n "no-nested-ternary" -- apps/chat-api/src` returns nothing.
- `npm run validate:specs` passes, and the change validates.

### Alternatives considered

Editing the main spec directly without a change. Rejected: main specs change through a delta, so that the reason is recorded in the archive.

### Rollback

Revert the commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-api-code-conventions`: "chat-api forbids nested ternaries" no longer allows an exception.

## Impact

`openspec/specs/chat-api-code-conventions/spec.md` only.

No impact on code, tests, docs, i18n, RTL or a11y, feature gating, telemetry or contracts.

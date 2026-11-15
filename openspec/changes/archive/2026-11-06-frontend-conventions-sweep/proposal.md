## Why

Refactoring item F11, the frontend conventions sweep. The refactoring audit found code that breaks the repository's own TypeScript conventions in `.claude/rules/all-ts.md` and `libs.md`:

- **Duplicate upload-mode types.** `libs/chat-hooks` declares the upload mode twice:
  - `UploadMode = 'overwrite' | 'create-only'` (a union) in `files/create-files-api.ts`;
  - `enum DialFilesApiUploadMode` in `files/dial-files-api.ts`.

  Both are exported from the root and `./file-manager` entry points.
- **Unions instead of string enums** for named value sets in lib public APIs:
  - `ListViewColumnKey` (`libs/catalog`);
  - `SkillTextField` (`libs/chat-hooks`);
  - `McpDeploymentKind` and `McpAppToolDiscovery` (`libs/mcp-apps`);
  - `ScheduledTaskTextField` (`libs/scheduled-tasks`);
  - `ChatSkillDetailsTrigger` (`libs/skills`).
- **Nested ternaries.** There are 33 nested conditional expressions in production code outside `libs/celebrations`, although the rule says "never". Nothing enforces the rule, so the count only grows.
- **Five switches in the file-manager notification adapter.** `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts` uses five switches where most cases only pick an i18n key.

## What Changes

- **Upload mode.** Remove the `UploadMode` union. `UploadFileWithProgressOptions.uploadMode` becomes `DialFilesApiUploadMode`, the one string enum. Call sites that pass the generated client's own value (`uploadMode: 'create-only'` to `FilesApi.uploadFile`) are left alone, since that is the generated enum at its call site.
- **String enums.** Each union listed above becomes a string enum with the same values:
  - `ListViewColumnKey`, `SkillTextField`, `McpDeploymentKind`, `McpAppToolDiscovery`, `ScheduledTaskTextField`, `ChatSkillDetailsTrigger`.
  - Each lives in its lib's `types` location, or the domain `types.ts` in `chat-hooks`.
  - Each is exported under the same name from the same entry point.
  - In-repo callers, tests and READMEs switch from literals to members.
- **Nested ternaries.**
  - Rewrite the 33 production hits outside `libs/celebrations` with `if`/`else`, early returns, a lookup, or a small helper. Behavior stays the same.
  - Add `no-nested-ternary: 'error'` to `eslint.config.mjs` for production sources, with `libs/celebrations/**` exempt, since its code is out of scope for refactors.
- **Notification adapter.**
  - Message-only `FileManagerNotificationReason` cases come from a `Record` lookup; the cases that interpolate values keep explicit branches.
  - `buildValidationErrorMessage` reads a `{ rename, create }` key table per `FileNameValidationErrorReason`.
  - `getTransferNotificationKeys` becomes a `Record<FileOperationKind, …>` lookup.

### Breaking for external hosts

These libs are published at `0.0.1`. A host that imports `UploadMode`, or passes a string literal where one of these types is now an enum, gets a type error. It must switch to the enum member. The runtime values are unchanged, so serialized data and DIAL Core requests are unaffected.

### Non-goals

- `libs/celebrations`, which reviewers asked to leave untouched.
- The generated client's `UploadFileUploadModeEnum` and the backend `UploadMode`.
- Any change to rendered output or translation keys.

## Capabilities

### New Capabilities

- `frontend-code-conventions`: production frontend code has no nested conditional expressions outside `libs/celebrations`, which lint enforces.

### Modified Capabilities

- `file-upload`: `UploadFileWithProgressOptions.uploadMode` is typed by the `DialFilesApiUploadMode` enum instead of a duplicate union.

## Impact

- **Libs:** `chat-hooks`, `catalog`, `mcp-apps`, `scheduled-tasks`, `skills`, `attachment-input`, `conversation-input`, `conversation-messages`, `conversation-panel`, `quotations`, `sidebar`. This covers the public types and their READMEs.
- **App:** `apps/chat` callers, the notification adapter, and the files with nested ternaries.
- **Config:** `eslint.config.mjs`.
- **Specs:** `file-upload`. The `mcp-app-trigger` spec names only runtime values, which are unchanged.

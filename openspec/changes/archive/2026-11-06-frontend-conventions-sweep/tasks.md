Branch: `chore/enable-chat-app-typecheck`. Celebrations code is not touched.

## 1. Upload mode

- [x] 1.1 Remove the `UploadMode` union from `libs/chat-hooks/src/files/create-files-api.ts`, and type `UploadFileWithProgressOptions.uploadMode` as `DialFilesApiUploadMode` (design D1). Update the callers and specs that pass the literal. Result: the two specs that passed `'create-only'` now pass `DialFilesApiUploadMode.CreateOnly`, and their wire-level assertions are unchanged. Specs: lib 13 of 13, app 2 of 2.

## 2. String enums

- [x] 2.1 Convert `ListViewColumnKey`, `SkillTextField`, `McpDeploymentKind`, `McpAppToolDiscovery`, `ScheduledTaskTextField` and `ChatSkillDetailsTrigger` to string enums (design D2). Update the in-repo literal callers, specs and READMEs.

  Result:
  - `SkillTextField` and `ScheduledTaskTextField` stay in their files, so the `./skill-editor` and `./validation` entry points still export them.
  - `ListViewColumnKey`, `McpDeploymentKind`/`McpAppToolDiscovery` and `ChatSkillDetailsTrigger` moved to the libs' `types/` folders.
  - The `mcp-app-trigger` spec names runtime values (`'direct'`), which are unchanged, so it is not edited.
  - Tests pass: mcp-apps 32, skills 147, scheduled-tasks 433, catalog ListView 73, chat-hooks (mcp-apps, skill, files) 802, and apps/chat (SkillSelector, upload, utils) 314.

## 3. Nested ternaries

- [x] 3.1 Rewrite the 33 production hits outside `libs/celebrations` (design D3). Result: 24 files were rewritten with early returns, `let` with if/else, or small local helpers. The finder now reports hits only in `libs/celebrations`, whose code is unchanged.
- [x] 3.2 Add `no-nested-ternary: 'error'` to `eslint.config.mjs`, with celebrations and spec files exempt. Lint finds no violation. The rule uses the project-relative glob `**/src/**`, so it also applies under each project's own `eslint .`. `libs/celebrations/eslint.config.mjs` turns it off there.

## 4. Notification adapter

- [x] 4.1 Turn the message-only cases of `buildFileManagerNotificationOptions`, the `buildValidationErrorMessage` keys and `getTransferNotificationKeys` into lookups (design D4). The adapter's spec passes unedited. Result: the spec is unchanged (checked by SHA-1), and `DialFileManagerShell` runs 108 of 108.

## 5. Close

- [x] 5.1 Lint, test, build and typecheck for every touched project. The `apps/chat` typecheck is real on this branch.

  Results:
  - `nx run-many -t lint typecheck` on the 13 touched projects (and 20 dependencies) passes.
  - `nx run-many -t test` on 12 projects passes: 10564 tests.
  - Build: in a combined run, `@epam/chat:build` failed on an `os error 32` file lock, then passed when run alone. The 11 libs build.
  - Two errors the real `apps/chat` typecheck found are fixed: `ToolsetApplicationEditor` now passes `McpDeploymentKind.Toolset`, and the adapter lookups are guarded for an absent `reason`.
- [x] 5.2 `validate:docs`, `validate:specs`, `validate:lib-duplicates` and `openspec validate frontend-conventions-sweep` pass. All four pass.

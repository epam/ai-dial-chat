# Tasks

## 1. Server refusal

- [x] 1.1 In `apps/chat-api/src/publish/org-unit-copy.service.ts`, add a method to `ApplicationPublishPreparationService` (which already holds `PublishDependenciesService`) that reads, with `getDependenciesStrict` in parallel, the dependencies of each `plan.toCopy` entry of type application and tells whether any is a folder (`hasFolderDependency`). Share one `isDialAdmin` result with the existing own-reference check, skip the nested reads for a DIAL admin or when nothing needs them, and throw `createFolderReferenceNeedsRequest()` for a non-admin before `findMissingWriteNamespaces`, the icon copy and `stage`. A failed read propagates. Verification: `npm exec nx test chat-api` passes the new cases.
- [x] 1.2 Add tests in `apps/chat-api/src/publish/tests/org-unit-copy.service.spec.ts`: non-admin with a folder in a dependency gives `422` and nothing is staged or copied; DIAL admin proceeds; `isDialAdmin` undefined skips the check; a toolset dependency makes no nested read; a dependency without a folder copies normally; a reused dependency is not read; a failing read gives `503` and nothing is written; a reused plus a folder-bearing dependency refuses and reads only the second; a mixed `toCopy` (toolset plus folder-bearing application); one `getDependenciesStrict` call per application dependency; `isDialAdmin` is called once and not at all when nothing needs it. Verification: `npm exec nx test chat-api` and `npm exec nx lint chat-api` pass.
- [x] 1.3 Update the `@ApiOperation` description and the `422` `@ApiResponse` text of `copyToOrgUnit` in `apps/chat-api/src/publish/publish.controller.ts`, the JSDoc `@throws` of `copyApplication`, and the description of `folderReferenceNeedsRequest` in `apps/chat-api/src/publish/dto/org-unit-copy-error.dto.ts` (then `npm run openapi` and the client rebuild). Verification: `npm run openapi:check` is clean (descriptions only; regenerate with `npm run openapi` if it reports a diff and commit the client).

## 2. Docs and specs

- [x] 2.1 Mention the nested case where `docs/architecture.md` and `libs/chat-hooks/README.md` describe the `422` refusal. Verification: `npm run validate:docs` passes.
- [x] 2.2 Validate the change. Verification: `openspec validate refuse-nested-folder-reference-in-org-unit-copy --strict` and `npm run validate:specs` pass.

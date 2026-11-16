**Slicing strategy: confirm the id shape, then contract first, then vertical.**

- Slice 0 pins the real DIAL Core attachment id before any code is written. Design D1 depends on it.
- Slice 1 lands the BFF contract for nested outputs and regenerates the client.
- Slice 2 fixes the resolver, which is the reported bug.
- Slice 3 brings the tile download, thumbnail and playback in line with it.
- Slice 4 covers docs and the final gate.

Each slice ends with `npm run verify:changed`, and the change closes with exactly one `npm run verify:full`.

Read these before starting:

- `.claude/rules/nestjs-best-practices.md`, before slice 1;
- `.claude/rules/libs.md` and the `AGENTS.md` "Library isolation" section, before slice 3.

**Architecture guard:** `libs/chat-hooks` gains only the pure `isDialProjectFileId` predicate. It never builds an `/api` URL or imports the app. Relative imports are extensionless, and multi-line comments use `/* */`.

## 0. Confirm the attachment id shape

- [x] 0.1 On a dev stand with `PROJECTS_ENABLED`, reproduce issue #9853 in a project whose name contains a space. Ask an agent to generate one file at the top of `artifacts/` and one in a sub-folder.
  - Record each attachment's `url` from the `GET /api/v1/projects/:id/conversations/:conversationName` response body, and the failing preview request and its status from DevTools.
  - Record them in this file under 0.1, with the bucket replaced by `a1b2c3`.
  - **Gate:** if the shape is not `projects/{bucket}/{projectPath}/files/{filePath}` with per-segment percent-encoding, stop and amend design D1 and the `project-view-ui` delta before slice 2.
  - **Done (2026-11-16):** the user checked the change on a dev stand, and project-chat files open with the implemented resolver. That confirms the assumed `projects/{bucket}/{projectPath}/files/{filePath}` shape with per-segment encoding. The raw ids were not recorded.

## 1. Nested output download (BFF contract)

- [x] 1.1 In `apps/chat-api/src/common/validators/dial-entity-name.validator.ts`, add `isSafeDialRelativePath(value)` and the `IsSafeDialRelativePath()` decorator next to `isSafeDialPathSegment`.
  - The value must be a string of at most 4,096 UTF-8 bytes, split on `/`, with every segment passing `isSafeDialPathSegment`.
  - Add a JSDoc that states the cap.
  - **Verification:** `npm run test:file -- apps/chat-api/src/common/validators/dial-entity-name.validator.spec.ts`, extended with these cases:
    - accepted: `report.pdf`, `run-1/data.csv`, `run-1/summary: final.md`;
    - rejected: `''`, `/a`, `a/`, `a//b`, `../x`, `a/../b`, `a\b`, `a%20b`, `files/x`, and a 4,097-byte path.
- [x] 1.2 In `apps/chat-api/src/projects/dto/project-id-param.dto.ts`, change `ProjectArtifactParamDto.fileName` from `@IsDialEntityName()` to `@IsSafeDialRelativePath()`.
  - Update its `@ApiProperty` description to "Path relative to the project `artifacts/` folder, URL-encoded into one path segment", with the example `run-1%2Fdata.csv`.
  - `ProjectFileParamDto` is unchanged.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/project-id-param.dto.spec.ts`. The artifact cases from the `project-detail-api` delta pass, and the context-file cases are unchanged.
- [x] 1.3 In `apps/chat-api/src/projects/download/projects-download.service.ts`, make `downloadArtifact` pass the last `/`-segment of `fileName` to `download(...)` as the disposition name. It keeps `encodeDialResourcePath(`${PROJECT_ARTIFACTS_FOLDER}/${fileName}`)` for the Core path.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects-download.service.spec.ts`. Add a nested-path case: the Core path is `artifacts/run-1/data.csv`, and the disposition is `filename="data.csv"`. Add a colon case: the Core path is `artifacts/run-1/summary%3A%20final.md`.
- [x] 1.4 In `apps/chat-api/src/projects/projects.controller.ts`, update the `downloadProjectArtifact` `@ApiParam` for `fileName` (description and example) and the operation description.
- [x] 1.5 Add supertest cases to the `project artifacts` block of `apps/chat-api/src/projects/tests/projects.controller.spec.ts`:
  - `…/artifacts/run-1%2Fdata.csv` → `200`, and Core is asked for `artifacts/run-1/data.csv`;
  - `..%2Fcontext%2Ftickets.csv`, `run-1%2F..%2Fx`, `run-1%2F%2Fdata.csv` and `report%2520v2.md` → `400`, with no Core call;
  - `context%2Ftickets.csv` → Core is asked for `artifacts/context/tickets.csv`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 1.6 Run `npm run openapi`, then `npm run openapi:check`.
  - Check that only the `downloadProjectArtifact` param and operation descriptions changed in `libs/chat-api-client/openapi.json`, and that `downloadProjectArtifactRaw({ id, fileName })` is unchanged.
  - Run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [x] 1.7 Update the `GET /api/v1/projects/:id/artifacts/:fileName` row in `apps/chat-api/README.md`: a path relative to `artifacts/`, encoded into one segment.
- [x] 1.8 Run `npm run verify:changed`. Typecheck and lint pass. `test:changed` has two failures in the full `chat-api` run, both outside this change: `app-config.service.spec.ts` › "keeps the response, config, and features key order" and `explicit-environment.spec.ts` › "treats every held value as explicit when nothing was captured". Both pass in isolation, with and without this change. The regenerated `models/index.ts` gained a stray `/* eslint-disable */` line; it was reverted, and `npm run openapi:check` still passes.

## 2. Resolve DIAL Core project file ids (the reported bug)

- [x] 2.1 Write the failing tests first in `apps/chat/src/utils/tests/dial-file.spec.ts`, using the ids recorded in 0.1. Cover every scenario of the `project-view-ui` and `project-context-file-preview` deltas:
  - Core-encoded artifact and context ids;
  - the same id unencoded, mapping to the same URL;
  - a nested output;
  - the first-`/files/` split;
  - a malformed escape, an empty segment, a `tmp/` path and a nested context path, all resolving to nothing.

  Replace the `uses the last folder segment when the project path contains one` test with the first-`/files/` case, because its project path contains the reserved name `files` and cannot exist in Core. Remove `'an output locator whose name has a path'` from the `does not resolve` table.
  - **Verification:** `npm run test:file -- apps/chat/src/utils/tests/dial-file.spec.ts` fails on the new cases.
- [x] 2.2 Rewrite `resolveProjectFileDownloadUrl` in `apps/chat/src/utils/dial-file.ts` per design D1:
  1. require the `projects/` prefix;
  2. split at the first `/files/` after `projects/{bucket}/`;
  3. decode every segment with `decodeURIComponent` in a `try`, resolving to `undefined` on a throw or an empty segment;
  4. route on the first in-project segment (`context` + one segment, or `artifacts` + one or more segments);
  5. encode the project id and the relative path with `encodeURIComponent`.

  Update its JSDoc and the JSDoc of `toProjectArtifactUrl`. Remove `PROJECT_FILE_ROUTES` if it is no longer used.
  - **Verification:** `npm run test:file -- apps/chat/src/utils/tests/dial-file.spec.ts` is green. `npm run test:file -- apps/chat/src/utils/tests/project-file-preview.spec.ts` and `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx` are unchanged and green.
- [x] 2.3 Add a project-chat regression test that opens an assistant attachment `projects/a1b2c3/Q4%20launch/files/artifacts/report%20v2.md` and asserts the requested URL `/api/v1/projects/projects%2Fa1b2c3%2FQ4%20launch/artifacts/report%20v2.md`. Put it in `apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx` if that suite renders messages with the real canvas resolvers. Otherwise put it in the `ConversationView` attachment test that wires `useAttachmentCanvasResolvers`.
  - **Done:** `ProjectChatPage.spec.tsx` mocks `Conversation`, and the `ConversationView` suites mock the resolvers. The test therefore went into `apps/chat/src/hooks/attachment/tests/useAttachmentCanvasResolvers.spec.ts`, which runs the app's real resolvers down to `fetch`. It fails on the old resolver with `Q4%2520launch`, which is the issue's double encoding.
- [x] 2.4 Run `npm run verify:changed`. Typecheck and lint pass. `test:changed` fails only on tests outside this change: the two `chat-api` tests noted in 1.8, and `apps/chat/src/components/ConversationView/tests/NegativeFeedbackModal.spec.tsx` › "calls onSubmit with formatted …", which also fails on a clean `development` tree.

## 3. Tile download, thumbnail and playback

- [x] 3.1 Add `isDialProjectFileId(url)` to `libs/chat-hooks/src/files/dial-file.ts`, with a JSDoc. It is exported through the existing `export * from './files/dial-file'`.
  - **Verification:** a unit test in `libs/chat-hooks/src/files/tests/dial-file.spec.ts`: `true` for `projects/b/p/files/artifacts/a.csv` and `projects/b/p/files/context/a.csv#page=2`; `false` for `projects/b/p/files/artifacts/`, `projects/b/p`, `files/b/a.csv` and `conversations/b/x`.
- [x] 3.2 In `libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts`, let `isDownloadableAttachment` and `downloadAttachment` accept a project file id as well as a `files/` id, and pass it to `resolveDownloadUrl`. Only the `isDialFileId` gate widens. Folder ids and the `data` branch are unchanged.
  - **Verification:** add `useAttachmentAction` spec cases for a project id that resolves (download triggered, returns `true`) and one that does not (returns `false`).
- [x] 3.3 In `apps/chat/src/utils/dial-file.ts`, add `resolveAttachmentDownloadUrl(url)`. It returns `resolveDialFileDownloadUrl` for a `files/` id, `resolveProjectFileDownloadUrl` for a project file id, and `undefined` otherwise. Pass it as `resolveDownloadUrl` in `apps/chat/src/hooks/conversation/useMessageAttachments.ts` and `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`.
- [x] 3.4 In `apps/chat/src/utils/icon-path.ts`, make `resolveCatalogIconUrl` resolve a project file id through `resolveProjectFileDownloadUrl` before the theme-icon fallback. In `apps/chat/src/utils/attachment-display-resolvers.ts`, make `resolvePlayUrl` use `resolveAttachmentDownloadUrl`.
  - **Verification:** add a project image case to `apps/chat/src/utils/tests/icon-path.spec.ts`, and create `apps/chat/src/utils/tests/attachment-display-resolvers.spec.ts` with a project audio case and a `files/` audio case. The existing `files/` and theme-icon cases are unchanged.
- [x] 3.5 Document `isDialProjectFileId` in `libs/chat-hooks/README.md`, next to `isDialFileId` in the `useAttachmentAction` section. State that `downloadAttachment` passes a project file id to the host's `resolveDownloadUrl`.
- [x] 3.6 Run `npm run verify:changed`. Typecheck and lint pass; `test:changed` fails only on the two `chat-api` tests noted in 1.8.

## 4. Docs and the final gate

- [x] 4.1 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`. Resolve every failure, and check each advisory hit against the four deltas.
- [x] 4.2 Check on the dev stand (from 0.1) that:
  - the top-level and the nested generated file both open;
  - the canvas Download saves `data.csv`;
  - the tile download and an image thumbnail work;
  - the project view's Context and Outputs cards still open.
- [ ] 4.3 Run `npm run verify:full` once.
  - **Run 2026-11-16:** `typecheck:full`, `lint:check` and `format:check` pass. `test:full` fails on three tasks, none in a file this change touches:
    - `chat-api`: the two tests noted in 1.8;
    - `libs/catalog` `CreateButton.mobile.spec.tsx` › "announces the no-results label and clears the query on close", which also fails on a clean `development` tree;
    - `attachment-canvas-consumer-fixture:pack-lib`: `ETARGET` for `@epam/pdf-highlighter-kit@^0.0.22` from the local registry. This is an environment failure, and no manifest changed.

    Left unchecked until it is green in CI.

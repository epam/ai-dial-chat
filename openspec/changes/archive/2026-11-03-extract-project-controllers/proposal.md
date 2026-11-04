## Why

### Problem

`@epam/ai-dial-projects` and `@epam/ai-dial-chat-hooks/project` already carry the Projects UI and its requests (`docs/projects-reuse.md`), yet every host still re-implements the same orchestration around them. `apps/chat` holds roughly 1,200 lines of project glue that contains no host knowledge (routes, i18n, contexts, `server-api`) in large stretches, and a second host (`pg-chat`) has just copied all of it file by file. Copies drift: the next fix to the preview toggle, the create-chat flow or the chat polling has to be made twice, and the second host only learns about it by diffing.

Measured duplication in `apps/chat/src` (each block is host-agnostic once its callbacks are injected):

| Block                                                                                                                                                              | Where                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open / toggle / close a project file in the canvas, repeated three times                                                                                           | `pages/ProjectCreatePage/ProjectCreatePage.tsx:83-128`, `pages/ProjectEditPage/ProjectEditPage.tsx:154-185`, `pages/ProjectViewPage/ProjectViewPage.tsx:121-175`                                                                                         |
| Preview keys, card ids and attachment builders                                                                                                                     | `utils/project-file-preview.ts:1-95`                                                                                                                                                                                                                     |
| Form draft: values, files, errors, seeding by `contentVersion`, removed/new files, dirty flag, field and file handlers                                             | `pages/ProjectEditPage/ProjectEditPage.tsx:100-160` and `:221-260`, `pages/ProjectCreatePage/ProjectCreatePage.tsx:60-90` and `:130-160`                                                                                                                |
| Project conversation data source: poll-based watch stream, title re-read, id normalisation, transport and handlers assembly, `ConversationDataSource` model | `utils/project-conversation-data-source.ts:1-190`, `models/conversation-data-source.ts:1-63`, `utils/regular-conversation-data-source.ts:1-73`                                                                                                           |
| New chat flow: create → save settings → always open the created chat, storage-full code mapping                                                                    | `components/ProjectConversationsSection/ProjectConversationsSection.tsx:165-230`                                                                                                                                                                       |
| File-manager promise bridge, a second copy of an existing lib hook                                                                                                  | `hooks/projects/useProjectFileManagerPicker.ts:1-105` vs `libs/chat-hooks/src/skill-editor/useSkillFileSystemPicker/useSkillFileSystemPicker.ts`                                                                                                        |
| Publish-history load on panel open (the catalog panel fetches per item through its own callback in `hooks/useCatalogPublishing/useCatalogPublishing.ts:150-172`, so only the project panel has this effect) | `components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx:130-150`                                                                                                                                                                      |

## What Changes

### Solution

Extract each block into `libs/chat-hooks` as an additive, host-agnostic API, in ordered slices that each stay verifiable on their own, and adopt it in `apps/chat` in the same slice so `apps/chat` keeps only a thin adapter (labels, notifications, navigation, contexts). Behaviour does not change. The design follows `archive/2026-10-29-extract-reusable-chat-controllers`.

- **A1 Preview helpers** (`chat-hooks/project`): `toProjectPreviewKey`, `fromProjectPreviewKey`, `toProjectOutputCardId`, `fromProjectOutputCardId`, `toStoredProjectFileAttachment`, `toProjectOutputAttachment`, `toProjectContextFileAttachment`. The locator builder is a required parameter; `toProjectContextFileUrl` / `toProjectArtifactUrl` and their `/api/v1/projects/...` resolution stay in `apps/chat/src/utils/dial-file.ts` (app-owned URL scheme).
- **A2 `useProjectFilePreview`** (`chat-hooks/project`): one controller for the open / toggle / close-when-removed behaviour of context cards and output cards. It never calls a canvas hook; the host passes `attachmentId`, `openAttachment`, `closeCanvas` and `startRequest`, exactly as `useDialFilePreview` does (`libs/chat-hooks/src/files/useDialFilePreview/useDialFilePreview.ts:45`).
- **A3 `useProjectDraft`** (`chat-hooks/project`): the New and Edit form state, with a create mode and an edit mode that seeds from a loaded project once per `contentVersion`.
- **A4 `classifyProjectSaveOutcome`** (dropped): planned as a small, droppable slice. With the draft hook in place the pages branch on the generated `ProjectCreateErrorCode` enum and the existing `getProjectFormError`, so a classifier would only restate that branching as a `switch`; it is not extracted (see design D5).
- **A5 `createProjectChat` and `classifyProjectChatCreateError`** (`chat-hooks/project`, plain async functions: the flow holds no state): create the chat from the first message, save the composer's settings, call the host's `onCreated` with the saved conversation even when the save fails (then rethrow, exactly as the page does today), and classify a failed create as `storage-full` or `failed` with its trace id. The host keeps deployments, tools, skill mentions, toasts and navigation.
- **B1-B2 Conversation data source** (`chat-hooks/conversation` and `chat-hooks/project`): the `ConversationDataSource` / `ConversationListSync` interfaces and `NO_CONVERSATION_LIST_SYNC` (with `notFoundMessageKey` widened to `string`), and `createProjectConversationDataSource`. The regular source's factory (B3) stays in the app: it is an object literal whose every field the host supplies, so a lib copy would be an identity function (see design D7). Host injects the stream path, CSRF accessors, route builders, the viewed-mark writer and the `ProjectsApiClient`.
- **C `usePublishHistory`** (`chat-hooks/catalog`, P3, droppable): the "re-read history on every open, cancel on close, empty on failure" effect of the project publish panel. Only the project panel has this effect in `apps/chat`; the value is that the second host stops copying it.
- **D Picker de-duplication**: rebuild `apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts` as an adapter over the existing `useSkillFileSystemPicker<File>` (host supplies the download, root label and error toast), the way `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts` already does for skills. The hook stays exported from `./skill-editor` only (the `entry-points.spec` invariant allows a re-export target in one entry barrel). The 105-line promise bridge disappears; a ~35-line adapter stays.
- **E Adapter collapse (app only)**: delete the seven one-line adapters in `apps/chat/src/hooks/projects/` (`useProject`, `useProjects`, `useCreateProject`, `useSaveProject`, `useProjectArtifacts`, `useProjectWatch`, `useProjectConversations`) and have pages call the shared hooks with `projectsClient`; `projects-client.ts` and the `server-api` wrappers stay (they are the seam the app's specs mock). `useProjectActions` stays as the host adapter (pins, toasts, navigation). No lib change and no new public API: the client must still be supplied by the host, as `AGENTS.md` requires, so the adapters add nothing but an import hop. The cases only those adapter specs assert move into the lib specs first.
- Update `apps/chat`, the README of `libs/chat-hooks`, `docs/projects-reuse.md` and the spec path references in the same slice.

### Non-goals

- No move of pages, containers, `*Labels` hooks, `useBuilderLeaveGuard`, the composer menus, `project-create-errors` key mapping, or any JSX. Those depend on `t()`, router, notifications or app contexts.
- No new UI, string, accessibility behaviour or RTL change; no backend or OpenAPI change.
- No registry publication. `pg-chat` adopts the published version afterwards; its own removal of the `projects.api` / `project-conversations.api` / `projects-client` delegation layers is tracked separately in that repository.
- No new package, no new peer on any entry point.

### Alternatives

| Option                                           | Correctness and delivery                                                | Security / performance                                                        | Migration and rollback                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Keep copies, sync by hand (status quo)           | No work now; drift is certain, already visible between the two hosts      | Each concurrency fix (stale preview request, polling stop) is made twice       | None; cost grows with every project change                              |
| Move pages and containers into a feature lib     | One implementation, but needs `t()`, router, contexts and `server-api`    | Violates `AGENTS.md` library isolation (routes, i18n, contexts, REST paths)   | Large coupled rollback; contradicts `docs/projects-reuse.md`            |
| Extract bounded controllers in slices (chosen)   | Characterisation tests carry over; host differences become explicit input | Keeps cancellation and stale-request rules in one place; no new peer         | Additive exports, thin adapters, one slice reverts alone                 |
| Extract only the pure helpers (A1)               | Lowest risk, about 70 lines                                               | No behavioural gain                                                           | Trivial, but leaves the three preview copies and the data source          |

## Capabilities

### New Capabilities

- `reusable-project-controllers`: public contracts of the project preview, draft, save-outcome, create-chat, conversation data-source and publish-history controllers, their host boundaries (what the host injects and keeps), and the requirement that `apps/chat` consumes them through thin adapters.

### Modified Capabilities

None. `project-context-file-preview`, `project-create-ui`, `project-edit-ui`, `project-view-ui`, `project-conversations-ui`, `project-conversation-read-state`, `app-config-context` and `reusable-chat-controllers` keep their behavioural requirements. Their spec text only gets path and name references updated where a moved file or hook is cited, so `npm run validate:specs` keeps passing.

## Impact

- **Libraries:** `libs/chat-hooks` gains new modules under `project/`, `conversation/` and `catalog/`, exported from the root and from the existing `./project`, `./conversation` and `./catalog` entries. Every new import must resolve against the peers those entries already declare (`libs/chat-hooks/README.md` entry-point-to-peer matrix: `./project` has `@epam/ai-dial-projects`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`; `./conversation` has `@epam/ai-dial-chat-shared`; `./catalog` has `@epam/ai-dial-catalog`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-attachment-input`, `@epam/ai-dial-publish-panel`, `@epam/ai-dial-skill-editor`). `libs/chat-hooks` stays non-rendering and receives host knowledge through parameters.
- **Library boundary:** `chat-hooks` already may import `@epam/ai-dial-projects` and `@epam/ai-dial-attachment-canvas` types and pure functions and the generated client's types (`AGENTS.md` "Library isolation", second exception). It never imports a feature-lib hook or component, never constructs a client, and never reads routing, storage, env or i18n. Routes, CSRF accessors, the stream base path, the viewed-mark writer and canvas callbacks arrive as parameters.
- **App:** `apps/chat` replaces the files listed above with adapters; the file-manager bridge in `apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts` shrinks to an adapter and its spec keeps only adapter-level cases. Public exports of `apps/chat` modules that are still imported elsewhere stay as delegates until the last importer moves.
- **Docs and specs:** `libs/chat-hooks/README.md` (a section per export), `docs/projects-reuse.md` ("What stays in the host" shrinks), `docs/architecture.md` if the module list changes, and path references in `openspec/specs/{project-view-ui,project-create-ui,project-conversations-ui,project-conversation-read-state,app-config-context}/spec.md`.
- **i18n:** no new user-visible string. `notFoundMessageKey` stays a host-resolved key; the lib sees a plain `string`.
- **Scope-creep flag:** this touches a shared published lib and its public API surface, so each slice carries lib tests, host adapter tests and the packed-consumer check from `chat-hooks-package-distribution`.

### Acceptance criteria

1. Each of A1-A3, A5, B1-B2, C and D has one implementation in `libs/chat-hooks` (or, for D, the existing one), used by `apps/chat`; the old app file remains only as a thin adapter.
2. Characterisation tests move with the code and still pass unchanged in meaning: stale canvas request is dropped, closing on removal, open card toggles closed, seeding once per `contentVersion`, create chat returns the conversation when the save fails, polling stops on abort, `shouldMarkOpenChatViewed` behaviour, publish history empties on failure and is re-read on each open.
3. The packed `@epam/ai-dial-chat-hooks` typechecks and bundles outside workspace aliases and no entry point gains a peer.
4. `libs/chat-hooks/README.md` documents each public API, required host callbacks and the entry that exports it; `docs/projects-reuse.md` matches.
5. `npm run validate:docs`, `npm run validate:specs`, `npm run validate:lib-duplicates`, `nx run-many -t lint typecheck test` for `chat-hooks` and `chat`, and the module-boundary lint pass.

### Backward compatibility and rollback

Not breaking. All additions are new exports; no existing export is renamed or removed. `apps/chat` keeps its current module paths until their last importer moves, and `ConversationDataSource` keeps its shape (only `notFoundMessageKey`'s type widens from a key enum to `string`). A slice reverts by restoring its adapter and removing its export; there is no persisted-data, API or backend migration. Registry publication and `pg-chat` adoption are separate release steps.

## Context

See `proposal.md` for motivation and the measured duplication. Facts that shape the approach (all verified in the current tree):

- `libs/chat-hooks` is the home of host-agnostic, non-rendering code. Its `./project` entry already holds the project requests and data hooks (`libs/chat-hooks/src/project/`: `projects-api-client.ts`, `use-project*.ts`, `project-form-errors.ts`, `project-mapping.ts`), and hooks there take an already configured `ProjectsApiClient`, or a `Pick<>` of it, as their first argument (`use-project-submit.ts`).
- The closest precedent for a page-level controller is `useDialFilePreview` (`libs/chat-hooks/src/files/useDialFilePreview/useDialFilePreview.ts`): the host calls the canvas hooks and passes `startRequest: () => () => boolean` and an `openAttachment` callback, so the lib never imports a feature-lib hook. `useOpenAttachmentCanvas` returns `OpenAttachmentCanvas = (attachment, canvasAttachmentId?, shouldCommit?) => Promise<boolean>` and `useLatestCanvasRequest` returns `() => () => boolean` (`libs/attachment-canvas/src`), both structurally typeable without importing the canvas lib.
- The closest precedent for an adapter over a lib controller is `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts` over `libs/chat-hooks/src/skill-editor/useSkillFileSystemPicker/useSkillFileSystemPicker.ts` (host supplies the download, the root label, and the toast).
- `AGENTS.md` "Library isolation" lets `chat-hooks` import `@epam/ai-dial-projects`, `@epam/ai-dial-attachment-canvas` and the generated client's types and pure functions, never a feature-lib hook or component, and never construct a client. `libs/chat-hooks/README.md` lists the peers per entry: `./project` has `@epam/ai-dial-projects`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`; `./conversation` has `@epam/ai-dial-chat-shared`; `./catalog` has catalog, chat-shared, attachment-input, publish-panel and skill-editor; `./file-manager` has react-file-manager, ui-kit and chat-shared.
- `ConversationStreamTransport` lives in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` and `createChatStreamApi` in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`, both already exported from `./conversation`.
- Behaviour is protected by existing host specs: `apps/chat/src/utils/tests/project-file-preview.spec.ts`, `apps/chat/src/utils/tests/project-conversation-data-source.spec.ts`, `apps/chat/src/hooks/projects/tests/useProjectFileManagerPicker.spec.ts`, the page specs under `apps/chat/src/pages/Project*Page/tests/`, and `apps/chat/src/components/ProjectConversationsSection/tests/`, `apps/chat/src/components/PublishProjectPanelContainer/tests/`.

## Goals / Non-Goals

**Goals:**

- One implementation of each host-agnostic project behaviour, consumed by `apps/chat` through thin adapters, so a second host adopts it by importing instead of copying.
- Preserve behaviour exactly, with the existing specs as the safety net and new lib specs that carry the same assertions.
- Add no peer to any entry point and no host knowledge to the lib.

**Non-Goals:**

- Moving anything that needs `t()`, router, contexts, notifications, `server-api` or JSX (pages, containers, `*Labels` hooks, `useBuilderLeaveGuard`, composer menus, `project-create-errors`).
- Changing the project chat page, the data-source consumer (`ConversationView`) or any visible behaviour.
- Publishing the package or migrating `pg-chat`.

## Decisions

### D1. Where each piece lives

| Piece | Module in `libs/chat-hooks/src` | Entries | Why there |
| --- | --- | --- | --- |
| A1 preview helpers, A2 controller, A3 draft, A5 chat flow, project data source | `project/` | root, `./project` | Domain code; `./project` already has the projects, ui-kit and chat-shared peers they need (`isStoredContextFile`, `ProjectContextFile`, `DisplayAttachment`) |
| B2 contracts, `NO_CONVERSATION_LIST_SYNC` | `conversation/conversation-data-source/` | root, `./conversation` | They depend only on `ConversationStreamTransport` and the client's `ConversationsApi` type; `./conversation` needs only chat-shared |
| C publish history | `catalog/use-publish-history.ts` | root, `./catalog` | Uses `mapPublishHistoryEntryDto` next to it (`catalog/publish.ts`) and the catalog entry's publish-panel peer |
| D picker | existing `skill-editor/useSkillFileSystemPicker` | unchanged (`./skill-editor` and root) | `libs/chat-hooks/src/entry-points/tests/entry-points.spec.ts` allows a re-export target in one entry barrel only, so it cannot also be exported from `./file-manager` |

Alternative considered: put the project data source in `./conversation` next to the contracts. Rejected: it needs the project request types, and a type from `./project` would make `./conversation` depend on `@epam/ai-dial-projects` at the declaration level. The contracts stay generic in `./conversation`; the project source imports them by relative path (the lib's own rule: never through its package name).

Alternative considered: put the generic contracts in `chat-shared`. Rejected: they reference `ConversationStreamTransport`, which lives in `chat-hooks`.

### D2. The preview controller takes callbacks, never a canvas hook (A2)

```ts
interface UseProjectFilePreviewOptions {
  scope: string;                                   // project id, or 'new'
  attachmentId: string | undefined;                // from the host's canvas state
  openAttachment: OpenProjectPreviewAttachment;    // (attachment, key, shouldCommit) => unknown
  closeCanvas: () => void;
  startRequest: () => () => boolean;
  resolveContextAttachment: (cardId: string) => DisplayAttachment | undefined;
  resolveOutputAttachment?: (name: string) => DisplayAttachment | undefined;
}
// returns { selectedCardId, selectedContextFileId, selectedOutputName,
//           onContextFileClick, onOutputClick, closeIfRemoved }
```

`OpenProjectPreviewAttachment` and `ProjectPreviewCommitGuard` are declared structurally in the lib, compatible with the canvas lib's `OpenAttachmentCanvas` and `ShouldCommitCanvas`, so the lib does not import `@epam/ai-dial-attachment-canvas` (this is the `useDialFilePreview` pattern, and it keeps the `./project` entry's peers as they are). The host builds the three canvas values once (`useAttachmentCanvas`, `useOpenAttachmentCanvas` with `useAttachmentCanvasResolvers`, `useLatestCanvasRequest`) and passes them in. Callbacks are `useCallback`-memoised on their real inputs, a requirement the spec carries. The selected card is derived, not stored, so there is no new state to desynchronise from the canvas; this keeps ownership with the canvas provider, as `project-context-file-preview` already requires.

`closeIfRemoved(files)` is separate from the draft so that the draft stays preview-agnostic; a page composes `onContextFilesChange = (files) => { draft.onContextFilesChange(files); preview.closeIfRemoved(files); }`.

Alternative: import `useOpenAttachmentCanvas` in the lib. Rejected by `AGENTS.md` (never a feature-lib hook).

### D3. Preview helpers take the locator builder (A1)

`toStoredProjectFileAttachment(card, projectId, toLocator)` makes `toLocator` required; the lib has no default. `apps/chat/src/utils/project-file-preview.ts` keeps three one-line bindings (`toProjectContextFileAttachment`, `toProjectOutputAttachment`, `toStoredProjectFileAttachment` with the context locator) so the pages' imports change minimally, and keeps the `toProjectContextFileUrl` / `toProjectArtifactUrl` builders, which belong to the app-owned URL scheme resolved by `resolveDialUrl` in `apps/chat/src/utils/dial-file.ts`.

Alternative: move the locator builders into the lib (they only concatenate `{projectId}/files/context|artifacts/{name}`). Rejected: the locator is the contract between the app's canvas URL resolvers and the BFF path; `AGENTS.md` lists "app-specific URL schemes" as host-owned.

### D4. One draft hook with two modes (A3)

```ts
useProjectDraft(
  { mode: 'create' } | { mode: 'edit', project: ProjectDetailsDto | null }
) // → { values, contextFiles, errors, setErrors, onFieldChange, onContextFilesChange,
  //      isDirty, isSeeded, removedFileNames, newFiles }
```

Edit seeding keeps the current rule: compare `project.contentVersion` with the last seeded one inside an effect and replace values, files (through `mapStoredContextFiles`) and errors once per version. `isDirty` is false until seeded. `setErrors` stays public because the host writes server field errors after a submit. `errors` uses `ProjectCreateFormErrors` from `@epam/ai-dial-projects` (a type, allowed). Hooks follow the existing rule: no side effect on unmount beyond cleanup, no `setState` after unmount.

Alternative: two hooks (`useProjectCreateDraft`, `useProjectEditDraft`). Rejected: the handlers and error clearing are identical; the create/edit differences are only seeding and dirty rules, which a mode handles in one file with less drift risk.

### D5. Save outcome classification is not extracted (A4, dropped)

`classifyProjectSaveOutcome` was planned as a pure function over `CreateProjectOutcome | SaveProjectOutcome` returning a discriminated union beside `getProjectFormError`. Once the draft hook (D4) and the preview controller (D2) are in, what remains in the pages is one comparison per generated `ProjectCreateErrorCode` (`ProjectChanged` and `ProjectTooLarge` in the Edit page) and the shared `getProjectFormError` for field errors. A classifier would restate that as a `switch` of the same size in each host, with no behaviour to share, so it is left out; hosts keep comparing against the generated enum, as `.claude/rules/apps.md` asks.

### D6. The new-chat flow is a function, with the host's callbacks around it (A5)

```ts
createProjectChat(client: Pick<ProjectsApiClient, 'createProjectConversation' | 'saveProjectConversation'>,
  { projectId, firstMessage, deploymentId, attachments, configurationValue, skills, settings },
  onCreated: (saved: ConversationResponseDto) => void): Promise<ConversationResponseDto>
classifyProjectChatCreateError(error): Promise<{ failure: ProjectChatCreateFailure; requestId?: string }>  // StorageFull | Failed
```

Behaviour copied from `apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`: create, merge `prompt`, `temperature`, `responseFormat` onto the created conversation, save, and call `onCreated` in a `finally` so the chat opens even if the save failed, then let the save error propagate. A failed create rejects before `onCreated`. The host still owns `selectedItemId`, tool configuration, skill mention reset and re-seed, toasts and `navigate`. There is no hook because there is no state; a plain function is easier to test and to call from any host's callback.

Alternative: a hook that also owns skill-mention bookkeeping. Rejected: that state lives in `useComposerMenus`, an app hook.

### D7. The conversation data source is a factory over injected ports (B1-B2)

```ts
createProjectConversationDataSource({
  projectId, canEdit,
  client: Pick<ProjectsApiClient,
    'getProjectConversation' | 'saveProjectConversation' |
    'deleteProjectConversation' | 'attachToProjectGeneration'>,
  stream: { getCsrfToken, setCsrfToken, completionsBasePath, getTimezone? },
  routes: { getConversationRoute, getExitRoute },
  viewedWriter: { enqueue(id), drop(id) },     // SerializedKeyedWriter shape
  notFoundMessageKey?: string,
})
```

The factory contains what is host-agnostic in `apps/chat/src/utils/project-conversation-data-source.ts`: `toConversationId`, the abortable poll stream, the title re-read with its five attempts at two seconds, the transport (`createChatStreamApi` + the client's get/save/attach), and the handlers (`saveConversation`, `deleteConversation`). The base path (`/api/v1/projects/{id}/conversations`), CSRF accessors, route builders and the writer are the host's. `ApiEndpoints.PROJECTS` therefore stays in the app. The app file becomes a ~30-line binding. `NO_CONVERSATION_LIST_SYNC` and the `ConversationDataSource` / `ConversationListSync` contracts move into `./conversation` so the factory can type its result, with `notFoundMessageKey` as `string`. A `createRegularConversationDataSource` was considered and not extracted: the app's version is an object literal in which the transport, `getConversation`, `saveConversation`, the `conversationsApi` handlers, both route builders, read-only, list sync and title watch all come from the host, so the lib function would only return its argument. `isRegularConversationReadOnly` is a host ownership rule (list flags, then the bucket prefix) and stays too.

The title and poll timers use `window.setTimeout`/`AbortSignal`, as today; tests use fake timers. This is a browser API, not an app dependency, consistent with the other `chat-hooks` hooks.

Alternative: leave the data source in the app and move only `watchProjectConversation*`. Rejected: the assembly (transport, handlers, id rules, read-only, list sync) is the part a second host gets wrong.

### D8. Picker: adapt, do not rebuild (D)

`useProjectFileManagerPicker` re-implements the promise bridge of `useSkillFileSystemPicker`. The lib hook already matches the project form's needs: files only, selection order, cancel on close and on unmount, `onError` after cancelling, and a guard against stale downloads (`attempt` identity). The host adapter reduces to `materializeFile` (resolve the API path with `resolveDialFileApiPath`, download, build a `File`) and `onError` (the existing toast key). One observable difference is an improvement: the download receives the picker's `AbortSignal`, so a cancelled pick aborts its requests, which the old bridge did not do; the existing spec's cases keep their meaning. The hook stays exported from `./skill-editor` (and the root) only: `entry-points.spec` forbids one re-export target in two entry barrels, so a host imports it from `./skill-editor` and has that entry's peers (including `@epam/ai-dial-skill-editor`), or from the root.

### D9. Publish history controller (C, P3)

`usePublishHistory({ isOpen, entityId, loadHistory })` re-reads on every open, ignores a result that arrives after close or an `entityId` change, and returns an empty list on failure. The host's `loadHistory` calls its own `getCatalogPublishHistory` wrapper and maps with `mapPublishHistoryEntryDto`. Only the project panel has this effect today (the catalog panel pulls history per item through a callback), so the benefit is the second host. Droppable, like D5.

### D10. Collapse the one-line adapters instead of generating them (E)

Seven files in `apps/chat/src/hooks/projects/` are `useShared…(projectsClient, …)`. `AGENTS.md` keeps the client with the host, so those hooks cannot move, but the hop through an adapter can go: pages import the shared hook and pass `projectsClient`. A factory such as `createProjectHooks(client)` was considered and rejected: it is a new public API shape with no precedent in the lib, and it saves no more lines than direct calls. `projects-client.ts` and the two `server-api` wrappers (`projects.api.ts`, `project-conversations.api.ts`) stay as they are. Rebuilding the client from `projectsRequests` was considered and dropped in this change: the wrappers are the app's documented seam, and about nine specs (pages, the section, the data source) mock them, so the collapse would re-target those mocks for no behaviour change. It remains a simplification for `pg-chat`, which has no such seam to keep. `useProjectActions` stays because it wires pins, toasts and navigation.

Page specs mock `server-api`, not the adapters, so they are unaffected; the adapter specs are deleted after the cases they alone assert (disabled/no-id, first-render loading, abort on unmount or disable, previous project not returned, `isSubmitting` in flight, status-only failure) are added to the lib specs, so coverage does not drop.

### D11. Slicing and verification

Vertical, one concept per slice, each ending with the host adopting the lib code and its specs passing, in the order D, E, A1, A2, A3, A4, A5, B, C, then docs and final verification. D goes first because it proves the adapter pattern and the `./file-manager` re-export without new lib code; E (app only) follows so the later page edits start from the final import shapes; B is the largest and comes after the smaller slices have exercised the entry and peer checks. Characterisation tests move with the code (host spec cases reappear as lib spec cases; the host keeps adapter-level cases).

## Risks / Trade-offs

- **A new import quietly adds a peer to an entry** (for example `ProjectsApiClient` types dragging `@epam/ai-dial-projects` into `./conversation`) → the data source stays in `project/` and imports the contracts by relative path; each slice runs the packed-consumer check from `chat-hooks-package-distribution`, and the README matrix is re-read before each export is added.
- **Behaviour drift while moving code** (the stale-request guard, polling stop, seeding by version) → every behaviour in the spec has a lib test copied from the current host test before the code moves (test first), and the host page specs run unchanged.
- **Widening `notFoundMessageKey` to `string` loses key typing in the app** → the app adapter passes a `ProjectsI18nKeys` member, and `ConversationView` already resolves it through `t()`; lint and typecheck cover the call sites.
- **Over-extraction** (A4, C save few lines) → both are marked droppable, and the apply phase records any dropped slice instead of forcing it.
- **A published API surface is hard to take back** → exports are additive and documented in the same slice; names follow the existing `use-project-*` / `project-*` conventions, and anything doubtful is left unexported until a second consumer needs it.
- **Spec path references rot** → the moved modules' citations in `project-view-ui`, `project-create-ui`, `project-conversations-ui`, `project-conversation-read-state` and `app-config-context` are updated in the slice that moves them, and `npm run validate:specs` runs in each slice.

## Migration Plan

1. Land each slice behind no flag: the library export and the `apps/chat` adoption ship together, so there is never a second copy of the code in the repository.
2. After the last slice, `pg-chat` bumps to the published version, deletes its copies and keeps its adapters. That follow-up is outside this change.
3. Rollback: revert the slice's commit; there is no data, API or schema migration, and no other slice depends on a later one except A2 on A1 and the project data source on B2.

## Open Questions

- The exact lib module names (for example `project-file-preview.ts` and `use-project-file-preview.ts` under `project/`) follow the folder's kebab-case convention and can be settled while writing each slice's tests without changing the specs or tasks.

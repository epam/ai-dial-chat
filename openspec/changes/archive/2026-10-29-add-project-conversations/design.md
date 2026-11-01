## Context

The project view page is in place: #9596 added the listing, #9605 added create, and #9621 sections 1–3 added view and edit. The archived designs are `openspec/changes/archive/2026-10-28-add-project-view-page/design.md` and the create design next to it. #9621 section 4 adds chats stored inside the project.

**DIAL Core facts** (read in the local `ai-dial-core` checkout at `b9c6f0dd`):

- `ComplexResourceService.putFile` / `deleteFile` go through `copyOnWrite`. Under the folder lock, each call:
  - validates `If-Match` against the **aggregate** project ETag;
  - copies the whole current version server-side;
  - writes the one file;
  - commits a new marker.

  Any file write changes the project ETag, and no per-file precondition exists.
- `listFiles` returns per-file `etag`, `createdAt`, `updatedAt` and `author` (`context.getUserDisplayName()`), with no sizes.
- `ResourceOperationService` moves a complex resource as a whole. A file inside it cannot be moved.
- Publication copies the whole project, `conversations/` included.
- Core forwards every request header to the deployment on both Chat Completions and Responses (confirmed by the user). An `x-project-id` header set by the BFF therefore reaches the deployment with no Core change, and the deployment's access to the project's files follows from it.

**Chat side, as the code is today** (exploration of `origin/development` `35332224a`):

- **Persistence.** Only `ConversationNamingService` injects the `CONVERSATION_PERSISTENCE` port token. `ConversationStreamingService`, `BackgroundGenerationService`, `ConversationLifecycleService` and `ConversationService` inject the concrete `ConversationPersistenceService`. Lifecycle, listing, titles, publish and share call Core's conversation API directly.
- **Generation.**
  - A foreground generation writes twice: the start state and the final state.
  - A background generation writes a placeholder, the `responseId` and the terminal state, each conditionally.
  - The generation registry key is `${ownerKey}::${dto.path}`.
- **Requests.** `ChatCompletionsAdapter.buildRequest` and `ResponsesAdapter.buildRequest` build the system message from `startConversation.prompt`. Headers are assembled in each adapter's `stream`.
- **Frontend.** `useConversationStream` already takes a `ConversationStreamTransport`, and `createChatStreamApi` takes a `completionsBasePath`. `ConversationPage` calls `server-api/conversations.api.ts` directly, routes with `/conversations`, and derives read-only from the bucket.
- **Project view.** `ProjectView` has no main column: the Details panel is pushed to the inline end.

**User decisions for this change:**
- Publish warns, and does not block.
- Shared and organization recipients read chats read-only.
- Context reaches the model through `x-project-id` plus attachments.
- New chats use the composer's model selector.

## Goals / Non-Goals

**Goals:**
- Chats that live and die with the project (share, publish, download, delete, rename), stored at `conversations/{name}` inside it.
- One generation pipeline for top-level and project conversations, with no forked streaming or background code.
- A regular `/conversations/*` chat whose behaviour does not change at all.
- Edits and deletes that do not fail because the owner chatted in the meantime.
- A host-agnostic `libs/projects`.

**Non-Goals:** see the proposal (Outputs, sidebar/search/pins, single-conversation share/publish/duplicate, watch, editable shares, moving chats).

## Decisions

### D1. Storage: a file inside the project, top-level body and naming

A project conversation is `conversations/{deploymentId}__{title}__{uuid}`, with the same JSON body as a top-level conversation. Its id is the locator `projects/{bucket}/{projectPath}/conversations/{name}`, and the body's `folderId` is the project id.

- The listing derives a fallback title from the file name.
- Every body-level helper (history builder, display-name derivation, naming) works unchanged.
- Parsing is unambiguous because `conversations/` is flat: the second-to-last segment is always `conversations`.

**Alternatives:**
- Top-level `conversations/{bucket}/…` resources with a link to the project. Rejected: the sidebar's recursive listing picks them up, and project lifecycle operations would not carry them.
- An opaque `{uuid}.json` with a separate title index. Rejected: an extra file to keep consistent, and every write would touch two files, so two Core versions.

### D2. Persistence: route by locator inside the concrete service

`ConversationPersistenceService` checks for a `projects/` locator at the top of each method and delegates to `ProjectConversationStore`. `qualifySessionConversationPath` and `resolveConversationLocation` pass a locator through untouched.

**Why:**
- Every consumer that matters (streaming, background, lifecycle, naming) already receives the persistence service. Routing there makes all of them project-aware with no signature change.
- The locator is self-describing, so the bucket argument the callers pass is irrelevant. That matters for shared projects, whose bucket is not the session bucket.

**Alternatives:**
- Switch every consumer to `@Inject(CONVERSATION_PERSISTENCE)` and bind a delegating adapter. That is the same routing, plus many injection changes, and the concrete class's non-port methods (`getConversationWithStoredVersion`, `getStoredConversation`) would have to join the port. It can be done later as a refactor.
- Widen every signature to a location object (about 40 call sites). Rejected for this change.

**Paths that never see a locator:** listing, bulk delete, publish, share, duplicate, watch and `markViewed` call Core's conversation API directly. They are not reachable for project conversations, because the project endpoints never call them. `listSync: null` and `canDuplicate: false` on the frontend keep the UI away from them too.

### D3. Conflict detection: content hash plus bounded retry on the aggregate ETag

Core can only precondition a file write on the project's aggregate ETag. Passing that ETag through as the conversation's version would make a write to any other file look like a conflict on this one. That covers parallel generations, auto-naming and a context edit, and it would turn into spurious `409`/`503` errors through `CONDITIONAL_WRITE_ATTEMPTS`.

So the store's version token is `"sha256:{hex}"` of the file bytes. `saveConversationIfMatch` reads the aggregate ETag from the project metadata, then re-reads the file, checks the hash, and writes with `If-Match: <that ETag>`. It retries a `412` up to 5 times. The file download's `ETag` header is the file's own, not the aggregate one: using it made every conditional write fail with `412` and fall back to an unconditional write after ~4.5 s.

- **Correctness:** if this file changed, the hash check fails and the caller sees `{ isSaved: false }`, exactly the port's contract. If another file changed between the re-read and the write, Core's `412` makes the store re-check rather than overwrite.
- **Cost:** one extra GET per conditional write. These writes happen only in background generation and naming, a few per reply.

**Alternatives:**
- Core per-file ETags from `listFiles`. Rejected: the blob etag after `copyFolder` into a new version prefix is not verified to be stable, and the check would need another round trip anyway.
- Pass the aggregate ETag through as the version. Rejected for the contention described above.

**Unconditional writes** (foreground start and final saves, create, delete) send `If-Match: *`. The Core controller's `ProxyUtil.etag` is expected to read `*` as "any version". Verifying that is a task, because an omitted header may mean "create only" for complex resources.

### D4. contentVersion decouples edits from chats

Every conversation write bumps the project's ETag. With the existing edit design (snapshot ETag = `If-Match`), any reply finishing while the edit page is open, including a background generation, would make the save `409 project-changed`.

The snapshot therefore computes `contentVersion`: a SHA-256 over `{path}\t{crc32}\t{size}` of every non-conversation entry, from the ZIP central directory, so nothing is inflated. `PUT` and `DELETE` take it in `If-Match`. The BFF still writes to Core with the fresh aggregate ETag, and on a `412` it re-reads and retries, up to 3 times, as long as `contentVersion` is unchanged.

- **Correctness:** CRC-32 plus size over every non-conversation path detects any content change a user can make through this app.
- **Integrity:** a malicious collision only lets a user overwrite their own project.
- **Re-upload:** the save still re-uploads conversation entries, because `uploadProjectFolder` replaces the whole version. That is why each retry rebuilds the `FormData` from the fresh snapshot: a retry must carry the newer conversation bytes, not the stale ones.

**Alternatives:**
- Switch the edit to per-file `PUT`/`DELETE` of `PROJECT.md` and the context files. Rejected: it reverses the user's earlier "one atomic write" decision, and a save could fail half-way.
- Keep the ETag check and let the UI auto-retry on `409`. Rejected: the BFF cannot tell a chat write from a real edit without `contentVersion`.

### D5. Project context: only the `x-project-id` header

A project chat's model calls differ from a top-level chat's by one header, `x-project-id`, and nothing else. The project id is parsed from the conversation locator (`buildProjectHeadersForPath`), so there is no extra preparation step and no Core read before the model call. The deployment resolves the project's instructions and context files from the header itself.

The adapters gain one optional input: extra headers in `stream`, as an options bag appended after the existing positional parameters. `buildProjectIdHeaders` follows `buildConversationIdHeaders`, and the value goes through `encodeHeaderValue`, as `X-CONVERSATION-ID` does.

**Header name and semantics** (`x-project-id` = project id) are the user's decision, as is sending nothing besides it.

**Alternatives:**
- Lead the system message with the `PROJECT.md` instructions and attach the `context/` files to the first user message. Implemented first and then removed by the user's decision: an application that uses its own system prompt rejects a `system` message (`role 'system' is not accepted by this application`), and the deployment owns how the project context is applied.
- Have the BFF inline the text of the context files. Rejected by the user in favour of Core-granted access.
- Copy the context files into the conversation's attachments. Rejected: it duplicates storage and goes stale.

### D6. BFF placement: a projects controller over conversation services

`ProjectConversationsController` lives in `apps/chat-api/src/projects/conversations/`. `ProjectsModule` imports `ConversationModule`, which now exports `ConversationService`. `ProjectConversationStore` lives in `conversations/persistence/` and depends only on the global `DialClientService` and the pure `projects/utils/*` helpers, so `ConversationModule` never imports `ProjectsModule` and there is no cycle and no `forwardRef`.

**Authorization:**

| Endpoint group | Who may call it |
| --- | --- |
| Every route | Authenticated session, `PROJECTS_ENABLED` (`FeatureGuard` + `@RequireFeature(FeatureKey.ProjectsEnabled)`) |
| Reads (list, get) | Anyone Core lets read the project (the owner, share recipients, organization) |
| Writes and completions | The owner only: the project bucket is the session bucket, checked before any Core call (matches `canEdit`) |

**Completions.** They mirror the conversation controller's `completions`, `stop` and `attach` under the project base path, so the app's `createChatStreamApi({ completionsBasePath })` works unchanged. The body `path` is the stripped locator, which keeps the registry key unique and identical across the three calls.

### D7. Frontend seam: ConversationDataSourceContext

`ConversationPage` reads load, save, title watch, routing, read-only and list side effects from one context value. The regular value wraps today's calls one to one, and the project value wraps the project endpoints.

- This is the only change to the main chat page. It is mechanical: the direct calls move behind the data source.
- The existing page tests are the regression guard.

**Alternatives:**
- Fork `ConversationPage` into a `ProjectConversationPage`. Rejected: over 1,000 lines duplicated, with drift guaranteed.
- Pass the data source as a prop. Rejected: `ConversationPage` is rendered by the router and also reached by nested hooks. A context avoids prop drilling, and the default provider keeps every current mount unchanged.

### D8. UI composition: a lib list, an app section and an embedded composer

- **Lib.** `libs/projects` gains `ProjectView.mainContent` and a presentational `ProjectConversationList`. Rows, strings and callbacks come from the app, so no REST path, flag, i18n or router enters the lib.
- **App.** `ProjectConversationsSection` composes `NewConversationComposer` (`ComposerLayout.Embedded`) and the list. Neither the composer nor the list moves into a lib: the composer depends on app contexts.
- **Chat page.** `ProjectChatPage` adds a breadcrumb bar and reuses `ConversationPage` through the D7 context.

### D9. Publish and delete messaging

- **Publish.** It keeps Core's whole-project semantics. The panel's `renderSummary` adds a warning `Notification` when `conversationCount > 0`, with no `libs/publish-panel` change.
- **Delete.** The confirmation body switches to a pluralised "chats will be deleted too".
- **Source of the count.** Both read `conversationCount` from `GET /api/v1/projects/:id`, which the snapshot already has for free.

### D10. Reusable project hooks and components live in the libs

So another host can build the Projects pages, project logic lives in the libs and `apps/chat` keeps only host wiring:

- **`@epam/ai-dial-chat-hooks/project`** (a new entry point, like `./scheduled-tasks`): `createProjectsApiClient(projectsApi)` composes the project and project-conversation requests over the host's configured generated client; `useProjects`, `useProject`, `useCreateProject`, `useSaveProject`, `useProjectConversations` and `useProjectActions` take that client first; the DTO mappers, the context-file limit helpers and `getProjectFormError` are pure exports. `useProjectActions` reports failures as `ProjectActionError` and delegates pins, file saving, notifications and navigation to host handlers.
- **`@epam/ai-dial-projects`** gains `ProjectConversationsPanel` (a composer slot, the Chats list, and the rename and delete dialogs with focus return) and `ProjectChatHeader` (the chat breadcrumb bar; routing through `projectHref` and `onProjectLinkClick`).
- **Boundary.** `chat-hooks` now imports `@epam/ai-dial-projects` types, enums and pure functions (an optional peer), the same edge it already has to the other feature libs; lint already allows it, and `AGENTS.md` and `docs/architecture.md` list it.
- **App.** Its project hooks are one-line adapters over an app client object that resolves the `server-api` functions at call time, so the existing app specs keep mocking `server-api`. `NewConversationComposer`, the project `ConversationDataSourceContext` value, the publish container, the file-manager picker and the `*Labels` hooks stay in the app: they depend on app contexts or i18n.

The host guide is `docs/projects-reuse.md`.

## Risks / Trade-offs

- **[Core write cost]** Every conversation write copies the whole project version server-side. → Writes are two per foreground reply and a handful per background reply. The cost is bounded by Core's 64 MiB project cap. It is recorded as a follow-up for Core (a cheaper per-file write for complex resources).
- **[Deployment support]** The project context reaches the model only if the deployment reads `x-project-id`. A deployment that ignores it answers without the project's instructions and files. → Before merge, verify against a dev Core with a project-aware deployment. The BFF change is inert for top-level chats.
- **[Project growth]** Chats grow the project archive. The view's snapshot read (64 MiB cap, 4 concurrent) and the edit's re-upload grow with it, and a project full of chats can reach `413 project-too-large` on view. → Conversation entries are never inflated on view. Conversation writes surface `project-storage-full`. A later change can move the view off the archive once Core exposes sizes in metadata.
- **[Rename and delete races]** Renaming the project moves its chats. An open project chat then fails its next save (`404`) and exits to the project, and an in-flight background generation loses its terminal write. → This is documented. It matches the existing "move takes no ETag" trade-off.
- **[Stale titles]** There is no watch, so the auto-generated title appears after a re-read rather than live. Another tab does not see new messages live. → `watchTitle` re-reads with backoff. Live sync is a non-goal.
- **[Privacy on publish]** Publishing exposes chats. → A warning is shown (user decision). Blocking or stripping chats was rejected.
- **[ConversationPage refactor]** It touches the main chat page. → Slice it first, with no behaviour change, verified by the unchanged existing tests before any project code lands.
- **[Generation key collision]** A regular conversation in a folder named exactly like a bucket id could share a stripped path with a project chat. → This is accepted as practically impossible. The project path always begins with the owner's bucket id.

## Migration Plan

1. **BFF first.**
   - Locator utilities and `ProjectConversationStore`.
   - Persistence routing.
   - `contentVersion` and the snapshot classification, with `PUT`/`DELETE` switched to it.
   - Endpoints.
   - Project context in the adapters.
2. **App.**
   - The `ConversationDataSourceContext` refactor, with no behaviour change.
   - The project data source and the route.
   - `ProjectView.mainContent` and `ProjectConversationList`.
   - The section, then the publish and delete messaging.
3. **Ship together.** The app and BFF ship in one release, because `If-Match` now carries `contentVersion`. An old app against a new BFF would get `409` on edit, so they are not deployed separately.
4. **Rollback.**
   - Turning `PROJECTS_ENABLED` off hides everything.
   - A code revert leaves `conversations/` files inside projects, inert in `otherEntries` and carried through edits verbatim.
   - Reverting the app and BFF together restores ETag-based edits.

## Open Questions

- **Header value and attachment URL.** Core forwards the header as is. Which value form does the deployment expect: raw `projects/{bucket}/{path}`, or URL-encoded by `encodeHeaderValue` for non-Latin-1 names? And which attachment URL form does it resolve? Verify against a dev Core.
- **`If-Match: *` on file writes — resolved (task 1.2).** Read in the local `ai-dial-core` checkout: `ComplexResourceController.putFile` / `deleteFile` take `ProxyUtil.etag(request)`, which is `EtagHeader.fromHeader(If-Match, If-None-Match, method)`. `parseIfMatch` maps both `*` and an absent header to "no tag set", so `validateIfMatch` accepts any aggregate ETag. `copyOnWrite` then calls `etag.validate(current.getEtag())` on the project marker, after it has already answered `404` for a missing project, so the "Resource must exist" branch for a present `If-Match` with no ETag is unreachable there. An absent `If-None-Match` parses to an empty set and never fails. So `If-Match: *` on `PUT` and `DELETE …/files/{filePath}` means "any version of an existing project", and unconditional writes keep `If-Match: *`.
- **Rate endpoint.** Does `POST /api/v1/rate` accept a project locator as `conversationId`? It is used only as `X-CONVERSATION-ID` for analytics. Verify its DTO validation.

## Context

`libs/chat-hooks` (`@epam/ai-dial-chat-hooks`) already holds 9 hooks extracted
under the widened generated-client boundary recorded in
`openspec/changes/archive/…/extract-reusable-chat-hooks/design.md`'s Decision
D6: a hook may depend on `@epam/ai-dial-chat-api-client` types/operations and
on already-published host-agnostic packages
(`@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`, `@epam/ai-dial-quotations`,
`@epam/ai-dial-source-panel`, `@epam/ai-dial-attachment-canvas`); it still
never imports a *configured* client instance, a React context, routing,
auth/session, i18n, or UI-kit rendering. That predecessor change explicitly
deferred the five hooks this change targets as **named second-order
candidates**, in this priority order: `useConversationStream` (highest
value, blocked by 3 contexts), `useConversationHandlers` (depends on
`useConversationStream`'s shape, blocked by `DeploymentsContext` + routing),
`useConversationExport` (blocked by `NotificationContext`/i18n),
`useConversationImport` (same, plus `UserContext`/`ConversationsContext`).
`useAttachmentValidation` was separately recorded as **keep app-owned**
because no consumer was found at the time — two consumers exist today
(`ConversationView.tsx`, `NewConversationComposer.tsx`), so that verdict is
revisited here.

This design was produced from a full read of each target hook's source, its
existing tests, every repo-wide call site, the seven React contexts these
hooks read (`ClientChannelContext`, `GenerationContext`, `OverlayContext`,
`DeploymentsContext`, `UserContext`, `ConversationsContext`,
`NotificationContext`), the relevant `server-api/*` files
(`chat-stream.api.ts`, `conversations.api.ts`, `files.api.ts`, `rate.api.ts`,
`api-error.ts`, `base.ts`, `api-client.ts`), and 21 supporting
utility/model/type files together with every one of their repo-wide
consumers.

## Goals / Non-Goals

**Goals:**

- Publish all five target hooks from `@epam/ai-dial-chat-hooks`, each
  behind a contract that replaces every context read, routing call,
  configured-client import, and i18n/notification call with an injected
  parameter, while keeping `apps/chat`'s observable behavior byte-for-byte
  identical.
- Fix `useAttachmentValidation`'s missing debounce-timer cleanup as an
  explicit, called-out extraction-time correctness fix, not a silent
  behavior change.
- Give `useConversationExport`/`useConversationImport` one shared,
  library-owned job-queue capability instead of two independently
  hand-rolled queues, and make job identity (`label`/`description`) library
  data instead of pre-rendered app translation strings.
- Define a `ConversationStreamTransport` contract for
  `useConversationStream` that never hardcodes a `/api` path, CSRF handling,
  or a `server-api` import, with every optional host capability
  (client-channel, overlay) genuinely optional.
- Split `useConversationHandlers`'s orchestration into composed primitives
  built on the library's own `useAttachmentUpload` and the newly extracted
  `useConversationStream`, rather than publishing one 559-line hook with an
  undifferentiated bag of injected callbacks.
- Resolve, per supporting file, whether it moves whole, splits, or stays
  app-owned with a seam — not just for the five hooks' direct imports, but
  for every other repo-wide consumer of those files (§Audit Matrix,
  dimension 7).
- Correct `libs/chat-hooks/README.md`'s stale "`react` is the library's only
  dependency" claim in the same change.

**Non-Goals:**

- Changing `apps/chat`'s UX, translation strings, or RTL/directional
  behavior — this is extraction, not a product change.
- Extracting the file-manager subsystem, citations, auth/navigation hooks,
  or fixing the `useBreakpoint`/`useIsMobile` inconsistency — all recorded
  as separate, unaffected items by the predecessor change; untouched here.
- Any backend/OpenAPI change. Where a generated-client gap exists (there is
  none found for these five hooks), the transport/adapter stays app-owned
  rather than expanding backend scope.
- Rewriting `apps/chat`'s own error-taxonomy classes
  (`UnauthorizedError`, `ApiRequestError`) or CSRF/session-refresh logic —
  these remain entirely app-owned; the library only ever receives their
  *classification result* through an injected callback.

## Audit Matrix

Each hook is audited against the ten required dimensions. Columns 1–6 are
condensed into "Current shape"; columns 7–10 get their own rows since they
carry the decisions that most affect the public contract.

### 1. `useAttachmentValidation` (78 lines)

| Dimension | Finding |
|---|---|
| 1. Inputs/outputs/state/refs/effects/cleanup | Input: `selectedDeployment: DeploymentItem \| undefined`. Output: `{ inputAttachmentTypes, isAttachmentsAllowed, validateAttachment, fileAccept }`. One ref (`unsupportedTypeTimerRef`), no `useEffect` at all — **the timer is never cleared on unmount**, only replaced on the next call. `validateAttachment` schedules a 100ms-delayed notification, cleared/replaced on every call but not on unmount. |
| 2. Observable behavior + consumers | Debounces a burst of rejected-file notifications into one toast per 100ms window; distinguishes "no types allowed" vs "unsupported type" messaging. Consumers: `ConversationView.tsx:279`, `NewConversationComposer.tsx:183`, both destructuring the same four fields. No dedicated test exists (`NewConversationComposer.spec.tsx` only stubs the hook). |
| 3. React/browser deps | `useCallback`/`useMemo`/`useRef`, `setTimeout`/`clearTimeout`. |
| 4. Host-agnostic DIAL types/ops | `Attachment`, `AttachmentErrorReason` (`@epam/ai-dial-chat-shared`, already a lib dependency). `isMimeTypeAllowed`/`mimeTypesToExtensionLabels` from `@epam/ai-dial-attachment-input` — already an independent, host-agnostic package (not app-owned). |
| 5. App-owned touches | `useTranslation`/`t()` (i18n, hard exclude); `useNotification`/`showErrorNotification` (`NotificationContext`, hard exclude); `DeploymentItem` — the *whole* deployment object is app-shaped, but the hook only ever reads `.inputAttachmentTypes: string[]`. |
| 6. Reusable supporting utils | `mimeTypesToFileAccept` from `apps/chat/src/utils/attachment-types.ts` — pure, host-agnostic aside from typing through `DialFileAcceptType` from `@epam/ai-dial-react-file-manager`. |

- **7. Supporting file disposition**: `attachment-types.ts` has one other
  consumer, `DialFileManagerModal.tsx` (uses `isDialFileAcceptType`,
  unrelated to this hook). **Partial split**: move only
  `mimeTypesToFileAccept` (and its private callees
  `mimeTypesToDialFileAcceptTypes`/`isDialFileAcceptType`) into the library;
  leave `mimeTypesToAttachmentExtensionLabels` and the file's other export
  app-owned in `apps/chat/src/utils/attachment-types.ts` for
  `DialFileManagerModal.tsx`. This introduces a new peer dependency,
  `@epam/ai-dial-react-file-manager`, justified solely by
  `DialFileAcceptType`'s type shape (see Decision D7).
- **8. Library vs app contract**:
  ```ts
  export enum AttachmentValidationErrorReason {
    NoTypesAllowed = 'noTypesAllowed',
    UnsupportedType = 'unsupportedType',
  }
  export interface AttachmentValidationErrorEvent {
    reason: AttachmentValidationErrorReason;
    /** Resolved MIME types the caller currently allows (possibly empty). */
    allowedMimeTypes: string[];
    /** Human-readable extension list (e.g. ".png, .jpg"), already-formatted, non-translated data — not translated text. */
    formats?: string;
  }
  export interface UseAttachmentValidationParams {
    allowedMimeTypes: string[];
    onValidationError?: (event: AttachmentValidationErrorEvent) => void;
    /** Debounce window before firing `onValidationError` for a rejected file. Defaults to `100`. */
    debounceMs?: number;
  }
  export interface UseAttachmentValidationResult {
    inputAttachmentTypes: string[];
    isAttachmentsAllowed: boolean;
    validateAttachment: (attachment: Attachment) => AttachmentErrorReason | undefined;
    fileAccept: string | undefined;
  }
  ```
  `apps/chat` passes `allowedMimeTypes: selectedDeployment?.inputAttachmentTypes ?? []`
  and an `onValidationError` that maps `reason`/`formats` to
  `AttachmentsI18nKeys.*` and calls `showErrorNotification`. `formats` is
  computed inside the hook via `mimeTypesToExtensionLabels` — non-translated,
  purely formatted data (a list of extensions), so it stays in the library
  rather than being recomputed at the app edge from `allowedMimeTypes`.
- **9. Test migration**: no existing dedicated spec to migrate; author a new
  `libs/chat-hooks/src/attachment/useAttachmentValidation/tests/useAttachmentValidation.spec.ts`
  covering: debounce timing and timer replacement; no-types-allowed vs
  unsupported-type reason; unmount clears the pending timer (new coverage —
  see below); stable callback identity across re-renders with unchanged
  props; a prop change (`allowedMimeTypes`) updates `fileAccept`/
  `isAttachmentsAllowed`. Update `NewConversationComposer.spec.tsx`'s mock
  import path.
- **10. Risks**: **compatibility note** — the current hook leaks its timer
  on unmount; the library version adds a `useEffect` cleanup
  (`clearTimeout` on unmount), which is a behavior *improvement*, not a
  regression, but must be called out explicitly since it is not a pure
  mechanical move. Low bundle/SSR risk (browser timer APIs only).

### 2 & 3. `useConversationExport` (465 lines) / `useConversationImport` (508 lines)

Audited together: both are "enqueue a job, run it against a per-job
`AbortController`, retry/dismiss/dismiss-all" state machines sharing the
exact same queue shape (`QueueJob`/`ExportJobStatus` from
`apps/chat/src/models/conversation-queue.ts` /
`apps/chat/src/types/conversation-export.ts`) and the same
`controllersRef`/`retryFnsRef`/`updateJob`/`addJob`/`dismissJob`/`retryJob`/
`dismissAll`/unmount-cleanup skeleton, duplicated verbatim between the two
files today.

| Dimension | Finding |
|---|---|
| 1. Inputs/outputs/state/refs/effects/cleanup | Export: no params, returns `{ jobs, exportSingle, exportAll, dismissJob, retryJob, dismissAll }`. Import: no params, returns `{ jobs, importConversations, dismissJob, retryJob, dismissAll }`. Both: `jobs: QueueJob[]` state, `controllersRef: Map<jobId, AbortController>`, `retryFnsRef: Map<jobId, () => Promise<void>>`, one unmount effect that aborts every live controller. |
| 2. Observable behavior + consumers | Export: single-conversation (with/without attachments) and export-all, JSON v5 envelope or `.dial` ZIP, `ATTACHMENT_CONCURRENCY = 5`, per-conversation-title toasts on partial export-all failure, 401 → silent job-failed (no toast), 404 during export-all → per-title toast + continue, warning toast for skipped attachments. Import: plain JSON or `.dial`/`.zip` archive, `ATTACHMENT_CONFLICT_RETRY_LIMIT = 5` re-allocation retries on 409, pre-fills the upload-folder listing to avoid round-tripping through 409s, forces `llmNamingDone: true` on save, refreshes the conversation list on any success, one job per **file** (not per conversation) with a "All conversations" label for multi-conversation files. Sole consumer of both: `ConversationPanelView.tsx:157-171` (no args). |
| 3. React/browser deps | `useState`/`useCallback`/`useRef`/`useEffect`, `crypto.randomUUID()`, `File`/`FileReader`/`Blob` (import side only). |
| 4. Host-agnostic DIAL types/ops | `ConversationListItemDto`, `ConversationResponseDto`, `ResponseError` (`@epam/ai-dial-chat-api-client`); `Conversation`, `triggerBlobDownload` (`@epam/ai-dial-chat-shared`, already-allowed dependency — the browser-download side effect is *already* a published, host-agnostic utility, not something to re-inject). |
| 5. App-owned touches | `useTranslation`/`useNotification` (i18n + `NotificationContext`, hard excludes — and the source of the "job identity as translated text" issue, see below); `useUser`/`.bucket` (import only); `useConversations().refreshConversations` (import only); `getApiErrorDetails` (app's own W3C-traceparent trace-id extraction); `UnauthorizedError` (app's own class, thrown by the *configured* client's `unauthorizedMiddleware`); `normalizeConversationId` (app's `ROUTES`-aware path stripping, from `constants/routes.ts`); the hand-wrapped `server-api/*.api.ts` functions (`getConversation`, `listConversations`, `saveConversation`, `downloadFile`, `listFiles`, `uploadFile`) — thin, DTO-shaped wrappers over the generated client, now movable per the widened boundary. |
| 6. Reusable supporting utils | `runWithConcurrency` (`utils/async.ts`); `collectAttachmentRefs` (`utils/attachment-refs.ts`); `resolveDialFileBucketAndPath` (`utils/dial-file.ts`, a `files/{bucket}/{path}` protocol-level parser — genuinely DIAL-protocol, unlike its sibling `resolveDialFileDownloadUrl` in the same file, which hardcodes the app's `/api/v1/files/download` BFF route); `buildExportEnvelope`/`serializeExportEnvelope`/`buildExportFileName`/`EXPORT_APP_NAME` (`utils/export-conversation.ts`); `buildDialArchive` (`utils/zip-export.ts`); `parseImportEnvelope`/`rebaseConversationId`/`getFolderBreadcrumb`/`formatQuotedNameList`/`rewriteAttachmentUrls`/`planAttachmentUploads`/`UnsupportedImportFormatError` (`utils/import-conversation.ts`); `parseDialArchive` (`utils/zip-import.ts`); `createUploadPathAllocator` (`utils/build-upload-path.ts`); `formatDateYM`/`formatDateYMD` (`utils/date.ts`); `safeDecodeURIComponent` (`utils/string-utils.ts`). |

- **7. Supporting file disposition**:
  - `models/conversation-queue.ts` (`QueueJob`), `types/conversation-export.ts`
    (`ConversationExportMode`, `ExportFileNameKind`, `ExportJobStatus`): both
    are consumed by `ConversationPanelView.tsx` and `ImportExportQueue.tsx`
    (rendering the job list UI) beyond the two target hooks. Since the
    library redefines the job shape (see contract below), these two app
    components must be updated to consume the new library types — this is
    **not** a like-for-like rename; `QueueJob`/`ExportJobStatus` are retired
    from `apps/chat` entirely once both hooks move. `ConversationExportMode`/
    `ExportFileNameKind` are pure export-format constants with no app
    dependency — **move whole** into the library.
  - `utils/async.ts`, `utils/attachment-refs.ts`, `utils/export-conversation.ts`,
    `utils/zip-export.ts`, `utils/zip-import.ts`, `utils/import-conversation.ts`,
    `utils/build-upload-path.ts`, `utils/date.ts`: each has **no consumer
    outside this transfer capability** except `dial-file.ts`'s
    `isDialFileId` (already a library-owned pure function per the
    predecessor change) and each other (e.g. `import-conversation.ts` →
    `attachment-refs.ts`; `zip-import.ts` → `import-conversation.ts` +
    `zip-export.ts`). **Move whole**, verbatim, with their existing unit
    tests (`tests/attachment-refs.spec.ts` doesn't exist but
    `tests/export-conversation.spec.ts`, `tests/zip-export.spec.ts`,
    `tests/zip-import.spec.ts`, `tests/import-conversation.spec.ts`,
    `tests/build-upload-path.spec.ts` do).
  - `utils/dial-file.ts`: **split**. `resolveDialFileBucketAndPath` is a
    pure `files/{bucket}/{path}` parser (DIAL protocol-level, same class as
    the already-moved `isDialFileId`) — moves into the library. The rest of
    the file (`resolveDialFileDownloadUrl`, which hardcodes
    `/api/v1/files/download`; `resolveDialUrl`, `resolveRelativeDialFilePath`)
    stays app-owned; other consumers
    (`ConversationSourcesPanel.tsx`, `ConversationMessageItem.tsx`,
    `useOpenAttachmentCanvas.ts`) are unaffected.
  - `utils/string-utils.ts`: **split**. Only `safeDecodeURIComponent` (an
    alias of `safeDecodeURI`) is needed here; the file has ~10 unrelated
    consumers for its other exports
    (`sanitizeConversationName`, `formatFileSize`, etc.). Move
    `safeDecodeURIComponent`/`safeDecodeURI` into the library as a small
    exported utility (also needed by `useConversationStream`, see below);
    update every app call site
    (`conversation-path.ts`, `conversation-id-match.ts`,
    `deployment-endpoint-url.ts`, `dial-file-to-attachment.ts`,
    `map-deployment-to-catalog-item.ts`, `map-prompt-to-catalog-item.ts`,
    `ConversationsContext.tsx`, `constants/routes.ts`,
    `ConversationPanelView.tsx`, `ConversationView/utils/message-display.ts`)
    to import it from `@epam/ai-dial-chat-hooks` instead; delete it from
    `string-utils.ts` once every caller is updated.
  - `constants/routes.ts`'s `normalizeConversationId`: stays **app-owned** —
    it depends on the app's own `ROUTES` table, which is routing policy, a
    hard exclude. The library's `toApiConversationPath`-equivalent step
    becomes the app adapter's job: the app passes an already-normalized,
    already-decoded conversation id/path into the hook instead of the hook
    normalizing it itself.
- **8. Library vs app contract**: one shared internal queue primitive, two
  public hooks.
  ```ts
  export enum ConversationTransferJobStatus {
    InProgress = 'inProgress', Success = 'success', Failed = 'failed',
  }
  export enum ConversationTransferSubjectKind { Single = 'single', All = 'all' }
  export type ConversationTransferSubject =
    | { kind: ConversationTransferSubjectKind.Single; title: string; sourceBreadcrumb?: string }
    | { kind: ConversationTransferSubjectKind.All };
  export interface ConversationTransferJob {
    id: string;
    subject: ConversationTransferSubject;
    status: ConversationTransferJobStatus;
  }
  export enum ConversationTransferErrorCode {
    Unauthorized = 'unauthorized', NotFound = 'notFound',
    UnsupportedFormat = 'unsupportedFormat', MissingBucket = 'missingBucket',
    Unknown = 'unknown',
  }
  export interface ConversationTransferErrorEvent {
    jobId: string; code: ConversationTransferErrorCode;
    titles?: string[]; traceId?: string;
  }
  export enum ConversationTransferWarningCode { AttachmentSkipped = 'attachmentSkipped' }
  export interface ConversationTransferWarningEvent {
    jobId: string; code: ConversationTransferWarningCode; names?: string[];
  }
  export interface ConversationTransferSuccessEvent { jobId: string; titles?: string[] }

  export interface UseConversationExportParams {
    conversationsApi: Pick<ConversationsApi, 'getConversation' | 'listConversations'>;
    filesApi: Pick<FilesApi, 'downloadFileRaw'>;
    classifyTransferError?: (error: unknown) => { isUnauthorized?: boolean; isNotFound?: boolean };
    resolveErrorTraceId?: (error: unknown) => Promise<string | undefined>;
    normalizeConversationPath: (conversationId: string) => string; // replaces toApiConversationPath
    onSuccess?: (event: ConversationTransferSuccessEvent) => void;
    onWarning?: (event: ConversationTransferWarningEvent) => void;
    onError?: (event: ConversationTransferErrorEvent) => void;
  }
  export interface UseConversationImportParams {
    conversationsApi: Pick<ConversationsApi, 'saveConversation'>;
    filesApi: Pick<FilesApi, 'listFiles' | 'uploadFile'>;
    bucket: string | undefined;
    onImported?: () => Promise<void> | void; // replaces refreshConversations
    classifyTransferError?: (error: unknown) => { isUnauthorized?: boolean };
    resolveErrorTraceId?: (error: unknown) => Promise<string | undefined>;
    onSuccess?: (event: ConversationTransferSuccessEvent) => void;
    onWarning?: (event: ConversationTransferWarningEvent) => void;
    onError?: (event: ConversationTransferErrorEvent) => void;
  }
  ```
  `apps/chat`'s adapter builds `classifyTransferError` from
  `UnauthorizedError`/`ResponseError` `instanceof` checks (its own error
  taxonomy, unchanged), `resolveErrorTraceId` from `getApiErrorDetails`,
  `normalizeConversationPath` from
  `safeDecodeURIComponent(normalizeConversationId(id))`, and its
  `onSuccess`/`onWarning`/`onError` from
  `ConversationExportI18nKeys`/`ConversationImportI18nKeys` + `showXNotification`
  — rendering `label`/`description` text from `job.subject` (e.g.
  `subject.kind === Single ? subject.title : t(AllConversationsJobLabel)`)
  instead of the library ever holding pre-rendered text. `jobs`, `dismissJob`,
  `retryJob`, `dismissAll` keep their current shapes/semantics unchanged.
  `exportSingle`, `exportAll`, `importConversations` keep their current
  signatures.
- **9. Test migration**: `useConversationExport.spec.ts` (855 lines, 24
  cases) and `useConversationImport.spec.ts` (1028 lines, 27 cases) move
  into the library with their `react-i18next`/`NotificationContext`/
  `ConversationsContext`/`UserContext` mocks replaced by plain fake
  `conversationsApi`/`filesApi` objects and captured `onSuccess`/`onWarning`/
  `onError` calls — the library's own tests assert on emitted event codes,
  not on rendered toast text. `apps/chat` keeps a thin
  `ConversationPanelView`-adapter test verifying the translation-key mapping
  for one representative code per event type. `ImportExportQueue.tsx`'s
  spec updates to the new job/subject shape.
- **10. Risks**: the queue-shape change (`QueueJob`/`ExportJobStatus` →
  `ConversationTransferJob`/`…Status`/`…Subject`) is a breaking change to
  two UI components, not a pure hook-level move — sequenced explicitly in
  the migration plan so `ImportExportQueue.tsx`/`ConversationPanelView.tsx`
  update in the same slice as the hook move, never left on the old shape.
  Cancellation/stale-response semantics (per-job `AbortController`, dismiss
  aborts in-flight requests, unmount aborts every controller) are preserved
  exactly — verified by porting the existing "aborts on unmount"/"aborts
  mid-export/import" test cases unchanged.

### 4. `useConversationStream` (447 lines)

| Dimension | Finding |
|---|---|
| 1. Inputs/outputs/state/refs/effects/cleanup | Params: `{ conversationId, setConversation, conversationRef, onStopError? }`. Returns `{ startStream, handleStop, resumeIfAwaitingGeneration, isStreaming, canStopStreaming }`. State: `streamingPaths: Set<string>`, `stoppablePath: string \| null`. Refs: `activeGenerationIdRef`, `activeGenerationPathRef`, `resumingPathsRef`, `stoppedGenerationIdsRef`, `displayedConversationIdRef` (synced via one `useEffect`). No unmount abort by design — an in-flight generation is intentionally owned by `GenerationContext`, not aborted when this hook's component unmounts (documented in-code; navigation must not cancel a live stream). |
| 2. Observable behavior + consumers | Per-path streaming-state tracking so concurrent generations across conversations don't interfere; stale-chunk rejection by generation id; "not the currently displayed conversation" guard on chunk/complete/error; on complete, reloads the full persisted conversation via `getConversation` (never trusts the locally-accumulated stream); on stop, only signals the backend and lets `onComplete`'s reload pick up the saved partial (never reloads eagerly, to avoid racing the backend save); `resumeIfAwaitingGeneration` detects a hard-refresh-mid-generation state, marks the path streaming, opens a `watchConversation` SSE-like stream, and polls until an `UPDATE` event or a 5-minute timeout, then does one final `getConversation` check regardless of outcome. Consumers: `Conversation.tsx:256-267` (uses all 5 return fields), `AppPreviewChat.tsx:141-147` (uses only 4 — never destructures `resumeIfAwaitingGeneration`). |
| 3. React/browser deps | `useState`/`useCallback`/`useEffect`/`useRef`, `crypto.randomUUID()`, `AbortController`, `ReadableStream`/`TextDecoder`, `window.setTimeout`. |
| 4. Host-agnostic DIAL types/ops | `SendCompletionDtoModeEnum` (`@epam/ai-dial-chat-api-client`, type-only); `Conversation`/`MessageCustomContent` (`@epam/ai-dial-chat-shared`). |
| 5. App-owned touches | `useClientChannel()` (`ClientChannelContext` — `channelId`/`ensureConnected`); `useGeneration()` (`GenerationContext` — `startGeneration`/`completeGeneration`); `useOptionalOverlay()` (`OverlayContext` — `notifyGenerationStart`/`notifyGenerationEnd`/`notifyStopGenerating`); `streamCompletion`/`stopCompletion` (`server-api/chat-stream.api.ts` — raw `fetch` to `/api/v1/conversations/completions[/stop]` with CSRF-header handling and rotation, hard-excluded transport detail); `getConversation`/`watchConversation` (`server-api/conversations.api.ts` — generated-client wrappers, now movable). |
| 6. Reusable supporting utils | `applyChunkToMessages` (`utils/apply-chunk.ts`); `getConversationPath` (`utils/conversation-path.ts`); `isAwaitingGenerationResume` (`utils/generation-resume.ts`); `safeDecodeURIComponent` (`utils/string-utils.ts`, already being moved for the transfer capability above). |

- **7. Supporting file disposition**:
  - `utils/apply-chunk.ts`: no consumer outside this hook besides its own
    test — **move whole**, along with `tests/apply-chunk.spec.ts`. Depends
    on `@epam/ai-dial-quotations` (already an allowed lib dependency).
  - `utils/conversation-path.ts`: single-purpose file, but consumed by 8
    other app files (`ConversationsContext.tsx`, `ConversationPanelView.tsx`,
    `useActiveConversationBridge.ts`, `useConversationListBridge.ts`,
    `ConversationRoute.tsx`, `Conversation.tsx`, `AppPreviewChat.tsx`, plus
    its own test) beyond the two target hooks that use it
    (`useConversationStream.ts`, `useConversationHandlers.ts`). **Move
    whole** — it is genuinely a single pure function
    (`id.split('/').slice(1).join('/')` + decode) with no app dependency —
    but every one of those 8 call sites must switch its import to
    `@epam/ai-dial-chat-hooks` in the same slice; the app original is
    deleted, not duplicated.
  - `utils/generation-resume.ts`: single-purpose file, one extra direct
    consumer, `Conversation.tsx` (checks `isAwaitingGenerationResume` before
    calling `resumeIfAwaitingGeneration`). **Move whole**, update that one
    extra import.
- **8. Library vs app contract**:
  ```ts
  export interface ConversationStreamTransport {
    streamCompletion(
      path: string, message: string | undefined, model: string,
      options: { onChunk: (chunk: StreamChunk) => void; onComplete: () => void | Promise<void>; onError: (error: Error) => void; signal: AbortSignal },
      customContent?: MessageCustomContent, generationId?: string,
      mode?: SendCompletionDtoModeEnum, messageIndex?: number, clientChannelId?: string,
    ): void;
    stopCompletion(params: { generationId: string; path: string }): Promise<void>;
    watchConversation(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    getConversation(conversationId: string, signal?: AbortSignal): Promise<Conversation>;
  }
  export interface ConversationGenerationLifecycle {
    startGeneration: (path: string, generationId: string) => AbortController;
    completeGeneration: (path: string, generationId: string) => void;
  }
  export interface ConversationStreamChannel {
    channelId: string | null;
    ensureConnected: () => void;
  }
  export interface ConversationStreamOverlayNotifier {
    notifyGenerationStart?: () => void;
    notifyGenerationEnd?: () => void;
    notifyStopGenerating?: () => void;
  }
  export interface ConversationStateAccessor {
    setConversation: Dispatch<SetStateAction<Conversation | null>>;
    conversationRef: MutableRefObject<Conversation | null>;
  }
  export interface UseConversationStreamParams {
    conversationId: string | undefined;
    state: ConversationStateAccessor;
    transport: ConversationStreamTransport;
    generation: ConversationGenerationLifecycle;
    channel?: ConversationStreamChannel;
    overlay?: ConversationStreamOverlayNotifier;
    onStopError?: (error: Error) => void;
  }
  ```
  `apps/chat`'s adapter builds `transport` from `chat-stream.api.ts` +
  `conversations.api.ts` (unchanged app-owned fetch/CSRF/SSE-parsing logic —
  `parseSSELine`'s inner logic stays inside this app transport, since it is
  inseparable from the fetch/CSRF flow that produces the lines it parses),
  `generation` from `useGeneration()`, `channel` from `useClientChannel()`
  (always provided today, but the param stays optional for a consumer
  without live-chat interaction), and `overlay` from `useOptionalOverlay()`
  (already optional today via `useOptionalOverlay`). `state` is a single
  grouped param instead of two loose ones, but keeps exactly the current
  `setConversation`+`conversationRef` pair — see Decision D9 for why a
  library-owned internal ref was rejected.
- **9. Test migration**: `useConversationStream.spec.ts` (1125 lines, 24
  cases across the base suite, `resumeIfAwaitingGeneration` (8 cases), and
  overlay-mode generation-lifecycle events (5 cases)) moves into the
  library with its `ClientChannelContext`/`chat-stream.api`/
  `conversations.api` mocks replaced by fake `transport`/`channel`/
  `generation`/`overlay` objects passed directly as params — the real
  `GenerationProvider`/`OverlayProvider` wrappers are no longer needed since
  the hook takes their *values*, not the contexts themselves. `apps/chat`
  keeps a thin test only for the transport adapter's SSE-parsing/CSRF
  behavior (already effectively covered by `chat-stream.api.ts`'s own
  tests, if any exist — verify during implementation).
- **10. Risks**: `resumeIfAwaitingGeneration` and `startStream` both close
  over the exact same `isPathDisplayed`/`streamingPaths` state as
  `handleStop`/`canStopStreaming` — the ordering and mutual exclusion
  guarantees (only one path can be "stoppable" at a time; a resumed
  generation is *not* stoppable, per the existing "does not call
  `stopCompletion` for a resumed generation without a local generation id"
  test) must be preserved exactly; the ported test suite is the primary
  guard. `AbortController` semantics stay entirely inside the app-owned
  `GenerationContext` (unchanged) — the library never aborts a generation
  on its own unmount, matching current behavior.

### 5. `useConversationHandlers` (559 lines)

| Dimension | Finding |
|---|---|
| 1. Inputs/outputs/state/refs/effects/cleanup | Params: `conversation`, `conversationId`, `bucket`, `isStreaming`, `startStream`, `conversationRef`, `setConversation`, `navigate`, `showNetworkError?`, `toolConfigurationValue?`, `fixedModelId?`. Returns 16 fields: 8 handlers (`handleSend`, `handleRegenerateMessage`, `handleDeleteMessage`, `handleConfirmDelete`, `handleRateMessage`, `handleButtonSelect`, `handleConfirmStarter`, `handleStartEdit`/`handleCancelEdit`/`handleEditMessage`), `handleUploadAttachment` (from the library's own `useAttachmentUpload`), and 5 pieces of local UI state (`editingMessageIndexes`, `pendingDeleteIndex`/setter, `pendingStarterContext`/setter). No effects/cleanup — all state is plain `useState`. |
| 2. Observable behavior + consumers | Optimistic user+assistant message-pair insertion before every `startStream` call (send/regenerate/starter/edit); regenerate truncates at the assistant message, edit truncates one message earlier (both via `mode`/`serverMessageIndex` already handled inside `useConversationStream`); delete removes a user+following-assistant pair (or single message), and deletes the whole conversation + navigates to `ROUTES.Root` when that empties it to nothing (or to a lone status message); rate is optimistic with revert-on-failure for both the `rateMessage` API call and the follow-up `saveConversation`; starter submission optionally gates behind a confirmation dialog (`pendingStarterContext`) driven by `starter['dial:widgetOptions'].confirmationMessage`; every send-shaped call folds `toolConfigurationValue` into `custom_content.configuration_value` when any toggle is active. Consumers: `Conversation.tsx:458-486` (uses all 16 fields, real `navigate`, no `fixedModelId`), `AppPreviewChat.tsx:245-269` (uses 12 of 16 — omits `handleButtonSelect`/`handleConfirmStarter`/`pendingStarterContext`/its setter — passes a stubbed `navigate` that only implements `navigate(ROUTES.Root)`, and `fixedModelId` instead of `toolConfigurationValue`). |
| 3. React/browser deps | `useState`/`useCallback`, `crypto.randomUUID()`. |
| 4. Host-agnostic DIAL types/ops | `ConversationResponseDto`, `SendCompletionDtoModeEnum` (`@epam/ai-dial-chat-api-client`); `Attachment`, `Conversation`, `DisplayAttachment`, `MessageCustomContent`, `MessageRating`, `MessageRole`, `StarterOption` (`@epam/ai-dial-chat-shared`); already imports the library's own `useAttachmentUpload` from `@epam/ai-dial-chat-hooks`. |
| 5. App-owned touches | `useDeployments().selectedItemId` (`DeploymentsContext`); `filesApi` (configured-client singleton from `server-api/api-client.ts` — passed into `useAttachmentUpload`, which already expects an injected instance); `saveConversation`/`deleteConversation` (`server-api/conversations.api.ts`); `rateMessage` (`server-api/rate.api.ts`); `NavigateFunction`/`ROUTES.Root` (`react-router`, app routing); `NETWORK_ERROR_DEBOUNCE_MS` (app constant, trivially a value, not a policy). |
| 6. Reusable supporting utils | `attachmentsToDtos` (`utils/attachment-to-dto.ts`); `getConversationPath` (already moving, see §4); `createMessagePair` (`utils/message-factory.ts`); `hasActiveToolConfig`/`isMessageChanged` (`utils/message-utils.ts`); `getStarterSubmitText` (`utils/starter-option.ts`). |

- **7. Supporting file disposition**:
  - `utils/attachment-to-dto.ts`: single-purpose file (`attachmentToDto`/
    `attachmentsToDtos`), but consumed elsewhere too —
    `ConversationRoute.tsx`, `AppPreviewChat.tsx` (directly, not just
    through the handlers hook) plus their tests. **Move whole**; update
    those two extra app call sites' imports.
  - `utils/message-factory.ts`: two exports, only `createMessagePair` is
    needed here — `createDeploymentChangedMessage` is used only by
    `useDeploymentChangeEffect.ts`, an unrelated hook. **Partial split**:
    move `createMessagePair` (and its `MessagePair` return shape) into the
    library; leave `createDeploymentChangedMessage` app-owned in the
    original file.
  - `utils/message-utils.ts`: a general message-utility file with 7
    exports; only `hasActiveToolConfig` and `isMessageChanged` are needed
    here, and `isMessageChanged` has one other direct consumer,
    `ConversationView.tsx:79`. **Partial split**: move
    `hasActiveToolConfig`/`isMessageChanged` into the library; leave
    `isMessageStreaming`, `getLastDeploymentId`, `messageHasStages`,
    `hasActiveToolConfig`'s siblings, and `normalizeResponseFormat`
    app-owned; update `ConversationView.tsx`'s import of `isMessageChanged`
    to the library.
  - `utils/starter-option.ts`: 4 exports; `getStarterSubmitText` (needed
    here) internally calls `getStarterConversationText` (lines 36–47
    depend on lines 19–30) — both must move together. `getStarterPopulateText`
    and `getStartersFromSchema` have other consumers
    (`AppPreviewChat.tsx`, `ConversationRoute.tsx`,
    `ConversationView/utils/message-display.ts`) and stay app-owned.
    **Partial split**: move `getStarterConversationText`/
    `getStarterSubmitText`; leave the rest.
- **8. Library vs app contract**: rather than one hook taking the entire
  16-field bag, split by concern, composed under a compatibility facade
  that still returns the same 16 fields (Decision D8 explains why the
  facade shape is kept, not the internal split):
  ```ts
  export interface UseConversationHandlersParams {
    conversation: Conversation | null;
    conversationId: string | undefined;
    bucket: string | undefined;
    isStreaming: boolean;
    startStream: ConversationStreamStarter; // the exact fn shape useConversationStream.startStream already has
    state: ConversationStateAccessor; // shared with useConversationStream — see D9
    filesApi: Pick<FilesApi, 'uploadFile'>;
    conversationsApi: Pick<ConversationsApi, 'saveConversation' | 'deleteConversation'>;
    rateApi: Pick<RateApi, 'rateMessage'>;
    resolveModelId: () => string; // replaces useDeployments().selectedItemId ?? conversation.model.id / fixedModelId
    onConversationDeleted?: () => void; // replaces navigate(ROUTES.Root)
    showNetworkError?: (filenames: string[]) => void;
    toolConfigurationValue?: Record<string, boolean>;
  }
  ```
  `resolveModelId` folds the current three-way precedence
  (`fixedModelId ?? contextSelectedItemId ?? conversation.model.id`) into a
  single app-supplied function, since that precedence policy is itself
  app-owned (which deployment context/fixed-model convention applies).
  `onConversationDeleted` replaces the `navigate`/`ROUTES.Root` coupling
  with a semantic outcome callback — `apps/chat`'s adapter calls
  `navigate(ROUTES.Root)` inside it; `AppPreviewChat`'s adapter calls its
  existing stub. All 16 returned fields keep their current names/shapes.
- **9. Test migration**: `useConversationHandlers.spec.ts` (465 lines, 20
  cases) and the dedicated `handleRateMessage.spec.ts` (227 lines, 8 cases)
  move into the library with `DeploymentsContext`/`api-client`/
  `conversations.api`/`rate.api` mocks replaced by fake
  `conversationsApi`/`filesApi`/`rateApi`/`resolveModelId` params.
  `apps/chat` keeps a thin adapter test verifying `resolveModelId`'s
  precedence and that `onConversationDeleted` calls `navigate(ROUTES.Root)`.
- **10. Risks**: `AppPreviewChat.tsx`'s use of a stubbed `navigate` cast to
  `NavigateFunction` disappears entirely once `onConversationDeleted`
  replaces it — a strict improvement (removes a type-unsafe cast) but must
  be verified against `AppPreviewChat.spec.tsx`'s existing mock shape in
  the same slice. `resolveModelId` must be re-derived, not cached, on every
  call (deployment selection can change between sends) — same requirement
  the current `selectedItemId` variable already satisfies by being
  recomputed on every render.

## Decisions

**D1 — Sequence as four ordered slices inside one OpenSpec change, not
separate changes.** Each hook's contract depends on the previous slice's
contract already existing:
`useAttachmentValidation` (independent) →
`useConversationExport`/`useConversationImport` (independent of streaming,
share one queue primitive) →
`useConversationStream` (needed by handlers) →
`useConversationHandlers` (composes `useConversationStream` +
`useAttachmentUpload`). Splitting into separate OpenSpec changes would let a
later slice redesign a contract an earlier, already-merged slice depends
on — the proposal explicitly requires fixing all four contracts now to
avoid that. One change, four gated slices, matches the repo's per-slice
verification default.

**D2 — Job identity in the transfer capability is structured data, never
pre-rendered translated text.** The current `exportAll`/multi-conversation
`importConversations` jobs use `t(...AllConversationsJobLabel)` as the
literal `label` string stored in `QueueJob` — i.e., translated text used as
data. `ConversationTransferSubject`'s discriminated union
(`Single { title, sourceBreadcrumb? } | All`) replaces this: `title` and
`sourceBreadcrumb` are already non-translated domain data (a conversation's
own name, a folder path), so only the "All conversations" case needed
fixing.

**D3 — Three narrow success/warning/error callbacks, not one generic
`notify(event)`.** Compared against a single polymorphic `notify` callback
that the host would `switch` on a `kind` field. Rejected: it would force
every consumer to re-derive which of `NotificationContext`'s three toast
variants (success/warning/error) an event maps to, duplicating a switch the
library already knows the answer to by construction (a call to `onError`
always means an error toast). Three separate optional callbacks mirror
`NotificationContext`'s own `showSuccessNotification`/
`showWarningNotification`/`showErrorNotification` trio, so the app adapter
is a direct 1:1 forwarding, not a re-classification.

**D4 — `useConversationExport`/`useConversationImport` share one internal
queue primitive, exported publicly only as the two existing hook names.**
The proposal allows re-evaluating the "keep two entry points" default if an
alternatives analysis favors otherwise; it does not here — `apps/chat`'s
only consumer (`ConversationPanelView.tsx`) already calls both
independently and displays their jobs in one shared list
(`ImportExportQueue.tsx`), so a single merged hook would only need to be
immediately destructured back into export/import halves at the call site.
The shared logic (`addJob`/`updateJob`/`dismissJob`/`retryJob`/`dismissAll`/
unmount-abort) is extracted into a private, non-exported
`useConversationTransferQueue<TSubject>` used by both public hooks — this
is where the duplication that exists today between the two 465/508-line
files actually gets removed.

**D5 — The generated-client boundary widens further to accept
`ConversationsApi`/`FilesApi` operation shapes directly in
`useConversationExport`/`useConversationImport`/`useConversationHandlers`,
following the same D6 precedent already applied to `useAttachmentUpload`/
`useShareLink`.** No new kind of exception is introduced — this is the same
narrow seam, applied to three more generated-client operations
(`getConversation`, `listConversations`, `saveConversation`,
`deleteConversation`, `downloadFileRaw`, `listFiles`, `uploadFile`,
`rateMessage`, `watchConversationRaw`). The *configured* client instance,
its middleware (CSRF rotation, 401 handling, telemetry), and its base path
stay app-owned exactly as before.

**D6 — `ConversationStreamTransport`'s SSE-line parsing stays inside the
app-owned transport implementation, not as an exported library utility.**
Compared against exporting a `parseSSELine`-equivalent as a library utility
that any host's transport could reuse. Rejected for this change: the
current `parseSSELine` is pure in isolation, but it is only ever invoked
from inside `streamCompletion`'s own fetch-and-read loop, which already
owns the CSRF-rotation and `AbortError`-swallowing behavior around it —
splitting it out now would create a library API surface with exactly one
real caller and no test coverage independent of that caller. If a second
DIAL-Core-backed consumer needs the same SSE-decoding logic before its own
transport is written, promoting it to an exported utility is a small,
additive follow-up; inlining it into `ConversationStreamTransport`'s single
implementation today keeps this change's diff reviewable.

**D7 — `useAttachmentValidation`'s move introduces
`@epam/ai-dial-react-file-manager` as a new peer dependency, justified
narrowly.** `mimeTypesToFileAccept`'s only host-agnostic-boundary-relevant
dependency is `DialFileAcceptType`, a type from that package used purely
for a MIME-to-file-manager-accept-type mapping — not UI-kit rendering, not
app policy. Declared in `libs/chat-hooks/package.json`'s
`peerDependencies` and added to `vite.config.mts`'s `rollupOptions.external`
in the same commit (per the bundle-size risk the predecessor change already
hit once with `@epam/ai-dial-share`).

**D8 — `useConversationHandlers` keeps its current 16-field return shape
as a compatibility facade, with the *internals* split by concern
(send/regenerate/edit vs. delete vs. rate vs. starter), not published as
four separate public hooks.** Compared against (a) one hook taking an
injected-dependency bag (rejected — this is what the predecessor change
explicitly declined to do mechanically) and (c) a higher-level
`useConversationController` composed from streaming+handlers primitives
(deferred — nothing in `apps/chat` needs a controller-level API today, and
inventing one without a second consumer to validate it against risks
guessing wrong). Internally, `handleSend`/`handleRegenerateMessage`/
`handleEditMessage`/`submitStarter`/`handleButtonSelect`/
`handleConfirmStarter` share the message-pair-and-stream-start pattern and
are grouped in one internal module; `handleDeleteMessage`/
`handleConfirmDelete` and `handleRateMessage` are each small enough to stay
inline. The public hook composes these and re-exposes exactly today's 16
fields, so both existing consumers (`Conversation.tsx`, `AppPreviewChat.tsx`)
port with a parameter-shape change only, no call-site restructuring.

**D9 — `useConversationStream` and `useConversationHandlers` keep sharing
the current `setConversation`+`conversationRef` pair (grouped as
`ConversationStateAccessor`), not a library-owned internal ref.** Compared
against (a) a library-owned latest-value ref private to
`useConversationStream` and (b) a small conversation-state adapter object
with its own get/set methods. Both are rejected because
`useConversationHandlers` mutates the *same* displayed-conversation state
directly (optimistic message-pair insertion, delete, rate revert) in
lockstep with `useConversationStream`'s chunk/complete/error handlers — if
each hook owned its own private mirror, the two would diverge the moment
one updates without the other observing it. The shared pair must remain a
single external channel both hooks write through; naming it
`ConversationStateAccessor` only groups the existing two values into one
typed parameter, without changing their semantics.

## Risks / Trade-offs

- **[Risk]** The transfer-capability's job-shape change
  (`QueueJob`/`ExportJobStatus` → `ConversationTransferJob`/…) is a
  breaking change to `ImportExportQueue.tsx` and `ConversationPanelView.tsx`,
  not a pure hook-internal move. → **Mitigation**: sequenced as one slice
  that updates the hook and both consuming components together (see
  Migration Plan); no intermediate commit leaves them on mismatched shapes.
- **[Risk]** Moving `getConversationPath`/`safeDecodeURIComponent` requires
  updating 8+ and 10+ app call sites respectively that have nothing to do
  with these five hooks. → **Mitigation**: each is a single, already
  independently testable pure function; the update is a mechanical import-path
  change verified by `nx affected --target=test,lint,build`, not a logic
  change, and is called out as its own migration step rather than folded
  silently into a hook's slice.
- **[Risk]** `useConversationStream`'s `ConversationStreamTransport` could
  quietly re-absorb a host-specific detail (e.g. a special-cased error
  shape) if a future change adds transport logic without re-reading this
  design. → **Mitigation**: the interface's four methods are typed against
  only `Conversation`/`StreamChunk`/`ReadableStream`/`AbortSignal` — no
  `Response`, no header name, no path string appears in the interface
  itself, only inside the app-owned implementation.
- **[Risk]** `useConversationHandlers`'s internal split (D8) could drift
  from the public facade if a future change adds a new handler only
  internally without threading it through the facade's return type. →
  **Mitigation**: the facade's return type is declared once, explicitly
  listing all 16 fields, so a missing field is a TypeScript error, not a
  silent gap.
- **[Risk]** Every new peer dependency (`@epam/ai-dial-react-file-manager`
  for D7) must be added to both `package.json`'s `peerDependencies` and
  `vite.config.mts`'s `rollupOptions.external` in the same commit, or the
  bundle silently inlines its whole dependency tree (observed concretely in
  the predecessor change: ~7kB → ~2MB from one missed `external` entry). →
  **Mitigation**: task list requires printing/comparing the built bundle
  size after every slice, not just a green build.
- **[Risk]** `useAttachmentValidation`'s added unmount cleanup is a real,
  if minor, behavior change (a timer that used to leak now doesn't fire a
  stale notification after unmount). → **Mitigation**: called out
  explicitly in the proposal and this design as an intentional
  extraction-time correctness fix, not silently bundled into "move as-is."

## Migration Plan

1. **Slice 1 — `useAttachmentValidation`.** Add to the library with the
   `AttachmentValidationErrorEvent`/`onValidationError` contract, the
   unmount-cleanup fix, and new unit tests. Move `mimeTypesToFileAccept`
   (partial split per §1.7) into the library; add
   `@epam/ai-dial-react-file-manager` to `peerDependencies`/`external`
   (D7). Update `ConversationView.tsx`/`NewConversationComposer.tsx` to the
   new params/event shape and translation mapping. Delete the app
   original. Verify:
   `npm exec nx build ai-dial-chat-hooks && npm exec nx test ai-dial-chat-hooks`,
   `npm exec nx affected --target=test,lint,build --base=origin/development`.
2. **Slice 2 — conversation transfer (`useConversationExport` +
   `useConversationImport`).** Add the shared internal
   `useConversationTransferQueue`, both public hooks, and the moved
   supporting utils (§2&3.7) to the library in one commit. Update
   `ConversationPanelView.tsx` and `ImportExportQueue.tsx` to the new
   `ConversationTransferJob`/`…Subject`/event-code shapes in the *same*
   commit (D1/first risk). Move the two hooks' existing 855+1028-line specs
   into the library with fake-client fixtures; add the thin app-adapter
   translation-mapping test. Delete the app originals
   (`useConversationExport.ts`, `useConversationImport.ts`, and every moved
   util). Same verification commands.
3. **Slice 3 — `useConversationStream`.** Add
   `ConversationStreamTransport`/`ConversationGenerationLifecycle`/
   `ConversationStreamChannel`/`ConversationStreamOverlayNotifier`/
   `ConversationStateAccessor` and the hook to the library; move
   `applyChunkToMessages`/`getConversationPath`/`isAwaitingGenerationResume`/
   `safeDecodeURIComponent` (§4.7, `safeDecodeURIComponent` shared with
   slice 2's already-moved copy if slice 2 ran first — otherwise moved
   here). Update every one of `getConversationPath`'s/
   `safeDecodeURIComponent`'s other app call sites in this same commit.
   Build the app-owned transport implementation wrapping
   `chat-stream.api.ts`/`conversations.api.ts` (SSE parsing stays inside
   it, D6). Update `Conversation.tsx`/`AppPreviewChat.tsx` to construct and
   pass `transport`/`generation`/`channel`/`overlay`/`state`. Move the
   1125-line spec with fake transport/channel/generation/overlay params.
   Delete the app original. Same verification commands.
4. **Slice 4 — `useConversationHandlers`.** Add the hook (internally split
   per D8) to the library, consuming the library's own `useAttachmentUpload`
   and slice 3's `useConversationStream` contract shape for `startStream`/
   `state`. Move `attachmentsToDtos`, `createMessagePair` (partial split),
   `hasActiveToolConfig`/`isMessageChanged` (partial split, update
   `ConversationView.tsx`'s `isMessageChanged` import),
   `getStarterConversationText`/`getStarterSubmitText` (partial split).
   Update `Conversation.tsx`/`AppPreviewChat.tsx` to supply
   `resolveModelId`/`onConversationDeleted`/injected API interfaces instead
   of `DeploymentsContext`/`navigate`/`filesApi` singleton/`conversations.api`/
   `rate.api` imports. Move the 465+227-line specs. Delete the app
   original. Same verification commands.
5. **Every slice**: update `libs/chat-hooks/README.md` with the new hook's
   subsection (pattern: existing hooks' subsections) in the same commit,
   and print the built bundle size to confirm no accidental inlining.
6. **In slice 1** (the first slice touching `libs/chat-hooks/README.md`),
   also correct the stale "`react` is the library's only dependency" line
   to reflect the already-existing peer-dependency list.
7. **Rollback**: each slice is an independent commit; reverting a slice
   restores the deleted `apps/chat/src/hooks/*`/`utils/*` files and their
   call-site imports. Slice ordering has real dependencies (3 needs 1's
   shared-util precedent if run first; 4 needs 3's `ConversationStreamTransport`/
   `ConversationStateAccessor` types), so reverting slice 3 or earlier
   requires reverting slice 4 with it; slices 1 and 2 are independent of
   each other and of 3/4.

## Open Questions

- Whether `chat-stream.api.ts` has (or should gain) its own dedicated test
  file for the SSE-parsing/CSRF-rotation logic that stays app-owned inside
  slice 3's transport implementation — flagged in §4.9 as "verify during
  implementation," not blocking this design.
- Whether `hasActiveToolConfig` (moved in slice 4) has any consumer beyond
  `useConversationHandlers.ts` that the supporting-file audit did not
  surface — verify with a repo-wide grep at slice-4 implementation time
  before deleting the app original.
- Exact placement of the newly-moved single-purpose files inside
  `libs/chat-hooks/src/` (e.g. whether `applyChunkToMessages` gets its own
  folder or lives alongside `useConversationStream`) is left to
  implementation, following the existing `src/<concern>/<useHookName>/`
  convention.

# @epam/ai-dial-chat-hooks

Framework-level React hooks extracted from AI DIAL Chat, published so teams building custom chat interfaces on top of the AI DIAL backend can reuse proven chat-UI behavior without depending on the full AI DIAL Chat application.

## Overview

`@epam/ai-dial-chat-hooks` is a headless hooks library: every hook here solves a piece of chat-interface UI mechanics (scrolling, streaming, anchoring, attachment upload/validation — more hooks will be added over time) using only React, standard browser APIs, and a narrow set of already-published, host-agnostic DIAL packages (the generated `@epam/ai-dial-chat-api-client` and its DTOs, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-attachment-input`, and others listed under Peer Dependencies below). It never depends on AI DIAL Chat's React contexts, a _configured_ REST client instance, i18n, or routing, and never renders a UI-kit component — every hook that needs to call DIAL Core accepts an already-configured generated-client instance as a parameter instead of importing or constructing one itself. A few hooks do import non-component symbols from `@epam/ai-dial-ui-kit` (enums such as `NotificationVariant`, constants such as `NOT_ALLOWED_SYMBOLS`, types such as `TabModel`) to describe values the host renders — that is a data/type dependency, not a rendering one. This means a consumer can drop a hook from this package into a completely different chat UI, wire its returned refs/callbacks and injected client instances onto their own app, and get the same tuned, edge-case-tested behavior AI DIAL Chat ships with, without adopting anything else from this repository.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-hooks": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.2.6
- `@epam/ai-dial-attachment-canvas` \*
- `@epam/ai-dial-attachment-input` \*
- `@epam/ai-dial-chat-api-client` \*
- `@epam/ai-dial-chat-shared` \*
- `@epam/ai-dial-quotations` \*
- `@epam/ai-dial-react-file-manager` \*
- `@epam/ai-dial-share` \*
- `@epam/ai-dial-source-panel` \*
- `@epam/ai-dial-ui-kit` \*
- `ag-grid-community` ^35.3.0
- `fflate` ^0.8.3

## Hooks

### useUsageData

Fetches a user's rolling cost and token usage stats from DIAL Core. The hook accepts the fetch function as a parameter — the host supplies an already-configured API call; the hook owns only the request lifecycle (in-flight state, cancellation on unmount, `enabled` guard).

```tsx
import { useUsageData } from '@epam/ai-dial-chat-hooks';
import { getUserUsage } from './server-api/user-limits'; // host-owned configured call

const { usage, isLoading, usageError } = useUsageData(getUserUsage, isEnabled);
```

#### API

**Parameters**:

| Name           | Type                                       | Description                                                                                    |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `getUserUsage` | `() => Promise<UserLimitStatsResponseDto>` | Host-configured fetch function — the hook never constructs or imports a client itself.         |
| `enabled`      | `boolean`                                  | When `false`, the fetch is skipped and `isLoading` is immediately `false`. Defaults to `true`. |

**Returns** (`UseUsageDataResult`):

| Name         | Type                                     | Description                                      |
| ------------ | ---------------------------------------- | ------------------------------------------------ |
| `usage`      | `UserLimitStatsResponseDto \| undefined` | The fetched stats, or `undefined` while loading. |
| `isLoading`  | `boolean`                                | `true` while the fetch is in flight.             |
| `usageError` | `Error \| undefined`                     | Set when the `getUserUsage` call rejects.        |

### useConversationScroll

Owns chat message-list autoscroll: anchors a newly sent or regenerated turn near the top of the viewport, holds scroll position steady while a response streams in (using a temporary, imperatively-sized spacer element — not user-visible content), shows a "scroll to bottom" affordance once the user scrolls away from the latest content, and returns to the bottom on request.

The hook is generic over the message type: it only ever reads `messages.length` to detect growth or a conversation switch, so it works with any array of message-like objects.

```tsx
import { useConversationScroll } from '@epam/ai-dial-chat-hooks';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatMessageList = ({
  messages,
  isAssistantTyping,
  conversationId,
}: {
  messages: Message[];
  isAssistantTyping: boolean;
  conversationId: string;
}) => {
  const {
    containerRef,
    contentRef,
    spacerRef,
    setMessageRef,
    isScrollButtonVisible,
    scrollToBottom,
    armAnchor,
  } = useConversationScroll({ messages, isAssistantTyping, conversationId });

  // Call `armAnchor(messages.length - 1)` right before sending/regenerating
  // so the resulting message anchors near the top of the viewport.

  return (
    <div ref={containerRef} className="overflow-y-auto">
      <div ref={contentRef}>
        {messages.map((message, index) => (
          <div key={index} ref={(el) => setMessageRef(index, el)}>
            {message.content}
          </div>
        ))}
      </div>
      {/* Technical scroll room, not user-visible content — must render with an
          initial height of 0; the hook sets its height imperatively. */}
      <div ref={spacerRef} style={{ height: 0 }} className="shrink-0" />
      {isScrollButtonVisible && (
        <button onClick={scrollToBottom}>Scroll to bottom</button>
      )}
    </div>
  );
};
```

#### API

**Parameters** (`UseConversationScrollParams<T>`):

| Name                | Type      | Description                                                       |
| ------------------- | --------- | ----------------------------------------------------------------- |
| `messages`          | `T[]`     | Messages currently rendered in the list (only `.length` is read). |
| `isAssistantTyping` | `boolean` | Whether an assistant response is currently streaming in.          |
| `conversationId`    | `string`  | Identifier of the conversation being displayed.                   |

**Returns** (`UseConversationScrollResult`):

| Name                    | Type                                                  | Description                                                                                      |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `containerRef`          | `RefObject<HTMLDivElement \| null>`                   | Attach to the scrollable message-list element.                                                   |
| `contentRef`            | `RefObject<HTMLDivElement \| null>`                   | Attach to the element wrapping all rendered messages.                                            |
| `spacerRef`             | `RefObject<HTMLDivElement \| null>`                   | Attach to a spacer sibling rendered right after `contentRef`; render with `height: 0` initially. |
| `setMessageRef`         | `(index: number, el: HTMLDivElement \| null) => void` | Callback ref to register/unregister a rendered message's DOM node by index.                      |
| `isScrollButtonVisible` | `boolean`                                             | Whether the scroll-to-bottom button should be shown.                                             |
| `scrollToBottom`        | `() => void`                                          | Smoothly scrolls to the current bottom of the message content.                                   |
| `armAnchor`             | `(index: number) => void`                             | Arms the message at `index` to scroll near the viewport top on the next render.                  |

`armAnchor` is opt-in — a consumer that never calls it gets plain bottom-follow behavior with no spacer reservation.

### usePageFileDrag

Detects files being dragged over the whole page (using `document`-level drag events with an enter/leave counter to avoid flicker from child-element boundary crossings) and exposes the dropped files once dropped.

```tsx
import { usePageFileDrag } from '@epam/ai-dial-chat-hooks';

const ComposerWithFileDrop = ({
  isAttachmentsAllowed,
}: {
  isAttachmentsAllowed: boolean;
}) => {
  const { isDragging, pendingFiles, onFilesConsumed } =
    usePageFileDrag(isAttachmentsAllowed);

  useEffect(() => {
    if (pendingFiles.length === 0) return;
    // handle pendingFiles...
    onFilesConsumed();
  }, [pendingFiles, onFilesConsumed]);

  return isDragging ? <div>Drop files to attach</div> : null;
};
```

#### API

**Parameters**:

| Name                   | Type      | Description                                                    |
| ---------------------- | --------- | -------------------------------------------------------------- |
| `isAttachmentsAllowed` | `boolean` | Whether dropped files should be collected. Defaults to `true`. |
| `isEnabled`            | `boolean` | Whether drag detection is active at all. Defaults to `true`.   |

**Returns** (`UsePageFileDragResult`):

| Name              | Type         | Description                                                   |
| ----------------- | ------------ | ------------------------------------------------------------- |
| `isDragging`      | `boolean`    | Whether a file drag is currently over the page.               |
| `pendingFiles`    | `File[]`     | Files dropped on the page, pending consumption by the caller. |
| `onFilesConsumed` | `() => void` | Clears `pendingFiles` after the caller has processed them.    |

### useViewportWidth / usePanelMaxWidth

`useViewportWidth` tracks `window.innerWidth`, updating on the browser `resize` event. `usePanelMaxWidth` derives the maximum pixel width a resizable side panel may occupy without collapsing the main content area below a caller-supplied minimum.

```tsx
import { usePanelMaxWidth } from '@epam/ai-dial-chat-hooks';

const MIN_CONTENT_AREA_WIDTH = 400;

const ResizableSidePanel = () => {
  const maxPanelWidth = usePanelMaxWidth(MIN_CONTENT_AREA_WIDTH);
  return <aside style={{ maxWidth: maxPanelWidth }}>...</aside>;
};
```

#### API

**`useViewportWidth()`** returns `number` — the current `window.innerWidth`.

**`usePanelMaxWidth(minContentAreaWidth: number)`** returns `number` — `Math.max(0, viewportWidth - minContentAreaWidth)`.

| Name                  | Type     | Description                                                                   |
| --------------------- | -------- | ----------------------------------------------------------------------------- |
| `minContentAreaWidth` | `number` | Minimum pixel width the main content area must retain when the panel is open. |

### useShareLink

Resolves and manages share-link data for a DIAL Core resource: loading/error state, a stale-response guard, and re-fetch when the requested access levels change. Accepts an already-configured `ShareApi` instance from `@epam/ai-dial-chat-api-client` — the hook owns only the request lifecycle, not the client's base URL, auth, or CSRF setup.

```tsx
import { useShareLink } from '@epam/ai-dial-chat-hooks';
import { ShareLinkAccess } from '@epam/ai-dial-share';

const ShareLinkPanel = ({
  shareApi,
  itemId,
}: {
  shareApi: ShareApi;
  itemId: string;
}) => {
  const { data, isLoading, error, setAccess } = useShareLink(shareApi, itemId);

  return (
    <div>
      {isLoading && <span>Creating link...</span>}
      {data && <input readOnly value={data.url} />}
      <button onClick={() => setAccess([ShareLinkAccess.Edit])}>
        Allow editing
      </button>
    </div>
  );
};
```

#### API

**Parameters**: `useShareLink(shareApi, itemId, resourceKind?, origin?)`

| Name           | Type                                 | Description                                                                    |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `shareApi`     | `Pick<ShareApi, 'createShareLink'>`  | Already-configured generated-client instance.                                  |
| `itemId`       | `string`                             | Identifier of the resource being shared.                                       |
| `resourceKind` | `CreateShareLinkDtoResourceKindEnum` | Optional; required only for resources whose ids need backend qualification.    |
| `origin`       | `string`                             | Origin the returned link is anchored to. Defaults to `window.location.origin`. |

**Returns** (`UseShareLinkResult`): `{ data, isLoading, error, setAccess }` — `data` is `ShareLinkData | undefined`, `setAccess` takes a `ShareLinkAccess[]` and triggers a re-fetch.

### useToolsMenu

Derives the tools submenu from the active deployment's configuration schema: every boolean-typed property becomes a toggle, labelled by its schema `title` (falling back to a humanized property key). Manages toggle state, resets on deployment change, and exposes a stable `toolConfigurationValue` record for inclusion in completion requests. Headless: the host supplies the tool icon via `toolIcon`.

```tsx
import {
  type UseToolsMenuParams,
  useToolsMenu,
} from '@epam/ai-dial-chat-hooks';

const ToolsMenu = ({ params }: { params: UseToolsMenuParams }) => {
  const { toolsMenuItems, onToolToggle, toolConfigurationValue } =
    useToolsMenu(params);

  // Render `toolsMenuItems` with the host's own menu component; the hook is
  // headless and ships no UI. `toolConfigurationValue` is meant to be merged
  // into the completion request payload, not rendered directly.
  return (
    <ul>
      {toolsMenuItems.map((tool) => (
        <li key={tool.id}>
          <button
            aria-pressed={tool.isSelected}
            onClick={() => onToolToggle(tool.id)}
          >
            {tool.icon}
            {tool.label}
          </button>
        </li>
      ))}
    </ul>
  );
};
```

#### API

**Parameters**: `useToolsMenu(params: UseToolsMenuParams)`

| Name                              | Type                                    | Description                                                                    |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `selectedItemId`                  | `string \| null`                        | Selected deployment id; changing it resets toggle state to the schema default. |
| `selectedDeploymentConfiguration` | `DeploymentConfigurationSchema \| null` | JSON-schema for the selected deployment; `null` yields an empty menu.          |
| `toolIcon`                        | `ReactNode`                             | Icon element rendered on every tool item. Defaults to `null`.                  |

**Returns** (`UseToolsMenuResult`): `{ toolsMenuItems: ToolMenuItem[], onToolToggle, toolConfigurationValue: Record<string, boolean>, restoreToolConfiguration }` — `restoreToolConfiguration` re-applies a persisted tool-config record (e.g. from the last user message) on conversation load.

### useShareRecipientsCount

Resolves how many users hold shared access to a resource, one resource at a time and only when asked — a deduplicated, per-resource lazy lookup cache. Accepts an already-configured `ShareApi` instance.

```tsx
import { useShareRecipientsCount } from '@epam/ai-dial-chat-hooks';

const RevokeAccessMenuItem = ({
  shareApi,
  itemId,
}: {
  shareApi: ShareApi;
  itemId: string;
}) => {
  const { requestRecipientsCount, getRecipientsCount } =
    useShareRecipientsCount(shareApi);
  const { status, count } = getRecipientsCount(itemId);

  return (
    <button onMouseEnter={() => requestRecipientsCount(itemId)}>
      Revoke access {count != null ? `(${count})` : ''}
    </button>
  );
};
```

#### API

**Parameters**: `useShareRecipientsCount(shareApi: Pick<ShareApi, 'getShareRecipientsCount'>)`

**Returns** (`UseShareRecipientsCountResult`):

| Name                        | Type                                       | Description                                                           |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `requestRecipientsCount`    | `(itemId: string) => void`                 | Starts a lookup for the resource unless one already ran for it.       |
| `getRecipientsCount`        | `(itemId: string) => RecipientsCountEntry` | Current lookup state for the resource (`{ status, count? }`).         |
| `invalidateRecipientsCount` | `(itemId: string) => void`                 | Drops the resource's cached result so the next request fetches again. |

`RecipientsCountEntry.status` is a `RecipientsCountStatus` of `Idle` / `Loading` / `Resolved` / `Unknown` (`Unknown` on a failed lookup, so a "Revoke access" action stays reachable without a number).

### useAttachmentUpload

Uploads an attachment's file to DIAL Core storage against an already-configured `FilesApi` instance, coalescing a burst of offline/network upload failures into a single debounced callback rather than firing one notification per failed file.

```tsx
import { useAttachmentUpload } from '@epam/ai-dial-chat-hooks';

const Composer = ({
  filesApi,
  bucket,
}: {
  filesApi: FilesApi;
  bucket: string;
}) => {
  const { handleUploadAttachment } = useAttachmentUpload({
    filesApi,
    bucket,
    onNetworkError: (fileNames) =>
      showToast(`Failed to upload: ${fileNames.join(', ')}`),
  });

  return (
    <input
      type="file"
      onChange={(e) => handleUploadAttachment(toAttachment(e.target.files![0]))}
    />
  );
};
```

#### API

**Parameters** (`UseAttachmentUploadParams`):

| Name             | Type                            | Description                                                                   |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `filesApi`       | `Pick<FilesApi, 'uploadFile'>`  | Already-configured generated-client instance.                                 |
| `bucket`         | `string \| undefined`           | DIAL Core bucket the file is uploaded into.                                   |
| `onNetworkError` | `(fileNames: string[]) => void` | Called once per debounce window with all filenames that failed while offline. |
| `debounceMs`     | `number`                        | Debounce window for coalescing offline-failure batches. Defaults to `700`.    |

**Returns** (`UseAttachmentUploadResult`): `{ handleUploadAttachment: (attachment: Attachment) => Promise<string> }` — resolves to the uploaded file's DIAL Core URL; rejects with an `Error` tagged `errorReason: AttachmentErrorReason.Network` when offline.

### useConversationExport / useConversationImport

A shared conversation-transfer capability: `useConversationExport` downloads one or all conversations as a JSON (`.json`) or `.dial`/`.zip` archive; `useConversationImport` parses a selected file and re-persists its conversations, re-uploading any archive attachments and rewriting their references. Both share the same job-queue semantics — `jobs`, `cancelJob`, `dismissJob`, `retryJob`, `dismissAll` — and report determinate per-job progress plus outcomes through structured, translation-free `onSuccess`/`onWarning`/`onError` callbacks instead of calling a notification system themselves. A transfer that delivers its file but skips some attachments settles at `Warning` carrying a `warningCode`, so a partial result is distinguishable from a clean one without reading the event stream. Job identity is always structured data (`ConversationTransferSubject`), never pre-rendered text. `cancelJob` and `dismissJob` differ: both abort the job's in-flight requests, but `cancelJob` leaves the job in `jobs` with status `Canceled` so the UI can keep showing it, while `dismissJob` removes it.

```tsx
import { ConversationTransferErrorCode } from '@epam/ai-dial-chat-shared';
import {
  ConversationExportMode,
  useConversationExport,
  useConversationImport,
} from '@epam/ai-dial-chat-hooks';

const ExportButton = ({
  conversationsApi,
  filesApi,
}: {
  conversationsApi: ConversationsApi;
  filesApi: FilesApi;
}) => {
  const { jobs, exportSingle, dismissJob, retryJob } = useConversationExport({
    conversationsApi,
    filesApi,
    normalizeConversationPath: (id) => id,
    onSuccess: (event) => showToast(`Exported ${event.titles?.join(', ')}`),
    onError: (event) => {
      if (event.code !== ConversationTransferErrorCode.Unauthorized)
        showToast('Export failed');
    },
  });

  return (
    <button
      onClick={() =>
        exportSingle(
          'bucket/conv-id',
          'My Chat',
          ConversationExportMode.WithAttachments,
        )
      }
    >
      Export
    </button>
  );
};
```

#### API

**Parameters** (`UseConversationExportParams`):

| Name                        | Type                                                                     | Description                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversationsApi`          | `Pick<ConversationsApi, 'getConversation' \| 'listConversations'>`       | Already-configured generated-client instance.                                                                                                                                       |
| `filesApi`                  | `Pick<FilesApi, 'downloadFileRaw'>`                                      | Already-configured generated-client instance.                                                                                                                                       |
| `normalizeConversationPath` | `(conversationId: string) => string`                                     | Resolves a conversation id to the bucket-qualified path `getConversation` expects.                                                                                                  |
| `classifyTransferError`     | `(error: unknown) => { isUnauthorized?: boolean; isNotFound?: boolean }` | Host-owned error classification. Defaults to `{}` (never unauthorized/not-found).                                                                                                   |
| `resolveErrorTraceId`       | `(error: unknown) => Promise<string \| undefined>`                       | Resolves a trace id for a failing request. Defaults to resolving `undefined`.                                                                                                       |
| `maxArchiveBytes`           | `number`                                                                 | Ceiling on the summed byte length of an export's attachments; a larger export fails with `FileTooLarge` instead of being zipped. Defaults to `DEFAULT_MAX_ARCHIVE_BYTES` (512 MiB). |
| `onSuccess`                 | `(event: ConversationTransferSuccessEvent) => void`                      | Called when a job completes successfully.                                                                                                                                           |
| `onWarning`                 | `(event: ConversationTransferWarningEvent) => void`                      | Called when a job delivers its file but had to skip something (e.g. an attachment). The job settles at `Warning`, not `Success`.                                                                                                          |
| `onError`                   | `(event: ConversationTransferErrorEvent) => void`                        | Called when a job fails.                                                                                                                                                            |

**Returns** (`UseConversationExportResult`): `{ jobs, exportSingle(conversationId, title, mode), exportAll(), cancelJob(jobId), dismissJob(jobId), retryJob(jobId), dismissAll() }`.

**Parameters** (`UseConversationImportParams`): `conversationsApi: Pick<ConversationsApi, 'saveConversation'>`, `filesApi: Pick<FilesApi, 'listFiles' | 'uploadFile'>`, `bucket: string | undefined` (import fails with `MissingBucket` when absent), `onImported?: () => Promise<void> | void` (called after at least one conversation imports successfully), plus the same `classifyTransferError`/`resolveErrorTraceId`/`onSuccess`/`onWarning`/`onError` shape as export.

**Returns** (`UseConversationImportResult`): `{ jobs, importConversations(file), cancelJob(jobId), dismissJob(jobId), retryJob(jobId), dismissAll() }`.

`ConversationTransferJob`, `ConversationTransferSubject`, `ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferProgress`, `ConversationTransferUnitKind` and `ConversationTransferErrorCode` are owned and exported by `@epam/ai-dial-chat-shared` — import them from there, not from this package. `ConversationTransferJob` is `{ id: string; subject: ConversationTransferSubject; status: ConversationTransferJobStatus; fileName: string; progress: ConversationTransferProgress; errorCode?: ConversationTransferErrorCode }`, where `ConversationTransferSubject` is `{ kind: Single; title: string; sourceBreadcrumb?: string } | { kind: All }`. Render a row from `fileName` and translate `errorCode` at the call site — never from a library-owned string. `ConversationTransferErrorEvent`/`WarningEvent`/`SuccessEvent` carry a `jobId`, a library-owned code (`ConversationTransferErrorCode`/`WarningCode`), and structured facts (`titles`, `names`, `traceId`) — never translated text.

`progress.percent` is an integer 0–100 that never decreases for a given job id: phase weights are fixed per transfer kind, so discovering how many attachments a job has subdivides the work still to do instead of moving the indicator backwards. `progress.units` describes only the phase currently advancing, and is intended for `aria-valuetext` rather than visible text.

Also exports `DEFAULT_MAX_ARCHIVE_BYTES`, `EXPORT_APP_NAME` and `formatQuotedNameList` (the constants and standalone functions the hooks are built on) for hosts that tune the export size limit or render their own export file names or name lists outside the hooks' own notifications.

### useConversationStream

Owns completion-streaming state — per-conversation-path streaming/stoppable tracking, cross-navigation live-message buffering, stale-chunk rejection, reload-after-complete, and hard-refresh resume detection — driven entirely through an injected `ConversationStreamTransport`. The library never hardcodes an `/api` path, CSRF handling, or a `server-api` import; the host implements the transport against its own BFF/generated-client calls.

```tsx
import {
  useConversationStream,
  type ConversationStreamTransport,
} from '@epam/ai-dial-chat-hooks';

const ChatPage = ({
  transport,
  generation,
}: {
  transport: ConversationStreamTransport;
  generation: {
    startGeneration: (path: string, id: string) => AbortController;
    completeGeneration: (path: string, id: string) => void;
  };
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const conversationRef = useRef<Conversation | null>(conversation);

  const { startStream, handleStop, isStreaming, canStopStreaming } =
    useConversationStream({
      conversationId: conversation?.id,
      state: { setConversation, conversationRef },
      transport,
      generation,
    });

  return (
    <button onClick={() => startStream(conversation!.id, 'Hi', 1, 'gpt-4o')}>
      Send
    </button>
  );
};
```

#### API

**Parameters** (`UseConversationStreamParams`):

| Name             | Type                                | Description                                                                                   |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `conversationId` | `string \| undefined`               | The currently displayed conversation's id.                                                    |
| `state`          | `ConversationStateAccessor`         | `{ setConversation, conversationRef }` — the shared mutable channel for displayed state.      |
| `transport`      | `ConversationStreamTransport`       | Host-owned completion/stop/watch/reload implementation.                                       |
| `generation`     | `ConversationGenerationLifecycle`   | `{ startGeneration, completeGeneration }` — host-owned cross-navigation generation ownership. |
| `channel`        | `ConversationStreamChannel`         | Optional. `{ channelId, ensureConnected, waitForChannel }` for tool-signin delivery.          |
| `overlay`        | `ConversationStreamOverlayNotifier` | Optional. `{ notifyGenerationStart?, notifyGenerationEnd?, notifyStopGenerating? }`.          |
| `onStopError`    | `(error: Error) => void`            | Called when the transport's `stopCompletion` rejects.                                         |

`ConversationStreamTransport` has four methods the host implements: `streamCompletion(path, message, model, options, customContent?, generationId?, mode?, messageIndex?, clientChannelId?)`, `stopCompletion({ generationId, path })`, `watchConversation(path, signal)`, and `getConversation(conversationId, signal?)`.

**Returns** (`UseConversationStreamResult`): `{ startStream, handleStop, resumeIfAwaitingGeneration, restoreBufferedGeneration, isStreaming, canStopStreaming }`. `restoreBufferedGeneration(conversationId, conversation)` reapplies the full in-memory assistant message accumulated by an active stream when the host reloads that conversation during navigation; this includes text and merged `custom_content.stages` received before and while the conversation was hidden. `resumeIfAwaitingGeneration(conversationId, conversation)` detects a hard-refresh-mid-generation conversation and watches for its resolution.

Also exports the standalone `getConversationPath` (strips a conversation id's bucket segment and decodes it) and `isAwaitingGenerationResume` (the placeholder-detection predicate the hook is built on) for hosts that need the same checks outside the hook.

### useConversationHandlers

Composes send/regenerate/edit/delete/rate/starter-submission orchestration for a displayed conversation on top of the library's own `useAttachmentUpload` and the injected `startStream` (the `useConversationStream` result). Optimistic message-pair insertion, delete confirmation, and rate revert-on-failure mutate the same `ConversationStateAccessor` channel passed to `useConversationStream`, so the two hooks stay in lockstep.

```tsx
import {
  useConversationHandlers,
  useConversationStream,
} from '@epam/ai-dial-chat-hooks';

const ChatPage = ({
  conversationsApi,
  filesApi,
  rateApi,
}: {
  conversationsApi: Pick<
    ConversationsApi,
    'saveConversation' | 'deleteConversation'
  >;
  filesApi: Pick<FilesApi, 'uploadFile'>;
  rateApi: Pick<RateApi, 'rateMessage'>;
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const conversationRef = useRef<Conversation | null>(conversation);
  const state = { setConversation, conversationRef };

  const { startStream, isStreaming } = useConversationStream({
    conversationId: conversation?.id,
    state,
    transport,
    generation,
  });

  const { handleSend, handleRateMessage } = useConversationHandlers({
    conversation,
    conversationId: conversation?.id,
    bucket: 'my-bucket',
    isStreaming,
    startStream,
    state,
    filesApi,
    conversationsApi,
    rateApi,
    resolveModelId: () => conversation?.model.id ?? '',
    onConversationDeleted: () => navigate('/'),
  });

  return <button onClick={() => handleSend('Hi', [])}>Send</button>;
};
```

#### API

**Parameters** (`UseConversationHandlersParams`):

| Name                     | Type                                                                 | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `conversation`           | `Conversation \| null`                                               | The currently displayed conversation.                                                        |
| `conversationId`         | `string \| undefined`                                                | The currently displayed conversation's id.                                                   |
| `bucket`                 | `string \| undefined`                                                | Passed through to the internal `useAttachmentUpload`.                                        |
| `isStreaming`            | `boolean`                                                            | The `isStreaming` value returned by `useConversationStream` — gates regenerate/delete/edit.  |
| `startStream`            | `ConversationStreamStarter`                                          | The `startStream` function returned by `useConversationStream`.                              |
| `state`                  | `ConversationStateAccessor`                                          | `{ setConversation, conversationRef }` — the same channel passed to `useConversationStream`. |
| `filesApi`               | `Pick<FilesApi, 'uploadFile'>`                                       | Already-configured generated-client instance used to upload attachments.                     |
| `conversationsApi`       | `Pick<ConversationsApi, 'saveConversation' \| 'deleteConversation'>` | Already-configured generated-client instance used to save/delete the conversation.           |
| `rateApi`                | `Pick<RateApi, 'rateMessage'>`                                       | Already-configured generated-client instance used to rate a message.                         |
| `resolveModelId`         | `() => string`                                                       | Resolves the model id to send with the next completion. Re-evaluated on every call.          |
| `onConversationDeleted`  | `() => void`                                                         | Optional. Called when deleting the last message also deletes the whole conversation.         |
| `showNetworkError`       | `(filenames: string[]) => void`                                      | Optional. Called with batched filenames after a burst of network-error upload failures.      |
| `toolConfigurationValue` | `Record<string, boolean>`                                            | Optional. Tool toggle configuration values merged into every outgoing completion request.    |

**Returns** (`UseConversationHandlersResult`): `{ handleSend, handleUploadAttachment, handleRegenerateMessage, handleDeleteMessage, handleConfirmDelete, handleRateMessage, handleButtonSelect, handleConfirmStarter, handleStartEdit, handleCancelEdit, handleEditMessage, editingMessageIndexes, pendingDeleteIndex, setPendingDeleteIndex, pendingStarterContext, setPendingStarterContext }`.

Also exports the standalone `attachmentsToDtos`/`attachmentToDto`, `createMessagePair`, `hasActiveToolConfig`/`isMessageChanged`, and `getStarterConversationText`/`getStarterSubmitText` (the pure functions the hook is built on) for hosts that need the same logic outside the hook.

### useAttachmentValidation

Validates an attachment's content type against a resolved list of allowed MIME types, debouncing a burst of rejected files into a single structured `onValidationError` report instead of firing one per file. Reports rejections through a library-owned reason and interpolation-ready facts — never translated text — so the host maps them to its own copy and notification UI.

```tsx
import {
  AttachmentValidationErrorReason,
  useAttachmentValidation,
} from '@epam/ai-dial-chat-hooks';

const Composer = ({ allowedMimeTypes }: { allowedMimeTypes: string[] }) => {
  const { isAttachmentsAllowed, fileAccept, validateAttachment } =
    useAttachmentValidation({
      allowedMimeTypes,
      onValidationError: ({ reason, formats }) => {
        const noTypesAllowed =
          reason === AttachmentValidationErrorReason.NoTypesAllowed;
        showToast(
          noTypesAllowed
            ? 'Attachments are not allowed'
            : `Unsupported file type. Allowed: ${formats}`,
        );
      },
    });

  return (
    <input type="file" accept={fileAccept} disabled={!isAttachmentsAllowed} />
  );
};
```

#### API

**Parameters** (`UseAttachmentValidationParams`):

| Name                | Type                                              | Description                                                               |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `allowedMimeTypes`  | `string[]`                                        | Resolved MIME types currently allowed for attachments.                    |
| `onValidationError` | `(event: AttachmentValidationErrorEvent) => void` | Called at most once per debounce window when a rejected file is reported. |
| `debounceMs`        | `number`                                          | Debounce window before firing `onValidationError`. Defaults to `100`.     |

`AttachmentValidationErrorEvent` is `{ reason: AttachmentValidationErrorReason; allowedMimeTypes: string[]; formats?: string }`, where `reason` is `NoTypesAllowed` or `UnsupportedType` and `formats` (present only for `UnsupportedType`) is an already-formatted, non-translated extension list (e.g. `".png, .jpg"`).

**Returns** (`UseAttachmentValidationResult`): `{ inputAttachmentTypes: string[], isAttachmentsAllowed: boolean, validateAttachment: (attachment: Attachment) => AttachmentErrorReason | undefined, fileAccept: string | undefined }`.

### useConversationSources

Derives, via a pure `useMemo` computation, a deduplicated list of a conversation's uploaded/generated attachments and its quotation sources from a message list.

```tsx
import { useConversationSources } from '@epam/ai-dial-chat-hooks';

const SourcesPanel = ({ messages }: { messages: Message[] }) => {
  const { uploaded, generated, sources } = useConversationSources(messages, {
    resolvePreviewUrl: (dto) => resolveMyIconUrl(dto.url),
    resolvePlayUrl: (dto) => dto.url && resolveMyFileDownloadUrl(dto.url),
  });
  return <div>{/* render uploaded/generated/sources */}</div>;
};
```

#### API

**Parameters**: `useConversationSources(messages: Message[], resolvers?: AttachmentDisplayResolvers)` — `resolvers` (from `@epam/ai-dial-chat-shared`) resolves preview/play URLs for attachments; omit it to use the attachment's own `url`.

**Returns** (`UseConversationSourcesResult`): `{ uploaded: DisplayAttachment[], generated: DisplayAttachment[], sources: QuotationSource[] }`.

### useChatSettingsFormConfig

Assembles the config object a chat-settings popover/modal consumes: feature flags derived from deployment features, the current `responseFormat`/`systemPrompt`/`temperature` values, the save handler, and the form labels. Works in two modes — `'local'` (an in-flight composer that holds values in state) and `'conversation'` (a persisted `Conversation` patched on save). Headless: the host supplies translated labels via `labels` and a save toast via `onSaved`.

```tsx
import {
  type ChatSettingsFormLabels,
  useChatSettingsFormConfig,
} from '@epam/ai-dial-chat-hooks';

const labels: ChatSettingsFormLabels = {
  settings: 'Chat settings',
  savedNotification: 'Chat settings have been saved',
  responseFormatLabel: 'Response format',
  responseFormatHint: 'Applies to new and existing messages',
  responseFormatMarkdown: 'Markdown',
  responseFormatPlainText: 'Plain text',
  systemPromptLabel: 'System prompt',
  systemPromptTooltip: 'Enter a prompt',
  temperatureLabel: 'Temperature',
  temperaturePrecise: 'Precise',
  temperatureNeutral: 'Neutral',
  temperatureCreative: 'Creative',
  temperatureHint:
    'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
  saveLabel: 'Apply changes',
  saveDisabledTooltip: 'Please select a response format',
};

const ComposerSettings = ({
  values,
  onValuesChange,
  deploymentFeatures,
  isQuickApp,
}: {
  values: {
    responseFormat: ResponseFormat;
    systemPrompt: string;
    temperature: number;
  };
  onValuesChange: (v: typeof values) => void;
  deploymentFeatures?: DeploymentFeatures;
  isQuickApp?: boolean;
}) => {
  const chatSettings = useChatSettingsFormConfig({
    mode: 'local',
    values,
    onValuesChange,
    deploymentFeatures,
    isQuickApp,
    labels,
    onSaved: () => showToast(labels.savedNotification),
  });

  return <ChatSettingsModal {...chatSettings} />;
};
```

#### API

**Parameters**: `useChatSettingsFormConfig(params)` where `params` is a discriminated union:

| Mode             | Shape                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `'local'`        | `{ mode: 'local'; values; onValuesChange; deploymentFeatures?; isQuickApp?; labels?; onSaved? }`                    |
| `'conversation'` | `{ mode: 'conversation'; conversation; onConversationChange; deploymentFeatures?; isQuickApp?; labels?; onSaved? }` |

`labels` (`Partial<ChatSettingsFormLabels>`) overrides English fallbacks for every visible string; `onSaved` is called after a successful save so the host can surface its own toast. `isQuickApp` forces the temperature field off regardless of `deploymentFeatures`.

**Returns** (`UseChatSettingsFormConfigResult`): `{ features, responseFormat, systemPrompt, temperature, onSave, menuItemLabel, title, responseFormatLabel, responseFormatHint, responseFormatMarkdownLabel, responseFormatPlainTextLabel, systemPromptLabel, systemPromptTooltip, temperatureLabel, temperatureLabels, temperatureHint, saveLabel, saveDisabledTooltip }` — spread directly into `ChatSettingsModal` / `ChatSettingsBottomSheet` from `@epam/ai-dial-conversation-input`.

### useAttachmentAction

Default click behavior for an attachment tile: downloads DIAL-hosted and inline (`data`) files, and for reference-only attachments (RAG/search-grounding chunks), opens a PDF in the canvas scrolled to its referenced page when present, otherwise opens/downloads the reference as-is.

```tsx
import { useAttachmentAction } from '@epam/ai-dial-chat-hooks';

const AttachmentTile = ({ attachment }: { attachment: DisplayAttachment }) => {
  const { handleAttachmentClick } = useAttachmentAction({
    resolveDownloadUrl: (fileId) => myResolveFileDownloadUrl(fileId),
  });
  return (
    <button onClick={() => handleAttachmentClick(attachment)}>
      {attachment.name}
    </button>
  );
};
```

#### API

**Parameters** (`UseAttachmentActionParams`): `{ resolveDownloadUrl: (fileId: string) => string | undefined }` — resolves a DIAL Core file id (`files/{bucket}/{path}`) to a downloadable URL; this is host-owned since it encodes the app's own file-download endpoint.

**Returns** (`UseAttachmentActionResult`): `{ handleAttachmentClick: (attachment: DisplayAttachment) => void }`.

Also exports `isDialFileId`, `isDownloadableAttachment`, and `downloadAttachment` (the standalone functions the hook is built on) for callers that need the download decision outside the click handler.

### usePromptsState

Fetches a user's personal, shared-with-me, and organisation prompts in a single call on mount and on explicit refetch. The hook owns the request lifecycle (in-flight state, unmount cancellation, error state); the host supplies the fetch function so the hook never imports or constructs an API client.

```tsx
import { usePromptsState } from '@epam/ai-dial-chat-hooks';

const PromptCatalog = ({
  listPrompts,
}: {
  listPrompts: () => Promise<PromptListResponseDto>;
}) => {
  const {
    prompts,
    folders,
    sharedWithMe,
    publicPrompts,
    publicFolders,
    isLoading,
    error,
    refetch,
  } = usePromptsState({ listPrompts });

  if (isLoading) return <Spinner />;
  return (
    <ul>
      {prompts.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
};
```

#### API

**Parameters** (`UsePromptsStateParams`):

| Name          | Type                                   | Description                                                                            |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `listPrompts` | `() => Promise<PromptListResponseDto>` | Host-configured fetch function — the hook never constructs or imports a client itself. |

**Returns** (`UsePromptsStateResult`):

| Name                   | Type                        | Description                                                          |
| ---------------------- | --------------------------- | -------------------------------------------------------------------- |
| `prompts`              | `PromptResponseDto[]`       | The caller's own prompts.                                            |
| `folders`              | `PromptFolderResponseDto[]` | Folders in the caller's own namespace.                               |
| `sharedWithMe`         | `PromptResponseDto[]`       | Prompts other users have shared with the caller.                     |
| `publicPrompts`        | `PromptResponseDto[]`       | Organisation-wide (public) prompts; absent if the API omits them.    |
| `publicFolders`        | `PromptFolderResponseDto[]` | Folders in the organisation namespace; absent if the API omits them. |
| `isLoading`            | `boolean`                   | `true` while the initial fetch is in flight.                         |
| `error`                | `unknown`                   | Rejection reason of the most recent failed listing, or `null`.       |
| `refetch`              | `() => Promise<void>`       | Re-reads all namespaces and replaces the current state.              |
| `refetchPublicPrompts` | `() => Promise<void>`       | Backward-compat alias for `refetch`.                                 |

### useFavoriteEntitiesState

Loads the IDs of installed (favorited) deployments, toolsets, prompts, and skills from a single `loadFavorites` call; exposes an optimistic `toggleFavorite` that updates the local set immediately and rolls back to the pre-toggle state if the write fails.

```tsx
import {
  FavoriteEntityType,
  useFavoriteEntitiesState,
} from '@epam/ai-dial-chat-hooks';

const CatalogCard = ({
  loadFavorites,
  updateFavorite,
}: {
  loadFavorites: () => Promise<FavoritesPayload>;
  updateFavorite: (
    id: string,
    isFavorite: boolean,
    entityType: FavoriteEntityType,
  ) => Promise<void>;
}) => {
  const { favoriteIds, isLoading, toggleFavorite } = useFavoriteEntitiesState({
    loadFavorites,
    updateFavorite,
  });

  return (
    <button
      onClick={() => toggleFavorite('gpt-4o', !favoriteIds.has('gpt-4o'))}
    >
      {favoriteIds.has('gpt-4o') ? 'Unfavorite' : 'Favorite'}
    </button>
  );
};
```

#### API

**`FavoriteEntityType`** (enum):

| Member       | Value          |
| ------------ | -------------- |
| `Deployment` | `'deployment'` |
| `Toolset`    | `'toolset'`    |
| `Prompt`     | `'prompt'`     |
| `Skill`      | `'skill'`      |

**`FavoritesPayload`**: `{ deployments: string[]; toolsets: string[]; prompts: string[]; skills: string[] }`.

**Parameters** (`UseFavoriteEntitiesStateParams`):

| Name             | Type                                                                                 | Description                                                                        |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `loadFavorites`  | `() => Promise<FavoritesPayload>`                                                    | Host-configured fetch function — the hook never constructs a client itself.        |
| `updateFavorite` | `(id: string, isFavorite: boolean, entityType: FavoriteEntityType) => Promise<void>` | Persists a single toggle; the hook calls this after updating the optimistic state. |

**Returns** (`UseFavoriteEntitiesStateResult`):

| Name             | Type                                                                                  | Description                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favoriteIds`    | `ReadonlySet<string>`                                                                 | Current set of favorited IDs across all entity types.                                                                                                |
| `isLoading`      | `boolean`                                                                             | `true` while the initial load is in flight.                                                                                                          |
| `toggleFavorite` | `(id: string, isFavorite: boolean, entityType?: FavoriteEntityType) => Promise<void>` | Optimistically updates `favoriteIds`, calls `updateFavorite`, and rolls back on rejection. `entityType` defaults to `FavoriteEntityType.Deployment`. |

### useSkillsState

Fetches a user's personal, shared-with-me, and organisation skills from a single listing call, with an `enabled`/`ready` guard to defer the fetch until both the feature flag and user-auth state are settled. Also exposes `mergeSharedSkill` to splice an invitation-accepted skill into the shared list without a full refetch.

```tsx
import { useSkillsState } from '@epam/ai-dial-chat-hooks';

const SkillCatalog = ({
  listSkills,
  isEnabled,
  isReady,
}: {
  listSkills: () => Promise<SkillCatalogListResponseDto>;
  isEnabled: boolean;
  isReady: boolean;
}) => {
  const {
    skills,
    publicSkills,
    sharedWithMe,
    isLoading,
    error,
    refetch,
    mergeSharedSkill,
  } = useSkillsState({ listSkills, enabled: isEnabled, ready: isReady });

  if (!isEnabled) return null;
  if (isLoading) return <Spinner />;
  return (
    <ul>
      {skills.map((s) => (
        <li key={s.url}>{s.name}</li>
      ))}
    </ul>
  );
};
```

#### API

**Parameters** (`UseSkillsStateParams`):

| Name         | Type                                         | Description                                                                           |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `listSkills` | `() => Promise<SkillCatalogListResponseDto>` | Host-configured fetch function — the hook never constructs a client itself.           |
| `enabled`    | `boolean`                                    | When `false`, clears all arrays and resolves `isLoading` to `false` without fetching. |
| `ready`      | `boolean`                                    | When `false`, defers the fetch and keeps `isLoading: true` until it becomes `true`.   |

**Returns** (`UseSkillsStateResult`):

| Name               | Type                                   | Description                                                                |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------------- |
| `skills`           | `SkillMetadataItemDto[]`               | The caller's own skills.                                                   |
| `publicSkills`     | `SkillMetadataItemDto[]`               | Organisation-wide skills.                                                  |
| `sharedWithMe`     | `SkillMetadataItemDto[]`               | Skills other users have shared with the caller.                            |
| `isLoading`        | `boolean`                              | `true` while the initial fetch is in flight or deferred by `ready: false`. |
| `error`            | `unknown`                              | Rejection reason of the most recent failed listing, or `null`.             |
| `refetch`          | `() => Promise<void>`                  | Re-reads all namespaces and replaces the current state.                    |
| `mergeSharedSkill` | `(item: SkillMetadataItemDto) => void` | Upserts a skill into `sharedWithMe` by `url`, appending it if not present. |

## File Manager

A domain-specific set of hooks (and their supporting types/utilities) implementing the DIAL file manager: browsing/search, upload, create/rename/move/copy/delete, sharing, and metadata, composed against an injected `DialFilesApi` port instead of a configured REST client or React context. `useDialFileManager` is the composed entry point most consumers reach for; the six sub-hooks it composes (`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`) and the two standalone hooks (`useDialFileManagerTabConfig`, `useGridEditingScroll`) are exported individually for hosts that need only part of the surface, or that render `@epam/ai-dial-react-file-manager`'s `DialFileManager` grid directly.

None of these hooks call `react-i18next` or read an application context: every user-visible string arrives through a `labels`/`buildValidationErrorMessage`/`disabledNewButtonTooltip` parameter, and every failure/success is reported through a structured, translation-free event (`FileManagerNotification`, `FileOperationSuccessEvent`) the host maps to its own toast/notification copy.

### useDialFileManager

Composes listing/navigation, upload, mutations, sharing, and metadata into the single flat result `DialFileManager`'s host component consumes — action-label/upload/column/loading gating included.

```tsx
import {
  DialFileManager,
  DialFileManagerTabs,
  DialFileManagerActions,
} from '@epam/ai-dial-react-file-manager';
import {
  useDialFileManager,
  type DialFilesApi,
  DownloadDestinationType,
} from '@epam/ai-dial-chat-hooks';

const FileManagerHost = ({
  filesApi,
  bucket,
}: {
  filesApi: DialFilesApi;
  bucket: string;
}) => {
  const fileManager = useDialFileManager({
    filesApi,
    bucket,
    activeTab: DialFileManagerTabs.MyFiles,
    labels: {
      [DialFileManagerActions.Download]: 'Download',
      [DialFileManagerActions.Delete]: 'Delete',
    },
    locale: 'en-US',
    disabledNewButtonTooltip: 'You do not have permission to create files here',
    downloadDestination: {
      resolveDestination: async () => ({ type: DownloadDestinationType.Blob }),
      triggerDownload: async (response, fallbackName) => {
        // write `response`'s bytes to disk under `fallbackName`
        return fallbackName;
      },
    },
    buildValidationErrorMessage: (error) => {
      switch (error.reason) {
        case 'empty':
          return 'Name cannot be empty';
        case 'forbiddenSymbols':
          return `Name cannot contain: ${error.symbols}`;
        case 'reservedName':
          return 'This name is reserved';
        case 'tooLong':
          return `Name must be at most ${error.maxLength} characters`;
        case 'duplicateName':
          return `"${error.existingName}" already exists here`;
        case 'leadingDot':
          return 'Name cannot start with a dot';
      }
    },
  });

  return <DialFileManager {...fileManager} />; // from @epam/ai-dial-react-file-manager
};
```

#### API

**Parameters** (`UseDialFileManagerOptions`): `filesApi`, `bucket`, `labels`, `locale`, `disabledNewButtonTooltip`, `downloadDestination`, and `buildValidationErrorMessage` are required; `rootLabel` (default `'My files'`), `activeTab` (default `MyFiles`), `variant` (default `Attach`), `actionProfile`, `forbiddenSymbolsRegExp`, `onNotification`, and `onOperationSuccess` are optional. See the exported `UseDialFileManagerOptions` type for the complete shape.

**Returns** (`UseDialFileManagerResult`): the full set of props `DialFileManager` needs — `items`, `isLoading`, `path`/`onPathChange`, search (`onSearchFiles`/`searchResults`/`isSearching`), tree expand state, upload (`onUploadFiles`/`onUploadArchive`/`uploadBatchState`), create/rename/move/copy/delete callbacks and their `isXxx` flags, sharing (`onUnshareFiles`/`onRemoveFilesAccess`), metadata (`onGetInfo`/`fileMetadata`), `actionLabels`, `visibleColumns`, and the aggregate `isAnyOperationInProgress`. See the exported `UseDialFileManagerResult` type for the complete shape.

### useDialFileListing

Owns folder browsing/navigation, the tree's expand/collapse state, search, and the shared per-folder listing cache the other file-manager hooks invalidate through its returned `invalidateFolders`/`bumpRetry` after their own mutations settle.

```tsx
import { useDialFileListing } from '@epam/ai-dial-chat-hooks';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';

const { items, isLoading, path, onPathChange, onSearchFiles, searchResults } =
  useDialFileListing({
    filesApi,
    bucket,
    rootLabel: 'My files',
    activeTab: DialFileManagerTabs.MyFiles,
  });
```

#### API

**Parameters** (`UseDialFileListingOptions`): `filesApi`, `bucket`, `rootLabel`, `activeTab` are required; `onNotification` is optional.

**Returns** (`UseDialFileListingResult`): `items`, `isLoading`, `error`, `path`/`folderPath`/`onPathChange`, `retry`, search (`onSearchFiles`/`isSearching`/`searchResults`/`clearSearchResults`), tree state (`expandedPaths`/`loadedPaths`/`onExpandedPathsChange`), folder-popup preload state, `sharedWithMeIds`/`sharedByMePaths`/`currentFolder`, and the cache-ownership seam other sub-hooks consume (`cache`, `listingPermissionsCache`, `sharedRootMetaRef`, `setFolderPath`, `invalidateFolders`, `mergeCreatedFolder`, `bumpRetry`).

`loadedPaths` includes both expanded outer-tree folders and destination-popup folders whose listings are present in the cache. `folderPopupLoadingPaths` contains destination-popup folders whose listings are still being fetched.

### useDialFileMetadata

Fetches and holds single-file metadata for a file-details popup — the only sub-hook with no interaction with the shared listing cache.

```tsx
import { useDialFileMetadata } from '@epam/ai-dial-chat-hooks';

const { fileMetadata, isFileMetadataLoading, onGetInfo, clearMetadata } =
  useDialFileMetadata({ filesApi, bucket, rootLabel: 'My files' });

onGetInfo(selectedFile);
```

#### API

**Parameters** (`UseDialFileMetadataOptions`): `filesApi`, `bucket`, `rootLabel` are required; `onNotification` is optional.

**Returns** (`UseDialFileMetadataResult`): `{ fileMetadata: DialFile | undefined, isFileMetadataLoading: boolean, onGetInfo: (file: DialFile) => void, clearMetadata: () => void }`.

### useDialFileManagerTabConfig

Filters the file manager's tab list down to a host-configured set and resets the active tab to the highest-priority still-enabled tab when the current one becomes excluded. A `fileManagerTabs` of `undefined` means no restriction.

```tsx
import { useDialFileManagerTabConfig } from '@epam/ai-dial-chat-hooks';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';

const { tabs } = useDialFileManagerTabConfig(
  activeTab,
  setActiveTab,
  allTabs,
  ['my_files', 'shared'], // or undefined for no restriction
);
```

#### API

**Parameters**: `useDialFileManagerTabConfig(activeTab: DialFileManagerTabs, onTabChange: (tab: DialFileManagerTabs) => void, allTabs: TabModel[] | undefined, fileManagerTabs: string[] | undefined)`.

**Returns** (`UseDialFileManagerTabConfigResult`): `{ tabs: ToolbarOptions['tabs'] }`.

### useDialFileMutations

Implements create-folder, download, delete, rename, copy, and move against the injected `DialFilesApi`, reporting validation failures as a `FileNameValidationError` and successful mutations through a structured `FileOperationSuccessEvent` rather than a translated toast.

```tsx
import {
  FileOperationKind,
  useDialFileMutations,
} from '@epam/ai-dial-chat-hooks';

const mutations = useDialFileMutations({
  filesApi,
  bucket,
  rootLabel: 'My files',
  activeTab,
  folderPath,
  currentFolder,
  sharedRootMetaRef,
  listingPermissionsCache,
  invalidateFolders,
  bumpRetry,
  mergeCreatedFolder,
  setFolderPath,
  downloadDestination,
  onOperationSuccess: (event) => {
    if (event.kind === FileOperationKind.FolderCreated)
      showToast(`Created "${event.name}"`);
  },
});
```

#### API

**Parameters** (`UseDialFileMutationsOptions`, ~13 fields): most are the listing-cache seam threaded straight from `useDialFileListing`'s result (`folderPath`, `currentFolder`, `sharedRootMetaRef`, `listingPermissionsCache`, `invalidateFolders`, `bumpRetry`, `mergeCreatedFolder`, `setFolderPath`) plus `filesApi`, `bucket`, `rootLabel`, `activeTab`, `downloadDestination` (required), and the optional `onNotification`/`onOperationSuccess`/`forbiddenSymbolsRegExp`. See the exported `UseDialFileMutationsOptions` type for the complete shape.

**Returns** (`UseDialFileMutationsResult`): `onCreateFolder`/`onCreateFolderValidate`, `onDownloadFiles`, `onDeleteFiles`, `onRenameValidate`/`onMoveToFiles`, `onCopyFiles`, `cancelCopyMove`, and an `isXxx` in-flight flag for each (`isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`). `onCreateFolderValidate`/`onRenameValidate` return `FileNameValidationError | null` rather than a message string.

### useDialFileSharing

Implements unshare and remove-access, bumping `useDialFileListing`'s retry counter after each mutation settles instead of holding its own cache copy.

```tsx
import { useDialFileSharing } from '@epam/ai-dial-chat-hooks';

const { onUnshareFiles, onRemoveFilesAccess, isUnsharing, isRemovingAccess } =
  useDialFileSharing({ filesApi, bucket, rootLabel: 'My files', bumpRetry });
```

#### API

**Parameters** (`UseDialFileSharingOptions`): `filesApi`, `bucket`, `rootLabel`, `bumpRetry` are required; `onNotification` is optional.

**Returns** (`UseDialFileSharingResult`): `{ isUnsharing, isRemovingAccess, onUnshareFiles: (files: DialFile[]) => void, onRemoveFilesAccess: (files: DialFile[]) => void }`.

### useDialFileUploadBatch

Runs a concurrency-limited (`UPLOAD_CONCURRENCY`-worker) upload batch against the injected `DialFilesApi`, including per-file conflict resolution, cancellation, and a ZIP-archive extraction path via `onUploadArchive`.

```tsx
import { useDialFileUploadBatch } from '@epam/ai-dial-chat-hooks';

const { onUploadFiles, uploadBatchState, cancelUpload, clearUploadBatch } =
  useDialFileUploadBatch({
    filesApi,
    bucket,
    rootLabel: 'My files',
    activeTab,
    cache,
    sharedRootMetaRef,
    invalidateFolders,
    bumpRetry,
  });
```

#### API

**Parameters** (`UseDialFileUploadBatchOptions`): `filesApi`, `bucket`, `rootLabel`, `activeTab`, `cache`, `sharedRootMetaRef`, `invalidateFolders`, `bumpRetry` are required (all but `filesApi`/`bucket`/`rootLabel`/`activeTab` come straight from `useDialFileListing`'s result); `onNotification` is optional.

**Returns** (`UseDialFileUploadBatchResult`): `onUploadFiles`, `onUploadArchive`, plus (per `UseDialFileManagerResult`'s equivalent fields) `onValidateUpload`, `uploadBatchState: FileUploadBatchState | null`, `cancelUpload`, `clearUploadBatch`.

### useGridEditingScroll

Scrolls a newly inline-edited or newly-inserted grid row into view. Binds directly to the AG Grid `GridApi` obtained via `DialFileManager`'s `onGridApiChange` prop, since `@epam/ai-dial-react-file-manager`'s own `GridOptions` type does not forward the raw AG Grid event callbacks this needs. `handleGridApiChange` accepts that raw `GridApi` only to bind to `onGridApiChange` — the narrow AGENTS.md D9 exception for this hook — and the hook otherwise never renders, themes, or depends on AG Grid beyond that one event-binding parameter.

```tsx
import { useGridEditingScroll } from '@epam/ai-dial-chat-hooks';

const { handleGridApiChange, reset } = useGridEditingScroll();

// <DialFileManager onGridApiChange={handleGridApiChange} ... />
// reset() on a data-source change such as a tab switch
```

#### API

**Parameters** (`UseGridEditingScrollOptions`, all optional): `resolveTargetNode` — picks which newly-added row to scroll to; defaults to the first row flagged `isTemporary`, or the first new row.

**Returns** (`UseGridEditingScrollResult`): `{ handleGridApiChange: (api: GridApi<FileManagerGridRow>) => void, reset: () => void }`.

### Supporting types

- **`DialFilesApi`** — the operation port every file-manager hook that performs network I/O accepts as a parameter, mirroring the host's own files-API transport (list/upload/download/create/rename/move/copy/delete/share methods) instead of a configured REST client.
- **`FileManagerNotification`** — the structured toast event file-manager hooks emit through `onNotification`, carrying a `variant` (`NotificationVariant`), an optional `reason` (`FileManagerNotificationReason`), and optional interpolation data (`count`, `name`, `folder`, `names`, `restCount`).
- **`FileManagerNotificationReason`** — library-owned enum identifying why a hook is surfacing a notification (e.g. `FolderLoadFailed`, `FolderCreateFailed`, `FilesDeleted`, `UploadCompleted`, `UnshareFailed`) — see the exported enum for the full member list.
- **`FileNameValidationErrorReason`** — library-owned enum identifying why a file/folder name failed validation: `Empty`, `ForbiddenSymbols`, `ReservedName`, `TooLong`, `DuplicateName`, `LeadingDot`.
- **`FileNameValidationError`** — discriminated union returned by `onCreateFolderValidate`/`onRenameValidate` instead of a translated message; members are `{ reason: FileNameValidationErrorReason.Empty }`, `{ reason: FileNameValidationErrorReason.ForbiddenSymbols; symbols: string }`, `{ reason: FileNameValidationErrorReason.ReservedName }`, `{ reason: FileNameValidationErrorReason.TooLong; maxLength: number }`, `{ reason: FileNameValidationErrorReason.DuplicateName; existingName: string }`, `{ reason: FileNameValidationErrorReason.LeadingDot }`.
- **`FileOperationSuccessEvent`** — the structured success event `useDialFileMutations` emits through `onOperationSuccess`, carrying a `kind` (`FileOperationKind`) plus optional `name`/`count`/`destinationFolderName`/`isFolder`.
- **`FileOperationKind`** — library-owned enum identifying which mutation just succeeded: `FolderCreated`, `FileRenamed`, `FileDownloaded`, `FilesDownloaded`, `FileCopied`, `FilesCopied`, `FileMoved`, `FilesMoved`.
- **`DownloadDestinationHandlers`** / **`DownloadDestination`** / **`DownloadDestinationType`** — the host-injected "Save As" / blob-download seam for `useDialFileMutations.onDownloadFiles`. `DownloadDestinationType` is `Blob | Stream | Cancelled`; `DownloadDestination` is the matching discriminated union (the `Stream` member carries a `WritableStream<Uint8Array>`); `DownloadDestinationHandlers` is `{ resolveDestination(filename, mimeType), triggerDownload(response, fallbackName, destination) }`.
- **`FileUploadStatus`** / **`FileUploadEntry`** / **`FileUploadBatchState`** — an upload batch's progress model. `FileUploadStatus` is `Queued | Uploading | Completed | Failed | Cancelled`; `FileUploadEntry` is `{ id, name, status, percent? }`; `FileUploadBatchState` is `{ files: FileUploadEntry[], isOpen: boolean }`.
- **`DialFileManagerVariant`** / **`DialFileManagerActionProfile`** — identify which host is driving `useDialFileManager` (`Attach | Standalone | FolderPicker`) and which action set that gates (`Attach | Browse | Full`); `deriveActionProfile(variant)` maps the former to the latter.

## Conversation & File Utilities

### getModelIdFromConversationId

Extracts the deployment/model ID from a DIAL Core conversation ID (`{deploymentId}__{title}`, including scheduler paths and versioned application IDs).

```ts
import { getModelIdFromConversationId } from '@epam/ai-dial-chat-hooks';

getModelIdFromConversationId('conversations/bucket/gpt-4__My%20chat'); // 'gpt-4'
```

### virtualPathToApiPath / getParentFolderPath / resolveDialFileApiPath

Pure path-algebra helpers shared by the file-manager domain layer and by any host resolving a DIAL file to its bucket-relative API path.

```ts
import { getParentFolderPath } from '@epam/ai-dial-chat-hooks';

getParentFolderPath('reports/file.txt'); // 'reports/'
```

### dialFileToAttachment / dialFilesToAttachments / dialFolderPathToAttachment

Maps a selected DIAL file (or folder path) into the composer's `Attachment` shape. Image previews are resolved through an injected `resolvePreviewUrl` callback — the host owns bucket/icon-URL construction, not the library.

```ts
import { dialFilesToAttachments } from '@epam/ai-dial-chat-hooks';

const attachments = dialFilesToAttachments(selectedFiles, bucket, {
  resolvePreviewUrl: (url) => resolveCatalogIconUrl(url),
});
```

### mimeTypesToFileAccept / isDialFileAcceptType / mimeTypesToDialFileAcceptTypes / mimeTypesToAttachmentExtensionLabels

MIME/accept-type helpers for file pickers. `mimeTypesToFileAccept` always filters through `isDialFileAcceptType`, so it never disagrees with `mimeTypesToDialFileAcceptTypes` about which types are acceptable.

```ts
import { mimeTypesToFileAccept } from '@epam/ai-dial-chat-hooks';

mimeTypesToFileAccept(['image/*', 'application/pdf']); // 'image/*,application/pdf'
```

## API Transport

Host-agnostic factories over the browser API transport `apps/chat/src/server-api/*` uses. Every factory takes the host's own CSRF/session state, generated-client instance, or `fetch`/`XMLHttpRequest` implementation as a plain parameter — none of them read global state or construct a client `Configuration` themselves.

### createCsrfMiddleware / createUnauthorizedMiddleware

Generated-client `Middleware` factories: CSRF header injection/rotation, and 401 handling with an invalid-CSRF refresh-and-retry.

```ts
import {
  createCsrfMiddleware,
  createUnauthorizedMiddleware,
} from '@epam/ai-dial-chat-hooks';

const config = new Configuration({
  basePath: '',
  credentials: 'include',
  middleware: [
    createCsrfMiddleware({ getCsrfToken, setCsrfToken }),
    createUnauthorizedMiddleware({
      notifyUnauthorized,
      refreshCsrfToken: refreshCsrfTokenOutcome,
      isInvalidCsrfErrorBody,
      getCsrfToken,
      setCsrfToken,
      createUnauthorizedError: (url) => new UnauthorizedError(url),
    }),
  ],
});
```

### createFilesApiClient

Builds the DIAL files API wrapper functions (`listFiles`, `uploadFile`, `downloadFile`, `copyFiles`, …) over an already-configured generated `FilesApi` instance and an injected progress-reporting upload function.

```ts
import { createFilesApiClient } from '@epam/ai-dial-chat-hooks';

const files = createFilesApiClient(filesApi, uploadFileWithProgress);
```

### createUploadFileWithProgress

Builds a progress-reporting file-upload function backed by `XMLHttpRequest`, parameterized by the host's CSRF state, unauthorized callback, and upload URL.

```ts
import { createUploadFileWithProgress } from '@epam/ai-dial-chat-hooks';

const uploadFileWithProgress = createUploadFileWithProgress({
  getCsrfToken,
  setCsrfToken,
  notifyUnauthorized,
  createUnauthorizedError: (url) => new UnauthorizedError(url),
  uploadUrl: '/api/v1/files',
});
```

### createChatStreamApi

Builds the streamed-completion transport (`streamCompletion`/`stopCompletion`), parameterized by the host's CSRF state, completions base path, and an optional timezone resolver.

```ts
import { createChatStreamApi } from '@epam/ai-dial-chat-hooks';

const { streamCompletion, stopCompletion } = createChatStreamApi({
  getCsrfToken,
  setCsrfToken,
  completionsBasePath: '/api/v1/conversations',
  getTimezone: getBrowserTimezone,
});
```

### getApiErrorDetails / getApiErrorMessage / getApiErrorStatus / isConversationNotFoundError

Host-agnostic API error/trace-ID normalization. Works identically for a generated-client `ResponseError` or any host's own raw-fetch request-error shape.

```ts
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';

const { status, message, traceId } = await getApiErrorDetails(error);
```

## Locale Utilities

### toBaseLocale / resolveLocalizedText / appendLocaleCode

Resolves DIAL Core's `LocalizedText` shape (a plain string, or a map of locale code to translated value) to a single display string, with base-language and primary-locale fallback.

```ts
import { resolveLocalizedText } from '@epam/ai-dial-chat-hooks';

resolveLocalizedText({ en: 'Name', fr: 'Nom' }, 'fr-FR', 'en'); // 'Nom'
```

### composeLocalePayload / decomposeLocalizedFields / buildAdditionalLocaleOptions

Round-trips a deployment-creation form's "Add locale" popup entries against DIAL Core's `LocaleTextEntryDto[]` write payload, and builds the popup's selectable locale options.

```ts
import {
  composeLocalePayload,
  decomposeLocalizedFields,
} from '@epam/ai-dial-chat-hooks';

const payload = composeLocalePayload(otherLocales, 'en'); // LocaleTextEntryDto[] | undefined
const rows = decomposeLocalizedFields(displayName, description, 'en');
```

## Shared Utilities

### formatCalendarDate / padTwoDigits

`formatCalendarDate` formats a Unix timestamp (ms) as a locale-formatted calendar date; `padTwoDigits` pads a number or numeric string to at least 2 digits.

```ts
import { formatCalendarDate } from '@epam/ai-dial-chat-hooks';

formatCalendarDate(Date.now()); // e.g. '26/8/2026'
```

### getBrowserTimezone

Resolves the browser's current IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), or `undefined` if detection fails.

```ts
import { getBrowserTimezone } from '@epam/ai-dial-chat-hooks';

getBrowserTimezone(); // e.g. 'Europe/Warsaw'
```

### apSchedulerDayToJsDay / jsDayToApSchedulerDay

Converts between DIAL Scheduler's APScheduler weekday convention (Monday=0..Sunday=6) and JS `Date`'s weekday convention (Sunday=0..Saturday=6).

```ts
import { apSchedulerDayToJsDay } from '@epam/ai-dial-chat-hooks';

apSchedulerDayToJsDay(0); // 1 (Monday -> JS Monday)
```

### safeDecodeURI / safeDecodeURIComponent / stripSurroundingSlashes

`safeDecodeURI`/`safeDecodeURIComponent` decode a URI-encoded path segment, returning the original string unchanged if decoding fails; `stripSurroundingSlashes` strips leading and trailing slashes from a path segment.

```ts
import {
  safeDecodeURI,
  stripSurroundingSlashes,
} from '@epam/ai-dial-chat-hooks';

safeDecodeURI('My%20File.txt'); // 'My File.txt'
stripSurroundingSlashes('/reports/'); // 'reports'
```

### isCustomAppSchema / isQuickAppSchema

Classifies an application schema as the custom-app (code app) schema, or as a Quick App 2.0 schema.

```ts
import { isCustomAppSchema } from '@epam/ai-dial-chat-hooks';

isCustomAppSchema({ id: 'custom_app' }); // true
```

### isValidAbsoluteUrl / parseFeaturesData / isValidFeaturesData

Validation helpers for a custom application's `featuresData` JSON field: `isValidAbsoluteUrl` checks a well-formed `http(s)://` URL, `parseFeaturesData` parses the field, and `isValidFeaturesData` checks it contains only the allowed keys (`rate_endpoint`, `configuration_endpoint`).

```ts
import { isValidFeaturesData } from '@epam/ai-dial-chat-hooks';

isValidFeaturesData('{"rate_endpoint": "https://example.com/rate"}'); // true
```

### parseExternalServiceUrl / buildExternalServiceScopeId / getExternalServiceFallbackName

Splits/rebuilds the scope id an `external-service/signin` event carries (`applications/{bucket}/{app}/external_services/{name}`), and derives a fallback display name from the raw service name.

```ts
import { parseExternalServiceUrl } from '@epam/ai-dial-chat-hooks';

parseExternalServiceUrl('applications/bucket/app/external_services/jira');
// { appId: 'applications/bucket/app', serviceName: 'jira' }
```

## OAuth Popup Flow

Host-agnostic OAuth authorization-code popup orchestration. Three resource kinds share this machinery — toolsets, an application's external services, and Scheduled Tasks offline-credentials consent — which is why the module is named for the concern rather than for toolsets.

The module imports only browser APIs, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-chat-api-client` **types**. It knows no application route: every entry point that needs the callback location takes a `callbackPath` string supplied by the host.

### OAuth enums and models

| Name                                | Kind      | Purpose                                                                                              |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `ToolsetAuthTypes`                  | enum      | `NONE` / `API_KEY` / `OAUTH` — the mechanism a toolset requires.                                     |
| `ToolsetAuthStatus`                 | enum      | `SIGNED_IN` / `SIGNED_OUT` / `FAILED` — sign-in state for one credentials level.                     |
| `ToolsetCredentialsLevel`           | enum      | `GLOBAL` / `USER` / `APP` — scope the submitted credentials apply to.                                |
| `WithLogin`                         | enum      | `with-login` / `without-login` / `with-config`.                                                      |
| `OAuthResourceKind`                 | enum      | `toolset` / `external-service` / `offline-credentials`.                                              |
| `ToolsetOAuthInitiationResultType`  | enum      | `started` / `blocked` / `invalid-config`.                                                            |
| `ToolsetOAuthResultType`            | enum      | `success` / `failure` / `cancelled`.                                                                 |
| `ToolsetOAuthFailureReason`         | enum      | `missing-code` / `missing-redirect-state` / `state-mismatch` / `login-request-failed`.               |
| `ToolsetOAuthChannelControlType`    | enum      | `result-acknowledged` — the opener's consumption acknowledgement.                                    |
| `ToolsetOAuthCallbackQuery`         | enum      | `toolsetOAuthResult` / `toolsetOAuthFailureReason` — query keys written into the callback popup URL. |
| `TOOLSET_REDIRECT_STATE_KEY`        | const     | `sessionStorage` key the redirect state is written under, inside the popup.                          |
| `ToolsetOAuthSettings`              | interface | `clientId` / `authorizationEndpoint` / `scopes` / `codeChallenge` / `codeChallengeMethod`.           |
| `ToolsetRedirectState`              | interface | State handed to the popup: `toolsetId`, `credentialsLevel`, `redirectUri`, `state`, `resourceKind`.  |
| `ToolsetOAuthInitiationResult`      | type      | Discriminated result of opening/navigating the popup.                                                |
| `ToolsetOAuthResult`                | type      | Discriminated result resolved to the initiating tab.                                                 |
| `ToolsetOAuthChannelMessage`        | type      | Non-secret success/failure message posted by the callback.                                           |
| `ToolsetOAuthResultAcknowledgement` | interface | Control message confirming the opener consumed a result.                                             |

These declarations live in the package rather than being copied per host: TypeScript string enums are nominal, so a structurally identical host-side copy would not type-check against a lib signature that names the enum.

```ts
import {
  OAuthResourceKind,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  type ToolsetRedirectState,
} from '@epam/ai-dial-chat-hooks';

const redirectState: ToolsetRedirectState = {
  toolsetId: 'toolsets/public/jira',
  credentialsLevel: ToolsetCredentialsLevel.User,
  resourceKind: OAuthResourceKind.Toolset,
};

popup.sessionStorage.setItem(
  TOOLSET_REDIRECT_STATE_KEY,
  JSON.stringify(redirectState),
);
```

### encodeToolsetId / decodeToolsetId / isPublicToolsetId

`encodeToolsetId` percent-encodes each `/`-separated segment of a toolset id so it satisfies the backend's id pattern, keeping `/` as a literal separator — the counterpart of `encodeDeploymentId` on the applications side. `decodeToolsetId` inverts it, passing a malformed percent-encoded segment through unchanged rather than throwing, since it decodes externally-sourced ids. `isPublicToolsetId` reports whether an id lives in the org-wide `public` bucket.

```ts
import {
  decodeToolsetId,
  encodeToolsetId,
  isPublicToolsetId,
} from '@epam/ai-dial-chat-hooks';

encodeToolsetId('toolsets/b/My Toolset__1.0.0');
// 'toolsets/b/My%20Toolset__1.0.0'

decodeToolsetId('toolsets/b/My%20Toolset__1.0.0');
// 'toolsets/b/My Toolset__1.0.0'

isPublicToolsetId('toolsets/public/jira__1.0.0'); // true
```

### getToolsetRedirectUri / buildToolsetAuthorizeUrl

`getToolsetRedirectUri` resolves the host's own callback path against `window.location.origin`. `buildToolsetAuthorizeUrl` builds an authorization-code URL carrying `response_type=code`, `client_id`, `redirect_uri` and `state`, plus `code_challenge`/`code_challenge_method` and a space-joined `scope` when the supplied settings carry them. It returns `null` — never throws — for a configuration that cannot produce a valid URL: a missing or blank `clientId`/`authorizationEndpoint`, an unparseable endpoint, or an endpoint that is not reachable over a secure transport. `https:` is required; plain `http:` is accepted only on the loopback interface (`localhost`, `127.0.0.0/8`, `[::1]`), where the request never reaches a network that could observe the authorization code the provider returns.

**Parameters** (`buildToolsetAuthorizeUrl`):

| Name          | Type                   | Description                                                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------ |
| `auth`        | `ToolsetOAuthSettings` | OAuth client settings. A wider host form model is accepted structurally. |
| `redirectUri` | `string`               | Absolute callback URI, typically from `getToolsetRedirectUri`.           |
| `state`       | `string`               | Per-flow CSRF state, which also doubles as the flow id.                  |

```ts
import {
  buildToolsetAuthorizeUrl,
  getToolsetRedirectUri,
} from '@epam/ai-dial-chat-hooks';

const redirectUri = getToolsetRedirectUri('/auth/toolset-signin');
const url = buildToolsetAuthorizeUrl(
  {
    clientId: 'client',
    authorizationEndpoint: 'https://auth.example.com/authorize',
    scopes: ['read', 'write'],
  },
  redirectUri,
  crypto.randomUUID(),
);
```

### openToolsetOAuthPopup / navigateToolsetOAuthPopup / initiateOAuthLogin

`openToolsetOAuthPopup` opens a blank, same-origin popup. Call it as the very first synchronous statement of a click handler, before any `await` — that ordering is what makes a blocked popup detectable and keeps the browser treating the open as user-triggered.

`initiateOAuthLogin` is the one-shot path for a config already known synchronously: it validates the config, opens the popup, writes the redirect state into **the popup's own** `sessionStorage`, sets the popup's `opener` to `null`, and navigates it to the provider. `navigateToolsetOAuthPopup` is the deferred path for a config that can only be fetched after the popup is open — it closes the already-open popup and returns `InvalidConfig` when no authorize URL can be built.

**Parameters** (`navigateToolsetOAuthPopup`):

| Name               | Type                      | Description                                                                  |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| `popup`            | `Window`                  | The already-open blank popup.                                                |
| `auth`             | `ToolsetOAuthSettings`    | OAuth client settings.                                                       |
| `toolsetId`        | `string`                  | Resource id, or an opaque correlation id for the non-toolset resource kinds. |
| `callbackPath`     | `string`                  | The host's own OAuth callback route.                                         |
| `credentialsLevel` | `ToolsetCredentialsLevel` | Defaults to `ToolsetCredentialsLevel.User`.                                  |
| `resourceKind`     | `OAuthResourceKind`       | Defaults to `OAuthResourceKind.Toolset`.                                     |

`initiateOAuthLogin` takes `(auth, toolsetId, callbackPath, credentialsLevel?)` — same meanings, and it opens the popup itself.

```ts
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  ToolsetOAuthInitiationResultType,
} from '@epam/ai-dial-chat-hooks';

// Config known up front.
const initiation = initiateOAuthLogin(
  {
    clientId: 'client',
    authorizationEndpoint: 'https://auth.example.com/authorize',
  },
  'toolsets/public/jira',
  '/auth/toolset-signin',
);
if (initiation.type === ToolsetOAuthInitiationResultType.Blocked) return;

// Config fetched after the click.
const popup = openToolsetOAuthPopup();
if (!popup) return;
const settings = await fetchSettings();
const deferred = navigateToolsetOAuthPopup(
  popup,
  settings,
  'toolsets/public/jira',
  '/auth/toolset-signin',
);
```

### getToolsetOAuthChannelName / waitForToolsetOAuthResult

`getToolsetOAuthChannelName` names the same-origin `BroadcastChannel` an OAuth flow's opener and its callback popup share. `waitForToolsetOAuthResult` resolves success, failure, or cancellation over three redundant channels: that `BroadcastChannel`, a poll of the popup's same-origin URL for the completion marker, and a focus listener on the initiating window.

Two subtleties it exists to handle. A closed popup is treated as cancelled **only** via the focus check, never from the poll alone — cross-origin navigation can make a retained window reference report `closed` while the popup is in fact open. And the flow channel stays open past the settling tick so the consumption acknowledgement is actually delivered, which is what lets a callback popup whose `WindowProxy` was severed close itself.

**Options**:

| Name               | Type                      | Description                                                                                           |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `toolsetId`        | `string`                  | Resource id echoed back in a success result.                                                          |
| `credentialsLevel` | `ToolsetCredentialsLevel` | Credentials level echoed back in a success result.                                                    |
| `callbackPath`     | `string`                  | The route this flow's popup was opened against; a same-origin popup URL on any other path is ignored. |
| `timeoutMs`        | `number`                  | Defaults to 5 minutes, after which the popup is closed and the flow resolves cancelled.               |
| `pollIntervalMs`   | `number`                  | Defaults to `500`.                                                                                    |

```ts
import {
  waitForToolsetOAuthResult,
  ToolsetCredentialsLevel,
  ToolsetOAuthResultType,
} from '@epam/ai-dial-chat-hooks';

const result = await waitForToolsetOAuthResult(popup, flowId, {
  toolsetId: 'toolsets/public/jira',
  credentialsLevel: ToolsetCredentialsLevel.User,
  callbackPath: '/auth/toolset-signin',
});

if (result.type === ToolsetOAuthResultType.Success) {
  // refresh status
}
```

### useToolsetLogin

Toolset API-key and OAuth login orchestration, so no two surfaces fork the popup handshake or the stale-credential-clearing rule. Every backend call arrives as an injected callback — the hook constructs no client instance and reads no app context. It resolves an outcome and shows nothing itself; mapping an outcome to notifications is the caller's job.

For OAuth, a reported cancellation is re-checked against the backend through `getToolset` and upgraded to success when the target level reads signed in, so a login that completed server-side is never reported as cancelled.

**Parameters**:

| Name            | Type                                                                  | Description                                           |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `callbackPath`  | `string`                                                              | The host's OAuth callback route.                      |
| `loginToolset`  | `(toolsetId: string, body: ToolsetLoginBodyDto) => Promise<unknown>`  | Submits credentials at one level.                     |
| `logoutToolset` | `(toolsetId: string, body: ToolsetLogoutBodyDto) => Promise<unknown>` | Clears credentials at one level.                      |
| `getToolset`    | `(toolsetId: string) => Promise<DialToolsetDto>`                      | Re-reads a toolset to verify a reported cancellation. |

**Returns**: `{ login: (params: ToolsetLoginParams) => Promise<ToolsetLoginOutcome> }` — `login` is `useCallback`-stable while the injected callbacks are unchanged.

```tsx
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '@epam/ai-dial-chat-hooks';

const { login } = useToolsetLogin({
  callbackPath: '/auth/toolset-signin',
  loginToolset,
  logoutToolset,
  getToolset,
});

const outcome = await login({
  toolsetId: 'toolsets/public/jira',
  credentialsLevel: ToolsetCredentialsLevel.User,
  authenticationType: ToolsetAuthTypes.OAuth,
  oauthSettings: {
    clientId: 'client',
    authorizationEndpoint: 'https://auth.example.com/authorize',
  },
});

if (outcome.type === ToolsetLoginOutcomeType.PopupBlocked) {
  showPopupBlockedNotification();
}
```

### useOAuthCallbackCompletion

Runs inside the OAuth callback popup and completes the flow: reads and clears the redirect state from the popup's own `sessionStorage`, removes the authorization code from the visible URL **before** any request, validates the returned `state` against the stored one, performs the exchange through the injected callback, then reports the outcome into the popup URL and over the flow channel until the opener acknowledges it, closing the popup afterwards. It runs its effect once per mount even under StrictMode double-invocation, renders nothing, and produces no user-visible text.

Per-resource-kind dispatch stays in the host page — the hook sees only the one injected `exchange` callback.

**Parameters**:

| Name           | Type                                                                          | Description                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `searchParams` | `URLSearchParams`                                                             | Callback query parameters; `code` and `state` are read from it.                                                                           |
| `callbackPath` | `string`                                                                      | Used to build the echoed `redirect_uri` when the stored redirect state carries none.                                                      |
| `exchange`     | `(params: OAuthExchangeParams) => Promise<ToolsetOAuthFailureReason \| null>` | Performs the exchange. Resolve `null` for success, a reason for a host-side validation failure; a rejection reports `LoginRequestFailed`. |

**Returns**:

| Name            | Type                                | Description                                                    |
| --------------- | ----------------------------------- | -------------------------------------------------------------- |
| `isInProgress`  | `boolean`                           | `true` until the flow has reported an outcome.                 |
| `failureReason` | `ToolsetOAuthFailureReason \| null` | The failure reason, or `null` while in progress or on success. |

```tsx
import {
  useOAuthCallbackCompletion,
  type OAuthExchangeParams,
} from '@epam/ai-dial-chat-hooks';

const exchange = useCallback(
  async ({
    code,
    redirectUri,
    credentialsLevel,
    redirectState,
  }: OAuthExchangeParams) => {
    await loginToolset(redirectState.toolsetId, {
      url: redirectState.toolsetId,
      credentialsLevel,
      authenticationType: 'OAUTH',
      code,
      redirectUri,
    });
    return null;
  },
  [],
);

const { isInProgress, failureReason } = useOAuthCallbackCompletion({
  searchParams,
  callbackPath: '/auth/toolset-signin',
  exchange,
});
```

## Toolset Login Events

### emitToolsetLoginSuccess / subscribeToolsetLoginSuccess

Broadcasts (and subscribes to) a successful toolset login within the current window — a same-document `EventTarget`, not `postMessage`, for notifying another mounted React tree (e.g. an `AppEditorIframe`) rather than a cross-origin iframe. Generic over the host's own credentials-level type.

```ts
import {
  emitToolsetLoginSuccess,
  subscribeToolsetLoginSuccess,
  type ToolsetLoginSuccessDetail,
} from '@epam/ai-dial-chat-hooks';

const unsubscribe = subscribeToolsetLoginSuccess<'SIGNED_IN'>((detail) => {
  console.log(detail.toolsetId, detail.credentialsLevel);
});

emitToolsetLoginSuccess<'SIGNED_IN'>({
  toolsetId: 'toolsets/public/jira',
  credentialsLevel: 'SIGNED_IN',
});
```

## Conversation Utilities

### createDeploymentChangedMessage

Creates a `StatusMessage` recording a deployment change in the conversation timeline. Status messages are never forwarded to DIAL Core.

```ts
import { createDeploymentChangedMessage } from '@epam/ai-dial-chat-hooks';

const statusMessage = createDeploymentChangedMessage('gpt-4', 'gpt-4o');
```

### isMessageStreaming / getLastDeploymentId / messageHasStages / getLastUserMessageToolConfiguration / normalizeResponseFormat

Pure predicates/lookups over a conversation's `Message[]`: whether a message is the actively-streaming assistant response, the last deployment a `model_changed` status message recorded, whether a message carries any stages, the last user message's persisted tool-configuration value, and normalizing a legacy `responseFormat` string to the current enum.

```ts
import { getLastDeploymentId } from '@epam/ai-dial-chat-hooks';

getLastDeploymentId(conversation.messages); // string | null
```

### getTimeOfDayGreeting

Returns a time-of-day greeting string (morning/afternoon/evening/night, with/without a first name) from a pre-translated `GreetingTranslations` object.

```ts
import {
  getTimeOfDayGreeting,
  type GreetingTranslations,
} from '@epam/ai-dial-chat-hooks';

const translations: GreetingTranslations = {
  morningWithName: 'Good morning, {{name}}',
  morningNoName: 'Good morning',
  afternoonWithName: 'Good afternoon, {{name}}',
  afternoonNoName: 'Good afternoon',
  eveningWithName: 'Good evening, {{name}}',
  eveningNoName: 'Good evening',
  nightWithName: 'Good night, {{name}}',
  nightNoName: 'Good night',
};

getTimeOfDayGreeting(new Date().getHours(), translations, 'Ada');
```

### getQuickAppConversationStarters

Parses a Quick App's raw `conversationStarters` schema value into starter options, intro text, and whether the chat input should stay disabled.

```ts
import { getQuickAppConversationStarters } from '@epam/ai-dial-chat-hooks';

const { starters, introText, isChatMessageInputDisabled } =
  getQuickAppConversationStarters(schema.conversationStarters);
```

### getStarterPopulateText / getStartersFromSchema

Extracts starter-button options (and the schema property key and description) from a deployment configuration schema, and resolves the text to populate when a starter is selected.

```ts
import { getStartersFromSchema } from '@epam/ai-dial-chat-hooks';

const { starters, propertyKey, description } = getStartersFromSchema(
  deploymentConfiguration,
);
```

### sanitizeAnnouncementHtml / sanitizeAnnouncementMessageHtml / hasStructuredAnnouncement / hasAnnouncementContent / buildAnnouncementSignature

Announcement-banner helpers: sanitize operator-supplied HTML, check whether structured (`title`/`description`) or any content is present, and build the content-keyed signature used to track dismissal.

The two sanitizers differ in the tags they keep, because the two banner layouts differ. `sanitizeAnnouncementHtml` is for the structured `description`, which renders as one truncating line, so it keeps inline markup only — `a`, `b`, `strong`, `em`, `br`, `span`. `sanitizeAnnouncementMessageHtml` is for the legacy `html` message, a free-standing block, so it additionally keeps `u` and `p`. Both keep `href`, `target` and `rel` on links, drop everything else including `style`, and force `rel="noopener noreferrer"` on any link that already carries `target="_blank"`.

```ts
import {
  hasAnnouncementContent,
  sanitizeAnnouncementMessageHtml,
  type AnnouncementContent,
} from '@epam/ai-dial-chat-hooks';

const content: AnnouncementContent = {
  title: 'Maintenance window',
  description: null,
  html: null,
};

hasAnnouncementContent(content); // true

sanitizeAnnouncementMessageHtml('<p>Upgraded to <strong>1.47</strong></p>');
// '<p>Upgraded to <strong>1.47</strong></p>'
```

### sanitizeFooterHtml / formatAppVersion

Sanitizes footer-message HTML to an allowed tag/attribute set, and normalises a version string for display (`'0.45.0'` -> `'v0.45.0'`, `'v0.45.0'` left unchanged).

```ts
import { formatAppVersion } from '@epam/ai-dial-chat-hooks';

formatAppVersion('0.45.0'); // 'v0.45.0'
```

### shouldWatchForDisplayNameUpdate

Returns `true` when a conversation's first user/assistant exchange is complete and LLM-generated naming may still run for it.

```ts
import { shouldWatchForDisplayNameUpdate } from '@epam/ai-dial-chat-hooks';

if (shouldWatchForDisplayNameUpdate(conversation)) {
  // poll for the generated display name
}
```

### toOverlayMessages

Maps chat messages to the DIAL Chat Overlay protocol's message shape.

```ts
import { toOverlayMessages } from '@epam/ai-dial-chat-hooks';

const overlayMessages = toOverlayMessages(conversation.messages);
```

## Catalog Mapping Utilities

Pure mappers from DIAL Core deployment/prompt/skill/toolset DTOs into `@epam/ai-dial-catalog`'s `CatalogItem`/`CatalogItemTabData` shapes. Every label is a fixed English string — i18n stays at the app edge, passed in via a `*Labels` parameter.

### encodeDeploymentId / findDeploymentByIdOrReference

Percent-encodes each `/`-separated segment of a deployment/application id, and finds a deployment matching an id or (fallback) `reference`.

```ts
import { encodeDeploymentId } from '@epam/ai-dial-chat-hooks';

encodeDeploymentId('applications/bucket/My App__1.0');
// 'applications/bucket/My%20App__1.0'
```

### buildChatCompletionsUrl / buildResponsesUrl / buildDeploymentConnectApi

Builds the "Connect" tab's Chat Completions and/or Responses API endpoint entries for a model or application deployment, based on which generation APIs it reports supporting.

```ts
import { buildDeploymentConnectApi } from '@epam/ai-dial-chat-hooks';

const api = buildDeploymentConnectApi(baseUrl, deploymentId, {
  hasChatCompletion: true,
  hasResponsesApi: false,
});
```

### McpResourceKind / resolveMcpResourceKind / buildConnectApi / buildToolsetMcpUrl / buildApplicationMcpUrl

Resolves which MCP resource kind (toolset or application) a catalog item exposes, and builds the "Connect" tab's MCP endpoint data for it.

```ts
import {
  resolveMcpResourceKind,
  buildConnectApi,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

const kind = resolveMcpResourceKind(CatalogEntityType.Toolset);
const api = kind && buildConnectApi(baseUrl, toolsetId, kind);
```

### mapDeploymentLimitsToInput

Maps a deployment's monthly token-limit response into a display-ready `MonthlyUsageLimit` (`used`/`total`/`remaining`/`usedPercent`), or `undefined` when the backend reports no usable limit.

```ts
import { mapDeploymentLimitsToInput } from '@epam/ai-dial-chat-hooks';

const usage = mapDeploymentLimitsToInput(deploymentLimitsDto);
```

### mapDeploymentLimitsDtoToCatalogLimits

Maps a deployment limits DTO into display-ready `CatalogItemLimits` — a single "token limits" group of day/week/month `UsageLimitProgressRow` entries plus the worst-case `CatalogLimitStatus` across them — or `undefined` when no qualifying stats exist. Each row carries a "spent" caption built from the sibling cost stat for the same period, and a row whose total is effectively unlimited gets a "follows cost limit" note instead of a total. Stat labels and value/aria formatters are injected through a `DeploymentLimitsLabels` object so the function stays i18n-free.

```ts
import {
  mapDeploymentLimitsDtoToCatalogLimits,
  type DeploymentLimitsLabels,
} from '@epam/ai-dial-chat-hooks';

const labels: DeploymentLimitsLabels = {
  tokenGroup: t('catalog.details.limits.tokenGroup'),
  tokensPerDay: t('catalog.details.limits.tokensPerDay'),
  tokensPerWeek: t('catalog.details.limits.tokensPerWeek'),
  tokensPerMonth: t('catalog.details.limits.tokensPerMonth'),
  followsCostLimit: t('catalog.details.limits.followsCostLimit'),
  formatSpentCaption: (amount) =>
    t('catalog.details.limits.spentLabel', { amount }),
  formatValueLabel: (used, total) =>
    t('catalog.details.limits.value', { used, total }),
  formatProgressAriaLabel: ({ label, used, total }) =>
    t('catalog.details.limits.progressAriaLabel', { label, used, total }),
  formatFollowsCostLimitAriaLabel: ({ label, used }) =>
    t('catalog.details.limits.followsCostLimitAriaLabel', { label, used }),
};

const limits = mapDeploymentLimitsDtoToCatalogLimits(dto, labels);
```

### mapEntityDetailsToCatalogDetails / mapDeploymentDetailsDtoToEntityDetails / mapToolsetCredentials

Converts a backend `DeploymentDetailsDto` (model/application/toolset) into the strongly-typed `EntitySpecificDetails` domain model, then into the catalog UI's `CatalogItemTabData`; `mapToolsetCredentials` maps a toolset's specification into the credential-status shape used to refresh the details panel after login/logout.

```ts
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
} from '@epam/ai-dial-chat-hooks';

const entityDetails = mapDeploymentDetailsDtoToEntityDetails(detailsDto);
const tabData = mapEntityDetailsToCatalogDetails(entityDetails);
```

### mapDeploymentToCatalogItem / mapToolsetToCatalogItem / mapDeploymentToolsetCredentials / resolveDeploymentFolder

Maps a deployment or toolset listing row into a catalog `CatalogItem`. Both take a `folderLabels` (`DeploymentFolderLabels`, the translated Personal/Shared/Public folder labels) and a `resolveIconUrl` callback — the host owns icon-URL construction, not the library.

```ts
import {
  mapDeploymentToCatalogItem,
  type DeploymentFolderLabels,
} from '@epam/ai-dial-chat-hooks';

const folderLabels: DeploymentFolderLabels = {
  personal: 'My workspace',
  shared: 'Shared with me',
  public: 'Public',
};

const item = mapDeploymentToCatalogItem(deploymentDto, {
  folderLabels,
  activeLocale: 'en-US',
  primaryLocale: 'en',
  resolveIconUrl: (iconUrl) => iconUrl && resolveMyIconUrl(iconUrl),
});
```

### mapPromptToCatalogItem / buildPromptOverview / isOrganisationPromptItem

Maps a prompt DTO into a catalog `CatalogItem`, given the source namespace it came from (`PromptSource`), folder labels, Overview-tab labels, and favorited-id lookup.

```ts
import {
  mapPromptToCatalogItem,
  PromptSource,
  type PromptOverviewLabels,
} from '@epam/ai-dial-chat-hooks';

const overviewLabels: PromptOverviewLabels = {
  authorLabel: 'Author',
  updatedLabel: 'Updated',
  sectionTitle: 'Details',
};

const item = mapPromptToCatalogItem(promptDto, {
  folderLabels,
  overviewLabels,
  source: PromptSource.Personal,
  favoriteIds: new Set(['my-prompt-path']),
});
```

### mapSkillToCatalogItem / buildSkillOverview / buildSkillContentTree / resolveSkillManifestFileId / resolveSkillFileDownloadPath / readSkillFileBytes / readSkillManifest

Maps a skill's DIAL Core metadata into a catalog `CatalogItem`; the remaining functions build the Overview tab's specification/details sections, the Content tab's hierarchical file tree, resolve the manifest file's opaque listing id, resolve a file-listing id to its download path, and read a skill file/manifest response's bytes/text bounded by `SKILL_MANIFEST_MAX_BYTES`.

```ts
import {
  mapSkillToCatalogItem,
  buildSkillOverview,
  SkillSource,
  type SkillOverviewLabels,
} from '@epam/ai-dial-chat-hooks';

const item = mapSkillToCatalogItem(skillMetadataDto, {
  folderLabels,
  source: SkillSource.Personal,
  favoriteIds: new Set(['skills/my-bucket/my-skill']),
});

const overviewLabels: SkillOverviewLabels = {
  whenToUseLabel: 'When to use',
  allowedToolsLabel: 'Allowed tools',
  bundledResourcesLabel: 'Bundled resources',
  specificationSectionTitle: 'Specification',
  authorLabel: 'Author',
  updatedLabel: 'Updated',
  fileCountLabel: 'Files',
  detailsSectionTitle: 'Details',
};

const overview = buildSkillOverview(
  skillMetadataDto,
  files,
  about,
  overviewLabels,
);
```

### toPublishEntityType / mapPublishHistoryEntryDto / mapPublishConversationResultDto

Maps a catalog entity type to the publish API's entity-type path param (`CatalogPublishEntityType`), and maps publish-history API responses into the publish panel's `PublishHistoryEntry` model.

```ts
import { toPublishEntityType } from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

toPublishEntityType(CatalogEntityType.Skill); // 'skill'
```

## Prompt Utilities

### validatePromptName / validatePromptDescription / validatePromptContent / getRemainingCharacters / buildPromptPath

Client-side mirrors of the backend's prompt-editor validation rules (name pattern/length, description/content length limits), plus a character-remaining counter for length-limited fields and a folder-path/name joiner.

```ts
import {
  validatePromptName,
  PromptFieldError,
  getRemainingCharacters,
  PROMPT_NAME_MAX_LENGTH,
} from '@epam/ai-dial-chat-hooks';

const error = validatePromptName('My Prompt'); // PromptFieldError | null
const remaining = getRemainingCharacters('My Prompt', PROMPT_NAME_MAX_LENGTH);
```

### PromptSource / parsePromptResourceUrl

`PromptSource` identifies which prompt namespace a catalog prompt item came from. `CatalogItem.id` for a prompt is always the full `prompts/{bucket}/{path}` resource path, regardless of source; `parsePromptResourceUrl` splits it back into `{ bucket, path }` for the one caller that still needs the bucket-relative sub-path on its own — the organisation (public) prompt read, whose endpoint kept a bucket-relative `path` argument.

```ts
import { parsePromptResourceUrl, PromptSource } from '@epam/ai-dial-chat-hooks';

PromptSource.SharedWithMe; // 'sharedWithMe'
parsePromptResourceUrl('prompts/public/Work/AI/summarize');
// { bucket: 'public', path: 'Work/AI/summarize' }
```

### buildPromptExportEnvelope / serializePromptExport / buildPromptExportFileName

Builds a prompt's download envelope (including its folder chain), serializes it to a pretty-printed JSON `Blob`, and builds the download file name.

```ts
import {
  buildPromptExportEnvelope,
  serializePromptExport,
  buildPromptExportFileName,
} from '@epam/ai-dial-chat-hooks';

const envelope = buildPromptExportEnvelope(promptDto);
const blob = serializePromptExport(envelope);
const fileName = buildPromptExportFileName(promptDto.name, 'ai_dial');
```

## Scheduled-Task Utilities

### mapFormValuesToCreateBody / mapFormValuesToUpdateBody / mapScheduledTaskDtoToFormValues

Maps validated scheduled-task create/edit form values to their request bodies (converting local wall-clock time to the UTC cron fields DIAL Scheduler expects), and inverts that mapping back to editable form values — failing closed with an `UnsupportedTriggerReason` when a task's trigger cannot be represented losslessly by the editor.

```ts
import {
  mapFormValuesToCreateBody,
  mapScheduledTaskDtoToFormValues,
} from '@epam/ai-dial-chat-hooks';

const body = mapFormValuesToCreateBody(formValues);
const result = mapScheduledTaskDtoToFormValues(scheduledTaskDto);
if (result.ok) {
  // result.values: ScheduledTaskCreateFormValues
}
```

## Catalog Hooks

### useCatalogItemDetails

Headless hook for fetching and normalizing full detail data for any catalog item (model, agent, toolset, skill, or prompt). Accepts an injected `CatalogDetailsApi` adapter — the hook never constructs or imports a client itself. Returns three stable callbacks.

```ts
import { useCatalogItemDetails } from '@epam/ai-dial-chat-hooks';

const { onFetchDetails, onLoadContentFile, onLoadSkillDetailsFile } =
  useCatalogItemDetails({
    api, // CatalogDetailsApi — host-configured adapter
    skills, // SkillMetadataItemDto[] — all skills visible to the user
    isAdmin, // boolean
    dialCoreExternalUrl, // string | null | undefined
    skillOverviewLabels, // SkillOverviewLabels
    promptOverviewLabels, // PromptOverviewLabels
    deploymentLimitsLabels, // DeploymentLimitsLabels
  });

// Fetch full details for a catalog item (returns undefined on failure)
const details = await onFetchDetails(catalogItem);

// Load the text content of a file within the open skill package
const text = await onLoadContentFile(fileId);

// Download preview bytes for a skill file (throws on HTTP error)
const { bytes, mimeType } = await onLoadSkillDetailsFile(fileId);
```

#### API

`CatalogDetailsApi` is the injected adapter interface. Its methods mirror the server-api wrapper signatures used by the DIAL Chat app but carry no base URL, auth, CSRF, or context — the host constructs and configures the adapter.

**Options** (`UseCatalogItemDetailsOptions`):

| Name                     | Type                          | Description                                                  |
| ------------------------ | ----------------------------- | ------------------------------------------------------------ |
| `api`                    | `CatalogDetailsApi`           | Host-configured API adapter.                                 |
| `skills`                 | `SkillMetadataItemDto[]`      | All skills visible to the user (personal + shared + public). |
| `isAdmin`                | `boolean`                     | Whether the user has admin privileges.                       |
| `dialCoreExternalUrl`    | `string \| null \| undefined` | DIAL Core external base URL for the Connect tab.             |
| `skillOverviewLabels`    | `SkillOverviewLabels`         | Labels for skill overview sections.                          |
| `promptOverviewLabels`   | `PromptOverviewLabels`        | Labels for prompt overview sections.                         |
| `deploymentLimitsLabels` | `DeploymentLimitsLabels`      | Labels for the deployment limits table.                      |

**Returns** (`UseCatalogItemDetailsResult`):

| Name                     | Type                                                                         | Description                                                  |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `onFetchDetails`         | `(item: CatalogItem) => Promise<CatalogItemDetailsFetchResult \| undefined>` | Fetches full detail data; returns `undefined` on failure.    |
| `onLoadContentFile`      | `(fileId: string) => Promise<string \| undefined>`                           | Loads text content for a file within the open skill package. |
| `onLoadSkillDetailsFile` | `(fileId: string) => Promise<SkillFileContent>`                              | Downloads preview bytes; throws on HTTP error.               |

### resolveCatalogPrimaryAction

Pure async resolver for the catalog's "Use" primary action. Returns a discriminated `CatalogPrimaryActionResult` — either a deployment selection or a resolved prompt with optional parameter placeholders. Does not navigate, select, or show notifications — those remain the caller's responsibility.

```ts
import {
  resolveCatalogPrimaryAction,
  CatalogPrimaryActionType,
  type CatalogPrimaryActionResult,
} from '@epam/ai-dial-chat-hooks';

const action: CatalogPrimaryActionResult = await resolveCatalogPrimaryAction(
  catalogItem,
  fetchPrompt,
);

if (action.kind === CatalogPrimaryActionType.Prompt) {
  // action.id, action.name, action.description, action.content, action.hasParameters
} else {
  // CatalogPrimaryActionType.Deployment — action.id
}
```

### Catalog derivation helpers

Pure immutable helpers for deriving UI state from catalog item lists. All accept readonly arrays and return new arrays or sets without mutating their inputs.

```ts
import {
  filterCatalogItemsBySelector,
  filterHiddenOwnedItems,
  deriveFavoriteItems,
  deriveAvailableTabIds,
  reconcileFilterTopics,
} from '@epam/ai-dial-chat-hooks';

// Keep only items whose type is in visibleTypes (for selector mode)
const selected = filterCatalogItemsBySelector(
  items,
  new Set([CatalogEntityType.Model]),
);

// Remove items owned by the current user when hideOwned is true
const visible = filterHiddenOwnedItems(items, hideOwned);

// Extract user-favorited items in original order
const favorites = deriveFavoriteItems(items);

// Derive available tab ids (in tabOrder sequence) from present entity types
const tabs = deriveAvailableTabIds(items, tabOrder);

// Intersect persisted filter topics with those that still exist in items
const topics = reconcileFilterTopics(persistedTopics, items);
```

## Skill Utilities

### isValidSkillRelativePath / normalizeSkillName / buildSkillManifest / buildSkillManifestFromFrontmatter / parseSkillManifest / unpackSkillArchive

Client-side skill-authoring helpers: validates a relative file path against the backend's naming rules (inline feedback only — the server stays authoritative), normalizes a skill name to the DIAL naming convention, builds/parses a `SKILL.md`'s YAML frontmatter plus instructions body, and unpacks a whole-skill ZIP archive.

```ts
import {
  buildSkillManifest,
  parseSkillManifest,
  normalizeSkillName,
} from '@epam/ai-dial-chat-hooks';

const manifestText = buildSkillManifest({
  name: normalizeSkillName('My Skill'),
  description: 'Summarizes documents',
  instructions: 'You are a summarization assistant...',
});

const { frontmatter, instructions } = parseSkillManifest(manifestText);
```

### parseSkillManifestDocument

Splits a `SKILL.md` into its frontmatter fields (`name`, `description`, and recognised `about.*` fields) and its prose body. Never throws — a file with no frontmatter fence resolves to the whole input as `body`.

```ts
import { parseSkillManifestDocument } from '@epam/ai-dial-chat-hooks';

const { name, description, about, body } =
  parseSkillManifestDocument(rawManifestText);
```

### skillFileToAttachment

Converts a skill supporting file's in-memory bytes into the `Attachment` shape the chat attachment-canvas pipeline expects, so it can be previewed the same way a chat attachment is.

```ts
import { skillFileToAttachment } from '@epam/ai-dial-chat-hooks';

const attachment = skillFileToAttachment(fileTreeNode, {
  bytes: fileBytes,
  mimeType: 'text/markdown',
});
```

### nameFromPath / skillFileBytesToBlob / buildSkillManifestForSubmit / buildSkillFilesPayload

Small file-tree and submit-payload helpers shared by skill-editing UI: resolves a skill-relative path's display name (its final segment), wraps raw supporting-file bytes in a `Blob` (copying them so the source buffer can be reused) ahead of an upload request, builds `SKILL.md` for a create/edit submission (reassigning onto the loaded/imported frontmatter when one exists, otherwise building fresh), and builds the ordered `filePaths`/`files` payload `createSkill`/`updateSkill` expect from the editor's file tree and in-memory content map.

```ts
import {
  buildSkillFilesPayload,
  buildSkillManifestForSubmit,
  nameFromPath,
  skillFileBytesToBlob,
} from '@epam/ai-dial-chat-hooks';

nameFromPath('agents/analyzer.md'); // 'analyzer.md'
const blob = skillFileBytesToBlob(fileBytes);

const skillManifest = buildSkillManifestForSubmit(
  frontmatter,
  'good-morning',
  'Summarizes documents',
  'You are a summarization assistant...',
);
const { filePaths, files } = buildSkillFilesPayload(
  fileTreeNodes,
  filesContent,
);
```

### useSkillEditorLoad

Owns the edit-mode skill download/unpack/parse flow: the in-memory supporting-file map, the loaded manifest values and frontmatter, the concurrency ETag, and the `SkillEditorLoadState` machine driving a skill-editing form's loading/error/forbidden/not-found presentation. Create mode never leaves `Loaded` and starts with empty state. Accepts an already-configured `client` (the host's own `downloadSkill`/`downloadSkillFile`/`listSkillFiles` wrappers) rather than importing or configuring one itself.

```ts
import {
  useSkillEditorLoad,
  SkillEditorLoadState,
  type SkillEditorLoadClient,
} from '@epam/ai-dial-chat-hooks';

// Host-owned adapter over the generated `SkillsApi` client — see
// `SkillEditorLoadClient` for the exact shape. The library never imports or
// configures a client itself.
const client: SkillEditorLoadClient = {
  downloadSkill: (bucket, path) => skillsApi.downloadSkill(bucket, path),
  downloadSkillFile: (bucket, path, filePath) =>
    skillsApi.downloadSkillFile(bucket, path, filePath),
  listSkillFiles: (params) => skillsApi.listSkillFiles(params),
};

const { loadState, loadedValues, files, filesContentRef, retryLoad } =
  useSkillEditorLoad({ isEditMode, bucket, skillPath, client });

if (loadState === SkillEditorLoadState.Loading) {
  // render a loading state
}
```

### useSkillEditorSubmit

Owns a Skill Editor's create/edit submission flow: field validation, building and (in edit mode) merging the `SKILL.md` manifest, calling `client.createSkill`/`client.updateSkill`, and mapping the resulting success/error/conflict outcomes to presentable state. Accepts an already-configured `client`, a `messages` object, and `onNavigate`/`onNotify` callbacks rather than importing routing, notification, or i18n modules itself.

```ts
import {
  useSkillEditorSubmit,
  type SkillEditorSubmitClient,
} from '@epam/ai-dial-chat-hooks';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';

// Host-owned adapter over the generated `SkillsApi` client — see
// `SkillEditorSubmitClient` for the exact shape.
const client: SkillEditorSubmitClient = {
  createSkill: (bucket, path, skillManifest, filePaths, files) =>
    skillsApi.createSkill(bucket, path, skillManifest, filePaths, files),
  updateSkill: (bucket, path, skillManifest, filePaths, files, ifMatch) =>
    skillsApi.updateSkill(
      bucket,
      path,
      skillManifest,
      filePaths,
      files,
      ifMatch,
    ),
};

const { phase, errors, submitError, conflict, clearConflict, handleSubmit } =
  useSkillEditorSubmit({
    bucket,
    isEditMode,
    files,
    filesContentRef,
    frontmatterRef,
    loadedPathRef,
    etagRef,
    returnUrl,
    refetchSkills,
    client,
    messages: {
      required: 'Required',
      nameInvalid: 'Invalid name',
      nameConflict: 'A skill with this name already exists',
      archiveTooLarge: 'The uploaded content is too large',
      serviceUnavailable: 'Service is temporarily unavailable',
      pathInvalid: 'Invalid path',
      saveError: 'Could not save the skill',
      saveSuccessTitle: 'Skill created',
      createSuccess: (name) => `"${name}" has been created.`,
      updateSuccessTitle: 'Skill updated',
      updateSuccess: (name) => `"${name}" has been updated.`,
      conflictMessage: 'Someone else changed this skill',
    },
    onNavigate: (url) => navigate(url),
    onNotify: (notification) => showNotification(notification),
  });
```

### useSkillFileActions

Owns a Skill Editor's batch file upload workflow: validating a staged batch, committing it atomically (supporting files plus an optional `SKILL.md` manifest import, with a confirmation gate), and removing already-committed nodes. Accepts a `messages` object (host-translated strings) rather than resolving them itself.

```ts
import { useSkillFileActions } from '@epam/ai-dial-chat-hooks';

const { fileActions, pendingManifestImport, resolveManifestImport } =
  useSkillFileActions({
    files,
    setFiles,
    filesContentRef,
    frontmatterRef,
    loadedValues,
    setLoadedValues,
    isEditMode,
    isDirty,
    setSelectedPath,
    messages: {
      required: 'Required',
      pathReserved: 'Reserved name',
      pathInvalid: 'Invalid path',
      pathDuplicate: 'Duplicate path',
      fileTooLarge: (maxSize) => `File exceeds ${maxSize}`,
      manifestCasingInvalid: 'Must be exactly SKILL.md',
      manifestDuplicate: 'Only one SKILL.md allowed',
      manifestInvalidUtf8: 'Invalid UTF-8',
      manifestInvalidFrontmatter: 'Invalid frontmatter',
      totalSizeExceeded: 'Total size exceeded',
      totalCountExceeded: 'Total count exceeded',
      manifestNameMismatch: "Manifest name doesn't match this skill",
      manifestImportDeclined: 'Manifest import was declined',
      saveError: 'Could not save the skill',
    },
  });
```

### useSkillFilePreview

Headless hook that manages the lifecycle of a lazy skill-file preview load. Starts a new load on mount and whenever `fileId` changes, classifies HTTP 403 rejections as `Forbidden` and all other failures as `Generic`, and discards settlements from superseded or unmounted loads. The hook does not open the attachment canvas — the host component is responsible for bridging the result into the canvas protocol and calling `openCanvas`.

```ts
import {
  useSkillFilePreview,
  SkillPreviewErrorKind,
} from '@epam/ai-dial-chat-hooks';

const { isLoading, content, error } = useSkillFilePreview({
  fileId,
  onLoadFile, // (fileId: string) => Promise<SkillFileContent> — host-owned
});

if (error === SkillPreviewErrorKind.Forbidden) {
  // open a "403 forbidden" canvas overlay
} else if (error === SkillPreviewErrorKind.Generic) {
  // open a generic load-error canvas overlay
} else if (content != null) {
  // bridge content.bytes / content.mimeType into the canvas sync protocol
}
```

#### API

**Options** (`UseSkillFilePreviewOptions`):

| Name         | Type                                            | Description                                                                                                                     |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `fileId`     | `string`                                        | Opaque id of the selected skill file. Changing this resets all state and starts a new load; stale resolutions are discarded.    |
| `onLoadFile` | `(fileId: string) => Promise<SkillFileContent>` | Host-owned loader; resolves with raw bytes when the request succeeds. The hook never constructs a URL or imports a REST client. |

**Returns** (`UseSkillFilePreviewResult`):

| Name        | Type                            | Description                                                       |
| ----------- | ------------------------------- | ----------------------------------------------------------------- |
| `isLoading` | `boolean`                       | `true` while the async load is in flight.                         |
| `content`   | `SkillFileContent \| null`      | Resolved file content, or `null` while loading or after an error. |
| `error`     | `SkillPreviewErrorKind \| null` | Classified load error, or `null` while loading or after success.  |

`SkillPreviewErrorKind` values: `Forbidden` (HTTP 403), `Generic` (any other failure).

### validateSkillFileBatch

Validates a staged skill-file upload batch against per-file/limit and path-safety rules, in-batch and against-existing duplicates, and projected total size/count — mirroring the BFF's authoritative limits for immediate feedback; the server remains the final gate. Detects at most one root `SKILL.md` in the batch as a manifest-import candidate.

```ts
import { validateSkillFileBatch } from '@epam/ai-dial-chat-hooks';

const { results, batchErrors, manifestCandidate } =
  await validateSkillFileBatch(candidates, {
    existingPaths: ['agents/analyzer.md'],
    existingTotalBytes: 2048,
    manifestByteLength: 256,
    messages: {
      required: 'Required',
      pathReserved: 'Reserved name',
      pathInvalid: 'Invalid path',
      pathDuplicate: 'Duplicate path',
      fileTooLarge: (maxSize) => `File exceeds ${maxSize}`,
      manifestCasingInvalid: 'Must be exactly SKILL.md',
      manifestDuplicate: 'Only one SKILL.md allowed',
      manifestInvalidUtf8: 'Invalid UTF-8',
      manifestInvalidFrontmatter: 'Invalid frontmatter',
      totalSizeExceeded: 'Total size exceeded',
      totalCountExceeded: 'Total count exceeded',
    },
  });
```

### Supporting types and constants

- **`SkillSource`** — which skill namespace a catalog skill item came from: `Personal`, `SharedWithMe`, `Public`.
- **`PUBLIC_SKILL_BUCKET`** — the DIAL Core bucket holding organisation-wide skills.
- **`SKILL_MANIFEST_MAX_BYTES`** / **`SKILL_LISTING_PAGE_SIZE`** / **`SKILL_LISTING_MAX_PAGES`** — size/pagination bounds for skill manifest reads and skill listings.
- **`SkillEntityDetails`** — a skill's parsed manifest details (`{ about?: SkillAboutDetails }`).
- **`ParsedSkillResourceUrl`** / **`parseSkillResourceUrl`** — splits a `skills/{bucket}/{path}` resource URL into its bucket and path, or `null` if it doesn't match that shape.

## File & Attachment Utilities

### sanitizeFileName / splitFileNameExtension / trimFileNameToByteLimit

Sanitizes a filename for upload (forbidden characters replaced, trailing dots/whitespace trimmed, capped to 255 UTF-8 bytes), splitting/trimming helpers it is built on.

```ts
import { sanitizeFileName } from '@epam/ai-dial-chat-hooks';

sanitizeFileName('report:final?.pdf'); // 'report_final_.pdf'
```

### isDialFileId / resolveRelativeDialFilePath / resolveDialFileBucketAndPath

Recognizes a DIAL Core file id (`files/{bucket}/{path}`) and resolves it to a bucket-relative path or its `{ bucket, path }` parts.

```ts
import { resolveDialFileBucketAndPath } from '@epam/ai-dial-chat-hooks';

resolveDialFileBucketAndPath('files/my-bucket/reports/q1.pdf');
// { bucket: 'my-bucket', path: 'reports/q1.pdf' }
```

### openAnnotationAttachment

Default click behavior for a cited/referenced attachment: triggers a browser download for DIAL-hosted files via the injected `resolveDownloadUrl`, otherwise opens the URL in a new tab.

```ts
import { openAnnotationAttachment } from '@epam/ai-dial-chat-hooks';

openAnnotationAttachment(attachmentResource, (fileId) =>
  myResolveFileDownloadUrl(fileId),
);
```

### Attachment canvas content resolvers

A family of resolvers that turn a `DisplayAttachment` into the content payload `@epam/ai-dial-attachment-canvas` renders (image, plain text, markdown, code, HTML, PDF, OOXML, JSON, or a custom visualizer), plus the annotation-specific PDF resolvers and the shared LRU fetch cache they use. Every resolver takes the same host-injected `AttachmentCanvasUrlResolvers` — DIAL-file URL resolution is host-owned, since it encodes the app's own file-download endpoint.

```ts
import {
  resolveMarkdownCanvasContent,
  resolvePdfCanvasContent,
  clearAttachmentCache,
  type AttachmentCanvasUrlResolvers,
} from '@epam/ai-dial-chat-hooks';

const resolvers: AttachmentCanvasUrlResolvers = {
  resolveDialFileDownloadUrl: (fileId) => myResolveFileDownloadUrl(fileId),
  resolveDialUrl: (attachment) => myResolveDisplayAttachmentUrl(attachment),
};

const content = await resolveMarkdownCanvasContent(attachment, resolvers);

// on conversation navigation:
clearAttachmentCache();
```

Also exports `resolveImageCanvasContent`, `resolveTextCanvasContent`, `resolveCodeCanvasContent`, `resolveHtmlCanvasContent`, `resolveOoxmlCanvasContent`, `resolveJsonCanvasContent`, `resolveVisualizerCanvasContent`, `annotationToPdfCanvasContent`, `referenceAttachmentToPdfCanvasContent`, `hasAttachmentTextSource`, `getUrlFileName`, `isExternalSourcePreviewable`, and `resolveExternalSourceContentType` (corrects a content type that mislabels an external citation — e.g. a web-search grounding API reporting `text/markdown` for every reference — against a `.pdf` URL extension).

### attachmentDtoToDisplayAttachment / attachmentDtosToDisplayAttachments / annotationToDisplayAttachment

Maps Chat API message-attachment DTOs (and an annotation's source attachment) to the display-only `DisplayAttachment` model UI components consume.

```ts
import { attachmentDtosToDisplayAttachments } from '@epam/ai-dial-chat-hooks';

const displayAttachments = attachmentDtosToDisplayAttachments(dtos, {
  resolvePreviewUrl: (url) => resolveMyIconUrl(url),
});
```

### prepareDownloadDestination

Resolves where a download should be written: the browser's native "Save As" picker (`window.showSaveFilePicker`) when available, otherwise a plain blob download. Resolves to `Cancelled` if the user dismisses the picker.

```ts
import { prepareDownloadDestination } from '@epam/ai-dial-chat-hooks';

const destination = await prepareDownloadDestination(
  'report.pdf',
  'application/pdf',
);
```

## Conversation Panel Controller

Five hooks and two utility functions extracted from `ConversationPanelView.tsx` make the conversation-panel controller logic reusable. They carry no dependency on `@epam/ai-dial-conversation-panel` or `ConversationItem`. Both libraries consume the canonical `FilterTab` enum from `@epam/ai-dial-chat-shared`, so neither library depends on the other.

### useConversationPanelItems

Maps `ConversationListItemDto[]` to `ConversationItem[]` for `ConversationPanel`, resolving icons, tooltips, hrefs, and task badges through injected callbacks so the hook stays free of `/api` routes, `resolveCatalogIconUrl`, or routing utilities.

```tsx
import { useConversationPanelItems } from '@epam/ai-dial-chat-hooks';
import type {
  ConversationListItemDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';

const conversations = useConversationPanelItems({
  items,
  deployments,
  isDeploymentsLoading,
  toPanelConversationId,
  resolveIconUrl: (d?: DeploymentItemDto) => d?.iconUrl ?? undefined,
  resolveIconTooltip: (d: DeploymentItemDto | undefined, fallback: string) =>
    d?.displayName ?? fallback,
  resolveHref: (id) => `/chat/${id}`,
  resolveTaskBadge: (item: ConversationListItemDto) =>
    item.isScheduledTask
      ? { label: 'Task', isUnread: item.isUnread ?? false }
      : undefined,
});
```

#### API

**Parameters** (`UseConversationPanelItemsParams`):

| Name                    | Type                                                                                   | Description                                                              |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `items`                 | `ConversationListItemDto[]`                                                            | Raw DTOs from the API.                                                   |
| `deployments`           | `DeploymentItemDto[]`                                                                  | Current deployment catalogue used for icon/tooltip resolution.           |
| `isDeploymentsLoading`  | `boolean`                                                                              | When `true`, all items are returned with `isIconLoading: true`.          |
| `toPanelConversationId` | `(id: string) => string`                                                               | Maps a DTO `id` to the panel-space identifier.                           |
| `resolveIconUrl`        | `(deployment?: DeploymentItemDto) => string \| undefined`                              | Returns the resolved icon URL for a deployment.                          |
| `resolveIconTooltip`    | `(deployment?: DeploymentItemDto, fallback: string) => string \| undefined`            | Returns the tooltip text for the icon.                                   |
| `resolveHref`           | `(id: string) => string`                                                               | Converts a panel-space ID to a navigation href.                          |
| `resolveTaskBadge`      | `(item: ConversationListItemDto) => { label: string; isUnread: boolean } \| undefined` | Optional; returns the badge descriptor for scheduled-task conversations. |

**Returns**: `ConversationItem[]` — the mapped panel items, memoized by reference-stable inputs.

### getConversationSource

Classifies a conversation using the canonical `FilterTab` values without depending on the conversation-panel package.

```ts
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { getConversationSource } from '@epam/ai-dial-chat-hooks';

getConversationSource({ sharedWithMe: true, publishedWithMe: false });
// FilterTab.Shared
```

The function accepts `Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>`. `sharedWithMe` takes precedence over `publishedWithMe`; conversations with neither flag return `FilterTab.MyChats`.

### useConversationLookupMaps

Maintains two `Map`-backed lookups — panel-id → context-id and panel-id → raw DTO — rebuilt only when `items` or `toPanelConversationId` changes.

```tsx
import { useConversationLookupMaps } from '@epam/ai-dial-chat-hooks';

const { toContextId, getRawItem } = useConversationLookupMaps({
  items,
  toPanelConversationId,
});

const contextId = toContextId(panelItem.id); // string | undefined
const rawItem = getRawItem(panelItem.id); // ConversationListItemDto | undefined
```

#### API

**Parameters** (`UseConversationLookupMapsParams`):

| Name                    | Type                        | Description                                    |
| ----------------------- | --------------------------- | ---------------------------------------------- |
| `items`                 | `ConversationListItemDto[]` | Raw DTOs from the API.                         |
| `toPanelConversationId` | `(id: string) => string`    | Maps a DTO `id` to the panel-space identifier. |

**Returns** (`ConversationLookupMaps`):

| Name          | Type                                                        | Description                                           |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `toContextId` | `(panelId: string) => string \| undefined`                  | Reverse-maps a panel id back to its context (DTO) id. |
| `getRawItem`  | `(panelId: string) => ConversationListItemDto \| undefined` | Returns the raw DTO for a panel id.                   |

### useActiveConversationSync

Keeps the panel's highlighted row in sync with the app's active conversation and marks a viewed conversation when the panel renders it. Returns the panel-space id to highlight, or `undefined` when none is active.

```tsx
import { useActiveConversationSync } from '@epam/ai-dial-chat-hooks';

const panelActiveConversationId = useActiveConversationSync({
  activeConversationId,
  items,
  refreshConversations,
  markConversationViewed,
  conversationIdsMatch,
  toPanelConversationId,
});
```

#### API

**Parameters** (`UseActiveConversationSyncParams`):

| Name                     | Type                                | Description                                                                                |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `activeConversationId`   | `string \| undefined`               | The app's currently active conversation (context-space).                                   |
| `items`                  | `ConversationListItemDto[]`         | Raw DTOs from the API.                                                                     |
| `refreshConversations`   | `() => Promise<void>`               | Called when the active conversation is not found in `items`.                               |
| `markConversationViewed` | `(id: string) => Promise<void>`     | Called with the matching raw DTO id when the active conversation or matching item changes. |
| `conversationIdsMatch`   | `(a: string, b: string) => boolean` | Equality predicate for context-space ids.                                                  |
| `toPanelConversationId`  | `(id: string) => string`            | Maps a DTO `id` to the panel-space identifier.                                             |

**Returns**: `string | undefined` — the panel-space id to highlight.

### useAsyncConfirmDialog

Generic single-slot pending/loading/error state machine for confirmation dialogs. The `confirm` method calls `run(pending)`, closes the dialog on success, or sets an error message and keeps the dialog open on throw.

```tsx
import { useAsyncConfirmDialog } from '@epam/ai-dial-chat-hooks';

const deleteDialog = useAsyncConfirmDialog<string>();

// Open the dialog with the item id as the pending value:
deleteDialog.open(itemId);

// Confirm:
await deleteDialog.confirm(
  async (id) => {
    await deleteItem(id);
  },
  (e) => (e instanceof Error ? e.message : 'Delete failed'),
);

// Cancel:
if (!deleteDialog.isRunning) deleteDialog.close();
```

#### API

**Returns** (`AsyncConfirmDialogControls<T>`):

| Name        | Type                                                                                   | Description                                                                                      |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pending`   | `T \| null`                                                                            | The value passed to `open()`, or `null` when the dialog is closed.                               |
| `isPending` | `boolean`                                                                              | `true` while `pending` is non-null (dialog is open).                                             |
| `isRunning` | `boolean`                                                                              | `true` while `confirm`'s `run` callback is executing.                                            |
| `error`     | `string \| null`                                                                       | Error message from the most recent failed `confirm`, or `null`.                                  |
| `open`      | `(value: T) => void`                                                                   | Opens the dialog with `value` as the pending payload; clears any prior error.                    |
| `close`     | `() => void`                                                                           | Closes the dialog and clears pending + error.                                                    |
| `confirm`   | `(run: (value: T) => Promise<void>, onError: (e: unknown) => string) => Promise<void>` | Executes `run(pending)`: calls `close()` on success, or sets `error = onError(thrown)` on throw. |

### useImportFilePicker

Manages a hidden `<input type="file">` element for conversation import: applies an already resolved `accept` value via `useLayoutEffect`, then returns the ref and event handlers. The host owns breakpoint and allowed-file policy; the hook owns only DOM wiring.

```tsx
import { useImportFilePicker } from '@epam/ai-dial-chat-hooks';

const { inputRef, triggerImport, handleFileChange } = useImportFilePicker({
  accept: isMobile ? undefined : '.json',
  onFileSelected: (file) => void importConversations(file),
});

// In JSX:
<input ref={inputRef} type="file" className="sr-only" onChange={handleFileChange} />
<button onClick={triggerImport}>Import</button>
```

#### API

**Parameters** (`UseImportFilePickerParams`):

| Name             | Type                   | Description                                                                           |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `accept`         | `string \| undefined`  | Host-resolved `accept` string (e.g. `'.json,.zip'`); omit it to remove the attribute. |
| `onFileSelected` | `(file: File) => void` | Called with the first selected file when the picker resolves.                         |

**Returns** (`UseImportFilePickerResult`):

| Name               | Type                                             | Description                                                                         |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `inputRef`         | `RefObject<HTMLInputElement \| null>`            | Attach to the hidden `<input type="file">`.                                         |
| `triggerImport`    | `() => void`                                     | Programmatically clicks the input to open the file picker.                          |
| `handleFileChange` | `(event: ChangeEvent<HTMLInputElement>) => void` | `onChange` handler for the hidden input; passes the first file to `onFileSelected`. |

### deriveConversationRowActionState

Pure function that derives the action-menu visibility flags for a conversation row from its sharing/publish metadata, resolved publish history, and current recipient count.

```tsx
import { deriveConversationRowActionState } from '@epam/ai-dial-chat-hooks';

const {
  isReadonly,
  publishedFolders,
  isRevokeVisible,
  isPublishApplicable,
  isUnpublishApplicable,
} = deriveConversationRowActionState(
  { sharedWithMe, publishedWithMe, isReadonly: rawItem.isReadonly },
  publishHistory,
  recipients,
);
```

#### API

**Parameters**:

| Name             | Type                                                                                 | Description                                                     |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `item`           | `Pick<ConversationListItemDto, 'sharedWithMe' \| 'publishedWithMe' \| 'isReadonly'>` | Sharing/readonly flags from the DTO.                            |
| `publishHistory` | `PublishHistoryEntry[] \| undefined`                                                 | Resolved publish history entries, or `undefined` while loading. |
| `recipients`     | `RecipientsCountEntry`                                                               | Current recipient count entry for the conversation.             |

**Returns**:

| Name                    | Type       | Description                                                                          |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `isReadonly`            | `boolean`  | `true` when the conversation is owned by someone else or is a published copy.        |
| `publishedFolders`      | `string[]` | Slash-delimited destination folder paths the conversation is currently published to. |
| `isRevokeVisible`       | `boolean`  | `true` when a revoke-access menu item should be shown.                               |
| `isPublishApplicable`   | `boolean`  | `true` when a publish menu item should be offered.                                   |
| `isUnpublishApplicable` | `boolean`  | `true` when an unpublish menu item should be offered.                                |

## Building

```sh
npm exec nx build ai-dial-chat-hooks
```

## Testing

```sh
npm exec nx test ai-dial-chat-hooks
```

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

Derives the "deep research" tools submenu from the active deployment's configuration schema and the operator-configured tool id: detects the boolean-typed schema property, manages toggle state, resets on deployment change, and exposes a stable `toolConfigurationValue` record for inclusion in completion requests. Headless: the host supplies the translated fallback label via `labels` and the tool icon via `toolIcon`.

```tsx
import { type UseToolsMenuParams, useToolsMenu } from '@epam/ai-dial-chat-hooks';

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

| Name                                  | Type                                  | Description                                                                 |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `deepResearchToolId`                  | `string \| null`                      | Operator-configured tool id; `null` yields an empty menu.                   |
| `selectedItemId`                       | `string \| null`                      | Selected deployment id; changing it resets toggle state to the schema default. |
| `selectedDeploymentConfiguration`     | `DeploymentConfigurationSchema \| null` | JSON-schema for the selected deployment; `null` yields an empty menu.       |
| `labels`                              | `Partial<ToolsMenuLabels>`            | Override for the fallback label. Falls back to English `'Deep research'` only when the host omits `labels` entirely. |
| `toolIcon`                            | `ReactNode`                           | Icon element for the tool item. Defaults to `null`.                         |

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

A shared conversation-transfer capability: `useConversationExport` downloads one or all conversations as a JSON (`.json`) or `.dial`/`.zip` archive; `useConversationImport` parses a selected file and re-persists its conversations, re-uploading any archive attachments and rewriting their references. Both share the same job-queue semantics — `jobs`, `dismissJob`, `retryJob`, `dismissAll` — and report outcomes through structured, translation-free `onSuccess`/`onWarning`/`onError` callbacks instead of calling a notification system themselves. Job identity is always structured data (`ConversationTransferSubject`), never pre-rendered text.

```tsx
import {
  ConversationExportMode,
  ConversationTransferErrorCode,
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

| Name                        | Type                                                                     | Description                                                                        |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `conversationsApi`          | `Pick<ConversationsApi, 'getConversation' \| 'listConversations'>`       | Already-configured generated-client instance.                                      |
| `filesApi`                  | `Pick<FilesApi, 'downloadFileRaw'>`                                      | Already-configured generated-client instance.                                      |
| `normalizeConversationPath` | `(conversationId: string) => string`                                     | Resolves a conversation id to the bucket-qualified path `getConversation` expects. |
| `classifyTransferError`     | `(error: unknown) => { isUnauthorized?: boolean; isNotFound?: boolean }` | Host-owned error classification. Defaults to `{}` (never unauthorized/not-found).  |
| `resolveErrorTraceId`       | `(error: unknown) => Promise<string \| undefined>`                       | Resolves a trace id for a failing request. Defaults to resolving `undefined`.      |
| `onSuccess`                 | `(event: ConversationTransferSuccessEvent) => void`                      | Called when a job completes successfully.                                          |
| `onWarning`                 | `(event: ConversationTransferWarningEvent) => void`                      | Called when a job succeeds but had to skip something (e.g. an attachment).         |
| `onError`                   | `(event: ConversationTransferErrorEvent) => void`                        | Called when a job fails.                                                           |

**Returns** (`UseConversationExportResult`): `{ jobs, exportSingle(conversationId, title, mode), exportAll(), dismissJob(jobId), retryJob(jobId), dismissAll() }`.

**Parameters** (`UseConversationImportParams`): `conversationsApi: Pick<ConversationsApi, 'saveConversation'>`, `filesApi: Pick<FilesApi, 'listFiles' | 'uploadFile'>`, `bucket: string | undefined` (import fails with `MissingBucket` when absent), `onImported?: () => Promise<void> | void` (called after at least one conversation imports successfully), plus the same `classifyTransferError`/`resolveErrorTraceId`/`onSuccess`/`onWarning`/`onError` shape as export.

**Returns** (`UseConversationImportResult`): `{ jobs, importConversations(file), dismissJob(jobId), retryJob(jobId), dismissAll() }`.

`ConversationTransferJob` is `{ id: string; subject: ConversationTransferSubject; status: ConversationTransferJobStatus }`, where `ConversationTransferSubject` is `{ kind: Single; title: string; sourceBreadcrumb?: string } | { kind: All }` — render `label`/`description` text from `subject` at the call site (e.g. `subject.kind === Single ? subject.title : t('allConversations')`), never from a library-owned string. `ConversationTransferErrorEvent`/`WarningEvent`/`SuccessEvent` carry a `jobId`, a library-owned code (`ConversationTransferErrorCode`/`WarningCode`), and structured facts (`titles`, `names`, `traceId`) — never translated text.

Also exports `EXPORT_APP_NAME` and `formatQuotedNameList` (the standalone functions the hooks are built on) for hosts that render their own export file names or name lists outside the hooks' own notifications.

### useConversationStream

Owns completion-streaming state — per-conversation-path streaming/stoppable tracking, stale-chunk rejection, reload-after-complete, and hard-refresh resume detection — driven entirely through an injected `ConversationStreamTransport`. The library never hardcodes an `/api` path, CSRF handling, or a `server-api` import; the host implements the transport against its own BFF/generated-client calls.

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
| `channel`        | `ConversationStreamChannel`         | Optional. `{ channelId, ensureConnected }` for tool-signin delivery.                          |
| `overlay`        | `ConversationStreamOverlayNotifier` | Optional. `{ notifyGenerationStart?, notifyGenerationEnd?, notifyStopGenerating? }`.          |
| `onStopError`    | `(error: Error) => void`            | Called when the transport's `stopCompletion` rejects.                                         |

`ConversationStreamTransport` has four methods the host implements: `streamCompletion(path, message, model, options, customContent?, generationId?, mode?, messageIndex?, clientChannelId?)`, `stopCompletion({ generationId, path })`, `watchConversation(path, signal)`, and `getConversation(conversationId, signal?)`.

**Returns** (`UseConversationStreamResult`): `{ startStream, handleStop, resumeIfAwaitingGeneration, isStreaming, canStopStreaming }`. `resumeIfAwaitingGeneration(conversationId, conversation)` detects a hard-refresh-mid-generation conversation and watches for its resolution.

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
  values: { responseFormat: ResponseFormat; systemPrompt: string; temperature: number };
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

| Mode              | Shape                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `'local'`         | `{ mode: 'local'; values; onValuesChange; deploymentFeatures?; isQuickApp?; labels?; onSaved? }` |
| `'conversation'`  | `{ mode: 'conversation'; conversation; onConversationChange; deploymentFeatures?; isQuickApp?; labels?; onSaved? }` |

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
import { safeDecodeURI, stripSurroundingSlashes } from '@epam/ai-dial-chat-hooks';

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

const { starters, propertyKey, description } =
  getStartersFromSchema(deploymentConfiguration);
```

### sanitizeAnnouncementHtml / hasStructuredAnnouncement / hasAnnouncementContent / buildAnnouncementSignature

Announcement-banner helpers: sanitizes operator-supplied HTML to an allowed tag/attribute set, checks whether structured (`title`/`description`) or any content is present, and builds the content-keyed signature used to track dismissal.

```ts
import {
  hasAnnouncementContent,
  type AnnouncementContent,
} from '@epam/ai-dial-chat-hooks';

const content: AnnouncementContent = {
  title: 'Maintenance window',
  description: null,
  html: null,
};

hasAnnouncementContent(content); // true
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
import { resolveMcpResourceKind, buildConnectApi } from '@epam/ai-dial-chat-hooks';
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

const overview = buildSkillOverview(skillMetadataDto, files, about, overviewLabels);
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

### PromptSource / buildPromptResourceUrl / parsePromptResourceUrl

Builds/parses the `prompts/{bucket}/{path}` resource URL used to address a prompt outside the caller's own bucket (e.g. a shared-with-me prompt).

```ts
import { buildPromptResourceUrl, PromptSource } from '@epam/ai-dial-chat-hooks';

buildPromptResourceUrl({ bucket: 'other-user-bucket', path: 'My Prompt' });
// 'prompts/other-user-bucket/My Prompt'
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

const { name, description, about, body } = parseSkillManifestDocument(rawManifestText);
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

Also exports `resolveImageCanvasContent`, `resolveTextCanvasContent`, `resolveCodeCanvasContent`, `resolveHtmlCanvasContent`, `resolveOoxmlCanvasContent`, `resolveJsonCanvasContent`, `resolveVisualizerCanvasContent`, `annotationToPdfCanvasContent`, `referenceAttachmentToPdfCanvasContent`, `hasAttachmentTextSource`, `getUrlFileName`, and `isExternalSourcePreviewable`.

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

const destination = await prepareDownloadDestination('report.pdf', 'application/pdf');
```

## Building

```sh
npm exec nx build ai-dial-chat-hooks
```

## Testing

```sh
npm exec nx test ai-dial-chat-hooks
```

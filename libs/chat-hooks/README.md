# @epam/ai-dial-chat-hooks

Framework-level React hooks extracted from AI DIAL Chat, published so teams building custom chat interfaces on top of the AI DIAL backend can reuse proven chat-UI behavior without depending on the full AI DIAL Chat application.

## Overview

`@epam/ai-dial-chat-hooks` is a headless hooks library: every hook here solves a piece of chat-interface UI mechanics (scrolling, streaming, anchoring — more hooks will be added over time) using only React and standard browser APIs. It never depends on AI DIAL Chat's Redux-equivalent contexts, REST client, UI-kit components, i18n, or routing — `react` is the library's only dependency. This means a consumer can drop a hook from this package into a completely different chat UI, wire its returned refs and callbacks onto their own markup, and get the same tuned, edge-case-tested behavior AI DIAL Chat ships with, without adopting anything else from this repository.

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
  const { isDragging, pendingFiles, onFilesConsumed } = usePageFileDrag(
    isAttachmentsAllowed,
  );

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

| Name                  | Type      | Description                                                     |
| --------------------- | --------- | ----------------------------------------------------------------- |
| `isAttachmentsAllowed` | `boolean` | Whether dropped files should be collected. Defaults to `true`.   |
| `isEnabled`            | `boolean` | Whether drag detection is active at all. Defaults to `true`.     |

**Returns** (`UsePageFileDragResult`):

| Name              | Type         | Description                                                |
| ----------------- | ------------ | ------------------------------------------------------------ |
| `isDragging`      | `boolean`    | Whether a file drag is currently over the page.             |
| `pendingFiles`    | `File[]`     | Files dropped on the page, pending consumption by the caller. |
| `onFilesConsumed` | `() => void` | Clears `pendingFiles` after the caller has processed them.   |

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

| Name                  | Type     | Description                                                                 |
| --------------------- | -------- | ----------------------------------------------------------------------------- |
| `minContentAreaWidth` | `number` | Minimum pixel width the main content area must retain when the panel is open. |

### useShareLink

Resolves and manages share-link data for a DIAL Core resource: loading/error state, a stale-response guard, and re-fetch when the requested access levels change. Accepts an already-configured `ShareApi` instance from `@epam/ai-dial-chat-api-client` — the hook owns only the request lifecycle, not the client's base URL, auth, or CSRF setup.

```tsx
import { useShareLink } from '@epam/ai-dial-chat-hooks';
import { ShareLinkAccess } from '@epam/ai-dial-share';

const ShareLinkPanel = ({ shareApi, itemId }: { shareApi: ShareApi; itemId: string }) => {
  const { data, isLoading, error, setAccess } = useShareLink(shareApi, itemId);

  return (
    <div>
      {isLoading && <span>Creating link...</span>}
      {data && <input readOnly value={data.url} />}
      <button onClick={() => setAccess([ShareLinkAccess.Edit])}>Allow editing</button>
    </div>
  );
};
```

#### API

**Parameters**: `useShareLink(shareApi, itemId, resourceKind?, origin?)`

| Name           | Type                                          | Description                                                                 |
| -------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `shareApi`     | `Pick<ShareApi, 'createShareLink'>`            | Already-configured generated-client instance.                                |
| `itemId`       | `string`                                        | Identifier of the resource being shared.                                     |
| `resourceKind` | `CreateShareLinkDtoResourceKindEnum`            | Optional; required only for resources whose ids need backend qualification.  |
| `origin`       | `string`                                        | Origin the returned link is anchored to. Defaults to `window.location.origin`. |

**Returns** (`UseShareLinkResult`): `{ data, isLoading, error, setAccess }` — `data` is `ShareLinkData | undefined`, `setAccess` takes a `ShareLinkAccess[]` and triggers a re-fetch.

### useShareRecipientsCount

Resolves how many users hold shared access to a resource, one resource at a time and only when asked — a deduplicated, per-resource lazy lookup cache. Accepts an already-configured `ShareApi` instance.

```tsx
import { useShareRecipientsCount } from '@epam/ai-dial-chat-hooks';

const RevokeAccessMenuItem = ({ shareApi, itemId }: { shareApi: ShareApi; itemId: string }) => {
  const { requestRecipientsCount, getRecipientsCount } = useShareRecipientsCount(shareApi);
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

| Name                       | Type                                          | Description                                                        |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `requestRecipientsCount`   | `(itemId: string) => void`                        | Starts a lookup for the resource unless one already ran for it.        |
| `getRecipientsCount`       | `(itemId: string) => RecipientsCountEntry`        | Current lookup state for the resource (`{ status, count? }`).          |
| `invalidateRecipientsCount`| `(itemId: string) => void`                        | Drops the resource's cached result so the next request fetches again.  |

`RecipientsCountEntry.status` is a `RecipientsCountStatus` of `Idle` / `Loading` / `Resolved` / `Unknown` (`Unknown` on a failed lookup, so a "Revoke access" action stays reachable without a number).

### useAttachmentUpload

Uploads an attachment's file to DIAL Core storage against an already-configured `FilesApi` instance, coalescing a burst of offline/network upload failures into a single debounced callback rather than firing one notification per failed file.

```tsx
import { useAttachmentUpload } from '@epam/ai-dial-chat-hooks';

const Composer = ({ filesApi, bucket }: { filesApi: FilesApi; bucket: string }) => {
  const { handleUploadAttachment } = useAttachmentUpload({
    filesApi,
    bucket,
    onNetworkError: (fileNames) => showToast(`Failed to upload: ${fileNames.join(', ')}`),
  });

  return <input type="file" onChange={(e) => handleUploadAttachment(toAttachment(e.target.files![0]))} />;
};
```

#### API

**Parameters** (`UseAttachmentUploadParams`):

| Name             | Type                                | Description                                                                 |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| `filesApi`       | `Pick<FilesApi, 'uploadFile'>`         | Already-configured generated-client instance.                                   |
| `bucket`         | `string \| undefined`                  | DIAL Core bucket the file is uploaded into.                                     |
| `onNetworkError` | `(fileNames: string[]) => void`        | Called once per debounce window with all filenames that failed while offline.   |
| `debounceMs`     | `number`                                | Debounce window for coalescing offline-failure batches. Defaults to `700`.      |

**Returns** (`UseAttachmentUploadResult`): `{ handleUploadAttachment: (attachment: Attachment) => Promise<string> }` — resolves to the uploaded file's DIAL Core URL; rejects with an `Error` tagged `errorReason: AttachmentErrorReason.Network` when offline.

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

### useAttachmentAction

Default click behavior for an attachment tile: downloads DIAL-hosted and inline (`data`) files, and for reference-only attachments (RAG/search-grounding chunks), opens a PDF in the canvas scrolled to its referenced page when present, otherwise opens/downloads the reference as-is.

```tsx
import { useAttachmentAction } from '@epam/ai-dial-chat-hooks';

const AttachmentTile = ({ attachment }: { attachment: DisplayAttachment }) => {
  const { handleAttachmentClick } = useAttachmentAction({
    resolveDownloadUrl: (fileId) => myResolveFileDownloadUrl(fileId),
  });
  return <button onClick={() => handleAttachmentClick(attachment)}>{attachment.name}</button>;
};
```

#### API

**Parameters** (`UseAttachmentActionParams`): `{ resolveDownloadUrl: (fileId: string) => string | undefined }` — resolves a DIAL Core file id (`files/{bucket}/{path}`) to a downloadable URL; this is host-owned since it encodes the app's own file-download endpoint.

**Returns** (`UseAttachmentActionResult`): `{ handleAttachmentClick: (attachment: DisplayAttachment) => void }`.

Also exports `isDialFileId`, `isDownloadableAttachment`, and `downloadAttachment` (the standalone functions the hook is built on) for callers that need the download decision outside the click handler.

## Building

```sh
npm exec nx build ai-dial-chat-hooks
```

## Testing

```sh
npm exec nx test ai-dial-chat-hooks
```

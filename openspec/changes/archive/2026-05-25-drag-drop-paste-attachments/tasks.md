## 1. Props model updates

- [x] 1.1 Add `dropLabel?: string` (default `"Drop files here"`) to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`
- [x] 1.2 Add `pasteTextThreshold?: number` (default `4000`) to `ConversationInputProps`
- [x] 1.3 Add `pasteTextThreshold?: number` to `InputProps` in `libs/conversation-input/src/models/Input.ts`
- [x] 1.4 Add `pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void` to `InputProps`

## 2. `useDragDrop` hook

- [x] 2.1 Create `libs/conversation-input/src/hooks/useDragDrop.ts` — accepts `onFiles: (files: File[]) => void`, returns `{ dragHandlers, isDragOver }`
- [x] 2.2 Implement `dragDepth` ref counter to prevent flicker on child element crossings (`dragenter` increments, `dragleave` decrements clamped to 0)
- [x] 2.3 `dragHandlers` covers `onDragEnter`, `onDragLeave`, `onDragOver` (call `preventDefault`), `onDrop`
- [x] 2.4 On drop: extract `Array.from(event.dataTransfer.files)`, skip if empty, call `onFiles`
- [x] 2.5 Ignore drag events that contain no `files` (e.g. text drags) — check `event.dataTransfer.types` includes `'Files'`

## 3. `useClipboardPaste` hook

- [x] 3.1 Create `libs/conversation-input/src/hooks/useClipboardPaste.ts` — accepts `onAttachments: (a: Attachment[]) => void` and `threshold: number`, returns `{ handlePaste }`
- [x] 3.2 Guard against `null` `clipboardData` — return early, let event proceed normally
- [x] 3.3 Check `clipboardData.items` for image MIME types first; create `new File([blob], 'Screenshot.png', { type: blob.type })` for each, build `Attachment` with `type: AttachmentType.Image` and `previewUrl` via `URL.createObjectURL`, call `preventDefault`
- [x] 3.4 If no image items, read plain-text string; if `text.length > threshold` create `new File([text], 'Pasted text', { type: 'text/plain' })`, build `Attachment` with `type: AttachmentType.Pasted`, `status: RequestStatus.Idle`, call `preventDefault`
- [x] 3.5 If text is within threshold, do nothing (normal paste)

## 4. Wire drag-and-drop into `ConversationInput`

- [x] 4.1 Call `useDragDrop` in `ConversationInput`, forwarding pending files to `Input` via `pendingDropFiles` prop
- [x] 4.2 Spread `dragHandlers` onto the root `<div>` of `ConversationInput`
- [x] 4.3 When `isDragOver` is true, render a full-cover overlay sibling: `absolute inset-0 pointer-events-none` with a dashed border and `dropLabel` text
- [x] 4.4 Forward `pasteTextThreshold` from `ConversationInput` to `Input`

## 5. Wire clipboard paste into `Input`

- [x] 5.1 Extract `buildAttachments` and `addAttachments` helpers; refactor `handleFileChange` to use them
- [x] 5.2 Add `useEffect` to consume `pendingDropFiles` via `buildAttachments` + `addAttachments`, then call `onDropFilesConsumed`
- [x] 5.3 Call `useClipboardPaste` in `Input`, passing `addAttachments` and `pasteTextThreshold`
- [x] 5.4 Attach `handlePaste` to the `onPaste` prop of the textarea element

## 6. Verification

- [x] 6.1 `npm exec nx typecheck @epam/ai-dial-conversation-input` — zero errors
- [x] 6.2 `npm exec nx lint @epam/ai-dial-conversation-input` — zero warnings
- [x] 6.3 `npm exec nx test @epam/ai-dial-conversation-input` — 47 tests pass
- [x] 6.4 Manual: drag a PDF onto the input → card appears in tray
- [x] 6.5 Manual: drag an image → image card with thumbnail appears
- [x] 6.6 Manual: paste a screenshot (Win+Shift+S then Ctrl+V) → image attachment added
- [x] 6.7 Manual: paste >4000 chars of text → Pasted card appears, textarea unchanged
- [x] 6.8 Manual: paste <4000 chars of text → text inserts inline, no card
- [x] 6.9 Manual: drag file out without dropping → overlay disappears, no attachment added

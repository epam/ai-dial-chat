## Context

Phase 1 landed the attachment-picking UI but left the rest of the pipeline disconnected. There was no upload endpoint, no propagation through the chat completion request, and message bubbles had no concept of `attachments`. The `Attachment` interface mixed UI-only state (`File`, `status`, `previewUrl`) with what eventually needed to go on the wire — but the wire shape did not exist yet.

Phase 2 connects every link in that chain: the picked `File` becomes an uploaded artefact in DIAL storage, its URL travels with the user message into the chat completion request, the assistant sees it, and both messages render their attachments when the conversation is reloaded.

## Goals / Non-Goals

**Goals:**

- Stand up a backend endpoint that uploads files to DIAL storage on behalf of the authenticated user.
- Split the attachment type into a UI-state shape (`UiAttachment`) and a wire-format shape (`ApiAttachment`).
- Drive upload from inside the `Input` component without giving the lib HTTP knowledge — the consuming app injects an `uploadAttachment` function.
- Let users send attachments **without** text (the existing "send only enabled with non-empty text" rule blocked this).
- Persist attachments inside `custom_content` so reloading the conversation restores the original message exactly.
- Render attachments above the user message bubble and as part of assistant responses.

**Non-Goals:**

- Multi-bucket uploads, signed URLs, or per-folder paths beyond `uploads/{yyyy-mm-dd}/`.
- Drag-and-drop into the textarea (still file picker only).
- Inline preview of PDFs or other non-image files inside the chat stream — only thumbnails for images and file-type cards for everything else.
- Attachment editing / re-ordering after upload.
- Anti-virus or content scanning of uploads (DIAL Core is the source of truth).
- Resumable uploads or chunking.
- Pasted-image-from-clipboard support (separate follow-up).

## Decisions

### 1 — `ApiAttachment` and `UiAttachment` are separate types

`ApiAttachment` mirrors the DIAL Core `attachment` schema exactly (`type`, `title`, `url`, `data`, `reference_type`, `reference_url`). `UiAttachment` is the in-progress browser-only view: `File`, `status`, `previewUrl`, `apiAttachment?` (filled after upload).

**Why split:** the two have different lifecycles. `UiAttachment` lives only while the user is composing — it holds a non-serialisable `File`, a tracked `RequestStatus`, and an object URL that must be revoked. `ApiAttachment` is the network/storage shape — no `File`, no status, lives in the request body and the saved conversation. Merging them would force `File` and `status` to be optional everywhere and lose narrow typing in both layers.

**Alternative considered:** a single `Attachment` with everything optional. Rejected — every property read becomes "is it defined yet?" guesswork.

### 2 — Upload is injected into `Input`, not imported by it

`InputProps` gains `uploadAttachment?: (file: File) => Promise<ApiAttachment>`. The library has no `fetch`, no axios, no API base URL. The consuming app (`apps/chat`) wires it to `files.api.ts`, which in turn calls the generated `FilesApi` client.

**Why injection:** `libs/conversation-input` already ships as a standalone package — adding an HTTP dependency would couple it to a specific app's transport, CSRF middleware, and auth setup. Injection keeps the lib portable and lets tests pass mocks trivially.

### 3 — Upload is fire-and-forget, status lives per-attachment

When files are picked, each `UiAttachment` is added in `RequestStatus.Loading` and `uploadAttachment(file)` runs immediately in the background. Success transitions the card to `Idle` with `apiAttachment` filled; failure transitions to `Error`, which exposes a retry button.

**Why per-attachment:** users can pick multiple files at once. A single in-flight upload would force them to wait sequentially. Per-attachment status also matches the card-level visual states already designed in phase 1 (loading overlay, error badge).

**Why no global loading state:** `canSend` is computed from the attachment list itself (`hasUploadedAttachment && !hasLoadingAttachment`). No separate `isUploading` boolean is needed.

### 4 — Send is allowed when text **or** an attachment is present

`canSend = (message.trim().length > 0 || hasUploadedAttachment) && !hasLoadingAttachment`. The backend `SendCompletionDto.message` drops `@MinLength(1)` so empty-text requests pass validation when attachments are present.

**Why both layers:** the frontend prevents the user from clicking send into a known-bad state; the backend rejects malformed requests on its own (empty text *and* empty attachments would still produce an unhelpful chat completion). Keeping both means the UI cannot be bypassed and the API stays self-defending.

### 5 — `onSend` payload becomes an object

Phase 1: `onSend?: (message: string) => void`. Phase 2: `onSend?: (payload: { message: string; attachments?: ApiAttachment[] }) => void`.

**Why an object:** positional `(message, attachments)` reads ambiguously at call sites and is harder to extend (the next field — say, `mentions` — would shift parameter order). An object payload is self-documenting and forward-compatible.

**Migration cost:** small — three call sites in `apps/chat` (`Conversation`, `ConversationRoute`, `ConversationView`) plus the test files. Worth doing now before more callers appear.

### 6 — Backend uses `@nestjs/platform-express` + `FileInterceptor`

`FilesController` decorates the upload route with `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))` and receives `Express.Multer.File`. `multer` is pulled in transitively by `@nestjs/platform-express`.

**Why platform-express:** the rest of the API already runs on Express. Switching to Fastify just for file uploads would split the stack with no benefit.

**Why server-side size limit:** the browser cannot be trusted. `MAX_FILE_SIZE` enforced by the interceptor returns HTTP 413 cleanly before the file is buffered into memory.

### 7 — Generated `FilesApi` instead of a hand-rolled `post`

`apps/chat/src/server-api/files.api.ts` calls `filesApi.uploadFile({ file })` through the generated `FilesApi`, which is registered in `api-client.ts` alongside every other API (`modelsApi`, `conversationsApi`, etc.).

**Why generated:** consistency. The CSRF / unauthorized / telemetry middleware applies automatically. A hand-rolled `post` helper bypassed those middlewares and duplicated transport code.

**Why the OpenAPI post-processor change:** the generator emits `let formParams: { append(param: string, value: any): any }` for multipart routes. Two `replaceAll`s in `tools/openapi/postprocess-client.mjs` change that to `FormData | URLSearchParams` and remove the `as any` cast around `formParams.append('file', ...)`. Result: no `any` in the generated upload code.

### 8 — Attachments persist inside `custom_content` on each message

DIAL Core's chat completion API treats `custom_content.attachments` as a first-class field on a `ConversationMessage`. Saving the conversation back to DIAL preserves them; reloading restores them; the assistant sees them in the same chat completion request without any extra plumbing.

**Why not a separate `attachments` field at the message level:** would diverge from DIAL Core's wire format and require translation layers on save/load. `custom_content` is already the standard.

### 9 — User bubble hides when text is empty; attachments still render

In `UserMessageBubble`, the text bubble (`<div>` with `userBubble` style + `<p>{text}</p>`) is gated on `text` being truthy. The `MessageAttachmentTray` renders independently.

**Why:** an "attachments only" message used to render an empty styled bubble underneath the thumbnails — visually broken. Hiding the bubble when empty makes the message read as "the user sent these files."

### 10 — Read-only `AttachmentCard` is duplicated, not shared

`libs/conversation-messages/MessageAttachmentTray.tsx` contains its own minimal `AttachmentCard` (~30 lines). The input lib's `AttachmentCard` (~150 lines) is far richer: loading overlay, error badge, retry/remove actions, `getAttachmentCardState`.

**Why duplicated:** different domains. The input card consumes `UiAttachment` and drives upload state machinery. The message card consumes `ApiAttachment` (read-only, no state) and just renders. A shared base would either over-abstract for the read-only case or pollute the read-only API with knobs it never uses.

**Trade-off accepted:** ~50 lines of visual repetition (100×100 layout, name-on-top, icon-on-bottom). If the visual design diverges between input and messages, the cost is zero; if they stay identical and we add a third card, extract a shared `AttachmentCardSkeleton`.

## Risks / Trade-offs

- **`echo` model hardcoded in `conversation.service.ts`** — debug artefact from local testing. Tracked as cleanup; should not ship to production.
- **No upload progress reporting** — the `Loading` state shows a spinner but no percentage. `FilesApi.uploadFile` is a single `fetch` POST without progress events. Adding XHR-based progress is a separate change.
- **Object URL lifecycle** — `previewUrl` is created on file pick and revoked on remove / on `Input` unmount. If a card is uploaded successfully and the user navigates away mid-stream, the revoke runs in the cleanup `useEffect`. Verified safe.
- **`multer` memory storage by default** — files are buffered in RAM. For the configured `MAX_FILE_SIZE`, acceptable. Switching to disk storage would require multer-disk-storage config and tempfile cleanup, deferred until file-size limits grow.
- **Two AttachmentCard components** — accepted divergence (see Decision 10).

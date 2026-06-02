## Context

Before this change, the `ConversationInput` allowed users to pick files and see them in the `AttachmentTray`, but the files were never forwarded to the backend — `onSend` only passed the text string. Message bubbles had no concept of attached files at all. This change wires the full end-to-end path: client encoding → API DTO → DIAL Core forwarding → response rendering.

Current constraints:
- DIAL Core accepts attachments as inline base64 (`data` field) or by URL (`url` field); the AI DIAL Chat backend acts as a thin proxy — it does not store files itself
- The `libs/conversation-input` library must not call `fetch` directly; encoding is its own concern and the result is handed to the consuming app
- `libs/chat-shared` is types-only — no logic, no imports from other libs

## Goals / Non-Goals

**Goals:**
- Define the data flow from file selection to DIAL Core and back to message display
- Specify error surface: file-read errors (before send), and streaming errors (during/after send)
- Establish the `DialAttachment` ↔ `Attachment` mapping contract in `chat-shared`
- Specify `AttachmentCard` display rules (name without extension, tooltip, thumbnail)

**Non-Goals:**
- Server-side attachment storage or CDN upload (DIAL Core handles persistence via `url`/`data`)
- File size or MIME type validation (deferred to a future constraint spec)
- `AttachmentType.Prompt` and `AttachmentType.Pasted` flows (unrelated attachment categories)
- Drag-and-drop or clipboard paste as input methods

## Decisions

### 1. Base64 encoding in the frontend utility, not in the component

**Decision:** `attachmentsToDialAttachments()` in `apps/chat/src/utils/attachment-to-dial.ts` reads files via `FileReader` and returns `DialAttachment[]`. The `Conversation` page calls this before the API request; `Input` remains encoding-unaware.

**Why:** The `libs/conversation-input` lib must not perform network or async I/O that couples it to the API contract. Keeping encoding in `apps/chat` lets the lib stay portable. The `Input` component's `onSend` callback receives raw `Attachment[]`; the page decides what to do with them.

**Alternative considered:** Encoding inside `Input.tsx` — rejected because it would force a `Promise`-returning `onSend`, complicating every consumer and violating the lib's portability goal.

---

### 2. Inline `data` field (base64) as the only send strategy

**Decision:** All user-attached files are serialised to base64 and sent as `DialAttachment.data`. The `url` path is defined in the DTO but not used on the send side.

**Why:** AI DIAL Chat has no file-upload endpoint. Using `data` requires no extra round-trip and matches DIAL Core's capability for small payloads. The `url` path can be enabled later (e.g. for a future `/attachments` upload endpoint) without changing the receiving contract.

**Risk:** Large files increase request body size. Mitigation: file size limits should be enforced in a later spec; for now the constraint is acknowledged and documented.

---

### 3. Attachments embedded in `custom_content` on the backend, not as a top-level field

**Decision:** The backend service places `DialAttachment[]` inside `message.custom_content.attachments` when constructing the DIAL Core request body, mirroring the format DIAL Core uses in its responses.

**Why:** DIAL Core's own message schema uses `custom_content.attachments` for both directions. Embedding attachments at the same path on send makes the bidirectional contract symmetric and simplifies the response-mapping code.

---

### 4. `mapDialAttachmentToAttachment()` creates a stub `File` for display

**Decision:** When converting a `DialAttachment` from an API response to a client-side `Attachment`, a zero-byte `File` stub is created (name + MIME type only, no content). Image preview is not reconstructed; a `previewUrl` is set only when `data` is present.

**Why:** Response attachments are display-only in this phase — the user cannot re-send them. A full `File` object is not needed. The stub satisfies the `Attachment` type contract and allows `AttachmentCard` to render normally.

---

### 5. Error handling: two distinct surfaces

**Decision:**
- **File-read errors** are caught inside `attachmentsToDialAttachments` (per-file `try/catch`); a failed file short-circuits `onSend` and surfaces an inline error state on the card
- **Streaming errors** are caught in the SSE consumer in `chat-stream.api.ts`; a thrown error propagates to `Conversation.tsx` where it is shown as an error banner

**Why:** The two error types have different causes (local I/O vs. network/model) and different UX requirements (card-level retry vs. conversation-level retry). Mixing them into one handler would blur the surface.

---

### 6. `AttachmentCard` name display: no extension, `DialTooltip` for overflow

**Decision:** The displayed name strips the extension via `lastIndexOf('.')`. The name span uses `line-clamp-3 break-words` (multi-line) and is wrapped in `DialTooltip` (full name on hover).

**Why:** `DialEllipsisTooltip` only handles single-line truncation — it cannot wrap. `DialTooltip` wraps the multi-line span and always shows the full name (including extension) on hover for disambiguation when two files differ only by extension.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large files cause oversized request bodies | Document a recommended max size; enforce file size limits in a follow-up spec |
| DIAL Core rejects an unsupported MIME type | The SSE error path surfaces this as a streaming error banner; no silent failure |
| Zero-byte `File` stub causes issues if a consumer tries to read the file content | Documented as a known limitation; stub is display-only and should not be passed to `attachmentsToDialAttachments` |
| `URL.createObjectURL` leaks if the component unmounts before file selection finishes | `onAttachmentsChange` spec (existing) already requires `URL.revokeObjectURL` on removal and unmount |

## Context

The `ConversationSourcesPanel` already renders `AttachmentCard` components for every uploaded and generated file in the conversation. The `file-download` BFF endpoint (`GET /api/v1/files/download`) and its generated SDK wrapper already exist. The `AttachmentCard` component lives in `libs/conversation-input` and is aliased at build time by both the Vite config and `tsconfig.base.json`, meaning the app always resolves the local source rather than the published npm artefact.

The only missing piece was surfacing the download action in the card UI and connecting it to the BFF endpoint.

## Goals / Non-Goals

**Goals:**
- Add a per-card download icon button to `AttachmentCard` that appears on hover/focus (matching the existing remove/retry pattern).
- Wire the button in `FilesSection` using the existing BFF download infrastructure.
- Keep `AttachmentCard` host-agnostic: it fires a callback, not a fetch.

**Non-Goals:**
- "Download All" button (panel-level) — remains disabled; out of scope.
- Downloads for inline base64 attachments (no remote URL) — not wired.
- Progress indication, cancellation, or error handling for the download.

## Decisions

### Decision 1 — Download button lives inside `AttachmentCard`, not as an overlay wrapper

**Chosen:** Extend `AttachmentCard` with `onDownload?: (id: string) => void` and `downloadLabel?: string` props; the button renders inside the existing `absolute right-1 top-1` action container alongside retry/remove.

**Alternative considered:** Wrap `AttachmentCard` in `FilesSection` with a `group/card relative` div and overlay a separate `DialGhostIconButton` from outside the card.

**Rationale:** Placing the button inside the component gives it the correct `removeBtnClass` theming (dark background for image cards, card-bg for file cards), correct `group-hover` trigger scope, and correct visual stacking at no extra wrapper cost. An external overlay would duplicate hover logic and require re-deriving the card type from outside.

### Decision 2 — Download triggered via hidden `<a>` element, not `fetch + blob`

**Chosen:** `downloadAttachment` builds a download URL, creates a transient `<a href download>` element, clicks it, and removes it.

**Alternative considered:** Calling `downloadFile(bucket, path)` from `files.api.ts`, collecting a `Blob`, and creating an `objectUrl` manually.

**Rationale:** The BFF endpoint returns `Content-Disposition: attachment` headers, so the browser handles the save dialog without needing to buffer the file in JS heap. The `<a>` approach is synchronous, memory-efficient, and already works for same-origin URLs. The `fetch + blob` path is necessary only if streaming progress or cross-origin downloads are needed.

### Decision 3 — URL resolution reuses `resolveDialFileUrl` from `icon-path.ts`

**Chosen:** Export `resolveDialFileUrl` and call it from `download-attachment.ts` for DIAL file IDs (`files/{bucket}/{path}`); pass absolute URLs through unchanged.

**Alternative considered:** Adding a `parseDialFileId` helper and calling `downloadFile(bucket, path)` directly.

**Rationale:** `resolveDialFileUrl` already constructs the correct BFF query string with URL-decoded path segments. Reusing it avoids duplicating the parsing logic. Exporting one additional function from `icon-path.ts` is a small, safe change.

### Decision 4 — `onDownload` is omitted (not passed as `undefined`) for attachments without a URL

**Chosen:** `FilesSection` passes `onDownload={att.url ? handleDownload : undefined}`; `AttachmentCard` shows the button only when `onDownload` is defined.

**Rationale:** Avoids rendering a download button that can never succeed. Inline base64 attachments (`DisplayAttachment.previewUrl` is a `data:` URI, `url` is absent) have no remote file to download and no bucket/path to parse.

## Risks / Trade-offs

- **`<a download>` ignored for cross-origin redirects** → The BFF endpoint is always same-origin (`/api/v1/…`), so this is not a concern in practice. If the BFF ever redirects to a cross-origin CDN, the `download` attribute will be silently ignored by the browser (the file will open instead of being saved). Mitigation: ensure the BFF streams the response body rather than redirecting.
- **`resolveDialFileUrl` now part of the public API surface** → Any future rename of the function or its output format will have an external caller. Mitigation: documented in the export; prefer stable query-param names in the BFF.
- **No download error feedback** → If the BFF returns 403/404, the browser either shows a blank tab or triggers the save dialog with an empty file. Mitigation: acceptable for MVP; a follow-up can add `fetch`-based error detection.

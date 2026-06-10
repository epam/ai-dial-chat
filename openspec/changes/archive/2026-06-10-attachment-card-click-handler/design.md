## Context

`ConversationSourcesPanel` renders two `FilesSection` grids — uploaded and generated attachments — using `AttachmentCard` from `libs/conversation-input`. Cards are currently inert: `AttachmentCard` has callbacks for remove (`onRemove`), retry (`onRetry`), and pasted-text expand (`onExpand`), but no generic click handler.

The BFF already exposes `GET /api/v1/files/download?bucket=…&path=…` (spec: `openspec/specs/file-download/spec.md`). `apps/chat/src/utils/icon-path.ts` already contains a private `resolveDialFileUrl` helper that converts a DIAL file ID (`files/{bucket}/{path}`) to that BFF URL. `apps/chat/src/server-api/files.api.ts` wraps `filesApi.downloadFileRaw()` for fetch-based downloads.

## Goals / Non-Goals

**Goals:**
- Clicking an attachment card in `ConversationSourcesPanel` downloads the file.
- The action resolver is a single, replaceable hook so future handlers (preview, MIME-based routing, custom metadata handlers) can be added without touching card rendering or the panel layout.
- No UI layout or visual changes.

**Non-Goals:**
- Preview mode or any non-download handler — deferred to a later change.
- Changes to `FilesSection` rendering, search filtering, or empty states.
- Changes to the BFF or generated API client.

## Decisions

### Decision 1: Add `onClick` to `AttachmentCard`, mirroring the `onExpand` pattern

`AttachmentCard` already promotes the card root to an interactive button when `onExpand` is provided (sets `role="button"`, `tabIndex`, and key handlers). Adding `onClick?: (id: string) => void` follows the same pattern: when supplied, the card is interactive; when absent, it is inert (no regression).

**Alternative considered:** wrap the card in a `<button>` inside `FilesSection`. Rejected — it creates a nested interactive element when `onRemove` is also rendered, and breaks the card's existing focus-within outline.

### Decision 2: Browser-native download via anchor navigation, not fetch streaming

The `resolveDialFileUrl` helper in `icon-path.ts` already builds the correct BFF URL (`/api/v1/files/download?bucket=…&path=…`). Programmatically clicking a same-origin `<a href="…" download>` sends session cookies automatically, and the BFF forwards `Content-Disposition: attachment` from DIAL Core — the browser handles the download natively with zero memory overhead.

**Alternative considered:** use `downloadFile()` from `files.api.ts` (`filesApi.downloadFileRaw()` + blob + object URL). This approach works but buffers the entire file in memory and requires more cleanup code. Anchor navigation is simpler for a pure browser download trigger.

### Decision 3: Export `resolveDialFileDownloadUrl` from `icon-path.ts`

The existing `resolveDialFileUrl` is private to `icon-path.ts`. Rather than duplicating the logic, it should be extracted to a standalone exported function. Its name is changed to `resolveDialFileDownloadUrl` to make its purpose explicit.

**Alternative considered:** inline the URL construction inside `useAttachmentAction`. Rejected — duplication; the function already exists and is tested implicitly through `resolveCatalogIconUrl`.

### Decision 4: `useAttachmentAction` as the extensibility seam

`apps/chat/src/hooks/attachment/useAttachmentAction.ts` returns a stable `(attachment: DisplayAttachment) => void` callback. The hook is the single place where attachment-type-specific routing will live. Adding a new handler in the future means adding a branch here (or delegating to a registry), not touching `FilesSection` or `ConversationSourcesPanel`.

The hook lives in `apps/` not `libs/` because it knows about BFF URLs, routing, and other app concerns — consistent with the library isolation rule.

### Decision 5: `FilesSection` receives `onAttachmentClick` as a prop (not inlined)

`FilesSection` is passed `onAttachmentClick?: (attachment: DisplayAttachment) => void` and forwards `(att) => onAttachmentClick?.(att)` to `AttachmentCard`'s `onClick`. The panel owns the handler; the section is just a conduit. This keeps `FilesSection` reusable and avoids coupling it to any specific action.

## Risks / Trade-offs

- **`Content-Disposition` missing from DIAL Core response** → The browser will open the file inline instead of downloading it. Mitigation: the BFF spec requires forwarding this header; this is a server-side correctness issue, not a client-side one.
- **DIAL file ID format change** → If `files/{bucket}/{path}` format ever changes, `resolveDialFileDownloadUrl` breaks silently. Mitigation: the function is small and tested; a format change would require updating one place.
- **`AttachmentCard` interactive when only read-only display is wanted** → Callers that do not pass `onClick` are unaffected (prop is optional, card stays inert). No regression risk for the conversation input use-case.

## Migration Plan

No migration needed — no data schema changes, no API changes, no breaking changes to existing component consumers. The `onClick` prop on `AttachmentCard` is additive and optional.

Deploy as a normal feature PR on the `development` branch.

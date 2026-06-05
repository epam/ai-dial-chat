## Context

Conversations in DIAL Core are stored as resources whose file name encodes three segments: `{deploymentId}__{title}__{uuid}`. The human-readable title is embedded in the path, so "renaming" a conversation requires moving the resource to a new path with the updated title segment — DIAL Core has no in-place title mutation API. The SDK exposes `moveResource(sourceUrl, destinationUrl)` for this.

The existing ConversationPanelView already manages local dialog state for the Delete confirmation (pendingDeleteId / isDeleting / deleteError). The Rename popup follows the same pattern: local state in ConversationPanelView, a `renameConversation` operation surfaced through ConversationsContext.

## Goals / Non-Goals

**Goals:**
- Add `PATCH /api/v1/conversations` that renames a conversation via `moveResource` and returns the updated conversation path.
- Add a `RenameConversationPopup` component using `DialPopup` with a controlled text input, Cancel and Save buttons.
- Wire the Rename action into `ConversationPanelView` alongside Pin and Delete.
- Propagate the rename optimistically in `ConversationsContext` and revert on failure.
- Add i18n keys for all new strings.
- Integration tests for the PATCH handler; unit tests for the popup component.

**Non-Goals:**
- Bulk rename.
- Rename from the conversation view header (separate scope).
- Folder/path restructuring — title segment only.

## Decisions

### D1: PATCH renames by path-segment replacement, not a dedicated title field

DIAL Core has no title field — the title lives in the resource URL. Renaming = `moveResource(oldUrl, newUrl)` where `newUrl` is constructed by replacing the title segment of the path. The PATCH endpoint accepts `{ path, newTitle }` in the query/body, constructs the new DIAL Core URL, calls `moveResource`, and returns `{ newPath }` so the frontend can update its local state.

_Alternative considered_: a PUT that re-saves the full conversation — rejected because it would overwrite the latest content if another tab modified it during the rename dialog being open.

### D2: PATCH returns `{ newPath }` — the frontend updates ConversationsContext optimistically

On Save, the frontend: (1) closes the dialog, (2) optimistically updates the `title` and `id` in the local conversations list, (3) calls `PATCH`, (4) on error reverts the optimistic update and shows an inline error in the popup. This avoids a full list re-fetch for a title-only change.

_Alternative considered_: re-fetch the full list after rename — rejected for latency and flash-of-old-title UX.

### D3: Rename dialog state lives locally in ConversationPanelView

Pin uses a fire-and-forget optimistic update on the context. Delete uses local state (pendingDeleteId / isDeleting / deleteError). Rename follows Delete's pattern: `pendingRenameItem` (id + current title) / `isRenaming` / `renameError`. No new context state needed beyond the `renameConversation` action.

### D4: Use `DialPopup` directly (not `DialFormPopup` or `DialConfirmationPopup`)

`DialFormPopup` wraps submit into a form-submit callback which is heavier than needed for a single input. `DialPopup` with a custom footer (Cancel + Save `DialButton`s) is the right primitive — same pattern as the design spec in the task, and closer to what `DialConfirmationPopup` uses internally.

### D5: Input validation — non-empty, max 200 chars (matching `prepareEntityName` MAX_ENTITY_LENGTH)

Save is disabled while the trimmed value is empty or unchanged from the current title. The 200-char limit matches the backend's `prepareEntityName` sanitiser so validation is consistent frontend-to-backend.

## Risks / Trade-offs

- **Concurrent rename race**: If two tabs rename the same conversation simultaneously, the second `moveResource` call will 404 (source no longer exists). Mitigation: the backend propagates the DIAL Core error as 404, the frontend shows an error and refreshes.
- **Generated client lag**: `PATCH /api/v1/conversations` must be added before the OpenAPI client is regenerated. The slice order in tasks.md reflects this (backend → regenerate → frontend).
- **Path encoding**: DIAL Core paths may be percent-encoded. The existing code in ConversationPanelView already handles `decodeURIComponent` for panelToContextId mapping; the same encoding logic must be applied when constructing the new path in the backend service.

## Migration Plan

No migration needed — this is a purely additive change (new endpoint + new UI). Existing conversations are unaffected.

## Open Questions

None.

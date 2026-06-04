## Context

The `implement-conversation-panel` change shipped a read-only panel. Pin and Delete are the two most important per-item actions. Pin is non-destructive and requires server-side persistence; Delete is destructive and requires confirmation.

## Goals / Non-Goals

**Goals:**
- Per-row hover actions via a dots dropdown trigger — **Pin / Unpin** (toggle) and **Delete**.
- Pin state persisted server-side in the user's DIAL Core bucket.
- Delete with a `DialConfirmationPopup` (danger variant) showing the conversation title.
- Optimistic UI updates — pinned/deleted rows update immediately.
- On delete of the active conversation, navigate to the root (new chat) before the API call.
- Delete also cleans up the pin record for the deleted conversation.

**Non-Goals:**
- No rename from the panel in this change.
- No bulk pin/delete.
- No cross-device real-time sync (pin state is read on load, not pushed).

## Decisions

### 1. `getActions(item) => DropdownItem[]` instead of per-action props

The original proposal used individual props (`onPinConversation`, `pinLabel`, `unpinLabel`, `onDeleteConversation`, `deleteLabel`). This was replaced with a single callback that the app uses to build the full menu, making the lib completely action-agnostic.

**Rationale:** Adding future actions (rename, share, duplicate…) would require lib API changes with the per-prop approach. With `getActions`, the lib never needs to change — only the app's callback does.

**Decision:** `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` on both `ConversationPanelProps` and `ConversationGroupProps`.

### 2. `DialDropdown` + `DialIconButton` instead of `DialButtonDropdown`

`DialButtonDropdown` adds a chevron caret and is designed for labelled buttons. The trigger here is an icon-only dots button with no caret.

**Decision:** `DialDropdown` wrapping `DialIconButton` (`IconDotsVertical`, `ButtonAppearance.Ghost`, `ElementSize.Small`). Trigger styled with accent-secondary background and icon color via SCSS CSS vars.

### 3. Pin storage — `conversation-pins.json` in the user's DIAL Core bucket

DIAL Core has no native pin concept. Options considered:

| Option | Pro | Con |
|---|---|---|
| `isPinned` in conversation JSON body | No extra storage | Requires loading each conversation's full body — O(N) reads on list |
| `localStorage` | Zero backend | Lost on new device/session |
| Separate JSON file in DIAL Core bucket | One read per list call, cross-session | File may not exist on first load |

**Decision:** `conversation-pins.json` containing `{ pinnedIds: string[] }`. Read via `client.downloadFile`, written via `client.uploadFile`. Falls back to `[]` on any error (404, parse failure, network error). One extra parallel DIAL Core call per `listConversations`.

**Storage bucket:** The same `bucket` already present in the user session (resolved by `SessionGuard` via `getUserBucket`). No additional session fields are needed.

**Upload format:** The DIAL Core Files API requires `multipart/form-data`. Passing a raw `Buffer` with `Content-Type: application/json` (or `application/octet-stream`) causes openapi-fetch to send a boundary-less `multipart/form-data` header, which DIAL Core rejects with 400. The fix is to pass `body: { file: new Blob([content]) }` — openapi-fetch recognises the `{ file }` object matches the `multipart/form-data: { file }` schema and constructs a proper `FormData`, which in turn causes fetch to emit `Content-Type: multipart/form-data; boundary=<generated>`. Download (GET) uses the SDK's `client.downloadFile` with `parseAs: 'stream'` as before.

**SDK error field:** `client.uploadFile` resolves (does not throw) on DIAL Core errors — it returns `{ error, response }`. The original implementation did not inspect `error`, so any DIAL Core upload failure was silently swallowed and the controller returned 204. `savePinnedIds` now checks `error !== undefined` and calls `handleDialError` accordingly, so failures surface as proper HTTP errors to the client.

### 4. Pin identifier format — full DIAL Core resource URL

The `ConversationListItemDto.id` is the full DIAL Core resource URL (e.g. `conversations/bucket/gpt-4__chat__uuid`). This is stored directly in `pinnedIds` so that `listConversations` can match without any transformation: `pinnedSet.has(item.url)`.

For delete cleanup, the id is reconstructed as `conversations/${bucket}/${conversationPath}` using the `bucket` from the session and the `conversationPath` already received by the delete endpoint.

### 5. Delete navigation fires before the API call

The route change (`navigate(ROUTES.ROOT)`) is synchronous and fires before `await deleteConversation(id)`. This avoids a flash where the right panel still shows the deleted conversation while the API call is in flight.

### 6. `ConversationRow` extracted to its own file

The row component owns `isMenuOpen` state (from `DialDropdown.onOpenChange`). This state keeps the trigger visible when the dropdown is open and the mouse has moved away from the row. Extracting to a file prevents per-item state from living inline inside `ConversationGroup`'s render loop.

### 7. Optimistic updates — pin with rollback, delete without

`pinConversation` in the context is `async`. It applies the local state change optimistically, awaits the API call, and reverts the state (sets `isPinned` back to `!isPinned`) on failure. This ensures pin state never silently desynchronises from the server — the original fire-and-forget approach caused the UI to show a conversation as pinned even when the backend write failed, resetting on the next page reload.

`deleteConversation` re-throws on error so `ConversationPanelView` can log it. The optimistic removal is not rolled back on failure (the item has already been navigated away from); a full `refreshConversations` on error would restore it if needed in a future improvement.

## Risks / Trade-offs

- **[Risk] Race condition on pin + concurrent list refresh** — optimistic local state could be overwritten if the list refreshes while a pin call is in flight. Acceptable for V1.
- **[Trade-off] One extra network call per list load** — reading the pins file adds one DIAL Core round-trip. Mitigated by running it in parallel with the metadata call.
- **[Trade-off] Hover-only trigger** — users on touch devices cannot access pin/delete via hover. A context menu or long-press gesture is a follow-up.
- **[Trade-off] No rollback on failed delete** — the optimistic removal stands even if the API call fails. The user would need to reload to see the conversation again.

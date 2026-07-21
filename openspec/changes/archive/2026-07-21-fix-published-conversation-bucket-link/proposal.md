## Why

`GET /api/v1/conversations/list` tries to de-duplicate a user's personal-bucket conversations against the `public` bucket's published conversations by matching on relative path (the resource URL with the leading `conversations/<bucket>/` segment stripped). When a personal-bucket item's relative path happened to match a public-bucket item, the service kept the personal-bucket item (tagging it `publishedWithMe: true`) and dropped the public-bucket item from the response entirely — the public copy's `conversations/public/...` resource id never reached the frontend. Since both the "open conversation" link (`href={getConversationRoute(id)}` in `ConversationPanelView.tsx`) and the "Copy link" share action forward `item.id` verbatim, every link a user got for a conversation they'd published this way pointed at their personal bucket, not the public one (GitHub issue #7851).

The relative-path matching itself is also fundamentally unreliable: publish lets the user pick an arbitrary target folder in the public bucket (`getPublicTargetFolder`/`getResourceName` in `apps/chat-api/src/publish/publish-target.util.ts` only keep the source's last path segment), so the public relative path only coincidentally equals the personal one when publishing to the bucket root. Publishing into any named folder — the primary use of the publish folder-picker UI — means the two paths never match, so the old dedup silently failed to merge the pair at all in the common case, while in the coincidental-match case it additionally broke the owner's pin status on the personal copy (pins are keyed by id, and merging swapped which id survived).

## What Changes

- In `ConversationService.listConversations` (`apps/chat-api/src/conversations/conversation.service.ts`), remove the relative-path matching/merge logic entirely. The user's personal-bucket copy and its public-bucket copy (if published) are now always returned as **two independent list items**, each keeping its own resource id: the personal copy stays a normal, writable, non-published entry (`publishedWithMe: false`, real `isReadonly` from DIAL Core permissions), and the public copy is a separate read-only entry (`publishedWithMe: true`, `isReadonly: true`) with its own `conversations/public/...` id.
- This guarantees any link built from a list item's `id` — "Copy link", the conversation open/navigate route — resolves to the bucket that item actually represents, regardless of what folder the conversation was published to.
- The owner's pin status, rename/delete ability, and any other per-item state on the personal copy are unaffected by publishing, since the personal item's `id` never changes and is never dropped from the list.
- No changes to `ConversationPublishService`/the publish flow itself — `targetUrl` construction there is unaffected.
- No changes to the frontend — it already renders whatever items the list endpoint returns and already treats `publishedWithMe: true` items as read-only; showing two items for a published conversation instead of one merged item requires no frontend change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversations-api`: `GET /api/v1/conversations/list` no longer merges/deduplicates a personal-bucket item with its public-bucket counterpart. Both are always returned as separate items with their own ids, `isReadonly`, and `publishedWithMe` values.

## Impact

- **Affected code**: `apps/chat-api/src/conversations/conversation.service.ts` — `listConversations`'s `getBucketRelativePath`/`publicItemPaths`/merge logic is removed; `userItems` and `publicItems` are now built independently with no cross-bucket filtering.
- **Affected tests**: `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` and `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` — cases assert both items are returned independently with correct ids, and that the personal copy's pin status survives publishing.
- **Downstream effects (unchanged code, verified still correct)**: frontend "Copy link" (`ConversationPanelView.tsx` → `useShareLink` → `share-link.ts` → `POST /api/v1/share`) and the conversation `href`/navigation route (`getConversationRoute(id)`) both consume `item.id` as-is; since every list item's `id` now correctly matches the bucket it belongs to, both flows produce a correct link with no further changes.
- **User-visible change**: a user who has published one of their own conversations will now see **two** entries for it in the conversation list — their personal, editable copy and the read-only published copy — instead of a single merged entry. This matches how any other public-bucket item (not authored by the current user) already appears, and avoids silently losing the personal copy's pin/edit state.
- **No OpenAPI/DTO shape change**: `ConversationListItemDto` fields are unchanged.

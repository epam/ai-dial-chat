## Why

Publishing a conversation to an Organization folder calls DIAL Core's `createPublication`, which only ever creates a **pending publication request** — a separate, admin-only `approvePublication` call is required before the resource actually exists in the `public` bucket. `conversation-publish-flow`'s spec currently requires a success notification and a `refreshConversations()` call that together promise the published copy "becomes visible under the Organization tab... without requiring a manual reload" (GitHub issues #7897, #7806) — a promise Core cannot fulfill until an admin approves the request out-of-band.

The `createPublication`/moderation behavior itself is correct and working as DIAL Core designs it — the defect is that the spec (and the code built from it) asserts an outcome Core doesn't produce. Surfacing the publication's actual approval status in the UI is a separate, larger effort (it would need a reliable per-resource history read from Core, currently an open, unverified issue against `getPublications`, plus new UI) and is out of scope here. This change only corrects the spec and the two concrete pieces of misleading behavior it describes: the notification copy and the pointless list refresh.

## What Changes

- Correct `conversation-publish-flow`'s "Successful publish..." requirement to describe publish as submitting a request pending admin approval, not an operation that makes the conversation immediately visible.
- Frontend success notification copy (`conversationPublish.successMessage`) changes from implying the conversation is now published to indicating the request was submitted for admin approval.
- The `refreshConversations()` call in `PublishConversationPanelContainer`'s `onPublishSuccess` is removed — there is nothing new for the Organization tab to show immediately after submitting a request still pending approval, so calling it is pointless and reinforces the wrong mental model.
- No new `status` field, no publish-history UI changes, no catalog publish changes — out of scope for this change (see design.md Non-Goals).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversation-publish-flow`: successful publish shows a "submitted for approval" notification instead of a "published" one and no longer triggers `refreshConversations()`.

## Impact

- **Affected code**: `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` (remove the `refreshConversations()` call), `apps/chat/src/i18n/locales/en.json` (and any other actively maintained locale files) for the reworded `conversationPublish.successMessage` key.
- **Affected tests**: `apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx` — assert `refreshConversations` is NOT called on publish success; update notification-message assertions to the new copy.
- **Not affected**: `apps/chat-api` (no DTO/endpoint changes), `libs/catalog` (no shared-component changes), catalog publish flow (same underlying issue exists there too, but is explicitly out of scope for this change).

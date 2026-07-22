## Context

`apps/chat-api/src/conversations/conversation-publish.service.ts` proxies DIAL Core's `createPublication`. Per `@epam/ai-dial-typescript-sdk`'s generated types, a `Publication`'s `status` is `'PENDING' | 'APPROVED' | 'REJECTED'`, and a separate admin-only `approvePublication` operation exists specifically because `createPublication` does not itself make the target resource exist in the `public` bucket.

The frontend (`PublishConversationPanelContainer.tsx`'s `onPublishSuccess`) treats any 201 response as "done": it shows a success toast whose copy (`conversationPublish.successMessage`) implies the item is now published, and calls `ConversationsContext.refreshConversations()` expecting the Organization tab to now show it. `conversation-publish-flow`'s spec (`Requirement: Successful publish closes the panel, shows a success notification, and refreshes the conversation list`) encodes this same wrong assumption. This produced GitHub issues #7897 (published conversation not visible in Organization tab; 503 opening the destination folder) and traces back to #7806 (the original feature ask, whose acceptance criteria itself assumed immediate visibility).

This is a documentation-and-UX correction, not a change to `createPublication`/`approvePublication` call behavior, and not a change to `listConversations`'s bucket-merge logic (already correct — see `fix-published-conversation-bucket-link`).

## Goals / Non-Goals

**Goals:**
- `conversation-publish-flow`'s spec is corrected to describe the real behavior: publish success means a request was submitted and is pending admin review, not that the resource is now visible.
- The frontend notification copy matches that corrected understanding.
- The now-misleading `refreshConversations()` call on publish success is removed.

**Non-Goals:**
- Surfacing `Publication.status` anywhere in the API or UI. There is currently no reliable way to display it: the publish-history endpoint's `getPublications` call scope is an existing, unverified open issue (noted in `catalog-publish-api`'s spec), and adding a status indicator would require new DTO fields, generated-client regeneration, and new UI — a larger, separate effort. This change is scoped to the notification/refresh fix only.
- Any catalog publish changes. `PublishService`/`libs/catalog` share the same `createPublication` call and the same underlying issue, but are explicitly out of scope here — narrowed per explicit direction to fix only the conversation flow's concrete, currently-shipping misleading behavior.
- Implementing an in-app approval UI, auto-approving publications, polling for approval, or any other mechanism to detect approval happening later.
- Any change to `createPublication`'s request shape, `listConversations`, or the "already published in this folder" disable-submit check — all already correct.

## Decisions

### D1: Fix is two isolated edits, not a data-model change

No backend or DTO changes. The fix is:
1. `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`: delete the `void refreshConversations();` line from `onPublishSuccess`.
2. `apps/chat/src/i18n/locales/en.json` (and any other actively maintained locale file): reword `conversationPublish.successMessage` from an implied-complete phrasing to a submitted-for-approval phrasing.

Rejected alternative: adding a `status` field end-to-end (backend DTO → OpenAPI regen → history list UI) so the notification/UI could react precisely to approval state. Rejected for this change because it is a materially larger effort (new DTO fields, `npm run openapi` regeneration, new UI in a shared `libs/catalog` component, plus the pre-existing unresolved `getPublications` scope issue that would need fixing first for history data to be trustworthy) and was explicitly descoped in favor of shipping the concrete, currently-live UX fix now.

### D2: Spec correction describes "why", not just "what changed"

The `conversation-publish-flow` spec delta replaces the incorrect "becomes visible... without requiring a manual reload" language with accurate language: publish success means a request was submitted to Core and is pending admin review; the Organization tab will show the resource only after an admin approves it out-of-band. This is the same correction pattern already used by `fix-published-conversation-bucket-link` for a different, previously-wrong requirement in `conversations-api`.

## Risks / Trade-offs

- **[Trade-off]** Without a status indicator, a user who publishes has no in-app way to check whether their request was approved, rejected, or is still pending — they must rely on whatever out-of-band process/communication their organization's admins use. → **Mitigation**: this is the same situation the app is already in today (silently, and misleadingly); this change makes it honest rather than deceptive, without pretending to solve the larger visibility problem. A future change can add status visibility once the `getPublications` scoping issue is resolved.
- **[Trade-off]** The same misleading notification pattern remains in catalog publish (`PublishService`/`libs/catalog`), unfixed by this change. → **Mitigation**: explicitly out of scope per direction; can be proposed as a follow-up change reusing this one's approach.

## Migration Plan

Additive-only in effect (a copy change and a dead-call removal). No feature flag: ships as a normal PR; rollback is a plain revert. i18n locale files updated in the same commit as the key's value change, per project convention.

## Open Questions

- Exact reworded copy for `conversationPublish.successMessage` — a content/i18n decision, resolved at implementation time following existing i18n tone.

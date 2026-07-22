## Context

`ConversationService.listConversations` (`apps/chat-api/src/conversations/conversation.service.ts`) issues parallel `Promise.all` fetches against the user's own DIAL Core bucket and the `public` bucket. The original implementation tried to avoid showing a published conversation twice by matching a personal-bucket item to a public-bucket item via `getBucketRelativePath` — stripping the leading `conversations/<bucket>/` segment off each item's `url` and comparing the remainder as a string.

When a match was found, the old code kept the personal-bucket item (tagged `publishedWithMe: true`) and dropped the corresponding public-bucket item from the response — the public copy's `conversations/public/...` id never reached any caller. Every consumer of a list item's `id` (the "open conversation" `href` in `ConversationPanelView.tsx`, and the "Copy link" share action) builds a link straight from that `id`, so the resulting link pointed at the personal bucket even though the item displayed as published (GitHub issue #7851).

A first iteration of this fix kept the merge-into-one-item design but swapped which side survived (public instead of personal). Code review of that iteration surfaced two problems with keeping any merge at all:

1. **The match is unreliable in the case that matters most.** Publish lets the user pick an arbitrary target folder in the public bucket (`getPublicTargetFolder`/`getResourceName` in `apps/chat-api/src/publish/publish-target.util.ts` keep only the source's last path segment). The public relative path only equals the personal one when publishing to the bucket root; publishing into any named folder — the primary use of the publish folder-picker UI — means the paths never match, so the merge never engaged for the common case anyway.
2. **Merging drops state tied to the surviving side's old id.** Pins are stored keyed by whatever `id` was pinned (`UserConfigService.updatePin`); swapping which item's `id` survives the merge silently orphans the pin — `pinnedSet.has(decodedId)` in `mapItems` no longer matches, so a previously pinned, now-published conversation appears unpinned with no actual unpin action taken.

Given the match is inherently unreliable and merging has real, silent side effects on the surviving item's id-keyed state, this design instead removes the merge entirely.

## Goals / Non-Goals

**Goals:**

- A user's personal-bucket copy of a conversation and its public-bucket copy (if published) are both returned by `listConversations`, as two independent items, each carrying its own resource id.
- Any link built from a list item's `id` (open/navigate, "Copy link") resolves to the bucket that item actually represents — this holds unconditionally, not just for root-bucket publishes.
- The personal copy's pin status, edit permissions, and any other id-keyed state are unaffected by publishing, since its `id` never changes and it's never dropped from the list.
- Preserve existing behavior for every other case: items only in the personal bucket, items only in the public bucket, and shared-with-me items are unaffected.

**Non-Goals:**

- Deduplicating or visually grouping a personal item with its published counterpart in the list UI (e.g., showing them adjacent, or with a "this is also published" badge on the personal copy). The frontend already renders whatever the list contains; this is a possible future UX improvement, not part of this fix.
- Any change to `ConversationPublishService`, `publish-target.util.ts`, or the publish request/response contract.
- Any change to the frontend "Copy link" flow, `getConversationRoute`, or the conversation route/navigation code — all already forward `item.id` correctly and need no changes once every returned item's `id` is internally consistent.

## Decisions

**Decision: stop merging personal and public copies; always return both as independent items.**

Considered alternatives:
1. **Keep merging, but always swap to the public item's id/isReadonly for a matched pair** (the first iteration of this fix). Rejected after review: the match only fires for root-bucket publishes (see Context), so it silently fails to fix the reported bug for the more common named-folder publish case; and even in the case it does fire, it drops the personal item's pin status with no reconciliation.
2. **Keep merging, but add a `publicId` field alongside the untouched personal `id`** for the merged item, and have "Copy link" read `publicId` when present. Rejected: still depends on the unreliable relative-path match to know a public copy exists at all, so it still misses the common named-folder case; also requires DTO/OpenAPI and frontend consumer changes for a partial fix.
3. **(Chosen) Remove the matching/merge logic entirely.** The personal-bucket item and the public-bucket item are mapped independently, exactly like any other user-bucket-only or public-bucket-only item. This requires no matching heuristic at all (so it isn't limited to root-bucket publishes), leaves the personal item's `id` untouched (no pin/permission side effects), and needs zero frontend changes since the frontend already renders whatever the endpoint returns.

**Trade-off accepted:** a user who publishes their own conversation now sees two entries for it — their personal, editable copy and the read-only public copy — rather than one merged entry. This is the same visual pattern the app already used whenever the relative-path match happened to fail (i.e., most real publishes already looked this way); this change just makes it consistent for every publish, instead of an inconsistent special case for root-bucket publishes.

## Risks / Trade-offs

- **[Risk]** Users may be confused by seeing two identically-titled entries after publishing (their personal copy and the read-only public copy), with no visual indicator linking them. → **Mitigation**: out of scope for this bug-fix change (see Non-Goals); a future UX change could add a "published" badge to the personal copy by checking publish history, without needing to merge them.
- **[Trade-off]** No attempt is made to reconcile the two entries even when their relative paths do coincidentally match (root-bucket publish) — previously this case was "handled" (merged into one, incorrectly), now it behaves the same as every other publish (two entries). This is intentional: consistent behavior across all publish targets is simpler to reason about than a merge that only worked for one specific target.

## Migration Plan

No data migration. This is a pure read-path simplification in `listConversations` — no persisted state changes shape, and removing code only reduces what the endpoint does. Deploy as a normal backend release; rollback is a plain revert since no schema/contract changes are introduced.

## Open Questions

- Should a future change add a lightweight "published" indicator on the personal copy (without merging), so users have visual continuity between their draft and its published state? Out of scope here; raise as a follow-up UX proposal if requested.

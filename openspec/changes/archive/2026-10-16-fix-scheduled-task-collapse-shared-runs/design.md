## Context

`collapseScheduledTaskConversations` (`apps/chat/src/utils/collapse-scheduled-task-conversations.ts`) is a pure display-layer derivation introduced for #8934. It groups unpinned runs by `bucket/scheduleId` and keeps the newest. History is the route to older runs, but History needs `getScheduledTask`, which only the task's owner can call. Shared (`sharedWithMe`) and published (`publishedWithMe`) runs come from another user's bucket, so for their recipient the collapse hides rows with no other way to reach them.

## Goals / Non-Goals

**Goals:** shared and published runs always show as their own rows; own-run behavior is unchanged.
**Non-Goals:** the duplicate flow, a stack/switcher UI, any BFF/DTO/lib change.

## Decisions

### D1. Exempt by flag, in the same place as the pinned exemption

Both `groupScheduledTaskConversations` and `keepRepresentatives` already skip `isPinned`. Add one shared predicate (an item is collapsible when it is a task run, not pinned, not `sharedWithMe`, not `publishedWithMe`) and use it in both so the two phases cannot disagree. `applyActiveScheduledTaskRun` needs no change: exempt items never enter `runs`, so they are never swapped in or out.

*Alternatives:* compare the item's bucket with the session user's bucket — the host has no reliable bucket knowledge and the flags already carry it; filter in the BFF — rejected in #8934 D1 for the same reasons as before.

### D2. Keep the `bucket` part of the group key

Own runs always share the user's bucket, so the key is effectively `scheduleId` now. Dropping the bucket would be a needless change; leave it as defensive structure.

### D3. No change to ordering

Shared runs no longer take part in `compareNewestFirst`, so the "shared runs lack dates" fallback only matters for own runs (DIAL Core returns `createdAt` for items in the user's own bucket).

### D4. Published runs

The listing returns a published conversation's public-bucket copy as a separate item with `publishedWithMe: true` (`apps/chat-api/src/conversations/listing/conversation-listing.service.ts`). That copy never grouped with the owner's own runs (different bucket in the key); it now also stops grouping with other published runs of the same task. The owner's personal copy is unaffected.

## Risks / Trade-offs

- [An owner who shares many runs gives the recipient many rows] → accepted: each row is a result someone shared deliberately.
- [A shared copy the user later duplicated into their own bucket may still look like an own run] → out of scope, the duplicate follow-up covers it.

## Migration Plan

Single commit, no data or API migration. Rollback by revert.

## Open Questions

None. The direction (do not hide shared and published runs) was agreed with the requester in chat; product/QA confirmation happens on the PR. The duplicate flow is explicitly deferred.

## Why

A scheduled-task conversation the user does not own — one shared with them or published to the Organization — is still reported by `GET /api/v1/conversations/list` as a scheduled task with an unread state. The unread state cannot be cleared: opening the conversation clears it locally, but after the next list reload (for example, after the user clicks Home) it is unread again ([#9501](https://github.com/epam/ai-dial-chat/issues/9501)). The issue text says "Organization", but the recording attached to it shows a run in the **Shared** section. Publishing and sharing hand the recipient a copy of one conversation, not the task. The recipient cannot open the task, its run history, or its settings, so the scheduler metadata on that copy is wrong in the first place.

Root cause, observed in code:

- `ConversationListingService` runs `parseScheduledTaskConversationPath` on items from all three sources (user bucket, `public` bucket, shared resources) and sets `isScheduledTask`/`scheduleId`/`runId`/`isUnread` on every match (`apps/chat-api/src/conversations/listing/conversation-listing.service.ts:218` and `:293`). The parser only checks that `.scheduler` is the third path segment. It does not check whose bucket the item is in.
- A shared run's id is `conversations/{ownerBucket}/.scheduler/...`. Mark-as-viewed sends a bucket-less path (`libs/chat-hooks/src/conversation/useConversationStream/conversation-path.ts:8`). The backend then rebuilds the id with the **viewer's** bucket (`apps/chat-api/src/conversations/conversation.service.ts:109`, `buildConversationUrl(bucket, path)`). So the viewed-ids file stores `conversations/{viewerBucket}/.scheduler/...`, the listing compares that against `conversations/{ownerBucket}/...`, and they never match.

## What Changes

- **Problem**: shared and published copies of scheduled runs show the task icon and an unread dot that cannot be cleared, and opening one makes the active-task context look up a task the viewer does not own.
- **Solution**: only a conversation in the caller's own bucket can be a scheduled task. `GET /api/v1/conversations/list` SHALL report items from the `public` bucket and from `getSharedResources` with `isScheduledTask: false` and SHALL omit `scheduleId`, `runId` and `isUnread` for them, even when their path has the `.scheduler/{scheduleId}/` shape. The recipient then sees an ordinary conversation: no task icon, no unread dot, no task banner, and no mark-viewed request. This follows the rule `duplicate-conversation` already applies to copies of runs ("Duplicating a scheduled-task run produces an ordinary conversation").
- Rewrite the `ConversationListItemDto.isScheduledTask` OpenAPI description to say "a run in the caller's own bucket". Regenerate the client. Only the doc comment in the generated code changes.
- No frontend code changes. `ConversationsContext.markConversationViewed` (`apps/chat/src/context/ConversationsContext.tsx:429`), the task presentation in `ConversationPanelView` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:599`) and `ActiveScheduledTaskContext` (`apps/chat/src/context/ActiveScheduledTaskContext.tsx:131`) already treat `isScheduledTask: false` as a regular conversation.

**Alternatives considered**

1. *Keep foreign runs as scheduled tasks; fix only the id.* The frontend would send the full id, and the backend would store it without rebuilding the bucket. That clears the unread dot, but the recipient still gets a task icon and a task banner whose `getScheduledTask(scheduleId)` lookup runs against their own bucket and fails. It also contradicts the product rule that published or shared copies are not schedulers. Rejected.
2. *Strip the `.scheduler/{scheduleId}` segments from the publish `targetUrl`.* Not needed: `getPublishedTargetUrl` already keeps only the last path segment (`apps/chat-api/src/publish/publish-target.util.ts`), so a normal publish never produces a `.scheduler` path in `public`. It also does nothing for shares, which keep the owner's path. Rejected as insufficient.
3. *Detect ownership at the listing, by data source* (chosen). It is one backend change and covers share, publish, and a public folder someone named `.scheduler/...`. It needs no migration.

**Non-goals**

- Changing how the user's own runs are detected, grouped, marked unread, or marked viewed.
- Cleaning up ids that the old bug already wrote to `.client_data/.viewed-scheduled-task-conversations.json` (`conversations/{viewerBucket}/.scheduler/...`). They match nothing, so they are inert.
- Changing the publish or share request shapes, or the published copy's file name (`{deploymentId}__{title}__{runId}`). The title parser already treats the trailing run id as a legacy suffix and strips it.
- Updating `collapseScheduledTaskConversations`. Its shared/published exemption stays as defense in depth for a pure function that accepts any input.

**Acceptance criteria**

- A run shared with the user, and a published run in `public` (including one under `public/.scheduler/{id}/...`), are listed with `isScheduledTask: false` and without `scheduleId`/`runId`/`isUnread`.
- The user's own runs keep `isScheduledTask: true` with `scheduleId`/`runId` and the existing unread behavior, including fail-open when the viewed-ids file cannot be read.
- Opening a shared scheduled-run conversation and then navigating to Home shows no unread dot before or after the list reload.
- `npm run openapi:check` passes after regeneration. `chat-api` tests, lint and build pass, and `npm run validate:specs` passes.

**Rollback / compatibility**: Not breaking. The response shape is unchanged, and only the values for foreign items change. To roll back, revert the listing-service change. No data is migrated.

**i18n**: No new user-visible strings.

**Scope**: `apps/chat-api` only (listing service and DTO description), plus the regenerated `libs/chat-api-client`. No shared lib behavior or global provider changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversations-api`: the "Scheduler metadata" rule of `GET /api/v1/conversations/list` changes from "every merged item from any source" to "user-bucket items only". Public-bucket and shared items are always reported as non-scheduled.

## Impact

- `apps/chat-api/src/conversations/listing/conversation-listing.service.ts`: scheduler detection runs for user-bucket items only.
- `apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`: the two tests that assert foreign items are tagged (public and shared) are inverted, and a test is added for viewed-ids that never applies to foreign items.
- `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`: `isScheduledTask`/`isUnread` descriptions.
- `apps/chat-api/openapi` document and `libs/chat-api-client` generated models: description-only regeneration.
- `openspec/specs/conversations-api/spec.md`: updated through the delta spec.

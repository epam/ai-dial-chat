## Context

DIAL Scheduler persists conversations for each triggered scheduled task at a reserved DIAL Core path segment: `conversations/{bucket}/.scheduler/{scheduleId}/{runId}/{deploymentId}__{title}__{uuid}`. `ConversationService.listConversations` (see the [conversations-api spec](../../specs/conversations-api/spec.md)) already fetches all list items via three parallel DIAL Core calls and maps each into `ConversationListItemDto`. The frontend history panel (`libs/conversation-panel`, see [conversation-history-panel spec](../../specs/conversation-history-panel/spec.md)) renders those items through `ConversationPanelView` → `ConversationRow`.

Scheduled tasks (the `scheduled-tasks-api` capability) already validate `scheduleId`-shaped path segments against `^[A-Za-z0-9_-]{1,128}$` — this change reuses that exact pattern for both `scheduleId` and `runId` so parsing never trusts an unvalidated path segment into a response DTO.

## Goals / Non-Goals

**Goals:**
- Detect scheduler-created conversations purely from their DIAL Core resource path, with no new upstream call.
- Expose `isScheduledTask`/`scheduleId`/`runId` on every `ConversationListItemDto` the list endpoint already returns.
- Render a non-interactive "TASK" badge on matching rows in the history panel, in both LTR and RTL.

**Non-Goals:**
- No new REST endpoint, no path mutation, no read/write permission changes for scheduler conversations.
- No badge click-through or `/scheduled-tasks` navigation.
- No new "Tasks" filter tab — badge only, item stays in its existing Pinned/My chats/Shared/Organization group.
- No change to the single-conversation `GET /api/v1/conversations/:id` response in this change.

## Decisions

**Parsing is a pure function, not a service method.** `parseScheduledTaskConversationPath(resourceId: string): { scheduleId: string; runId: string } | null` lives in `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts`, with no DI, no logger, no DIAL Core client — it is pure string parsing so it is trivially unit-testable and reusable from `ConversationService` without constructing the service in tests. It:
1. Splits the resource id on `/`.
2. Confirms segment `[1]` (the segment right after `conversations/{bucket}`... actually after decoding the full id, the check is on the segment immediately following the bucket) equals the literal `.scheduler`.
3. Reads the next two segments as `scheduleId` and `runId`.
4. URL-decodes each of `scheduleId`/`runId` via the existing `safeDecodeURIComponent` (matches the pattern already used elsewhere in `conversations-api` for path segments).
5. Validates both against `^[A-Za-z0-9_-]{1,128}$`.
6. Returns `null` if any step fails — never throws. `ConversationService` treats `null` as "not a scheduled task": `isScheduledTask: false`, ids omitted.

Alternative considered: a regex over the raw id string. Rejected — segment-by-segment parsing makes the "decode before validate" step explicit and keeps malformed/traversal input (e.g. `..`, empty segments) naturally rejected by the allowlist regex rather than needing separate traversal checks.

**Populate the flag at the same mapping point as `sharedWithMe`/`publishedWithMe`.** `ConversationService.listConversations` already has one place where every merged item (user bucket, public bucket, shared) is mapped into `ConversationListItemDto`. The parser is called there per item using `item.id`/`item.url`, so scheduler detection works identically regardless of which of the three sources a scheduler conversation happens to appear from (e.g. it could theoretically be shared or published, independent of its own path).

**DTO fields are additive and optional.** `isScheduledTask` defaults `false` for every existing test fixture and caller; `scheduleId`/`runId` are `string | undefined`, present only when `isScheduledTask === true`. This keeps the change backward compatible for any existing consumer of `ConversationListItemDto` and avoids a breaking OpenAPI change.

**App-edge wiring keeps `libs/conversation-panel` host-agnostic.** The lib only receives `showTaskBadge?: boolean` and `taskBadgeLabel?: string` — plain presentational props, following the same pattern as existing `sharedWithMe`/`iconTooltip` props. `scheduleId`/`runId` are *not* passed into the lib in this change since the badge has no click behavior yet; if a future change adds navigation, those ids would be threaded through as opaque strings the same way, not as constructed URLs.

**Badge visibility is independent of the `scheduledTasksEnabled` feature flag.** The conversation already exists in DIAL Core regardless of whether the Scheduled Tasks nav feature is enabled for the user, so hiding the badge behind that flag would make an existing row look identical to a normal chat while still being scheduler-owned. The badge is derived purely from `isScheduledTask` on the list item.

## Risks / Trade-offs

- **[Risk] A conversation title or path that legitimately contains a `.scheduler` folder-like segment (unlikely, since conversation filenames are `{deploymentId}__{title}__{uuid}` without literal `/`, but a user-controlled title could theoretically collide if it contained an encoded slash before the deployment segment) → Mitigation:** the parser requires the exact three-segment shape (`.scheduler` / scheduleId / runId) *immediately* after the bucket, before any `{deploymentId}__{title}__{uuid}` segment, and both extracted ids must match the strict allowlist — a normal conversation's first post-bucket segment is always its `{deploymentId}__{title}__{uuid}` file segment (containing `__`), never a bare `.scheduler` literal, so false positives are not expected in practice.
- **[Risk] OpenAPI/client regeneration drift** if the DTO is hand-edited without running `npm run openapi` → **Mitigation:** tasks.md includes an explicit `npm run openapi && npm run openapi:check` step before considering the BFF slice done.
- **[Trade-off] No badge on `getConversation` (single-conversation) response** means the active chat header cannot show the badge in this iteration if that's later desired — deferred per proposal's Out of Scope; flagged as a natural follow-up rather than solved speculatively here.

## Open Questions

- Should the badge later gain a tooltip showing `scheduleId`/run timestamp? Deferred — out of scope for this change; no prop is being pre-built for it.

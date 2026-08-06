## Context

Scheduled tasks (spec `scheduled-tasks-api`) create conversations under a `.scheduler/{scheduleId}/{runId}/` path segment inside the user's bucket, outside of any direct user click. `GET /api/v1/conversations/list` already detects these via `parseScheduledTaskConversationPath` (`apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts`) and sets `isScheduledTask` on `ConversationListItemDto`. There is currently no notion of "has the user opened this conversation yet". Pin state is the closest existing analog: it is bucket-persisted in `.client_data/.user-config.json` and merged into the list response via one extra `Promise.all` branch in `ConversationService.listConversations` (`apps/chat-api/src/conversations/conversation.service.ts:564-762`, pinned ids fetched at `:614`).

Constraint: `.user-config.json` is explicitly off-limits for this feature (per the proposal) — it must be a separate file so that its read-modify-write lifecycle, versioning, and future growth don't couple to the unrelated user-config schema.

## Goals / Non-Goals

**Goals:**
- Persist "viewed scheduler-created conversation ids" per user in the DIAL Core bucket, surviving refresh and syncing across sessions/devices.
- Expose `isUnread` on `GET /api/v1/conversations/list` items, `true` only for scheduler-created conversations not yet marked viewed.
- Let the frontend mark a conversation as viewed when the user opens it, with an immediate (optimistic) UI update of the unread dot.
- Render an unread indicator dot before the row's leading icon in the history panel for such conversations.

**Non-Goals:**
- Tracking read/unread state for non-scheduler conversations (shared, published, regular chats).
- Real-time push of unread state across open tabs/devices (SSE) — the list is refetched/marked on normal navigation; no new socket channel is introduced.
- Any UI for bulk "mark all as read" — out of scope for this change.
- Pruning/garbage-collecting the viewed-ids file as conversations are deleted — left for a follow-up if the file grows large in practice (see Risks).

## Decisions

**1. New bucket file + domain, mirroring `user-config`.**
Add `apps/chat-api/src/scheduled-task-unread/` (service, controller, DTOs, module) rather than extending `UserConfigService`. Path constant `VIEWED_SCHEDULED_TASK_CONVERSATIONS_PATH = '.client_data/.viewed-scheduled-task-conversations.json'`. Same read pattern as `UserConfigService.readConfigFromPath` (`downloadFile` with `parseAs: 'stream'`, non-ok response → treated as empty/default, wrapped in try/catch falling back to `{ version: 1, conversationIds: [] }`), same write pattern as `UserConfigService.writeConfig` (`uploadFile` with a `FormData`/`Blob` body — required because DIAL Core rejects the boundary-less `Content-Type` a plain string/Buffer body produces). No migration function is needed yet since this is a v1 file; add one if the schema changes later (mirrors `migrateConfig` in `user-config.dto.ts`).
*Alternative considered*: extend `UserConfig` with a `viewedScheduledTaskConversationIds` field. Rejected per explicit proposal constraint — different lifecycle/growth characteristics (this list only grows with scheduler activity, unrelated to user preferences) and would force every user-config read/write to carry this payload.

**2. Storage as a flat id array, not a set/map keyed by schedule.**
`{ version: 1, conversationIds: string[] }` where each entry is the full DIAL Core conversation resource id (matches how `pinnedIds` stores full ids, not derived keys). Simpler dedup (`Set` in memory) and directly comparable against `ConversationListItemDto.id`. No need to key by `scheduleId`/`runId` since the id is already unique and stable.

**3. Mark-as-viewed is a dedicated endpoint, not folded into an existing PATCH.**
`PATCH /api/v1/conversations/viewed?path=<path>` — the conversation identified via the same `path` query param convention every other by-resource operation in `conversation.controller.ts` already uses (`ConversationPathDto`, see `GET`, `PUT`, `PATCH` rename, `DELETE`); there is no `:id` URL-segment convention in this controller to match, so a new one is not introduced. `@HttpCode(204)`, no body. Read-modify-write: read file, add id to array if absent (no-op if already present), write back. This keeps the endpoint idempotent and cheap to call optimistically on every open, without needing the frontend to know whether the id was already marked.
*Alternative considered*: reuse the `user-config` `PATCH` sub-resource style (`user-config/viewed-scheduled-tasks`). Rejected — the resource being mutated conceptually belongs to *conversations*, and colocating it under `conversations/viewed` keeps the frontend's `server-api/conversations.api.ts` wrapper as the single place that knows about this conversation lifecycle action.

**4. `isUnread` computed in `ConversationService.listConversations`, following the pinned-ids merge pattern exactly.**
Add one more parallel fetch — `this.scheduledTaskUnreadService.getViewedIds(token, bucket)` — alongside the existing `getPinnedIds` call, build a `Set<string>`, and in the per-item mapping set `isUnread: scheduledTask !== null && !viewedSet.has(decodedId)`. Only present (or `true`) for scheduler-created items; omitted/`false` otherwise — mirrors how `scheduleId`/`runId` are conditionally spread only when `scheduledTask !== null`.

**5. Frontend: optimistic mark-as-viewed on open, not a separate polling mechanism.**
`ConversationsContext` gains a `markConversationViewed(id)` action (mirrors the existing `pinConversation` optimistic-update-with-rollback pattern at `ConversationsContext.tsx:267`): update local `items` state to clear `isUnread` immediately, fire the PATCH, and on failure re-set `isUnread: true` (rollback) rather than blocking navigation on the network call. This is invoked from wherever a scheduler-created conversation is opened (history panel row click / direct route navigation to a `.scheduler/...` id) — a single call site is added at the existing "conversation selected/opened" handler, not duplicated per entry point.

**6. Unread dot rendering: composed into the existing `avatar`/`iconBefore` slot, not a new `Button` prop.**
In `ConversationRow.tsx`, when `item.isUnread`, wrap the existing `avatar` element in a small relatively-positioned wrapper with an absolutely-positioned dot (`start-0`/logical positioning per RTL rules), then pass that wrapper as `iconBefore` — same technique already used for `taskBadge` as `iconAfter` (`:141-150`). `ConversationItem` (`libs/conversation-panel/src/models/panel-props.ts`) gains an optional `isUnread?: boolean`. The dot itself is decorative status, not a control, so it needs an accessible name — expose it via a visually-hidden `aria-label`/`sr-only` span (e.g. "Unread") on the wrapper, since AAA requires status to not be conveyed by color alone.

## Risks / Trade-offs

- **[Risk] Viewed-ids file grows unbounded** as scheduled tasks accumulate over the user's lifetime, since nothing prunes ids for deleted conversations. → **Mitigation**: acceptable for v1 given pins have the same unbounded-growth characteristic today; if this becomes a real problem, a follow-up can cap/evict oldest ids or prune against a live listing during `readConfig`-equivalent.
- **[Risk] Optimistic mark-as-viewed race**: user opens a conversation, PATCH is in flight, and a concurrent `GET /list` (e.g. background poll) returns the pre-mark state, flickering the dot back. → **Mitigation**: same accepted trade-off as the existing pin optimistic-update pattern; low likelihood given `GET /list` is not polled aggressively today.
- **[Risk] Two bucket files now need independent read-modify-write for a single "open a conversation" action** (no cross-file transaction). A failed write to the new file simply leaves the item unread on next load — not destructive, so no cross-file consistency mechanism is needed.
- **[Trade-off] Extra bucket round-trip per `GET /list` call** (one more `downloadFile`), same cost class as the existing pinned-ids fetch; acceptable since both run in parallel via `Promise.all`.

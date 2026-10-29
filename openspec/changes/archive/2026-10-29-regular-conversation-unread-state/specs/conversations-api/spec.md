## MODIFIED Requirements

### Requirement: GET /api/v1/conversations/list returns a merged list from the user bucket, public bucket, and shared resources

The backend SHALL expose `GET /api/v1/conversations/list` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint is backed by DIAL Core metadata and the DIAL Core sharing API (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, min 1, max 1000, **no default** (`@IsInt @Min(1) @Max(1000) @IsOptional`)
- `nextToken` — opaque pagination cursor from a previous response (`@IsString @MaxLength(4096) @IsOptional`, `ListConversationsQueryDto`)

**Two request modes.** When **both** `limit` and `nextToken` are omitted, the endpoint returns the **complete history**: the service follows DIAL Core's cursors itself, in pages of 1000 per bucket, until each bucket is exhausted, and the response carries no `nextToken`. This mirrors the file listing contract (see the [file-list spec](../file-list/spec.md)). When either parameter is present, the endpoint returns **one page per bucket** and a compound continuation cursor; the page size is `limit` when given and 100 when only `nextToken` is given.

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;               // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;            // Human-readable conversation title extracted from the resource name
  updatedAt: number;        // Unix epoch milliseconds of the last update
  sharedWithMe: boolean;    // True when the conversation was shared with the current user
  publishedWithMe: boolean; // True when this conversation is from the public bucket (organisation content)
  isPinned: boolean;        // True when the user has pinned this conversation
  isReadonly: boolean;      // User-bucket items: true when the caller lacks WRITE permission; public and shared items: always true
  isScheduledTask: boolean; // True only for a user-bucket item whose resource path matches the .scheduler reserved-segment pattern; always false for public and shared items
  scheduleId?: string;      // Present only when isScheduledTask === true; the scheduler task id from the path
  runId?: string;           // Present only when isScheduledTask === true; the scheduler run id from the path
  isUnread?: boolean;       // Scheduled-task run: always present (true until opened). Regular user-bucket chat: present, as true, only while the chat is unread (see "Regular-chat unread" below); omitted otherwise
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Compound cursor for the next page; absent when no more results
}
```

**Six-way parallel fetch.** The service issues all of the following in a single `Promise.all`, always against the bucket root (recursive, no folder scoping):
1. `getConversationMetadata(bucket, '', { recursive: true, limit, permissions: true, token: userCursor })` — user's own conversations
2. `getConversationMetadata('public', '', { recursive: true, limit, token: publicCursor })` — organisation-published conversations
3. `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })` — conversations shared directly with the user
4. `UserConfigService.getPinnedIds(token, bucket)` — pinned conversation IDs
5. `ScheduledTaskUnreadService.getViewedIds(token, bucket)` — viewed scheduler-created conversation IDs
6. The regular-chat read state of the user's bucket: the read-before baseline and the viewed regular-chat ids (see the `regular-conversation-read-state` spec)

**Cursor following in complete-history mode.** The personal and public bucket walks are independent — each follows its own `nextToken` chain to exhaustion, so an empty intermediate page that still carries a cursor does not end that bucket's walk. Each bucket's walk keeps the set of cursors it has already requested; if DIAL Core returns a cursor that bucket has already followed, the service throws `BadGatewayException` rather than looping forever. In paged mode no cursor following happens: exactly one request per bucket is issued.

Items from all three data sources are merged and sorted by `updatedAt` descending (a stable sort). `FOLDER` items are filtered out from bucket and shared results. The `getSharedResources` response does not include `updatedAt`; shared items default to `updatedAt: 0`. Before the merge, shared items are pre-sorted by share date descending (the latest `acceptedAt` in `sharedBy`, 0 when absent), then by `name`, then by `url`, so their order among themselves is deterministic across reloads.

**Ownership flags.** Items from the `'public'` bucket always have `publishedWithMe: true` forced, regardless of the DIAL Core flag value. Items from `getSharedResources` always have `sharedWithMe: true` and `isReadonly: true` forced (public-bucket items are also always `isReadonly: true`). User-bucket items pass through the DIAL Core `sharedWithMe`/`publishedWithMe` flags unchanged.

**No personal/public merging.** The service SHALL NOT attempt to match or merge a user-bucket item with a public-bucket item, even when a personal conversation has been published and both a personal copy and a public copy exist. Each is returned as its own independent list item with its own `id`: the personal copy keeps its user-bucket `id`, real `isReadonly` (from DIAL Core permissions), and `publishedWithMe: false` (unless DIAL Core itself reports otherwise); the public copy is a separate entry with its own `conversations/public/...` id, `isReadonly: true`, and `publishedWithMe: true`. This guarantees any link built from a returned `id` (conversation open/navigation links, and share links created via `POST /api/v1/share`) always resolves to the bucket that specific item actually represents, and that the personal copy's pin status, unread status, and permissions are never affected by publishing.

**Scheduler metadata.** Only an item from the user's own bucket (data source 1) can be a scheduled task. For each such item the service SHALL call `parseScheduledTaskConversationPath(item.id)` (see the "Scheduler-created conversations are detected from their DIAL Core resource path" requirement above). When it returns a non-null result, the item SHALL have `isScheduledTask: true`, `scheduleId` and `runId` set from the result, and `isUnread` set to `true` unless the item's `id` is present in the viewed-ids set from `ScheduledTaskUnreadService.getViewedIds`, in which case `isUnread: false`. When `parseScheduledTaskConversationPath` returns `null`, the item SHALL have `isScheduledTask: false` with `scheduleId`/`runId`/`isUnread` all omitted.

**Regular-chat unread.** An item from the user's own bucket (data source 1) that is not a scheduled task SHALL have `isUnread: true` when its `updatedAt` is greater than the read-before baseline and its `id` is absent from the viewed regular-chat ids; otherwise `isUnread` SHALL be omitted. Ids are compared after the same URI-decoding the scheduler viewed set uses. When the baseline file is missing, the first list request SHALL create it with the current time and treat every chat as read; when the baseline file is malformed, or either file cannot be read (a failed download other than a missing file), the service SHALL omit `isUnread` for every regular chat, write no read-state file (so a missing baseline is not created while the viewed ids cannot be read) and log a warning. A malformed viewed-ids file is treated as an empty set, as for scheduled runs.

**Published and shared runs are ordinary conversations.** Items from the `'public'` bucket (data source 2) and from `getSharedResources` (data source 3) SHALL always have `isScheduledTask: false` with `scheduleId`/`runId`/`isUnread` all omitted, even when their path has the `.scheduler/{scheduleId}/` shape. Publishing or sharing hands the recipient one conversation, not the task: the recipient cannot open that task, its run history or its settings, and the viewed-ids file in the recipient's bucket is keyed by the recipient's own bucket. The rule is decided by data source, not by the `sharedWithMe`/`publishedWithMe` flags DIAL Core reports on a user-bucket item. This matches the "Duplicating a scheduled-task run produces an ordinary conversation" requirement of the `duplicate-conversation` spec.

**Scheduler conversation titles.** For filename-derived titles from any of the three data sources, the service SHALL recognize an application deployment path both at `applications/...` and beneath `.scheduler/{scheduleId}/applications/...`. The application version belongs to the deployment id, not the displayed conversation title: a filename `Daily%20plan__0.0.1__Todoist__{runId}` beneath `.scheduler/{scheduleId}/applications/{bucket}/` yields `title: "Todoist"` while its full `id` remains unchanged. This rule SHALL NOT treat a numeric title on a plain model deployment as an application version (for example, `model__18__{runId}` yields `title: "18"`). An authoritative stored display name remains governed by the display-name resolution requirement below.

**Compound `nextToken`.** Pagination state is tracked independently for the user bucket and public bucket (the `getSharedResources` endpoint returns all results at once and has no cursor). The response `nextToken` format is `ct1.<base64url(JSON)>` where the JSON object has optional fields `u` (user-bucket cursor) and `p` (public-bucket cursor). An incoming token without the `ct1.` prefix is treated as a legacy user-only cursor. The response `nextToken` is omitted when neither paginated source has more results.

**Resilience.** If the public bucket, shared resources, or viewed-ids call fails (throws or returns an error response), the endpoint logs a warning and continues — it still returns results from the other sources, with affected items falling back to `isUnread: true` for scheduler-created items when the viewed-ids fetch failed (fail open, so a transient error never silently hides a genuinely unread task). A failed regular-chat read-state fetch fails closed instead: no regular chat is flagged unread, so a transient error never turns the whole history unread. If the user bucket call fails, the endpoint returns the error to the client. In complete-history mode this applies to **every** page of the walk, not just the first: a failure on any personal-bucket page fails the whole request rather than returning a silently truncated history, and a failure on any public-bucket page drops the public contribution (including the pages already collected) while the request still succeeds.

`isPinned` is populated by `UserConfigService.getPinnedIds` against the user's DIAL Core bucket. See the [user-config-api spec](../user-config-api/spec.md). `isUnread` for scheduler-created items is populated by `ScheduledTaskUnreadService.getViewedIds` against the user's DIAL Core bucket (see the `scheduled-task-unread-tracking` spec) and for regular chats from the read state described above (see the `regular-conversation-read-state` spec). Pins and scheduler viewed ids fall back to `[]`/`isUnread: true` on error; the regular-chat read state falls back to no `isUnread`.

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken? })`
- Response type: `ConversationListResponseDto` (regenerated to include `isScheduledTask`/`scheduleId`/`runId`/`isUnread` on `ConversationListItemDto`)
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — invalid `limit` (out of range [1–1000] or non-integer) or `nextToken` exceeds 4096 chars
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — user bucket DIAL Core returned an error response on any page of the walk, or DIAL Core repeated a cursor already followed for a bucket

#### Scenario: Returns merged items from user bucket, public bucket, and shared resources

- **WHEN** `GET /api/v1/conversations/list` is called and each source has one conversation
- **THEN** the response is 200 with `items` containing all three entries

#### Scenario: Public bucket items always have publishedWithMe: true

- **WHEN** the public bucket returns an item with `publishedWithMe` absent or `false`
- **THEN** the response item SHALL have `publishedWithMe: true`

#### Scenario: Shared items are ordered by share date and are read-only

- **WHEN** `getSharedResources` returns two conversations, one accepted later than the other
- **THEN** both items have `isReadonly: true` and `updatedAt: 0`
- **AND** the more recently accepted share is listed before the other

#### Scenario: Shared resource items always have sharedWithMe: true

- **WHEN** `getSharedResources` returns a conversation
- **THEN** the response item SHALL have `sharedWithMe: true` and `publishedWithMe: false`

#### Scenario: Scheduled application run displays its title without the application version

- **GIVEN** DIAL Core metadata for `conversations/bucket/.scheduler/sched_abc/applications/bucket/Daily%20plan__0.0.1__Todoist__bc56151e-296d-469f-80f6-61fbb3e5a98a`
- **WHEN** `GET /api/v1/conversations/list` returns that item
- **THEN** its `title` is `"Todoist"`, its `id` retains `Daily%20plan__0.0.1__Todoist__bc56151e-296d-469f-80f6-61fbb3e5a98a`, and its `isScheduledTask` is `true`

#### Scenario: getSharedResources is called with CONVERSATION filter

- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the service calls `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })`

#### Scenario: Items are sorted by updatedAt descending

- **WHEN** items from all three sources are merged
- **THEN** the response `items` array is ordered by `updatedAt` descending (newest first)

#### Scenario: Omitting limit and nextToken returns the complete history

- **WHEN** `GET /api/v1/conversations/list` is called with neither `limit` nor `nextToken`, and the personal bucket holds more conversations than one 1000-item page
- **THEN** the service follows the personal bucket's cursors until exhausted, the response `items` contain the conversations from every page, and the response `nextToken` is absent

#### Scenario: Personal and public cursors are followed independently

- **WHEN** complete-history mode is requested and the public bucket returns an empty page that still carries a `nextToken`
- **THEN** the public walk continues to the next page rather than stopping, and the personal walk follows its own cursor chain unaffected

#### Scenario: A failed later personal page fails the request

- **WHEN** complete-history mode is requested and the personal bucket's second page returns an error
- **THEN** the endpoint returns 502 rather than a truncated list built from the first page

#### Scenario: A repeated personal-bucket cursor is rejected

- **WHEN** DIAL Core returns a `nextToken` that the personal-bucket walk has already followed
- **THEN** the service throws `BadGatewayException` instead of looping

#### Scenario: Returns compound nextToken when either paginated bucket has more results

- **WHEN** `GET /api/v1/conversations/list?limit=2` is called and both the user and public buckets return a next-page cursor
- **THEN** the response `nextToken` starts with `ct1.` and decodes to an object with both `u` and `p` cursor fields

#### Scenario: nextToken omitted when no paginated source has more results

- **WHEN** both the user and public buckets return fewer items than the limit
- **THEN** the response `nextToken` is absent

#### Scenario: Public bucket failure is non-fatal

- **WHEN** the public bucket call fails (network error or error response)
- **THEN** the response is 200 with user-bucket and shared items; the public bucket error is logged as a warning

#### Scenario: Shared resources failure is non-fatal

- **WHEN** the `getSharedResources` call fails
- **THEN** the response is 200 with user-bucket and public-bucket items; the error is logged as a warning

#### Scenario: FOLDER items are excluded from the response

- **WHEN** DIAL Core returns a mix of file items and items with `nodeType === 'FOLDER'` from either bucket
- **THEN** only non-FOLDER items appear in the response `items`

#### Scenario: Scheduler-created conversation not yet viewed is marked unread

- **GIVEN** a conversation whose id matches the `.scheduler/{scheduleId}/{runId}` path pattern
- **AND** that id is absent from the user's viewed-ids file
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: true` and `isUnread: true`

#### Scenario: Scheduler-created conversation already viewed is not marked unread

- **GIVEN** a conversation whose id matches the `.scheduler/{scheduleId}/{runId}` path pattern
- **AND** that id is present in the user's viewed-ids file
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: true` and `isUnread: false`

#### Scenario: Non-scheduler conversation omits isUnread

- **GIVEN** a conversation whose id does not match the `.scheduler/{scheduleId}/{runId}` path pattern, with `updatedAt` less than or equal to the read-before baseline (or any non-scheduler conversation from the public bucket or shared resources)
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: false` and `isUnread` omitted

#### Scenario: Regular chat updated after the baseline and not viewed is unread

- **GIVEN** a user-bucket regular chat with `updatedAt` greater than the baseline and an id absent from the viewed regular-chat ids
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: false` and `isUnread: true`

#### Scenario: Regular chat updated after the baseline but viewed omits isUnread

- **GIVEN** a user-bucket regular chat with `updatedAt` greater than the baseline and an id present in the viewed regular-chat ids
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isUnread` omitted

#### Scenario: First list request creates the baseline

- **GIVEN** the user's bucket has no read-before baseline file
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the file is written with the current time, and no regular chat has `isUnread`

#### Scenario: Read-state failure fails closed for regular chats

- **GIVEN** reading the baseline or the viewed regular-chat ids fails with anything other than a missing file, or the baseline file is malformed
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the response is still 200, a warning is logged, no regular chat has `isUnread`, and no read-state file is written

#### Scenario: Shared and published chats never carry isUnread

- **GIVEN** a chat from `getSharedResources` or the `'public'` bucket
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isUnread` omitted regardless of the read state

#### Scenario: Viewed-ids fetch failure falls back to unread for scheduler items

- **GIVEN** the viewed-ids bucket read fails (network error or error response)
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the response is still 200, a warning is logged, and every scheduler-created item from the user's own bucket has `isUnread: true`

#### Scenario: A run shared with the user is an ordinary conversation

- **GIVEN** `getSharedResources` returns `conversations/other-bucket/.scheduler/sched_shr/gpt-4o__title__a1b2c3d4-e5f6-4789-abcd-ef0123456789`
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `sharedWithMe: true` and `isScheduledTask: false`
- **AND** `scheduleId`, `runId` and `isUnread` are omitted

#### Scenario: A published run is an ordinary conversation

- **GIVEN** the `'public'` bucket returns `conversations/public/.scheduler/sched_pub/gpt-4o__title__d8bfff5d-d883-47e8-adc3-8a6afee46411`
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `publishedWithMe: true` and `isScheduledTask: false`
- **AND** `scheduleId`, `runId` and `isUnread` are omitted

#### Scenario: A shared run never reappears as unread

- **GIVEN** a run shared with the user from `other-bucket`, and the user's viewed-ids file holds no id for it, or holds the same path under the user's own bucket (written before this rule)
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: false` and no `isUnread`, so the conversation panel shows no unread dot and opening it sends no mark-viewed request

## ADDED Requirements

### Requirement: POST /api/v1/conversations/completions removes the conversation from the viewed regular-chat ids

When a generation is accepted on `POST /api/v1/conversations/completions` for a conversation that is not a scheduled-task run (every mode: append, regenerate and edit), the backend SHALL remove that conversation's id from the viewed regular-chat ids before the stream starts, so the chat becomes unread once its `updatedAt` passes the baseline. The removal SHALL be best effort: a failed read or write is logged as a warning and SHALL NOT fail, delay beyond the write itself, or alter the completion stream. A request rejected before generation starts (validation, authorization, an active generation conflict) SHALL NOT change the viewed ids. The id is built the same way as for `PATCH /api/v1/conversations/viewed`.

#### Scenario: Sending a message un-views the chat

- **GIVEN** a chat whose id is in the viewed regular-chat ids
- **WHEN** a completion is started for it
- **THEN** its id is no longer in the viewed ids and a later `GET /api/v1/conversations/list` returns `isUnread: true` for it once `updatedAt` exceeds the baseline

#### Scenario: A rejected completion leaves the viewed ids unchanged

- **GIVEN** a completion request that fails with 409 because another generation is active
- **WHEN** the request is rejected
- **THEN** the viewed regular-chat ids are not modified

#### Scenario: Un-view failure does not fail the completion

- **WHEN** removing the id from the viewed file fails
- **THEN** the completion stream still starts, and a warning is logged

### Requirement: Renaming a conversation preserves its read state

When `PATCH /api/v1/conversations` renames a regular chat that was read immediately before the rename (its `updatedAt` was less than or equal to the baseline, or its id was in the viewed regular-chat ids), the backend SHALL add its id to the viewed regular-chat ids so the rename's `updatedAt` bump does not make it unread. A chat that was unread before the rename SHALL stay unread. The read-state update SHALL be best effort and SHALL NOT fail the rename. Renaming a scheduled-task run does not touch the regular-chat read state.

#### Scenario: Renaming a read chat keeps it read

- **GIVEN** a chat updated before the baseline
- **WHEN** it is renamed
- **THEN** its id is added to the viewed regular-chat ids and the next list does not mark it unread

#### Scenario: Renaming an unread chat keeps it unread

- **GIVEN** a chat updated after the baseline whose id is not viewed
- **WHEN** it is renamed
- **THEN** its id is not added to the viewed ids and the next list still marks it unread

#### Scenario: Read-state failure does not fail the rename

- **WHEN** updating the read state fails during a rename
- **THEN** the rename still succeeds and a warning is logged

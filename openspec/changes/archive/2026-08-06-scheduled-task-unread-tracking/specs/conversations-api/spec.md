## MODIFIED Requirements

### Requirement: GET /api/v1/conversations/list returns a merged list from the user bucket, public bucket, and shared resources

The backend SHALL expose `GET /api/v1/conversations/list` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint is backed by DIAL Core metadata and the DIAL Core sharing API (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, default 100, max 1000 (`@IsInt @Min(1) @Max(1000) @IsOptional`)
- `nextToken` — opaque pagination cursor from a previous response (`@IsString @MaxLength(512) @IsOptional`)

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;               // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;            // Human-readable conversation title extracted from the resource name
  updatedAt: number;        // Unix epoch milliseconds of the last update
  sharedWithMe: boolean;    // True when the conversation was shared with the current user
  publishedWithMe: boolean; // True when this conversation is from the public bucket (organisation content)
  isPinned: boolean;        // True when the user has pinned this conversation
  isReadonly: boolean;      // True when the caller does not have WRITE permission on this exact resource
  isScheduledTask: boolean; // True when the resource path matches the .scheduler reserved-segment pattern
  scheduleId?: string;      // Present only when isScheduledTask === true; the scheduler task id from the path
  runId?: string;           // Present only when isScheduledTask === true; the scheduler run id from the path
  isUnread?: boolean;       // Present only when isScheduledTask === true; true when the user has not yet opened this conversation
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Compound cursor for the next page; absent when no more results
}
```

**Four-way parallel fetch.** The service issues all of the following in a single `Promise.all`, always against the bucket root (recursive, no folder scoping):
1. `getConversationMetadata(bucket, '', { recursive: true, limit, token: userCursor })` — user's own conversations
2. `getConversationMetadata('public', '', { recursive: true, limit, token: publicCursor })` — organisation-published conversations
3. `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })` — conversations shared directly with the user
4. `UserConfigService.getPinnedIds(token, bucket)` — pinned conversation IDs
5. `ScheduledTaskUnreadService.getViewedIds(token, bucket)` — viewed scheduler-created conversation IDs

Items from all three data sources are merged and sorted by `updatedAt` descending. `FOLDER` items are filtered out from bucket results. The `getSharedResources` response does not include `updatedAt`; shared items default to `updatedAt: 0`.

**Ownership flags.** Items from the `'public'` bucket always have `publishedWithMe: true` forced, regardless of the DIAL Core flag value. Items from `getSharedResources` always have `sharedWithMe: true` forced. User-bucket items pass through the DIAL Core `sharedWithMe`/`publishedWithMe` flags unchanged.

**No personal/public merging.** The service SHALL NOT attempt to match or merge a user-bucket item with a public-bucket item, even when a personal conversation has been published and both a personal copy and a public copy exist. Each is returned as its own independent list item with its own `id`: the personal copy keeps its user-bucket `id`, real `isReadonly` (from DIAL Core permissions), and `publishedWithMe: false` (unless DIAL Core itself reports otherwise); the public copy is a separate entry with its own `conversations/public/...` id, `isReadonly: true`, and `publishedWithMe: true`. This guarantees any link built from a returned `id` (conversation open/navigation links, and share links created via `POST /api/v1/share`) always resolves to the bucket that specific item actually represents, and that the personal copy's pin status, unread status, and permissions are never affected by publishing.

**Scheduler metadata.** For every merged item (from any of the three data sources), the service SHALL call `parseScheduledTaskConversationPath(item.id)` (see the "Scheduler-created conversations are detected from their DIAL Core resource path" requirement above). When it returns a non-null result, the item SHALL have `isScheduledTask: true`, `scheduleId` and `runId` set from the result, and `isUnread` set to `true` unless the item's `id` is present in the viewed-ids set from `ScheduledTaskUnreadService.getViewedIds`, in which case `isUnread: false`. When `parseScheduledTaskConversationPath` returns `null`, the item SHALL have `isScheduledTask: false` with `scheduleId`/`runId`/`isUnread` all omitted. This detection is independent per item — a scheduler-created conversation that also happens to be shared or published is still tagged and marked unread/viewed using its own resource id, not any other copy's id.

**Compound `nextToken`.** Pagination state is tracked independently for the user bucket and public bucket (the `getSharedResources` endpoint returns all results at once and has no cursor). The response `nextToken` format is `ct1.<base64url(JSON)>` where the JSON object has optional fields `u` (user-bucket cursor) and `p` (public-bucket cursor). An incoming token without the `ct1.` prefix is treated as a legacy user-only cursor. The response `nextToken` is omitted when neither paginated source has more results.

**Resilience.** If the public bucket, shared resources, or viewed-ids call fails (throws or returns an error response), the endpoint logs a warning and continues — it still returns results from the other sources, with affected items falling back to `isUnread: true` for scheduler-created items when the viewed-ids fetch failed (fail open, so a transient error never silently hides a genuinely unread task). If the user bucket call fails, the endpoint returns the error to the client.

`isPinned` is populated by `UserConfigService.getPinnedIds` against the user's DIAL Core bucket. See the [user-config-api spec](../user-config-api/spec.md). `isUnread` is populated by `ScheduledTaskUnreadService.getViewedIds` against the user's DIAL Core bucket. See the `scheduled-task-unread-tracking` spec. Both fall back to `[]`/`isUnread: true` on error.

Rate limiting: global default applies (no handler-level `@Throttle` override).

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken? })`
- Response type: `ConversationListResponseDto` (regenerated to include `isScheduledTask`/`scheduleId`/`runId`/`isUnread` on `ConversationListItemDto`)
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — invalid `limit` (out of range [1–1000] or non-integer) or `nextToken` exceeds 512 chars
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — user bucket DIAL Core returned an error response

#### Scenario: Returns merged items from user bucket, public bucket, and shared resources

- **WHEN** `GET /api/v1/conversations/list` is called and each source has one conversation
- **THEN** the response is 200 with `items` containing all three entries

#### Scenario: Public bucket items always have publishedWithMe: true

- **WHEN** the public bucket returns an item with `publishedWithMe` absent or `false`
- **THEN** the response item SHALL have `publishedWithMe: true`

#### Scenario: Shared resource items always have sharedWithMe: true

- **WHEN** `getSharedResources` returns a conversation
- **THEN** the response item SHALL have `sharedWithMe: true` and `publishedWithMe: false`

#### Scenario: getSharedResources is called with CONVERSATION filter

- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the service calls `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })`

#### Scenario: Items are sorted by updatedAt descending

- **WHEN** items from all three sources are merged
- **THEN** the response `items` array is ordered by `updatedAt` descending (newest first)

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

- **GIVEN** a conversation whose id does not match the `.scheduler/{scheduleId}/{runId}` path pattern
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** that item has `isScheduledTask: false` and `isUnread` omitted

#### Scenario: Viewed-ids fetch failure falls back to unread for scheduler items

- **GIVEN** the viewed-ids bucket read fails (network error or error response)
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the response is still 200, a warning is logged, and every scheduler-created item has `isUnread: true`

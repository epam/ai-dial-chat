## ADDED Requirements

### Requirement: Conversation list items carry the DIAL Core creation time

`ConversationListItemDto` (`apps/chat-api/src/conversations/dto/conversation-list.dto.ts`) SHALL include an optional field `createdAt?: number` — Unix epoch milliseconds of the resource's creation, documented with `@ApiPropertyOptional({ example: 1779206400000, description: ... })`.

`ConversationListingService.listConversations` SHALL populate it from DIAL Core metadata (`ResourceItemMetadata.createdAt`) for user-bucket and public-bucket items when DIAL Core returns a finite number, and SHALL omit it otherwise. Items from `getSharedResources` SHALL omit `createdAt` (that payload carries no dates). The field is purely additive: item count, the `updatedAt`-descending sort, pagination, and every other field of `GET /api/v1/conversations/list` are unchanged.

Example response item:

```json
{
  "id": "conversations/bucket/.scheduler/s1/gpt-4__Daily%20digest__7f3c...",
  "title": "Daily digest",
  "createdAt": 1779206400000,
  "updatedAt": 1779206460000,
  "sharedWithMe": false,
  "publishedWithMe": false,
  "isPinned": false,
  "isReadonly": false,
  "isScheduledTask": true,
  "scheduleId": "s1",
  "runId": "7f3c...",
  "isUnread": true
}
```

Generated-client impact:
- OpenAPI operationId: `listConversations` (unchanged)
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken? })` (unchanged)
- Response type: `ConversationListResponseDto`, regenerated so `ConversationListItemDto.createdAt?: number` is available to `apps/chat` and `libs/chat-hooks`
- Frontend callers keep using the normal (non-Raw) method via `apps/chat/src/server-api/conversations.api.ts`

Authorization and error codes are unchanged (401 without a bearer token; 400 on invalid `limit`/`nextToken`; 502 on user-bucket DIAL Core failure).

#### Scenario: User-bucket item exposes createdAt

- **GIVEN** DIAL Core returns a user-bucket item with `createdAt: 1779206400000`
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the response item has `createdAt: 1779206400000`

#### Scenario: Public-bucket item exposes createdAt

- **GIVEN** DIAL Core returns a public-bucket item with `createdAt: 1779206400000`
- **WHEN** the list is fetched
- **THEN** that item has `createdAt: 1779206400000` and `publishedWithMe: true`

#### Scenario: Missing creation time is omitted, not zeroed

- **GIVEN** DIAL Core returns an item without `createdAt`
- **WHEN** the list is fetched
- **THEN** the response item has no `createdAt` property

#### Scenario: Shared items carry no createdAt

- **WHEN** the list includes an item from `getSharedResources`
- **THEN** that item has no `createdAt` property and `updatedAt: 0`

#### Scenario: Ordering is unchanged

- **GIVEN** two items where the one with the later `createdAt` has the earlier `updatedAt`
- **WHEN** the list is fetched
- **THEN** items are still ordered by `updatedAt` descending

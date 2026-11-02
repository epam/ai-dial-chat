## ADDED Requirements

### Requirement: Project conversation list items carry isUnread

`ProjectConversationItemDto` (`apps/chat-api/src/projects/conversations/dto/project-conversation-list-response.dto.ts`) SHALL gain a required `isUnread: boolean` (`@ApiProperty`, `@IsBoolean`). It is computed for the caller by the rule of the `project-conversation-read-state` capability, and is present on every item.

`ProjectConversationsListService` (`apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`) SHALL:

- read the caller's project read state once per request, in parallel with Core's file listing, through `ConversationReadStateService.getProjectReadState(projectId, at, bucket)`. That method answers `{ readBefore, versions }` or `null`, and `null` fails closed;
- take each item's content version from the same body read that resolves its title. The `CachedTitle` entry (`projects:conversation-title:{locator}`, TTL 10 minutes) gains `version: string`. It stays valid only while the listing's `updatedAt` is unchanged, and the write endpoints still evict it. A cache hit therefore costs no extra read, and a miss costs the read the title already needs;
- when the title read fails (the file-name title fallback), leave the version unknown and report `isUnread: false`.

The response stays `200` with `Cache-Control: private, no-store`, and logs still carry counts only. The generated client's `ProjectConversationItemDto` gains `isUnread`. `toListItems` in `libs/chat-hooks/src/project/use-project-conversations.ts` maps it to `ProjectConversationListItem.isUnread`.

**Example response:**

```json
{
  "items": [
    {
      "id": "projects/a1b2c3/q4-launch/conversations/gpt-4o__Summary__7c1d",
      "name": "gpt-4o__Summary__7c1d",
      "title": "Weekly support health summary",
      "author": "Valery Tester",
      "updatedAt": 1793000000000,
      "isUnread": true
    }
  ],
  "hasMore": false
}
```

#### Scenario: Unread item in the list

- **GIVEN** a conversation updated after the caller's baseline, whose version differs from the caller's stored one
- **WHEN** `GET /api/v1/projects/:id/conversations` is called
- **THEN** that item has `isUnread: true`

#### Scenario: Cached title supplies the version

- **GIVEN** the title cache holds `{ updatedAt: 1793000000000, title, version: 'sha256:2' }` and the listing reports the same `updatedAt`
- **WHEN** the list is requested
- **THEN** the conversation body is not downloaded, and `isUnread` is computed from `sha256:2`

#### Scenario: Read state unavailable

- **WHEN** `getProjectReadState` answers `null`
- **THEN** every item has `isUnread: false`, and the response is `200`

## MODIFIED Requirements

### Requirement: Deleting and renaming a project conversation keep the caller's state consistent

`ProjectConversationsService` (`apps/chat-api/src/projects/conversations/project-conversations.service.ts`) SHALL, as a best effort after the Core write committed (a failure is logged at `warn` and never fails the request):

- **Delete:** after `deleteConversation`, remove `projectConversationIds[projectId][locator]` from the caller's file.
- **Rename (title only; the file name does not change):** before the rename, compute whether the conversation is read for the caller under the unread rule. If it was, store its new content hash after the save, so the user's own rename does not turn their chat unread. A chat that was unread stays unread.

- **Background display name:** when `ConversationNamingService` (`apps/chat-api/src/conversations/naming/conversation-naming.service.ts`) writes the LLM title of a project chat after its first answer, `ConversationReadStateService.carryProjectConversationViewed` moves the caller's stored version from the version before that write to the one after it. Nothing is written when the caller had viewed another version, or none. So an owner who watched the first answer does not find the chat unread once it has been named.

Only the caller's own file is changed. Other readers keep their entries:

- An entry for a deleted conversation is never listed again and is harmless.
- A title rename changes the content hash, so the chat shows as unread for other readers who had viewed it. This is accepted, because a rename is a change to the chat.

#### Scenario: Delete removes the entry

- **WHEN** the owner deletes conversation C of project P
- **THEN** the owner's file no longer holds `projectConversationIds[P][C]`

#### Scenario: The LLM title does not unread a watched chat

- **GIVEN** the owner viewed chat C at version `sha256:1` when its first answer ended
- **WHEN** the background naming writes C's title, so C is at `sha256:2`
- **THEN** the owner's file maps C to `sha256:2`, and C is read

#### Scenario: Rename keeps a read chat read

- **GIVEN** chat C is read for the owner
- **WHEN** the owner renames it
- **THEN** C is still read for the owner in the next list

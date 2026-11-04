## ADDED Requirements

### Requirement: Successful project viewed writes notify app listeners

`apps/chat/src/hooks/projects/projects-client.ts` SHALL export `subscribeProjectConversationViewed(listener: (conversationId: string) => void): () => void`. `projectsClient.markProjectConversationViewed(id)` SHALL await `projectViewedWriter.enqueue(id)`, then call every subscribed listener with `id`. The returned function removes the listener.

- A failed write notifies no listener and still rejects its own caller, as before.
- A write dropped by `drop(id)` notifies no listener.
- A listener that throws does not stop the others, nor the caller's promise.
- The listener registry is app-owned, module-level state. `createSerializedKeyedWriter` in `libs/chat-hooks/src/shared/serialized-writer.ts` does not change.

The sidebar's pinned-project tree subscribes (see the `sidebar-pinned-project-chats` capability), so a chat marked viewed by `ProjectChatPage` or by the project view's Chats list loses its dot in the sidebar too.

#### Scenario: A mark from the project chat page reaches the sidebar

- **GIVEN** a listener is subscribed
- **WHEN** `ProjectChatPage` marks chat C viewed and the `PATCH …/viewed` succeeds
- **THEN** the listener is called once with C

#### Scenario: A failed write notifies nobody

- **WHEN** the `PATCH …/viewed` for C fails
- **THEN** no listener is called, and the caller's promise rejects

#### Scenario: Unsubscribing

- **WHEN** the function returned by `subscribeProjectConversationViewed` is called and C is then marked viewed
- **THEN** the removed listener is not called

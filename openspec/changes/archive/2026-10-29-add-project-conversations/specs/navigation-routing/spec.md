## ADDED Requirements

### Requirement: Project chat route and helpers

`ROUTES` (`apps/chat/src/types/routes.ts`) SHALL gain `ProjectChat = '/projects/chat/:bucket/*'`, registered in `apps/chat/src/app/app.tsx`:

- inside the `ChatLayout` group, next to `/conversations/*`, so the desktop top bar and its sources toggle render;
- lazily loading `ProjectChatPage`;
- gated by `projectsEnabled`. When the flag is off the route renders `NotFoundPage`.

The static `chat` segment keeps the route disjoint from `ProjectView`, `ProjectEdit`, `ProjectCreate` and `ProjectSharedInvitation`.

`apps/chat/src/constants/routes.ts` SHALL add:

- **`getProjectConversationRoute(conversationId)`.**
  - It takes a project conversation id `projects/{bucket}/{projectPath…}/conversations/{name}`.
  - It returns `/projects/chat/{bucket}/{projectPath…}/conversations/{name}`, with every segment re-encoded as `buildProjectRoute` does.
  - An id whose second-to-last segment is not `conversations`, or with an unsafe segment (`isSafePathSegment`), falls back to `ROUTES.Projects`.
- **`parseProjectConversationRouteParams({ bucket, '*': splat })`.**
  - It returns `{ projectId, conversationId }`.
  - The splat's last segment is the conversation name, the one before it must be `conversations`, and every segment before that is the project path. A project path that itself contains a `conversations` segment is therefore unambiguous.
  - It returns `null` for an empty or unsafe splat, or one whose second-to-last segment is not `conversations`.
- **`isConversationPagePath(pathname)`:** `true` for `/conversations/…` and for `/projects/chat/…`.

#### Scenario: Building a project chat route

- **WHEN** `getProjectConversationRoute('projects/a1b2c3/marketing/Q4 launch/conversations/gpt-4o__Summary__1b2c')` is called
- **THEN** it returns `/projects/chat/a1b2c3/marketing/Q4%20launch/conversations/gpt-4o__Summary__1b2c`

#### Scenario: A project folder named conversations

- **WHEN** the route `/projects/chat/a1b2c3/conversations/team/conversations/gpt-4o__Plan__9f` is parsed
- **THEN** `projectId` is `projects/a1b2c3/conversations/team` and `conversationId` is `projects/a1b2c3/conversations/team/conversations/gpt-4o__Plan__9f`

#### Scenario: A splat without a conversations segment

- **WHEN** `/projects/chat/a1b2c3/q4-launch` is parsed
- **THEN** the parser returns `null`, and `ProjectChatPage` renders its not-found state

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is false and the user opens `/projects/chat/a1b2c3/q4/conversations/x`
- **THEN** `NotFoundPage` renders

### Requirement: Conversation-page route matchers recognise the project chat route

Every place that today decides "this is a conversation page" by the `/conversations/` prefix SHALL use `isConversationPagePath` instead, so a project chat gets the same chrome and channels:

- the client channel gate in `apps/chat/src/context/ClientChannelContext.tsx`, which delivers toolset sign-in events and is functionally required;
- the sources toggle in `apps/chat/src/components/Header/SourcesSidebarToggle.tsx`;
- the sources panel and attachments manager gate in `apps/chat/src/app/app.tsx`;
- `apps/chat/src/context/CelebrationHost.tsx`.

The sidebar's `activeConversationId` stays derived from `/conversations/` only, so no sidebar row is highlighted on a project chat.

#### Scenario: Toolset sign-in works in a project chat

- **WHEN** the user is on `/projects/chat/a1b2c3/q4/conversations/x`
- **THEN** the client channel is open, and the sources toggle renders

#### Scenario: No sidebar highlight

- **WHEN** the user is on a project chat route
- **THEN** no sidebar conversation row has `aria-current`

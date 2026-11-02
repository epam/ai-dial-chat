## ADDED Requirements

### Requirement: getInvitationRoutePath routes project invitations to the project landing route

`getInvitationRoutePath(itemId)` in `apps/chat-api/src/share/utils/share-resource.util.ts` SHALL return:

- `/projects/shared` for an id starting with `projects/`;
- `/conversations/shared` for an id starting with `conversations/`;
- `/catalog/shared` otherwise.

The project route path is a module constant next to `CATALOG_SHARE_INVITATION_ROUTE_PATH` and `CONVERSATION_SHARE_INVITATION_ROUTE_PATH`. Its JSDoc names `ROUTES.ProjectSharedInvitation` as the frontend route it must match. The helper stays pure, with no injectable dependency, as this capability requires.

#### Scenario: Project share link

- **WHEN** a share link is created for `projects/a1b2c3/q4-launch`
- **THEN** the returned link's path is `/projects/shared/{invitationId}`

#### Scenario: Other kinds are unchanged

- **WHEN** a share link is created for `skills/a1b2c3/helper`
- **THEN** the link's path is `/catalog/shared/{invitationId}`

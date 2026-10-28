## ADDED Requirements

### Requirement: Project view and edit routes and helpers

The `ROUTES` enum in `apps/chat/src/types/routes.ts` SHALL declare:

- `ProjectView = '/projects/view/:bucket/*'`
- `ProjectEdit = '/projects/edit/:bucket/*'`
- `ProjectSharedInvitation = '/projects/shared/:invitationId'`

All three are route patterns, not navigable URLs. Each is registered in `apps/chat/src/app/app.tsx` as a lazy-loaded page (`ProjectViewPage`, `ProjectEditPage`, `ProjectSharedInvitation`), next to `ROUTES.Projects`, inside the `RouteErrorBoundary` + `Suspense`/`RouteFallback` wrapper. All three are registered unconditionally, and each page applies the `projectsEnabled` guard itself.

`apps/chat/src/constants/routes.ts` SHALL export these helpers:

- **`getProjectViewRoute(id: string): string`** and **`getProjectEditRoute(id: string): string`**:
  - strip the `projects/` prefix;
  - split the remainder on `/`;
  - return `ROUTES.Projects` when the id has no prefix, fewer than two segments, or any segment that fails `isSafePathSegment`;
  - otherwise return `/projects/view/` or `/projects/edit/` followed by each segment encoded with `encodeURIComponent(safeDecodeURIComponent(segment))`, as `getConversationRoute` does.
- **`parseProjectRouteParams(params: { bucket?: string; '*'?: string }): string | null`**: rebuilds `projects/{bucket}/{path}` from the route params, or returns `null` when the bucket or path is missing or any segment fails `isSafePathSegment`.

The static segments `new`, `view`, `edit` and `shared` keep the patterns disjoint. `NAVIGATION_CONFIG` is unchanged, and the Projects sidebar item stays `aria-current="page"` on every `/projects/*` route through its existing prefix match.

#### Scenario: View route for a nested project

- **WHEN** `getProjectViewRoute('projects/a1b2c3/marketing/Q4 launch')` is called
- **THEN** it returns `/projects/view/a1b2c3/marketing/Q4%20launch`

#### Scenario: Unsafe id falls back to the list

- **WHEN** `getProjectEditRoute('projects/a1b2c3/../x')` is called
- **THEN** it returns `/projects`

#### Scenario: Params round-trip

- **WHEN** the router matches `/projects/view/a1b2c3/marketing/Q4%20launch`
- **THEN** `parseProjectRouteParams` returns `projects/a1b2c3/marketing/Q4 launch`

#### Scenario: Static create path still wins

- **WHEN** the router resolves `/projects/new`
- **THEN** it renders `ProjectCreatePage`, not the view page

#### Scenario: Sidebar keeps Projects active

- **WHEN** the user is on `/projects/view/a1b2c3/q4`
- **THEN** the Projects sidebar item has `aria-current="page"`

### Requirement: Project share invitations land on the project view

`ProjectSharedInvitation` (`apps/chat/src/pages/ProjectSharedInvitation/ProjectSharedInvitation.tsx`) SHALL render `SharedInvitation` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) with:

- `getTargetRoute = getProjectViewRoute`;
- `errorFallbackRoute = ROUTES.Projects`.

This is the pattern `ConversationSharedInvitation` follows. Accept errors, including `shareInvitationAcceptedUsersLimitReached` (Core caps project invitations at 10 accepted users), are shown exactly as for catalog invitations. When `projectsEnabled` is not `true`, the page renders `NotFoundPage` without accepting the invitation.

#### Scenario: Accepted project invitation opens the project

- **WHEN** a user opens `/projects/shared/inv-1` and the accept resolves with item id `projects/z9y8x7/research`
- **THEN** the router replaces the location with `/projects/view/z9y8x7/research`

#### Scenario: User limit reached

- **WHEN** the accept fails with `shareInvitationAcceptedUsersLimitReached`
- **THEN** the same limit message as for catalog invitations is shown, and the user is sent to `/projects`

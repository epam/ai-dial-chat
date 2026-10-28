## ADDED Requirements

### Requirement: Project create route

The `ROUTES` enum in `apps/chat/src/types/routes.ts` SHALL declare `ProjectCreate = '/projects/new'`. It is registered in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectCreatePage`, next to the existing `ROUTES.Projects` registration, using the same `RouteErrorBoundary` + `Suspense`/`RouteFallback` wrapper. Like `ROUTES.Projects`, it is registered unconditionally, and the `projectsEnabled` guard is applied inside the page through `useFeatureFlag('projectsEnabled')`.

`NAVIGATION_CONFIG` is unchanged: `/projects/new` has no sidebar item of its own. The Projects item in `apps/chat/src/constants/navigation.ts` declares no `isExactMatch`, so its `path` already matches as a prefix, and it SHALL remain marked `aria-current="page"` on `/projects/new` with no config change.

#### Scenario: Create path renders the create page

- **WHEN** `projectsEnabled` is `true` and the browser navigates to `/projects/new`
- **THEN** the lazy-loaded `ProjectCreatePage` mounts inside the standard route wrapper

#### Scenario: Static segment wins over future dynamic segments

- **WHEN** the router resolves `/projects/new`
- **THEN** it renders `ProjectCreatePage`, not the list page or NotFound

#### Scenario: Sidebar keeps Projects active

- **WHEN** the user is on `/projects/new`
- **THEN** the Projects sidebar item has `aria-current="page"`

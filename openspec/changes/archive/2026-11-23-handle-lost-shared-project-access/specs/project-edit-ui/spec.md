## MODIFIED Requirements

### Requirement: The project edit page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.ProjectEdit` (`/projects/edit/:bucket/*`) in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`), inside the standard `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper.

The page SHALL:

- render `RouteFallback` until the app config is ready;
- render `NotFoundPage` when `projectsEnabled` is not `true`;
- rebuild the id with `parseProjectRouteParams`;
- load the project with `useProject`;
- while loading, render `RouteFallback`;
- on error, not-found or access denied, render the same states the view page uses, through `ProjectView`'s state rendering with `project={null}`, passing `hasError`, `isNotFound` and `isAccessDenied` from `useProject`. On access denied the page shows "You no longer have access to this project" with "Back to projects" and no Retry (see the `project-view-ui` capability).

**Read-only guard.** When the loaded project has `canEdit: false`, the page SHALL `navigate(getProjectViewRoute(id), { replace: true })` and render nothing editable.

**Feature flag:** `projectsEnabled`. **RTL impact:** inherited from `ProjectCreateForm` (logical properties, mirrored back arrow) and from `ProjectView`'s states. **i18n impact:** see the i18n requirement; the access-denied strings come from `useProjectViewLabels`.

#### Scenario: Shared project cannot be edited by URL

- **WHEN** a user opens `/projects/edit/z9y8x7/shared-research` for a project with `canEdit: false`
- **THEN** the router replaces the location with `/projects/view/z9y8x7/shared-research`

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is not `true`
- **THEN** `NotFound` renders, and `getProject` is not called

#### Scenario: Edit after the owner revoked access or deleted the project

- **WHEN** a former editor opens `/projects/edit/z9y8x7/shared-research` and `getProject` rejects with `403`
- **THEN** "You no longer have access to this project" renders with a "Back to projects" button that navigates to `/projects`, no Retry button renders, and no form field renders

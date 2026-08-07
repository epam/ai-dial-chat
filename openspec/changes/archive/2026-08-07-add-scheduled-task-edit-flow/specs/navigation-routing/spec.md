## ADDED Requirements

### Requirement: Scheduled Task edit route and helper

`apps/chat/src/types/routes.ts`'s `ROUTES` constant SHALL declare `ScheduledTaskEdit: '/scheduled-tasks/:scheduleId/edit'`, registered in `apps/chat/src/app/app.tsx` as a lazy-loaded route alongside the existing `ROUTES.ScheduledTaskDetail` registration, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern. `apps/chat/src/constants/routes.ts` SHALL export `getScheduledTaskEditRoute(scheduleId: string): string`, returning `` `${getScheduledTaskDetailRoute(scheduleId)}/edit` `` so the `scheduleId` percent-encoding is inherited from `getScheduledTaskDetailRoute` rather than re-applied.

#### Scenario: Route path resolves for a given scheduleId

- **WHEN** `getScheduledTaskEditRoute('sched_123')` is called
- **THEN** it returns `/scheduled-tasks/sched_123/edit`

#### Scenario: scheduleId is percent-encoded in the resulting path

- **WHEN** `getScheduledTaskEditRoute` is called with a `scheduleId` containing characters that require percent-encoding
- **THEN** the returned path has that `scheduleId` percent-encoded via `encodeURIComponent` (inherited from `getScheduledTaskDetailRoute`)

#### Scenario: Edit route is registered with the same wrapper pattern as the detail route

- **WHEN** the user navigates to a URL matching `ROUTES.ScheduledTaskEdit`
- **THEN** the lazy-loaded `ScheduledTaskEditPage` route registration mounts, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern as `ROUTES.ScheduledTaskDetail`

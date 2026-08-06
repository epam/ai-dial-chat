## ADDED Requirements

### Requirement: Scheduled Task detail route and helper

`apps/chat/src/types/routes.ts`'s `ROUTES` constant SHALL declare `ScheduledTaskDetail: '/scheduled-tasks/:scheduleId'`, registered in `apps/chat/src/app/app.tsx` as a lazy-loaded route alongside the existing `ROUTES.ScheduledTasks` registration, behind the same `scheduledTasksEnabled` feature-flag guard. `apps/chat/src/constants/routes.ts` SHALL export `getScheduledTaskDetailRoute(scheduleId: string): string`, returning `` `/scheduled-tasks/${encodeURIComponent(scheduleId)}` ``, mirroring the existing `getConversationRoute` helper's pattern of building a route path from a caller-supplied id.

#### Scenario: Route path resolves for a given scheduleId

- **WHEN** `getScheduledTaskDetailRoute('sched_123')` is called
- **THEN** it returns `/scheduled-tasks/sched_123`

#### Scenario: scheduleId is percent-encoded in the resulting path

- **WHEN** `getScheduledTaskDetailRoute` is called with a `scheduleId` containing characters that require percent-encoding
- **THEN** the returned path has that `scheduleId` percent-encoded via `encodeURIComponent`

#### Scenario: Detail route is registered behind the same feature flag as the list route

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to a URL matching `ROUTES.ScheduledTaskDetail`
- **THEN** the lazy-loaded `ScheduledTaskDetailPage` route registration mounts, using the same `RouteErrorBoundary`/`Suspense` wrapper pattern as the list route

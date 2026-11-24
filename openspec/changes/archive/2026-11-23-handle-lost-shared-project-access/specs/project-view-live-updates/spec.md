## ADDED Requirements

### Requirement: A refresh that finds the access lost shows a toast and leaves the page

When a silent refresh of the open project resolves `ProjectRefreshOutcome.AccessLost` (its `getProject` answered `403`, see the `project-view-ui` capability), `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL leave the page as it does for a delete elsewhere:

- `showInfoNotification` from `useNotification()` (`apps/chat/src/context/NotificationContext.tsx`) with `t(ProjectsI18nKeys.ViewAccessDenied)`, "You no longer have access to this project". `NotificationContainer` announces it through its kit `LiveRegion`.
- `replacePinnedProjectId(id, null)`, so the sidebar no longer offers a project the user cannot open.
- `navigate(ROUTES.Projects, { replace: true })`.

The page SHALL leave at most once per project id: the guard that `handleDeletedElsewhere` uses (`hasLeftRef`, and the own-delete check) also covers this path. A `DELETE` event and an `AccessLost` refresh that both arrive therefore show one toast.

A recipient's access can disappear without a watch event the recipient can receive: an unshare changes the share, not the project, and a delete in the owner's bucket may no longer be delivered to the recipient. Any refresh the page runs, including the one after a reconnect, is what detects the loss. This change adds no polling.

The state stays in the page: `useProjectWatch` and `useProject` neither show toasts nor navigate.

#### Scenario: Access revoked while the page is open

- **WHEN** the view page shows a shared project and a silent refresh gets `403` from `getProject`
- **THEN** the toast "You no longer have access to this project" is shown, the project is unpinned, and the router is at `/projects`

#### Scenario: Delete event and lost access show one toast

- **WHEN** a `DELETE` event arrives and the refresh running at the same time resolves `AccessLost`
- **THEN** exactly one toast is shown, and the router is at `/projects`

#### Scenario: A failed refresh still keeps the page

- **WHEN** a silent refresh gets `503` from `getProject`
- **THEN** no toast is shown, and the page keeps the loaded project

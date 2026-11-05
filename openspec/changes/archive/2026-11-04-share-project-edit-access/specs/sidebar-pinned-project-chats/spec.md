## MODIFIED Requirements

### Requirement: The project row's menu offers the caller's project actions

The adapter SHALL build `getActions` for project rows (the See all row is only a link and has no menu) with these entries, in this order:

| Item | Shown | Behaviour |
| --- | --- | --- |
| Unpin (`ButtonsI18nKeys.Unpin`) | always | `setPinnedProject(id, false)`. A rejection shows `ProjectsI18nKeys.ActionsPinError` through `showErrorNotification`. |
| Edit (`ButtonsI18nKeys.Edit`) | `project.canEdit` | opens `getProjectEditRoute(id)` through `onOpenRoute` |
| Publish (`ButtonsI18nKeys.Publish`) | `project.canManage` | opens `PublishProjectPanelContainer` for the project, returning focus to the row's ⋮ trigger on close |
| Share (`ButtonsI18nKeys.Share`) | `project.canManage` | opens `ProjectShareOverlay` for the project |
| Delete (`ButtonsI18nKeys.Delete`) | `project.canManage` | opens `ProjectDeleteConfirmation`, the dialog `ProjectViewPage` uses |

`project` is the snapshot's `ProjectDetailsDto` (`usePinnedProjectChats`). So:

- the owner (`canEdit` and `canManage`) gets every item;
- a recipient with edit access (`canEdit: true`, `canManage: false`) gets Unpin and Edit;
- a view-only recipient and an organization project (`canEdit: false`) get Unpin only.

**Overlays.** The overlays SHALL be rendered by a new app component `PinnedProjectActionOverlays` (`apps/chat/src/components/PinnedProjectActionOverlays/PinnedProjectActionOverlays.tsx`). It is mounted with `ConversationPanelView`'s other overlays, portalled out of the sidebar, and it holds at most one open action. Its own guard on the publish panel reads `project.canManage`, the flag the menu item uses.

**Delete.** The confirmed delete SHALL use the app's `useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) for the chosen project. That hook gains an optional `leaveOnDelete` option, default `true`:

- The sidebar passes `true` only while the current route is that project's view, edit or chat page.
- With `false`, the success toast is shown and the pin is dropped, but the route does not change.
- A `ProjectChanged` conflict shows `ProjectsI18nKeys.ErrorsChangedElsewhere` and refreshes that project in the tree.
- The sidebar owns the dialog's open state: it passes `isDeleteOpen` (the Delete action is open) and `onDeleteOpenChange`, through which the shared `useProjectActions` reports a cancel, a success or a conflict, and each of them ends the action.

#### Scenario: Owner menu

- **WHEN** the owner opens the ⋮ of their own pinned project
- **THEN** Unpin, Edit, Publish, Share and Delete are offered, in that order

#### Scenario: Editor menu

- **WHEN** a recipient with edit access opens the ⋮ of a pinned shared project
- **THEN** Unpin and Edit are offered, in that order

#### Scenario: View-only shared project menu

- **WHEN** a view-only recipient opens the ⋮ of a pinned shared project
- **THEN** only Unpin is offered

#### Scenario: Unpin

- **WHEN** the user chooses Unpin
- **THEN** the project and its chats leave the Pinned section

#### Scenario: Delete from another page

- **GIVEN** the user is on a regular chat
- **WHEN** they delete a pinned project from its ⋮ and confirm
- **THEN** the success toast is shown, the project leaves the tree, and the route does not change

#### Scenario: Delete while on that project

- **GIVEN** the user is on the project's view page
- **WHEN** they delete it from the sidebar ⋮ and confirm
- **THEN** the router is at `/projects`

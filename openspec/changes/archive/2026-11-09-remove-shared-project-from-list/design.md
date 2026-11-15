## Context

Every shared entity already has "Remove from My List" (`catalog-unshare` spec; `useCatalogSharing`, `useConversationRowActions`). Projects are missing it. A project is listed for a recipient with `source: shared` (`apps/chat-api/src/projects/projects.mapper.ts`) and `canManage: false`; owners have `canManage: true`. The BFF already accepts `projects/{bucket}/{path}` in `POST /api/v1/share/discard` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`, `catalog-resource-path.validator.ts`) and `apps/chat-api/src/share/utils/share-resource.util.ts` resolves and re-encodes project ids, so the backend is ready. The two project surfaces are the pinned ⋮ menu (`usePinnedProjectsPanel.getActions` → `PinnedProjectActionOverlays`) and the view page (`ProjectViewPage` → `ProjectView` in `libs/projects`). Delete already follows this exact shape (`useProjectActions` + `ProjectDeleteConfirmation`).

## Goals / Non-Goals

**Goals:** one discard flow reused by both surfaces; no backend or generated-client change; the lib stays host-agnostic.

**Non-Goals:** owner-side unshare/revoke, Projects page card actions, hiding organization projects, a new endpoint.

## Decisions

1. **Reuse `POST /api/v1/share/discard`.** Alternatives rejected: a project-specific endpoint, or a local "hidden projects" list; both diverge from the other entities and the latter leaves access in place. Authorization is the BFF's existing check that the resource is shared with the caller (403 otherwise).

2. **One app hook, `useProjectRemoveFromList`, in `apps/chat/src/hooks/projects/`.** It owns the pending state and `confirm()`: calls `discardSharedCatalogItem`, then on success notifies, `replacePinnedProjectId(id, null)`, refreshes, and navigates to `ROUTES.Projects` only when asked (`leaveOnRemove`, like `leaveOnDelete` in `useProjectActions`). Failures use `getApiErrorDetails` for the trace id and `showErrorNotification`, mirroring `handleUnpin` in `usePinnedProjectsPanel`. It stays in the app, not `libs/chat-hooks`: it touches `server-api`, the router, notifications and user config, which are host-owned. Alternative: extend `useProjectActions`; rejected, it is the owner-action adapter over the shared lib hook and discard is a share concern.

3. **One confirmation component, `ProjectRemoveFromListConfirmation`, in `apps/chat/src/components/`**, built on `ConfirmationDialog` from `@epam/ai-dial-chat-shared` (as `useFileUnshareConfirmation` does), non-danger, with consequence bullets. Alternative: `DeleteConfirmationDrawer` like `ProjectDeleteConfirmation`; rejected, this is not a deletion and must not carry danger styling. Both surfaces render it.

4. **Eligibility is a pure predicate** `isProjectSharedWithMe(project)` (`source === shared && !canManage`) in `apps/chat/src/utils/`, used by the pinned menu and the page. It stays in the app because only the app needs it today.

5. **Pinned surface.** Add `PinnedProjectActionKind.RemoveFromMyList`; `getActions` appends the item for a recipient (also when `canEdit`, after Edit); `PinnedProjectActionOverlays` renders the confirmation for that kind, with `leaveOnRemove` true only when `routeProjectId` equals the project. `usePinnedProjectChats` already drops a project whose read fails and calls `onProjectDeleted`, so a stale entry also self-heals.

6. **View surface.** `ProjectViewPage` passes `onRemoveFromMyList` only when eligible and always leaves for the Projects list on success.

7. **The lib change is minimal and generic**: `ProjectView` gets `onRemoveFromMyList` and `removeFromMyListLabel`, rendered where Delete renders, with no request and no sharing knowledge (AGENTS.md "Library isolation"). `libs/projects/README.md` and `project-view-props.ts` are updated in the same change.

States: confirm shows loading while pending; the Pinned section and Projects list are the loaded states after success; errors are toasts (action-level errors use the notification, not an inline message) with the trace id.

## Risks / Trade-offs

- [`source` or `canManage` differ from the assumption for an edge case, e.g. an administrator or a publisher] → one predicate with unit tests; the BFF still enforces "shared with caller" and answers 403.
- [The project is open in another tab] → `useProjectWatch` delete/403 handling already clears stale views; a failed 403 triggers a re-read.
- [Copy duplicated from the catalog's unshare text] → catalog keys are catalog-scoped (`Details…`), so project copy gets its own `projects.removeFromList.*` keys; only the action label is shared.

## Migration Plan

Additive; no data migration. Rollback: drop the two callbacks and the menu item.

## Open Questions

- Should the Projects page cards also offer the action? Out of scope here; raise with product.

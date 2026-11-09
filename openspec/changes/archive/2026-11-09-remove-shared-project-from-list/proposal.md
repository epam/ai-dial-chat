## Why

A project shared with a user stays in their Projects list and Pinned section forever: there is no way to drop it. Every other shared entity (toolset, agent, skill, prompt, conversation) already offers "Remove from My List", which discards only the recipient's own access through `POST /api/v1/share/discard`. Projects are the one gap.

## What Changes

- Add a **"Remove from My List"** action for a project whose `source` is `shared` (shared with the current user, not owned by them), in the two places a project has an action menu:
  - the ⋮ context menu of a project in the sidebar's **Pinned** section (`usePinnedProjectsPanel`);
  - the action menu of the project **view page** (preview), via a new optional `ProjectView` callback.
- The action asks for confirmation, then calls the existing `discardSharedCatalogItem(project.id)`. The owner's project and other recipients' access are untouched.
- On success: show a success notification, drop the project's pin (so the sidebar entry disappears), and, when the user is on that project's view page, leave for the Projects list. On failure: show an error notification with the trace id; nothing else changes.
- The action never appears for projects the user owns (`canManage`), nor for the public `organization` source.
- No backend change: `DiscardSharedCatalogItemDto` already accepts `projects/{bucket}/{path}` and `share-resource.util.ts` already resolves the project kind.

## Capabilities

### New Capabilities
- `project-remove-from-list`: recipient-side removal of a shared project: eligibility, the two entry points, the confirmation, the discard call and its after-effects (notification, unpin, navigation), strings, RTL and accessibility.

### Modified Capabilities
<!-- None: ProjectView's and the pinned menu's existing requirements are not changed; the new capability's delta adds the action beside them. -->

## Impact

- `libs/projects`: `ProjectView` gains optional `onRemoveFromMyList` and `ProjectViewLabels.removeFromMyListLabel` (host-agnostic; no request in the lib). README and `project-view-props.ts` updated.
- `apps/chat`: `usePinnedProjectsPanel` (menu item), `PinnedProjectActionKind` (new `RemoveFromMyList`), `PinnedProjectActionOverlays` and `ProjectViewPage` (confirmation + discard), a shared app hook for the discard flow, `useProjectViewLabels`, `translation-keys.ts` and `en.json`. Reuses `server-api/share.api.ts:discardSharedCatalogItem` and the existing `ButtonsI18nKeys.RemoveFromMyList`.
- `libs/chat-hooks`: only if the discard flow's decision ("is this project removable by me") is extracted there; otherwise none.
- i18n: reuses `ButtonsI18nKeys.RemoveFromMyList`; adds feature-scoped confirmation, success and error strings.
- Docs/specs: lib README, `docs/architecture.md` untouched (no new lib, route or context).

## Alternatives considered

- **Reuse the catalog's confirmation (`DetailsPanel` sub-view)**: rejected; projects are not catalog items and the catalog panel lives in `libs/catalog`.
- **Hide via a local "hidden projects" list in user config**: rejected; it leaves the access in place and diverges from every other entity.
- **Chosen**: call the existing discard endpoint, as every other entity does.

## Non-goals

- Removing a project from "organization" (public) listings.
- Any change to the owner-side Unshare/Revoke flow.
- Bulk removal from the Projects page cards (not requested).

## Acceptance criteria

- A recipient sees "Remove from My List" in the pinned menu and the view page menu of a shared project, and never for an owned or organization project.
- Confirming removes the project from the user's list and pins; the owner and other recipients keep their access.
- A failed discard keeps the project and shows an error toast.

## Assumptions

- `source === shared` identifies "shared with me" (the mapper sets it for projects from a share, `projects.mapper.ts:86`); `canManage` is `true` only for the owner, so the action is offered when `source` is shared and `canManage` is `false`.
- Confirmation is required (as for the catalog); the project's own delete drawer pattern is the visual model.

## Rollback / compatibility

Additive and non-breaking: new optional props and a new menu item. Revert by removing the callbacks; no data migration.

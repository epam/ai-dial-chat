## Why

A project can be shared only for viewing. A team cannot keep one project together: a recipient cannot update the instructions or context files, and cannot chat in the project. The share popover offers no "Can edit" choice for a project, because the project page passes `canEditAccess={false}` (`apps/chat/src/components/ProjectShareOverlay/ProjectShareOverlay.tsx`, `ProjectShareOverlay`). This change lets the owner share a project with edit access.

## Problem

View-only sharing was a deliberate choice of `add-project-view-page` (`openspec/changes/archive/2026-10-28-add-project-view-page/design.md`, "Share app"). Everything that depends on it assumes that a shared project is read-only:

- **The popover.** `ProjectShareOverlay` renders `SharePopoverContainer` with `canEditAccess={false}`.
- **The read-only rule.** `ProjectsService.getProject` returns `canEdit: source === ProjectSource.Personal` (`apps/chat-api/src/projects/projects.service.ts`). DIAL Core puts no `permissions` on a project's item metadata. This still holds on `ai-dial-core` `origin/development` (`6dae044a`): `ComplexResourceMetadataController` checks write access internally but does not return it.
- **Owner-only writes, refused before any Core call:**
  - `ProjectsUpdateService.updateProject` (`apps/chat-api/src/projects/update/projects-update.service.ts`): `project.bucket !== sessionBucket` is `403`;
  - `ProjectConversationsService.assertOwner` (`apps/chat-api/src/projects/conversations/project-conversations.service.ts`), called by create, save, rename and delete, and by `ProjectConversationsController.resolveWritableLocator` for completions, stop and attach;
  - `ProjectsService.deleteProject`.
- **One flag for every action in the UI.** Edit, Publish, Share and Delete all key off `canEdit`:
  - on the view page (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`);
  - in the sidebar row menu (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`).
  
  The chat input, chat rename and chat delete key off the same flag (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`).
- **An editable name.** The edit form always lets the user change the name (`libs/projects/src/components/ProjectCreateForm/ProjectCreateForm.tsx`), and a changed name is a Core move. Core's `/v1/ops/resource/move` requires `ALL` (`READ` + `WRITE` + `SHARE`) on the source (`ResourceOperationController.move`). A share link grants `READ` + `WRITE` (`ACCESS_PERMISSIONS` in `apps/chat-api/src/share/invitation/share-invitation.service.ts`), so an editor's rename would save the content and then fail the move.

So simply turning on `canEditAccess` would make things worse. The recipient would get `WRITE` in Core, but the UI would stay read-only and the BFF would refuse every write with `403`.

What DIAL Core already supports. Verified on `ai-dial-core` `origin/development`:

- **Writes by a share recipient.** Every write route for a complex resource needs only `WRITE` (`ControllerSelector`; `AccessControlBaseController` checks `isWriteAccess`). That covers a whole-project `PUT`, a per-file `PUT` / `DELETE`, and the whole-project `DELETE`.
- **The recipient's permissions.** `getSharedResources({ with: 'me' })` returns `permissions` on every entry (`ShareService.listSharedWithMe`). The skills listing already turns that into `canEdit` (`apps/chat-api/src/skills/listing/skills-listing.service.ts`: `canEdit: item.permissions?.includes('WRITE') ?? false`).
- **Re-sharing.** A recipient can never pass on `WRITE`: `ShareService` refuses that ("Re-shared resource … is not allowed to be shared with the permission WRITE"). Without `SHARE`, they cannot share the project at all.

## Solution

- **The BFF decides access from the share permissions.** A new `ProjectAccessService` (`apps/chat-api/src/projects/access/project-access.service.ts`) answers `{ canEdit, canManage }` for the caller:
  - **personal:** both `true`, with no Core call;
  - **organization:** both `false`, with no Core call;
  - **shared:** `canEdit` is whether the caller holds `WRITE` on the project, or on a grouping folder above it, according to `getSharedResources`; `canManage` is `false`.
- **`ProjectDetailsDto`:**
  - `canEdit` widens to "may change the content and write the chats";
  - a new required `canManage` means "may rename, delete, share and publish". It is `true` only for the owner.
- **Writes check access through the same service:**
  - the content save, and every project conversation write (create, save, rename, delete, completions, stop, attach), need `canEdit`;
  - a save that changes the name needs `canManage`;
  - project delete stays owner-only.
- **What an editor gets.** The same view page, chat and edit form as the owner, except:
  - the name field is read-only, with a visible hint;
  - Publish, Share and Delete are hidden.
- **The popover** shows the View / Edit choice for a project, with project-worded notes.

## What Changes

- **BFF `projects`:**
  - `ProjectAccessService` and a pure `resolveSharedProjectPermissions` (`apps/chat-api/src/projects/utils/project-access.util.ts`);
  - `getProject` fills `canEdit` and `canManage` from it;
  - `ProjectsUpdateService` replaces its bucket check with "a rename needs `canManage`, any save needs `canEdit`";
  - `ProjectConversationsService.assertOwner` becomes the async `assertCanWrite`, which the controller's `resolveWritableLocator` also awaits;
  - `ProjectDetailsDto` gains `canManage`, and its `canEdit` description changes.
- **Generated client:** `npm run openapi` adds `ProjectDetailsDto.canManage`. No operation changes.
- **App:**
  - `ProjectShareOverlay` passes `canEditAccess`, plus the project's own `visibilityNote` and `visibilityNoteEdit`;
  - `SharePopoverContainer` gains optional `visibilityNote` and `visibilityNoteEdit` overrides;
  - `ProjectViewPage`, `usePinnedProjectsPanel` and `PinnedProjectActionOverlays` gate Publish, Share and Delete on `canManage`, and Edit on `canEdit`;
  - `ProjectEditPage` passes `isNameReadOnly={!project.canManage}`.
- **`libs/projects`:** `ProjectCreateForm` gains `isNameReadOnly?: boolean` and `labels.nameReadOnlyHint?: string`.
- **Comments and docs that state today's owner-only rule:**
  - `libs/chat-hooks/src/project/project-conversation-data-source.ts`;
  - `apps/chat/src/models/project-chat.ts`;
  - `libs/share/src/models/share-popover-props.ts`;
  - `docs/architecture.md`;
  - `apps/chat-api/README.md`;
  - `libs/projects/README.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-detail-api`:
  - `GET` answers `canEdit` from the share permissions and adds `canManage`;
  - `PUT` lets an editor save content but not rename;
  - a new requirement covers `ProjectAccessService`.
- `project-conversations-api`: conversation writes and completions are allowed for every caller with `canEdit`, not only the owner.
- `project-view-ui`:
  - the share popover offers edit access;
  - Publish, Share and Delete follow `canManage`, and Edit follows `canEdit`.
- `project-edit-ui`: an editor's form keeps the name read-only.
- `project-create-ui`: `ProjectCreateForm` gains `isNameReadOnly` and `labels.nameReadOnlyHint`.
- `project-conversations-ui`: the read-only scenarios name a view-only recipient, and an editor gets the chat input, chat rename and chat delete.
- `sidebar-pinned-project-chats`: the row menu splits Edit (`canEdit`) from Publish, Share and Delete (`canManage`).

## Non-goals

- **Editing the description.** The form has no description field for anyone (`ProjectCreateFormValues` is `{ name, instructions }`), and a save keeps the stored one. This change adds none.
- **Per-chat ownership.** An editor may continue, rename and delete any chat of the project, the owner's included, exactly as the owner may. Core grants `WRITE` to the whole project and records no per-chat rule.
- **Attachments across readers.** A chat attachment is a file in the sender's own bucket, uploaded by the regular flow. This change grants no access to it, so a reader may be unable to open an attachment from someone else's chat. View-only recipients opening the owner's chats already hit this today. Follow-up below.
- **Listing permissions.** The Projects listing (`ProjectDto`) gains no `canEdit`. No card action depends on it.
- **Changing Core.**

## Acceptance criteria

- **The popover.** The owner's Share popover for a project shows the View / Edit access dropdown. Edit creates a link with `permissions: ['READ', 'WRITE']`.
- **An editor (a recipient who accepted an Edit link):**
  - `GET /api/v1/projects/:id` answers `canEdit: true`, `canManage: false`;
  - sees Edit, the chat input, and Rename and Delete on chat rows;
  - does not see Publish, Share or Delete, on the view page or in the sidebar menu;
  - can save instructions and context files; the name field is read-only with the hint;
  - can start, continue, rename and delete project chats.
- **A view-only recipient** gets `canEdit: false`, `canManage: false`, and today's read-only UI, unchanged.
- **BFF refusals:**
  - a `PUT` by an editor that changes the name is `403` before any Core call;
  - a `DELETE` by an editor is `403` before any Core call;
  - any write by a view-only recipient is `403`, and neither a Core write nor a model call is made.
- **A failed permission lookup:**
  - on `GET`, the response is still `200`, with `canEdit: false`;
  - on a write, the response is the upstream error (`502` / `503`), never `403`.
- **The owner's behaviour and requests are unchanged**, and the owner's paths make no new Core call.
- **Checks:**
  - BFF and frontend tests named in `tasks.md`;
  - `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.

## Alternatives considered

- **Status quo (view-only links).** No risk, but it is what the user reported as a bug. Rejected.
- **Flip `canEditAccess` only.** Rejected: the recipient gets `WRITE` in Core while the UI and the BFF stay read-only, so the popover promises an edit that does not work.
- **Drop the BFF pre-checks and let Core authorize.** It needs no lookup, but it is rejected because:
  - a completion would call the model before the save is refused;
  - Core lets any `WRITE` holder delete the whole project, so the BFF could no longer keep Delete owner-only;
  - the UI still needs `canEdit` from somewhere.
- **Expose Core's `permissions`, or derive ownership in the app from `source`.** Rejected: the app would re-implement authorization in four places, and `WRITE` does not map one-to-one to the chat's rules. Delete, rename, share and publish stay owner-only even though Core allows some of them with `WRITE`. Two booleans keep the rule in the BFF.
- **Cache the permission lookup.** Rejected for now:
  - there is no cache today;
  - a recipient's writes come at human pace (one lookup per save, chat write or completion);
  - a cache would delay a revoke.
- **Read permissions from Core's project metadata.** Not available (see Problem). If Core adds it, `ProjectAccessService` is the only place to change. Follow-up below.

## Library isolation

`libs/projects` gains a boolean and a label. The host decides the value from `ProjectDetailsDto.canManage` and passes the translated hint. The lib learns nothing about ownership, buckets, Core permissions or the share API. `libs/chat-hooks` and `libs/share` change only JSDoc.

## i18n

New keys:

- `projects.edit.nameReadOnlyHint`: "Only the project owner can rename it."
- `share.visibilityNoteProject`: "This project, its chats and its updates will be visible to users with the link."
- `share.visibilityNoteEditProject`: "Anyone with the link will be able to view and edit this project and chat in it."

They reach the app through new members of `ProjectsI18nKeys` and `ShareI18nKeys`. Generic labels are reused.

## Rollback and compatibility

- **Additive API.**
  - `canManage` is a new response field; old clients ignore it.
  - `canEdit` keeps its name and type.
  - For an owner and for a view-only recipient, every value is unchanged.
- **No migration.** Nothing new is stored. Read state and pins are per user and unchanged.
- **Rollback is safe.** Links already created with Edit keep `WRITE` in Core, and accepted editors keep it. After a revert, the BFF refuses those editors' writes again (owner-only), and the UI shows them the project read-only. Nothing is corrupted. The owner can revoke access through the existing revoke flow.

## Out-of-scope findings (follow-ups)

- **Concurrent writers in one chat.** The generation registry rejects a second generation only for the same principal and path, and project chat saves use `If-Match: *`. So when the owner and an editor (or two editors) generate in the same chat at the same time on a stateless model, the later save overwrites the other exchange. Serialize writers per project chat (a path-scoped registry conflict for project locators, a conditional start-state save), tracked in [#9731](https://github.com/epam/ai-dial-chat/issues/9731).

- **Attachments across readers.** Let readers of a project open attachments from others' chats: upload into the project, or share the attachment with the project's recipients.
- **Core.** Ask DIAL Core to return `permissions` on a project's item metadata. That would replace the share-list lookup.
- **Duplicate button.** `ConversationView` renders a Duplicate button for every read-only conversation, including a project chat, whose data source sets `canDuplicate: false`. So the button does nothing for a view-only recipient (`apps/chat/src/components/ConversationView/ConversationView.tsx`).
- **README duplication.** `apps/chat-api/README.md` contains its whole body four times (each `##` section appears four times). This change edits the project paragraph in every copy, and leaves the de-duplication to a separate fix.

## Context

`add-project-view-page` (`openspec/changes/archive/2026-10-28-add-project-view-page/design.md`) made project links view-only and tied every project write to bucket ownership. Today:

- **BFF.**
  - `ProjectsService.getProject` returns `canEdit: source === ProjectSource.Personal` (`apps/chat-api/src/projects/projects.service.ts`).
  - Three paths refuse with `403` before any Core call when the project bucket is not the session bucket:
    - `ProjectsUpdateService.updateProject`;
    - `ProjectsService.deleteProject`;
    - `ProjectConversationsService.assertOwner`, which covers create, save, rename and delete, plus completions, stop and attach through `ProjectConversationsController.resolveWritableLocator`.
- **App.** Every gate reads `ProjectDetailsDto.canEdit`, and nothing reads ownership separately:
  - `ProjectViewPage` passes `onPublish`, `onEdit`, `onShare` and `onDelete` only when `canEdit`, and mounts `PublishProjectPanelContainer` only when `canEdit`;
  - `ProjectConversationsSection` shows the composer and the row Rename / Delete when `canEdit`;
  - `createProjectConversationDataSource` sets `isReadOnly = () => !canEdit` (`libs/chat-hooks/src/project/project-conversation-data-source.ts`);
  - `usePinnedProjectsPanel` returns Unpin only unless `canEdit`, and `PinnedProjectActionOverlays` checks `canEdit` again before mounting the publish panel;
  - `ProjectEditPage` redirects to the view page unless `canEdit`;
  - `ProjectShareOverlay` passes `canEditAccess={false}`.
- **The edit form.** `ProjectCreateForm` (`libs/projects`) has no way to lock the name. Its values are `{ name, instructions }`, so the description is not editable by anyone.

DIAL Core facts. Verified on `ai-dial-core` `origin/development` `6dae044a`:

- `AccessControlBaseController` admits a write when the caller's permissions contain `WRITE`. Every complex-resource write route — a whole-project `PUT`, a per-file `PUT` / `DELETE`, and the whole-project `DELETE` — is built with `isWriteAccess = true` (`ControllerSelector`). A `WRITE` holder can therefore also delete the whole project in Core.
- `ResourceOperationController.move` requires `ALL` (`READ`, `WRITE`, `SHARE`) on the source.
- `ShareService.listSharedWithMe` sets `permissions` on every listed entry, and `lookupPermissions` unions a resource's own permissions with its parents'.
- `ShareService` refuses to re-share a resource with `WRITE`. Without `SHARE`, a recipient cannot share at all.
- `ComplexResourceMetadataController` computes `hasWriteAccess` but does not return it. Project item metadata still carries no `permissions`.
- `PublicationService` requires only `READ` (or admin) on the source of a publication request.

The closest model in the chat is the skills listing (`apps/chat-api/src/skills/listing/skills-listing.service.ts`). It maps shared skills to `canEdit: item.permissions?.includes('WRITE') ?? false`.

## Goals / Non-Goals

**Goals:**

- The owner can share a project with View or Edit access from the existing popover.
- A recipient with `WRITE` can save the instructions and context files, and can start, continue, rename and delete any of the project's chats.
- Rename, delete, share and publish stay owner-only, in the UI and in the BFF.
- One BFF component decides access, and the app reads two booleans instead of re-deriving rules.
- The owner's requests are unchanged and cost no extra Core call.

**Non-Goals:**

- a description field;
- per-chat ownership;
- access to other readers' chat attachments;
- listing-level permissions (`ProjectDto`);
- any Core change;
- caching.

See the proposal.

## Decisions

### D1. Two booleans: `canEdit` (content and chats) and `canManage` (owner actions)

`ProjectDetailsDto.canEdit` keeps its name and type, and widens to "may change the instructions and context files and write the chats". A new required `canManage` means "may rename, delete, share and publish". `canManage` implies `canEdit`.

| Caller | `source` | `canEdit` | `canManage` |
| --- | --- | --- | --- |
| Owner | `personal` | `true` | `true` |
| Recipient with `WRITE` | `shared` | `true` | `false` |
| View-only recipient | `shared` | `false` | `false` |
| Organization reader | `organization` | `false` | `false` |

Every existing `canEdit` gate that means "may write content or chats" stays as it is: the edit route guard, the composer, chat rename / delete, and the data source's `isReadOnly`. Only the four owner actions move to `canManage`.

**Alternatives:**

- **Derive ownership from `source` in the app.** Rejected: the rule would be re-implemented in `ProjectViewPage`, `usePinnedProjectsPanel`, `PinnedProjectActionOverlays` and `ProjectEditPage`, and the BFF would no longer be the single owner of authorization.
- **Return Core's `permissions`.** Rejected: the chat's rules are not Core's. Delete and rename stay owner-only even though Core would let `WRITE` delete.
- **Rename `canEdit`.** Rejected: it would churn the generated client and every fixture for no change in behaviour.

### D2. `ProjectAccessService` resolves access from the share list

`apps/chat-api/src/projects/access/project-access.service.ts`, provided by `ProjectsModule`:

```ts
export interface ProjectAccess {
  canEdit: boolean;
  canManage: boolean;
}

resolveAccess(project: ParsedProjectId, sessionBucket: string, accessToken: string, signal?: AbortSignal): Promise<ProjectAccess>;
assertCanWrite(project: ParsedProjectId, sessionBucket: string, accessToken: string, signal?: AbortSignal): Promise<void>;
assertCanManage(project: ParsedProjectId, sessionBucket: string): void;
```

- **By source.** `personal` and `organization` (via `resolveProjectSource`) resolve with no Core call.
- **Shared.** `shared` calls `dialClient.client.getSharedResources({ headers: getBearerAuthHeaders(token), body: { resourceTypes: ['PROJECT'], with: 'me' }, signal })`, the call `listSharedProjects` already makes.
- **Matching.** The pure `resolveSharedProjectPermissions(resources, projectId)` (`apps/chat-api/src/projects/utils/project-access.util.ts`) mirrors Core's `lookupPermissions`:
  - each entry's url is normalized as `mapSharedProject` does (`safeDecodeURIComponent`, then `StringUtils.stripTrailingSlashes`);
  - an entry is kept when its url equals the project id, or when the id starts with the url followed by `/`;
  - the result is the union of the kept entries' permissions.
  
  The trailing `/` makes `projects/b/research-old` never match `projects/b/research`.
- **Failures.** A failure goes through `handleDialSdkError(…, 'projects.resolveAccess', …)`.
  - On a write it propagates: a `502` / `503` is not a `403`, so the client does not tell a user they lost access because Core blinked.
  - `getProject` catches it, logs `warn`, and answers `canEdit: false`, `canManage: false`, so the page still opens, read-only. It degrades the same way `listSharedProjects` degrades the listing.

**Why a pre-check at all, when Core authorizes every call with the caller's token:**

- **Completions.** A completion calls the model before it saves. Without the pre-check, a view-only recipient would spend a model call that is refused afterwards.
- **Delete.** Core lets any `WRITE` holder delete the project, so only a BFF check can keep Delete owner-only.
- **The UI.** It needs `canEdit` before any write anyway.

**Alternatives:**

- **Cache the lookup per `(sessionBucket, projectId)`.** It would save a call per recipient write, but a revoke would then take up to the TTL to apply, and there is no cache to extend today. A recipient writes at human pace: one save, one chat write or one completion at a time. Rejected for now, and recorded as the first lever if `getSharedResources` latency shows up.
- **Probe with a no-op Core write.** Rejected: there is no side-effect-free write.
- **Read `permissions` from project metadata.** Not available in Core. If Core adds it, only `resolveAccess` changes.

### D3. Where each check sits

| Path | Check | Order |
| --- | --- | --- |
| `GET /projects/:id` | `resolveAccess` | concurrent with the metadata and snapshot reads, under the same combined signal but outside the sibling-failure controller (D2) |
| `PUT /projects/:id` | `assertCanManage` when the trimmed name differs from the path's last segment; then `requireSingleIfMatch`; then `assertCanWrite` | all before the snapshot read; the first two need no Core call |
| `DELETE /projects/:id` | unchanged owner check | before any Core call |
| conversation create / save / rename / delete | `await assertCanWrite` | first statement of each `ProjectConversationsService` method |
| completions / stop / attach | `await assertCanWrite` in `resolveWritableLocator`, which becomes `async` and is awaited by each handler before the stream opens | before `resolveCompletionLocator` |
| mark viewed, list, get, titles, downloads, artifacts | none (any reader) | unchanged |

`ProjectConversationsService.assertOwner` is removed. Its callers use `assertCanWrite`, so no owner-only conversation path is left behind by accident. `ProjectsUpdateService` keeps no bucket comparison of its own.

### D4. The edit form locks the name with `readOnly`, not `disabled`

`ProjectCreateForm` gains `isNameReadOnly?: boolean` and `labels.nameReadOnlyHint?: string` (English default). This follows `DeploymentCreationForm`'s `isNameReadOnly` (`libs/builder-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx`), with two differences, both for WCAG AAA:

- The input gets `readOnly` rather than `disabled`, so keyboard and screen-reader users can still reach the value and hear that it is read-only.
- The reason is visible helper text linked through `aria-describedby`, rather than a hover tooltip.

`ProjectEditPage` passes `isNameReadOnly={!project.canManage}`, so the trimmed name it sends always equals the stored one. The BFF check in D3 is defense in depth.

### D5. Share popover: project-worded notes, catalog unchanged

`ProjectShareOverlay` sets `canEditAccess`. Today `SharePopoverContainer` hard-codes the deployment-worded `share.visibilityNote` / `share.visibilityNoteEdit`. It gains optional `visibilityNote` / `visibilityNoteEdit` overrides, and the overlay passes:

- `share.visibilityNoteProject`;
- `share.visibilityNoteEditProject`, which warns that link holders can chat in the project. Their chats are visible to everyone with access.

`CatalogView` passes nothing, so the catalog popover renders exactly as before. `libs/share` is unchanged apart from the `canEditAccess` JSDoc, which today lists only catalog types.

### D6. Equal chat rights for editors

An editor may rename and delete any chat of the project, the owner's included. A chat that one editor started may be continued by another.

- **Why.** This matches Core (one `WRITE` on the whole complex resource), keeps the UI rule to `canEdit`, and was the user's call ("chats are visible to everyone with access to the project").
- **Alternative.** Author-only rename and delete would need the BFF to compare Core's file `author` on every write, and Core itself would not enforce it. Rejected.

## Authorization summary (per endpoint)

| Endpoint | Owner | Editor (`WRITE`) | View-only recipient | Organization reader |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/:id` | ✓ | ✓ | ✓ | ✓ |
| `PUT /api/v1/projects/:id`, same name | ✓ | ✓ | `403` | `403` |
| `PUT /api/v1/projects/:id`, new name | ✓ | `403` | `403` | `403` |
| `DELETE /api/v1/projects/:id` | ✓ | `403` | `403` | `403` |
| `POST/PUT/PATCH/DELETE …/conversations…`, completions, stop, attach | ✓ | ✓ | `403` | `403` |
| `PATCH …/conversations/:name/viewed`, list, get, titles | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/share` for the project | ✓ | UI hidden; Core refuses without `SHARE` | UI hidden; Core refuses | UI hidden |
| `POST /api/v1/catalog/project/:entityId/publish` | ✓ | UI hidden; Core requires only `READ`, and admin review still applies | UI hidden | UI hidden |

Every route also keeps the global `SessionGuard` + `CsrfGuard` and the `projectsEnabled` `FeatureGuard`.

## States

- **View page.** No new state. An editor sees the owner's page minus Publish, Share and Delete.
  - A failed permission lookup on `GET` renders the project read-only, not an error.
  - A refresh after the owner revokes access is a `403` from Core on the read, handled as today.
- **Edit page.** Loading, error and not-found are unchanged.
  - The name renders read-only with the hint for an editor.
  - A `403` on save (access revoked while editing) shows `projects.edit.toast.error` and keeps the draft, as every other `403` already does.
- **Chat.** An editor's chat is the owner's chat: same loading, streaming, error and storage-full states.

## Observability

No new metric. `MetricsInterceptor` already covers the routes. `ProjectAccessService` logs a lookup failure at `warn` with the source kind and the status or the error's `name` only. A refused write logs nothing beyond the existing exception handling. Ids, buckets, tokens and permission lists are never logged.

## Risks / Trade-offs

- **One extra Core call per recipient write.** For each save, chat write or completion by a recipient, the BFF makes one `getSharedResources` call. → The owner's paths make none. The call is the one the listing already makes; caching is the first lever if it shows up in latency.
- **An editor can overwrite the owner's instructions.** → The existing `If-Match: contentVersion` gives a `409 project-changed` to whichever save is stale. Both sides keep their drafts and reload.
- **Two writers in one chat at once lose an exchange.** D6 lets several callers continue the same chat, but the generation registry conflicts only per principal and path, and a project chat is saved with `If-Match: *`. Two concurrent stateless generations both start, and the later terminal save overwrites the other one. → Accepted for this change and tracked in [#9731](https://github.com/epam/ai-dial-chat/issues/9731).
- **Attachments from someone else's chat may not open** (403 from the sender's bucket). → Already true for view-only recipients. Tracked as a follow-up in the proposal.
- **Core allows more than the chat does.** A `WRITE` holder could delete the project, and publication needs only `READ`. → The browser never holds a Core token. Every request goes through the BFF, which keeps delete owner-only and hides publish from non-owners.
- **A changed link access does not change accepted recipients.** → `useShareLink` requests a new link, so existing links and accepted recipients keep their permissions. The revoke flow (`share-revoke-access`) removes everyone. This is how catalog entities already behave.

## Migration Plan

- Ship BFF and app together in one PR. The DTO change is additive (`canManage`), and `canEdit` values do not change for owners or view-only recipients.
- No data migration.
- **Rollback.** Reverting restores the owner-only checks.
  - Editors who accepted Edit links keep `WRITE` in Core, but the BFF refuses their writes again, and the UI shows them the project read-only.
  - The owner can revoke the links through the existing flow.

## Open Questions

None blocking. The open follow-ups are in the proposal:

- Core metadata permissions;
- cross-reader attachments;
- the dead Duplicate button;
- the `apps/chat-api/README.md` duplication.

Two small items are left to archive time:

- The Purpose paragraph of `openspec/specs/project-conversations-api/spec.md` says "owner-writable endpoints". Delta specs cannot change a Purpose, so it is edited when this change is archived (task 5.5).
- The `useProject` requirement in `project-view-ui` says a refresh that drops `canEdit` "hides Edit, Delete, Share and Publish". That stays true: an editor never sees the last three. It is therefore not modified.

**Slicing strategy: risk-first, then vertical.**

- **Slice 1** proves the risky part end to end: reading a recipient's `WRITE` from DIAL Core's share list into `GET /api/v1/projects/:id`, regenerated into the client.
- **Slice 2** opens the BFF writes to editors and keeps rename owner-only.
- **Slices 3 and 4** make the app use the two flags. Slice 3 covers the share popover and the action gates; slice 4 covers the name lock in the form.
- **Slice 5** updates comments and docs.

Each slice is verifiable on its own. Backend tests live in `apps/chat-api/src/projects/tests/`, and frontend tests in a `tests/` folder next to the source. Relative TypeScript imports stay extensionless. `apps/chat-api/AGENTS.md` and `.claude/rules/libs.md` were read for the wording of these tasks.

## 1. BFF: resolve project access and return `canEdit` / `canManage`

- [x] 1.1 Add the pure `resolveSharedProjectPermissions(resources, projectId): ReadonlySet<string>` to `apps/chat-api/src/projects/utils/project-access.util.ts`:
  - normalize each url with `safeDecodeURIComponent` + `StringUtils.stripTrailingSlashes`, as `mapSharedProject` does;
  - keep an entry whose url equals the id, or is a folder above it (the id starts with the url followed by `/`);
  - return the union of the kept entries' `permissions`; a missing `permissions` counts as empty.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-access.util.spec.ts`. Cover:
    - exact match;
    - an encoded url (`Q4%20launch`);
    - a trailing `/`;
    - a grouping-folder share;
    - a sibling with a common prefix (`research-old`), which must not match;
    - two entries unioned;
    - a non-project url;
    - an empty list.
- [x] 1.2 Create `ProjectAccessService` in `apps/chat-api/src/projects/access/project-access.service.ts`, with `resolveAccess`, `assertCanWrite` and `assertCanManage`.
  - The `ProjectAccess` interface and `resolveProjectSource` move into `apps/chat-api/src/projects/utils/project-access.util.ts`. Before this change `resolveProjectSource` lived in `projects.service.ts`, and leaving it there would make `projects.service.ts` and the new service import each other.
  - The shared case calls `dialClient.client.getSharedResources({ resourceTypes: ['PROJECT'], with: 'me' })` with the caller's token and the signal.
  - Errors go through `handleDialSdkError` with context `projects.resolveAccess`.
  - Logs carry no ids, buckets or tokens.
  - Register the service in `apps/chat-api/src/projects/projects.module.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-access.service.spec.ts`. The service is constructed directly with a fake `DialClientService`, as the other project service specs do. Cover:
    - personal and organization: no Core call;
    - shared with `WRITE`, shared with `READ` only;
    - `assertCanWrite` throwing `ForbiddenException` for view-only and organization;
    - a Core `503` mapped to `502`, and an unreachable Core to `503`, never `403`;
    - `assertCanManage` for owner and non-owner.
- [x] 1.3 In `apps/chat-api/src/projects/projects.service.ts` (`getProject`), replace `canEdit: source === ProjectSource.Personal`:
  - call `resolveAccess` concurrently with the metadata and snapshot reads, under the combined `readSignal` but not through `abortSiblingOnFailure`;
  - on a rejection, log `warn` and use `{ canEdit: false, canManage: false }`;
  - inject `ProjectAccessService`;
  - update the JSDoc that says "project share links are view-only".
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-get.service.spec.ts`. Cover:
    - personal: `true`/`true`, and `getSharedResources` is not called;
    - shared with `WRITE`: `true`/`false`;
    - shared with `READ`: `false`/`false`;
    - organization: `false`/`false`;
    - a failed lookup: `200` with `false`/`false`, and the snapshot is not aborted.
- [x] 1.4 Add the required `canManage!: boolean` to `ProjectDetailsDto` (`apps/chat-api/src/projects/dto/project-details.dto.ts`), with `@ApiProperty` (example, description) and `@IsBoolean()`. Reword the `canEdit` description to "content and chats; `true` for the owner and for a recipient with `WRITE`".
- [x] 1.5 Update the supertest test for `GET /api/v1/projects/:id` so the response carries `canManage`, and add a shared-with-`WRITE` case.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 1.6 Run `npm run openapi` and `npm run openapi:check`, then `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Confirm that `ProjectDetailsDto.canManage` is generated, and do not hand-edit generated files. No operation is added, so `apps/chat/src/server-api/api-client.ts` needs no new singleton.
- [x] 1.7 Add `canManage` to every frontend `ProjectDetailsDto` fixture that the regenerated type now requires. Owner fixtures get `true`; shared and organization fixtures get `false`. Change nothing else in those tests.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`, `npm run test:file -- apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx`, `npm run test:file -- apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx` and `npm run test:file -- apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts`
- [x] 1.8 Slice check: `npm run verify:changed`.

## 2. BFF: editors write content and chats; rename stays owner-only

- [x] 2.1 In `apps/chat-api/src/projects/update/projects-update.service.ts` (`updateProject`), replace the `project.bucket !== sessionBucket` check, in this order:
  1. compute `destination`; when it is non-null, call `assertCanManage` (`403` "Only the owner can rename a project");
  2. `requireSingleIfMatch`;
  3. `await assertCanWrite(…, requestSignal)` before validation and the snapshot read.

  Inject `ProjectAccessService`, and update the class JSDoc ("Only the owner edits").
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-update.service.spec.ts`. Cover:
    - an editor's content save writing to the owner's bucket with no move;
    - an editor's rename: `403` with no Core call;
    - a view-only save: `403`, with `getSharedResources` as the only Core call;
    - an organization save: `403`, no Core call;
    - a lookup failure: mapped `503`;
    - the owner's existing cases unchanged, with no `getSharedResources` call.
- [x] 2.2 In `apps/chat-api/src/projects/conversations/project-conversations.service.ts`, replace `assertOwner` with an injected `ProjectAccessService.assertCanWrite`, awaited first in `createConversation`, `saveConversation`, `renameConversation` and `deleteConversation`. Update the class JSDoc ("Writes are owner-only").
- [x] 2.3 In `apps/chat-api/src/projects/conversations/project-conversations.controller.ts`, make `resolveWritableLocator` `async`: it awaits `assertCanWrite(project, bucket, at)`, then calls `resolveCompletionLocator`. Await it in the completions, stop and attach handlers before any stream opens. Update its comment ("Owner check first"). Update the `403` `@ApiResponse` descriptions on the write routes to "the caller may not write to the project".
  - Verification (2.2 and 2.3): `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.controller.spec.ts` and `npm run test:file -- apps/chat-api/src/projects/tests/project-conversations.integration.spec.ts`. Cover:
    - an editor's create (`201`, `uploadProjectFile` on the owner's bucket);
    - an editor deleting the owner's chat (`204`);
    - a view-only completion (`403`, no model call, no Core write);
    - an editor's completion streaming;
    - an organization write (`403`, no Core call);
    - the existing owner and path-validation cases.
- [x] 2.4 Run `npm run openapi` and `npm run openapi:check` again, because the `403` descriptions changed. Then build and lint `chat-api-client`.
- [x] 2.5 Slice check: `npm run verify:changed`.

## 3. App: share with edit access, split the action gates

- [x] 3.1 Add the keys to `apps/chat/src/i18n/locales/en.json` and every other locale file, with the matching `ShareI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`:
  - `share.visibilityNoteProject` (`VisibilityNoteProject`);
  - `share.visibilityNoteEditProject` (`VisibilityNoteEditProject`).
- [x] 3.2 Give `SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`) optional `visibilityNote?: string` and `visibilityNoteEdit?: string` props, each replacing its default `t(…)` when set.
  - Verification: `npm run test:file -- apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx`. Cover both the defaults (the catalog case, unchanged) and the overrides.
- [x] 3.3 In `ProjectShareOverlay` (`apps/chat/src/components/ProjectShareOverlay/ProjectShareOverlay.tsx`), pass `canEditAccess` and the two project notes, and update the JSDoc ("Project links are view-only…").
  - Verification: `npm run test:file -- apps/chat/src/components/ProjectShareOverlay/tests/ProjectShareOverlay.spec.tsx`. Replace "opens a view-only share popover" with "offers view and edit access with project notes".
- [x] 3.4 In `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`), derive `canManage = project?.canManage ?? false`:
  - gate `onPublish`, `onShare`, `onDelete` and the `PublishProjectPanelContainer` mount on `canManage`;
  - keep `onEdit` and `ProjectConversationsSection`'s `canEdit` on `canEdit`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`. Cover:
    - an editor: Edit, the chat input and row menus present; Publish, Share and Delete absent;
    - the existing view-only and owner cases.
- [x] 3.5 In `usePinnedProjectsPanel` (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`), return Unpin, plus Edit when `canEdit`, plus Publish, Share and Delete when `canManage`. Keep the order. In `PinnedProjectActionOverlays` (`apps/chat/src/components/PinnedProjectActionOverlays/PinnedProjectActionOverlays.tsx`), make the publish guard read `project.canManage`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts` (new "offers an editor Unpin and Edit") and `npm run test:file -- apps/chat/src/components/PinnedProjectActionOverlays/tests/PinnedProjectActionOverlays.spec.tsx` (the publish panel does not mount for `canManage: false`).
- [x] 3.6 Add an editor case to the chat surfaces. Do not change their code; `canEdit` already drives them.
  - Verification: `npm run test:file -- apps/chat/src/components/ProjectConversationsSection/tests/ProjectConversationsSection.spec.tsx` ("a shared editor gets the input and row menus") and `npm run test:file -- apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx` ("opens a shared project conversation writable for an editor"). Update the helper that ties `source` to `canEdit` so the two can vary independently.
- [x] 3.7 RTL check for the slice: the popover notes and menus add no layout or icon. Confirm that no physical-direction class was introduced in the touched files (`.claude/rules/rtl.md`).
- [x] 3.8 Slice check: `npm run verify:changed`.

## 4. Edit form: read-only name for editors

- [x] 4.1 In `libs/projects`:
  - add `isNameReadOnly?: boolean` to `ProjectCreateFormProps` and `nameReadOnlyHint?: string` (JSDoc, English default "Only the project owner can rename it.") to `ProjectCreateFormLabels` (`libs/projects/src/models/project-create-form-props.ts`);
  - in `ProjectCreateForm` (`libs/projects/src/components/ProjectCreateForm/ProjectCreateForm.tsx`), render the Name `Input` with `readOnly` (not `disabled`) when set;
  - when set, render the hint with `helperClassName` and an `id`, and add that id to the input's `aria-describedby` next to the error id;
  - never call `onFieldChange('name', …)` while read-only.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx`. Use role and label queries: read-only value, the hint linked by `aria-describedby`, typing calls nothing, editable by default with no hint.
- [x] 4.2 Architecture guard for `libs/projects`: confirm that the change adds no `/api/`, `@epam/ai-dial-chat-api-client`, server-api, `react-router`, `react-i18next`, feature-flag, env, storage or app-context import, and that `ProjectCreateForm` learns only a boolean and a string.
- [x] 4.3 Add `projects.edit.nameReadOnlyHint` ("Only the project owner can rename it.") to `en.json` and every locale file, with `ProjectsI18nKeys.EditNameReadOnlyHint` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 4.4 In `ProjectEditPage` (`apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`), pass `isNameReadOnly={!project.canManage}`, and add `nameReadOnlyHint: t(ProjectsI18nKeys.EditNameReadOnlyHint)` to the memoised labels. Keep the read-only guard on `canEdit`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx`. Cover:
    - an editor: the form renders, the name is read-only with the hint, and a save sends the stored name and returns to the view route;
    - the owner's name stays editable;
    - the existing "sends the project to its view page when it cannot be edited" case.
- [x] 4.5 RTL check: the hint is text in normal flow with logical spacing only, and has no directional icon (`.claude/rules/rtl.md`).
- [x] 4.6 Slice check: `npm run verify:changed`.

## 5. Comments and docs

- [x] 5.1 Update the JSDoc that states the owner-only rule. Change no code in these files:
  - `libs/chat-hooks/src/project/project-conversation-data-source.ts`: `canEdit` means "may write the project's chats";
  - `libs/chat-hooks/src/project/use-pinned-project-chats.ts`: the snapshot feeds `canEdit` and `canManage`;
  - `apps/chat/src/models/project-chat.ts` (`ProjectChatNavigationState`);
  - `apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`, the `canEdit` prop;
  - `libs/share/src/models/share-popover-props.ts`, the `canEditAccess` doc, to name projects.
- [x] 5.2 Update `libs/projects/README.md` § ProjectCreateForm: `isNameReadOnly`, `labels.nameReadOnlyHint` and their defaults, in the example and the prose. Run `npm run validate:docs`.
- [x] 5.3 Update `apps/chat-api/README.md`. The file holds four copies of its body (follow-up in the proposal), so edit every copy:
  - the `GET /api/v1/projects/:id` table row: `canEdit` and `canManage`;
  - the paragraph "`PUT` and `DELETE` act only on a project in the caller's own bucket …": `PUT` allows a recipient with `WRITE` without a rename, and `DELETE` stays owner-only.
- [x] 5.4 Update `docs/architecture.md`, the `/api/v1/projects` row: "(owner-only writes)" becomes "(writes by the owner and by recipients with `WRITE`; rename and delete owner-only)". Update the `ConversationDataSourceContext` row ("read-only from `canEdit`") only if its wording names ownership. Run `npm run validate:docs`.
- [x] 5.5 At archive time, when syncing the delta specs, also reword the Purpose paragraph of `openspec/specs/project-conversations-api/spec.md`. "the flag-gated owner-writable endpoints" becomes "the flag-gated endpoints writable by the owner and by recipients with `WRITE`". Delta specs cannot change a Purpose.
- [x] 5.6 Run `npm run validate:specs` and `npm run spec:impact`, and resolve every finding the change introduced.

## 6. Close

- [x] 6.1 Run `npm run build:quiet`: the generated client and a shared lib changed.
- [x] 6.2 Run `npm run verify:full` once.

## Follow-ups (not in this change)

- Serialize concurrent writers in one project chat: today the registry conflicts per principal and path and saves use `If-Match: *`, so two callers generating at once lose an exchange ([#9731](https://github.com/epam/ai-dial-chat/issues/9731)).

- Let readers of a project open attachments from others' chats: upload them into the project, or share them with the project's recipients.
- Ask DIAL Core to return `permissions` on a project's item metadata, then drop the share-list lookup in `ProjectAccessService`.
- Remove the dead Duplicate button that `ConversationView` renders for a read-only project chat (`canDuplicate: false`).
- De-duplicate `apps/chat-api/README.md`.

# add-project-unpublish — tasks

Slicing strategy: **vertical**. Slice 1 makes the lib able to render the action; slice 2 lifts the shared dialog with the conversation panel as its first (unchanged) consumer; slice 3 wires the project page end to end; slice 4 is docs and final gates. Each slice is independently verifiable. No `apps/chat-api` or OpenAPI work — the endpoints already accept `project`.

## 1. Lib: `ProjectView` renders Unpublish in Publish's slot

- [x] 1.1 Add `onUnpublish?: () => void` to `ProjectViewProps` and `unpublishLabel?: string` (doc: "Unpublish action label. Defaults to `'Unpublish'`.") to `ProjectViewLabels` in `libs/projects/src/models/project-view-props.ts`.
- [x] 1.2 In `libs/projects/src/components/ProjectView/ProjectView.tsx`: when `onUnpublish` is set, render a desktop `NeutralButton` with `IconWorldOff` and push a non-danger `unpublish` menu item first in `buildMenuItems(true)`; suppress both Publish placements. Logical classes only; do not mirror the icon.
- [x] 1.3 Architecture guard: confirm `libs/projects` gains no `/api` path, generated-client/server-api import, app context, auth/env/feature-flag access, i18n import or entity-type knowledge.
- [x] 1.4 Tests in `libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`: Unpublish replaces Publish (desktop button + mobile menu first item), default label `'Unpublish'`, host label override, no Unpublish without the callback, not a danger item. Query by role and name.
- [x] 1.5 Update `libs/projects/README.md`: `onUnpublish` in the props list and read-only note, `unpublishLabel` in the labels example.

**Verification:** `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`; then `npm run verify:changed`.

## 2. Lib: shared `UnpublishConfirmationDialog`, conversation panel migrated

- [x] 2.1 Create `libs/publish-panel/src/components/UnpublishConfirmationDialog/UnpublishConfirmationDialog.tsx` rendering `ConfirmationDialog` + `RadioGroup` as `ConversationPanelOverlays.tsx` did, with every string from `UnpublishConfirmationDialogLabels` (English defaults), `optionClassName` (default `'dial-small-text'`) and `colors.optionText`; export it and its types from `libs/publish-panel/src/index.ts`, document it in `libs/publish-panel/README.md`. The app fills the labels with `apps/chat/src/hooks/publish/useUnpublishConfirmationLabels.ts`.
- [x] 2.2 Replace the inline dialog in `apps/chat/src/components/ConversationPanel/ConversationPanelOverlays.tsx` with the lib component, passing the existing `ConversationUnpublishI18nKeys.*` strings through `useUnpublishConfirmationLabels`. No behaviour or string change.
- [x] 2.3 Tests in `libs/publish-panel/src/components/UnpublishConfirmationDialog/tests/UnpublishConfirmationDialog.spec.tsx`: one folder → message names it and confirm enabled; several → radio group named, none selected, confirm disabled until a pick; root folder labelled Organization; loading disables both buttons and announces the status; Cancel calls `onClose`.

**Verification:** `npm run test:file -- libs/publish-panel/src/components/UnpublishConfirmationDialog/tests/UnpublishConfirmationDialog.spec.tsx apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`; then `npm run verify:changed`.

## 3. App: project page end to end

- [x] 3.1 i18n: add `projects.unpublish.{confirmTitle,confirmMessage,selectFolderMessage,folderGroupAriaLabel,requestingStatus}` and `entityNotifications.project.{unpublishRequestedTitle,unpublishRequested}` to `apps/chat/src/i18n/locales/en.json`, with `ProjectsI18nKeys.Unpublish*` and `EntityNotificationsI18nKeys.ProjectUnpublishRequested{,Title}` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.2 Add `[EntityOperation.UnpublishRequested]` to the `NotifiableEntity.Project` entry in `apps/chat/src/utils/entity-notification.ts`.
- [x] 3.3 Fill `unpublishLabel: t(ButtonsI18nKeys.Unpublish)` in `apps/chat/src/hooks/projects/useProjectViewLabels.ts`.
- [x] 3.4 Create `apps/chat/src/hooks/projects/useProjectUnpublish.ts` per the spec decision table: history for an own project, admin synthesis / `getCatalogUnpublishAccess` for a public copy, none otherwise; `isPublishStateResolved`; failure settles silently; cancelled-flag effect; `refreshPublishState` keeps current folders while re-fetching; `useAsyncConfirmDialog` + selected folder; confirm calls `unpublishCatalogEntity` (no `version`, `''` root allowed), notifies `UnpublishRequested`, reports failures via `usePublishErrorNotification`, then refreshes. Memoise callbacks and the result.
- [x] 3.5 Add optional `onPublished` to `apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`, called after the success notification.
- [x] 3.6 Wire `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`: pass exactly one of `onPublish`/`onUnpublish` once settled (spec table), render `UnpublishConfirmationDialog` with the `projects.unpublish.*` copy, pass `onPublished={refreshPublishState}`.
- [x] 3.7 Unit tests `apps/chat/src/hooks/projects/tests/useProjectUnpublish.spec.ts`: each row of the visibility table; failed lookup → resolved with no folders and no toast; stale response for a previous id ignored; confirm sends the joined folder (and `''` for root) with `Project` type; success notification payload; failure → `usePublishErrorNotification` with `UnpublishRequested`, no success toast; refresh keeps folders during re-fetch.
- [x] 3.8 Tests: `apps/chat/src/components/PublishProjectPanelContainer/tests/PublishProjectPanelContainer.spec.tsx` (`onPublished` after success, not after failure); `apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx` (no Publish/Unpublish while loading; Unpublish for a published own project; Publish for an unpublished one; neither for a share recipient; Unpublish on a public copy for an admin; dialog opens and confirms).
- [x] 3.10 Move the who-may-unpublish decision into `libs/chat-hooks/src/catalog/use-unpublishable-folders.ts` (`resolveUnpublishableFolders`, `useUnpublishableFolders`, exported from the root and `./catalog`); export `publishApiClient` from `apps/chat/src/server-api/publish.api.ts`; reduce `useProjectUnpublish` to an adapter over it. Architecture guard: the lib module imports only `react` and sibling `catalog/` modules, takes the client as a parameter, and adds no peer to `./project`.
- [x] 3.11 Tests: visibility matrix, failure, stale response and refresh in `libs/chat-hooks/src/catalog/tests/use-unpublishable-folders.spec.ts`; `apps/chat/src/hooks/projects/tests/useProjectUnpublish.spec.ts` keeps the target wiring, dialog, request and notifications; document the hook in `libs/chat-hooks/README.md`.
- [x] 3.12 Move `useCatalogPublishing`'s public-copy branch onto `resolveUnpublishableFolders`, so the catalog and the project page share one who-may-unpublish gate; `apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts` keeps covering it.
- [x] 3.9 RTL check: the new button, menu item and dialog use logical utilities only; `IconWorldOff` carries no `rtl:scale-x-[-1]`; run the existing RTL assertions in the touched specs if present.

**Verification:** `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectUnpublish.spec.ts apps/chat/src/components/PublishProjectPanelContainer/tests/PublishProjectPanelContainer.spec.tsx apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`; then `npm run verify:changed`.

## 4. Docs and final gates

- [x] 4.1 Update `docs/projects-reuse.md` (publish row: unpublish state comes from `useProjectUnpublish`-style host logic; the lib takes `onUnpublish`) and the project view paragraph of `docs/architecture.md` if it lists the header actions.
- [x] 4.2 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`.
- [ ] 4.3 Audit the diff against `specs/project-unpublish-flow/spec.md` and `specs/project-view-ui/spec.md`; run the five-axis review (`code-review-and-quality`) before merge.

## Follow-ups (out of scope)

- Offer Unpublish from the pinned-project sidebar menu (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`).

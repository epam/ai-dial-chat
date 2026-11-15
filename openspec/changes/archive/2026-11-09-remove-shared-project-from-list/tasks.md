Slicing: vertical. Slice 1 adds the lib callback, slice 2 the shared flow, slice 3 the view page, slice 4 the pinned menu. Read `AGENTS.md` and `.claude/rules/libs.md` before slice 1 and `.claude/rules/apps.md` before the app slices.

## 1. Lib: ProjectView action (libs/projects)

- [x] 1.1 Add `onRemoveFromMyList?: () => void` to `libs/projects/src/models/project-view-props.ts` and `removeFromMyListLabel?: string` to `ProjectViewLabels`; render the non-danger `IconTrashX` action (in the ⋮ menu, desktop and mobile, where Delete sits) in `libs/projects/src/components/ProjectView/ProjectView.tsx`, defaulting the label to `'Remove from My List'`
- [x] 1.2 Add tests in `libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`: present, absent, custom label, never together with Delete
- [x] 1.3 Update `libs/projects/README.md` props and examples; architecture guard: confirm the lib has no `/api` path, client, router, i18n or sharing knowledge
- Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`, then `npm run validate:docs`

## 2. App: shared removal flow

- [x] 2.1 Reuse the existing generic `CatalogI18nKeys.DetailsUnshare*` strings (confirm message, three consequences, removing status, success, error) and `ButtonsI18nKeys.RemoveFromMyList` instead of adding duplicate `projects.removeFromList.*` keys; no `en.json` change
- [x] 2.2 Add `isProjectSharedWithMe` to an app utils file under `apps/chat/src/utils/` with unit tests (shared, personal, organization, `canManage`)
- [x] 2.3 Add `apps/chat/src/hooks/projects/useProjectRemoveFromList.ts` (pending state, `discardSharedCatalogItem`, success toast, `replacePinnedProjectId`, refresh, optional navigation, error toast with trace id) and tests in `apps/chat/src/hooks/projects/tests/useProjectRemoveFromList.spec.ts` covering success, failure, 403, duplicate confirm and `leaveOnRemove`
- [x] 2.4 Add `apps/chat/src/components/ProjectRemoveFromListConfirmation/ProjectRemoveFromListConfirmation.tsx` on `ConfirmationDialog` (non-danger, consequences, pending state, `Props`, `memo` default export) with a spec in its `tests/` folder
- Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectRemoveFromList.spec.ts` and the confirmation spec, then `npm run verify:changed`

## 3. App: project view page

- [x] 3.1 Fill `removeFromMyListLabel` in `apps/chat/src/hooks/projects/useProjectViewLabels.ts` with `t(ButtonsI18nKeys.RemoveFromMyList)`
- [x] 3.2 In `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx` pass `onRemoveFromMyList` when eligible, render the confirmation, and leave for `ROUTES.Projects` with `replace`
- [x] 3.3 Extend `apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`: shared shows the action and not Delete; owner the reverse; confirm navigates; failure stays
- Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`

## 4. App: pinned project menu

- [x] 4.1 Add `RemoveFromMyList` to `PinnedProjectActionKind` in `apps/chat/src/types/pinned-project-action.ts`
- [x] 4.2 Add the menu item in `getActions` of `apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts` for eligible projects (also for `canEdit` recipients)
- [x] 4.3 Render the confirmation for that kind in `apps/chat/src/components/PinnedProjectActionOverlays/PinnedProjectActionOverlays.tsx`, navigating away only when the route shows the project
- [x] 4.4 Extend `apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts` and `apps/chat/src/components/PinnedProjectActionOverlays/tests/PinnedProjectActionOverlays.spec.tsx` (menu contents per ownership, confirm-then-discard, focus return)
- Verification: both spec files via `npm run test:file -- <path>`

## 5. Wrap-up

- [x] 5.1 RTL check: the icon is symmetric and no physical Tailwind classes were added
- [x] 5.2 Run `npm run validate:specs` and `npm run validate:docs`
- [ ] 5.3 Run `npm run verify:full` once, plus `npm run build:quiet` since a lib prop changed

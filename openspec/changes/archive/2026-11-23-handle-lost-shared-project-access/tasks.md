# Tasks

**Slicing strategy: vertical, bottom-up along the existing `isNotFound` path.** Each group leaves the repo green and is verifiable on its own:

1. Hook: `useProject` reports the new state.
2. Lib: `ProjectView` renders it.
3. App wiring: strings plus the view and edit pages, so the bug from the issue is fixed end to end here.
4. Chat page.
5. Live refresh.
6. Docs and closing checks.

Groups 4 and 5 depend on 1 and 3 but not on each other. No backend, OpenAPI or `libs/chat-api-client` file is touched.

## 1. `useProject` reports lost access (`project-view-ui` delta, design D1–D2)

- [x] 1.1 In `libs/chat-hooks/src/project/tests/project-hooks.spec.ts`, add failing cases for `useProject`. Name them by behaviour:
  - a `403` load sets `isAccessDenied`, with `hasError` and `isNotFound` false and `project` null;
  - a `404` load leaves `isAccessDenied` false;
  - a `503` load leaves `isAccessDenied` false and `hasError` true;
  - `refresh()` on a loaded project resolves `ProjectRefreshOutcome.AccessLost` on `403` and keeps `project` and `isAccessDenied: false`;
  - `retry()` after a `403` clears `isAccessDenied` while the new read is in flight.
  - Verification: `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts` fails on the new cases (red).
- [x] 1.2 Add `AccessLost = 'access-lost'` to `ProjectRefreshOutcome` in `libs/chat-hooks/src/project/project-refresh.ts`, with a JSDoc line ("The caller lost READ access: the owner stopped sharing the project or deleted it; the page should leave it").
- [x] 1.3 In `libs/chat-hooks/src/project/use-project.ts`:
  - add `isAccessDenied` to `ProjectResult`;
  - branch the `load` `catch` on `getApiErrorStatus(err)` (`404` / `403` / other);
  - return `AccessLost` from `refresh` on `403`;
  - return `isAccessDenied: settled?.isAccessDenied ?? false`;
  - update the hook's JSDoc ("A `404` is a not-found result, a `403` lost access, every other failure an error").
  - Verification: `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts` and `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks-lifecycle.spec.ts` pass.
- [x] 1.4 Architecture guard: confirm that the `libs/chat-hooks/src/project/use-project.ts` diff imports nothing new besides what it already uses (`getApiErrorStatus`), with no i18n, routing, notification or app import.
  - Verification: `npm run verify:changed` passes (slice 1 closed).

## 2. `ProjectView` access-denied state (`project-view-ui` delta, design D3)

- [x] 2.1 In `libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`, add failing cases. Use role and text queries:
  - with `isAccessDenied`, the title and description render, a "Back to projects" button calls `onBrowseProjects`, and no "Retry" button exists;
  - when `isLoading` is followed by `isAccessDenied`, the pre-mounted live region holds the access-denied title;
  - labels without `accessDeniedLabel` / `accessDeniedDescription` render the English defaults;
  - `isAccessDenied` together with `hasError` renders the access-denied state.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx` fails on the new cases (red).
- [x] 2.2 In `libs/projects/src/models/project-view-props.ts`:
  - add the optional `isAccessDenied?: boolean` prop to `ProjectViewProps`, with JSDoc;
  - add the optional `accessDeniedLabel?: string` and `accessDeniedDescription?: string` to `ProjectViewLabels`, with JSDoc that names the English defaults.
- [x] 2.3 In `libs/projects/src/components/ProjectView/ProjectView.tsx`:
  - define `DEFAULT_ACCESS_DENIED_LABEL` and `DEFAULT_ACCESS_DENIED_DESCRIPTION` constants;
  - destructure `isAccessDenied = false`;
  - add the access-denied branch first in `renderState`: an `aria-hidden` title `<p>` in `bodyClassName` + `styles.body`, a description `<p>` in `helperClassName` with a secondary-text class backed by `--pv-secondary-text` in `ProjectView.module.scss`, and the `GhostButton` with `browseProjectsLabel` → `onBrowseProjects`;
  - include `isAccessDenied` in the early-return condition;
  - make the `LiveRegion` carry the access-denied title when `!isLoading && isAccessDenied`.

  Use logical classes only (`text-center` is direction-neutral), and no icon.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx` passes.
- [x] 2.4 Architecture, theming and RTL guard for `libs/projects`:
  - the diff adds no `/api`, `@epam/ai-dial-chat-api-client`, router, i18n or feature-flag import;
  - every color comes from a `--pv-*` variable in the `.module.scss`;
  - typography comes from the `typography` props;
  - no physical `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` class is added.
  - Verification: `npm run verify:changed` passes (slice 2 closed).

## 3. Strings and the view and edit pages (`project-view-ui`, `project-edit-ui` deltas)

- [x] 3.1 Add the i18n keys `projects.view.accessDenied` ("You no longer have access to this project") and `projects.view.accessDeniedDescription` ("The owner may have stopped sharing it or deleted it.") to `apps/chat/src/i18n/locales/en.json`. Add the `ProjectsI18nKeys.ViewAccessDenied` and `ProjectsI18nKeys.ViewAccessDeniedDescription` members to `apps/chat/src/constants/i18n-keys/projects.ts`.
- [x] 3.2 Fill `accessDeniedLabel` and `accessDeniedDescription` with `t()` in `apps/chat/src/hooks/projects/useProjectViewLabels.ts`.
- [x] 3.3 In `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx` and `apps/chat/src/pages/ProjectEditPage/ProjectEditPage.tsx`, read `isAccessDenied` from `useProject` and pass it to `ProjectView`.
- [x] 3.4 Add page tests:
  - in `apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`, `getProject` rejecting with `403` shows "You no longer have access to this project", no "Retry", and "Back to projects" navigates to `/projects`;
  - in `apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx`, the same, and no form field renders.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ProjectEditPage/tests/ProjectEditPage.spec.tsx` pass. Then `npm run verify:changed` passes (slice 3 closed; the issue's scenario is fixed).

## 4. Chat page (`project-conversations-ui` delta, design D4)

- [x] 4.1 In `apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`, read `isAccessDenied` from `useProject` and add it to the early-return condition. For it, render `StateScreen` with:
  - `title={t(ProjectsI18nKeys.ViewAccessDenied)}`;
  - `description={t(ProjectsI18nKeys.ViewAccessDeniedDescription)}`;
  - `announce="polite"`;
  - the existing "Back to projects" `PrimaryButton`.

  Not-found keeps its current title. The access-denied branch also applies when router state supplied a summary.
- [x] 4.2 In `apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx`, add two cases:
  - with a router-state summary and `getProject` rejecting with `403`, the access-denied screen replaces the chat, no conversation input renders, and "Back to projects" navigates to `/projects`;
  - a `503` with a summary still keeps the chat open.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectChatPage/tests/ProjectChatPage.spec.tsx` passes.

## 5. Leaving the open view page on lost access (`project-view-live-updates` delta, design D5)

- [x] 5.1 In `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`:
  - extract the guard, unpin and navigate steps of `handleDeletedElsewhere` into one memoised `leaveProject(messageKey)`;
  - keep `handleDeletedElsewhere` (passed to `useProjectWatch` as `onDelete`) as a call to it with `ProjectsI18nKeys.ViewDeletedElsewhere`;
  - in `handleProjectChanged`, call it with `ProjectsI18nKeys.ViewAccessDenied` when the outcome is `ProjectRefreshOutcome.AccessLost`;
  - keep the `useCallback` dependency lists exhaustive.
- [x] 5.2 In `apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx`, add three cases:
  - a watch `UPDATE` whose refresh gets `403` shows the toast "You no longer have access to this project", unpins the project, and routes to `/projects`;
  - a `DELETE` event plus a `403` refresh show exactly one toast;
  - a `503` refresh shows no toast and keeps the page.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectViewPage/tests/ProjectViewPage.spec.tsx` passes. Then `npm run verify:changed` passes.

## 6. Docs and closing checks

- [x] 6.1 Update `libs/chat-hooks/README.md`:
  - the `useProject` return value gains `isAccessDenied`;
  - the `ProjectRefreshOutcome` member list gains `AccessLost`;
  - the live-update example leaves the page on `AccessLost` as well as `NotFound`.
- [x] 6.2 Update `libs/projects/README.md`, `ProjectView` section:
  - the state list gains access denied (no Retry, `onBrowseProjects`);
  - the props list gains `isAccessDenied`;
  - the labels example gains the two optional labels and their defaults.
- [x] 6.3 Check whether `docs/` describes the project view's error states (use the `dial-docs` skill). If it does, update that doc in the same commit. Otherwise record "no `docs/` change" in the PR description.
- [x] 6.4 Run the documentation and spec gates.
  - Verification: `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact` (advisory) pass with no new findings.
- [x] 6.5 Close the change.
  - Verification: `npm run verify:full` passes once.

## Why

A recipient who had a shared project (view or edit) and then loses it, because the owner stopped sharing it or deleted it, sees "Could not load the project" with a Retry button. The message does not say what happened, and Retry can never succeed. Users read it as an outage, retry, and report bugs.

## Problem

- `GET /api/v1/projects/{id}` answers `403` for a project in another user's bucket once the caller has no READ access. DIAL Core checks permissions before existence, and deleting a resource also drops its shares, so a revoked share and a deleted project produce the **same** `403`. The BFF cannot tell them apart, and this change does not try to.
- The BFF already maps Core's `403` mask of a missing resource in the caller's **own** bucket to `404` (`readProjectMetadata` in `apps/chat-api/src/projects/projects.service.ts`, the `response?.status === 403 && parsed.bucket === sessionBucket` branch), so an owner never reaches this state.
- `useProject` (`libs/chat-hooks/src/project/use-project.ts`, the `catch` in `load`) has only two failure kinds: `404` → `isNotFound`, anything else → `hasError`. So `403` lands in the generic, retryable error state on the view page (`ProjectViewPage`), the edit page (`ProjectEditPage`, which reuses `ProjectView`'s states), and the chat page (`ProjectChatPage`, which shows "Project not found" only when it has no summary from router state).
- On the open view page, a live refresh that gets `403` resolves `ProjectRefreshOutcome.Failed`, so the page keeps showing stale content the user can no longer reach. A `404` refresh already leaves the page with a toast (`handleDeletedElsewhere` in `apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`).

## Solution

Add a third failure kind, **access denied**, for a `403` on the project read. It has one honest message that covers both causes and only one way out: back to the projects list.

## What Changes

- **`libs/chat-hooks` — `useProject`:** a `403` sets a new `isAccessDenied` flag, not `hasError`. `ProjectRefreshOutcome` gains `AccessLost = 'access-lost'`, which a silent `refresh` resolves on `403`. `hasError` and `isNotFound` keep their meaning for every other status.
- **`libs/projects` — `ProjectView`:** a new optional `isAccessDenied` prop renders an access-denied state: a title (`labels.accessDeniedLabel`), an explanation (`labels.accessDeniedDescription`), and the existing "Back to projects" button (`labels.browseProjectsLabel` → `onBrowseProjects`). It has **no Retry**. The title is announced through the always-mounted `LiveRegion`, as the error is today. Both labels are optional with English defaults, so the lib stays non-breaking for other hosts.
- **`apps/chat` pages:**
  - `ProjectViewPage` and `ProjectEditPage` pass `isAccessDenied` to `ProjectView`.
  - `ProjectChatPage` renders its `StateScreen` with the access-denied title and description when `isAccessDenied`, even if router state gave it a summary, because the chat can no longer be read or written.
  - `ProjectViewPage` treats a refresh that resolves `AccessLost` like a delete elsewhere: an info toast ("You no longer have access to this project"), `replacePinnedProjectId(id, null)`, and `navigate(ROUTES.Projects, { replace: true })`.
- **i18n:** new keys `projects.view.accessDenied` ("You no longer have access to this project") and `projects.view.accessDeniedDescription` ("The owner may have stopped sharing it or deleted it."), with `ProjectsI18nKeys` members and `useProjectViewLabels` wiring. `en.json` is the only locale file in the repo.
- **No backend change.** The `GET /api/v1/projects/{id}` contract already documents `403` ("DIAL Core denied access"), and the OpenAPI client is unchanged.

## Non-goals

- Distinguishing "revoked" from "deleted". Core gives the recipient no signal that tells them apart. Probing the owner's bucket or listing shares would need permissions the recipient no longer has.
- Removing the stale entry from the Projects page's "Shared with me" list. That list is re-read from Core on load and through the projects watch, so it drops the project on its own.
- Changing how a `403` from a **write** (save, chat completion) is reported. Those keep their current toasts (`projects.edit.toast.error`, and so on).
- A distinct state for the `projectsEnabled` feature guard's `403`. Each page already renders `NotFoundPage` before it reads the project when the flag is off.

## Alternatives considered

1. **Only change the copy of `projects.view.error`** (baseline). Rejected: a `503` would then also claim lost access, and Retry would stay where it can never help.
2. **BFF maps a foreign-bucket `403` to `404`** so the existing not-found state shows. Rejected: "Project not found" is also wrong when the project still exists but was unshared, and it changes a documented API status for every client.
3. **Separate `isAccessDenied` flag in the hook and the lib (chosen).** It is additive, keeps the API contract, and gives the clearest message the available information supports.

## Acceptance criteria

- A recipient whose access was revoked, or whose project was deleted, sees "You no longer have access to this project" with the explanation and a "Back to projects" button on `/projects/view/...`, `/projects/edit/...` and a project chat URL. No Retry button is shown.
- A `503` still shows "Could not load the project" with Retry, and a `404` still shows "Project not found".
- With the view page open, losing access, detected by the next silent refresh, shows the toast and returns to `/projects`, and the project is unpinned.
- `npm run validate:docs` and `npm run validate:specs` pass. The `libs/projects` and `libs/chat-hooks` READMEs document the new prop, labels and enum member.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-view-ui`: `useProject` gains `isAccessDenied` and `ProjectRefreshOutcome.AccessLost`; `ProjectView` gains the access-denied state, prop and labels; the new i18n keys.
- `project-view-live-updates`: a silent refresh that resolves `AccessLost` leaves the page with an access-lost toast, as a `404` does.
- `project-edit-ui`: the edit page renders the access-denied state on `403`.
- `project-conversations-ui`: `ProjectChatPage` renders the access-denied screen on `403`, even with a router-state summary.

## Impact

- **Libs (shared, flagged as scope):**
  - `libs/chat-hooks`: `use-project.ts` and `project-refresh.ts`. Additive return field and enum member.
  - `libs/projects`: `ProjectView.tsx` and `models/project-view-props.ts`. Additive optional prop and labels.

  Both libs stay host-agnostic. The hook reads only the HTTP status from the injected client's error, through the existing `getApiErrorStatus`. The lib receives a boolean, two strings and the existing `onBrowseProjects` callback. Navigation, toasts, pinning and i18n stay in `apps/chat`.
- **App:** `ProjectViewPage.tsx`, `ProjectEditPage.tsx`, `ProjectChatPage.tsx`, `hooks/projects/useProjectViewLabels.ts`, `constants/i18n-keys/projects.ts`, `i18n/locales/en.json`.
- **Docs:** `libs/projects/README.md` (`ProjectView` states and labels) and `libs/chat-hooks/README.md` (`useProject` return value, `ProjectRefreshOutcome`).
- **Tests:** `libs/chat-hooks/src/project/tests/project-hooks.spec.ts`, `libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx`, and the three page specs.
- **Compatibility / rollback:** non-breaking. Every new field is optional or additive, and a host that ignores `isAccessDenied` falls back to the loaded or empty path as before. To roll back, revert the commit. No data or API migration is involved.
- **Model files:** follows the existing `isNotFound` path end to end (`use-project.ts` → `ProjectView` not-found state → `handleDeletedElsewhere`).

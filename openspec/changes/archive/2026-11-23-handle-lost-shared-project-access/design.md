## Context

A shared project lives in the owner's bucket. The recipient reads it through `GET /api/v1/projects/{id}` (`ProjectsService.getProject` in `apps/chat-api/src/projects/projects.service.ts`). That call runs `readProjectMetadata` and the snapshot read in parallel.

When the owner unshares or deletes the project, Core answers the recipient's reads with `403`:

- Core checks permissions before existence.
- Deleting a resource also drops its shares.

Both reads map a foreign-bucket `403` through `handleDialSdkError` (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) to `ForbiddenException`. A `403` in the caller's own bucket is already turned into `404`. On the client, only the status reaches the host.

Today the `403` flows through three layers:

1. `useProject` (`libs/chat-hooks/src/project/use-project.ts`) has two failure kinds, `404` → `isNotFound` and the rest → `hasError`.
2. `ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`, `renderState`) shows `errorLabel` + Retry for `hasError`.
3. The pages:
   - `ProjectViewPage` and `ProjectEditPage` pass the flags to `ProjectView`.
   - `ProjectChatPage` renders its own `StateScreen` for not-found and keeps the chat open on other errors when it has a router-state summary.
   - `ProjectViewPage.handleProjectChanged` acts only on `ProjectRefreshOutcome.NotFound`.

The fix follows the existing `isNotFound` path end to end. The proposal explains why; the delta specs say what must happen.

## Goals / Non-Goals

**Goals:**
- One clear, honest state for "you lost access", with no Retry, on the view, edit and chat routes.
- An open view page leaves with a toast when a refresh discovers the loss, as it does for a delete elsewhere.
- Additive, non-breaking lib APIs. Libs stay host-agnostic.

**Non-Goals:**
- Telling "revoked" apart from "deleted". The BFF and the client do not have that information.
- Backend or OpenAPI changes, and any new endpoint.
- Changing write-path `403` handling (save, completions, share actions).
- Polling for lost access. Detection rides on the refreshes the page already runs.

## Decisions

### D1. A separate `isAccessDenied` flag, not a status code or an enum

`useProject` returns `isAccessDenied: boolean` beside `hasError` and `isNotFound`. The internal `ProjectResult` gains the same field, and the `catch` in `load` becomes a three-way branch on `getApiErrorStatus(err)`: `404` / `403` / other.

- *Alternative: return `errorStatus?: number`* and let the host decide. Rejected. Every host would repeat the same status → state mapping, and `ProjectView` would still need a state prop.
- *Alternative: replace the three booleans with a `ProjectLoadState` enum.* This is cleaner, but it is a breaking change to a published hook and to `ProjectView`'s props. It is not worth it for one new case. It can be a later refactor.

### D2. `ProjectRefreshOutcome.AccessLost` rather than reusing `NotFound`

The page reacts the same way to both, but the toast text differs. "This project was deleted" would be false for an unshare. A distinct member keeps the hook truthful and leaves the message choice with the host. It is a string-enum addition (`'access-lost'`). An exhaustive `switch` in a host would need a new case, but every current caller compares against `NotFound` only.

### D3. Access-denied state inside `ProjectView`, reusing `onBrowseProjects`

`ProjectView` already owns the loading, error and not-found states and is reused by the edit page. Adding the state there gives one implementation for both routes. The state's only action is the existing `onBrowseProjects` with `browseProjectsLabel`, so no new callback is introduced. `onRetry` stays required in the props because the error state still uses it.

The new labels `accessDeniedLabel` and `accessDeniedDescription` are **optional with English defaults**. That follows the `loadingAriaLabel` and `downloadFileLabel` precedent in `ProjectViewLabels`, and `libs.md` asks for English defaults on `*Labels`. Making them required would break other hosts' type-checks.

Rendering mirrors the error branch:

- the visible title `<p aria-hidden>`;
- the description `<p>` in `helperClassName` with `--pv-secondary-text`;
- the `GhostButton`.

The existing always-mounted `LiveRegion` announces `accessDeniedLabel`. Its expression becomes `!isLoading && (isAccessDenied ? accessDeniedLabel : hasError ? errorLabel : null)`. `ProjectView` keeps the plain `<p>` layout instead of switching to kit `StateScreen`. That keeps the change small and does not alter the existing error and not-found visuals. Migrating all three states to `StateScreen` is a separate cleanup.

### D4. `ProjectChatPage` uses `StateScreen` with `description` and `announce`

The chat page already renders a kit `StateScreen` for not-found. For `isAccessDenied` it renders the same screen with:

- `title` = `ViewAccessDenied`;
- `description` = `ViewAccessDeniedDescription`;
- `action` = the existing "Back to projects" `PrimaryButton`;
- `announce="polite"`, because the screen can replace an already rendered chat.

The early-return condition becomes `... || isNotFound || isAccessDenied || (hasError && !summary)`. The branch picks the access-denied copy when `isAccessDenied`. A router-state summary no longer keeps the chat open on `403`: every write would fail, and the read did.

### D5. Leaving the view page on `AccessLost`

`handleProjectChanged` in `ProjectViewPage` calls a new `handleAccessLost`, which shares the guard and the unpin + navigate steps with `handleDeletedElsewhere`. A small internal `leaveProject(message)` callback holds the shared steps, and both handlers call it with their own i18n key. The `hasLeftRef` / `isOwnDeleteRef` guard stays in that one place, so concurrent `DELETE` + `AccessLost` show one toast. Everything is memoised with `useCallback` on the same dependencies as today.

### D6. Host-boundary check

- `libs/chat-hooks` reads only the HTTP status through `getApiErrorStatus`. It shows no toast, does not navigate and does not read i18n.
- `libs/projects` gets a boolean, two strings and the existing callback.
- Toasts (`useNotification`), pinning (`replacePinnedProjectId`), routing (`ROUTES.Projects`) and `t()` stay in `apps/chat`.

No new React context, hook file or route is added.

## Risks / Trade-offs

- **[A transient Core `403`, for example a permission cache race right after sharing, now shows a dead end with no Retry]** → The user can still reload the browser. "Back to projects" re-lists from Core, so a project that is actually shared reappears there. This is accepted because a persistent `403` is the overwhelmingly common case.
- **[The copy is deliberately vague ("may have stopped sharing it or deleted it")]** → This is the most accurate statement the data supports. Stating one cause would be wrong half the time.
- **[An open view page may not learn about the loss until its next refresh]** → An unshare emits no event on the project resource, so the page notices only on the next refresh (any `UPDATE` by the owner, or a reconnect). Until then the user sees stale content, and any action fails with its existing toast. This change adds no polling, consistent with the live-updates design.
- **[A host with an exhaustive `switch` over `ProjectRefreshOutcome` gets a new member]** → Additive. It is documented in the `libs/chat-hooks` README, and `apps/chat` has no exhaustive switch over it.

## Migration Plan

No data or API migration. The change ships in one commit, with the READMEs and delta specs. Rollback is a revert. Hosts that do not pass `isAccessDenied` see the access-denied case fall through to their loaded or empty rendering, which is no worse than today.

## Open Questions

- None blocking. If product later wants different copy for an edit-only downgrade (edit → view), that case already works: the project loads with `canEdit: false`, and the edit page redirects to the view page. It does not touch this state.

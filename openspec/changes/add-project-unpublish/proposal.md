# add-project-unpublish — proposal

Issue: [#9759](https://github.com/epam/ai-dial-chat/issues/9759) — "[Projects] Allow users to request unpublishing of a published project from the chat view".

## Problem

A project owner can publish a project from the project view page (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx` → `PublishProjectPanelContainer`), but nothing in the chat app can take it back. `ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`) renders only a Publish action; there is no Unpublish. Publication is one-way, so a project published by mistake, with outdated data, or no longer needed stays public until an administrator removes it by hand.

Catalog entities (applications, toolsets, prompts, skills) and conversations already have this: `useCatalogPublishing.handleUnpublish` (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`) and the conversation row menu (`apps/chat/src/hooks/conversation-panel/useConversationSharingDialogs.ts`). Projects are the only publishable resource without it.

## Solution

Mirror the application (catalog) unpublish flow on the project view page. **No backend change is needed**: `CatalogEntityType.Project` already exists in `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`, so `POST /api/v1/catalog/project/{entityId}/unpublish`, `GET /api/v1/catalog/project/{entityId}/unpublish-access` and `GET …/publish-history` already accept projects, and `PublishService.canUnpublish` already lets only an administrator or the publisher request removal. The generated wrappers `unpublishCatalogEntity`, `getCatalogUnpublishAccess` and `getCatalogPublishHistory` are already exported from `apps/chat/src/server-api/publish.api.ts`.

1. **`libs/projects`** — `ProjectView` gains an optional `onUnpublish` callback and an optional `labels.unpublishLabel` (default `'Unpublish'`). When `onUnpublish` is supplied it renders an Unpublish action with `IconWorldOff` in Publish's slot (desktop header `NeutralButton`, first item of the mobile ⋮ menu) and Publish is not rendered. The lib knows nothing about history, ownership or endpoints.
2. **`libs/chat-hooks` + `apps/chat`** — `useUnpublishableFolders` (`libs/chat-hooks/src/catalog/use-unpublishable-folders.ts`) decides who is offered Unpublish; the app adapter `useProjectUnpublish` (`apps/chat/src/hooks/projects/useProjectUnpublish.ts`) adds the dialog, the request and the toasts:
   - **Own project** (`project.canManage`): load `getCatalogPublishHistory(Project, id)`; ≥ 1 live folder → Unpublish replaces Publish.
   - **Public copy** (`projects/public/…`, `isPublicCatalogEntityId`): an administrator gets a synthesised single-folder entry outright; anyone else only when `getCatalogUnpublishAccess(Project, id)` answers `canUnpublish: true`.
   - While the lookup is outstanding neither Publish nor Unpublish is passed, so the header never flashes one and swaps to the other (the catalog's [#9500](https://github.com/epam/ai-dial-chat/issues/9500) lesson). A failed lookup settles as "no folders" (Publish for an owner, nothing on a public copy).
3. **Confirmation** — a `ConfirmationDialog` (`@epam/ai-dial-chat-shared`) with a `RadioGroup` when the project is published to several folders, as the conversation flow does. The dialog body moves into `UnpublishConfirmationDialog` in `libs/publish-panel`, used by both the conversation panel and the project page, so the two copies do not drift.
4. **Result** — success raises `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.UnpublishRequested, { name, folder })`; failure reuses `usePublishErrorNotification(error, EntityOperation.UnpublishRequested)`.

Closest models: `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts` (who may unpublish, history synthesis for public copies), `apps/chat/src/components/ConversationPanel/ConversationPanelOverlays.tsx` (the confirmation dialog), `apps/chat/src/components/ProjectDeleteConfirmation/ProjectDeleteConfirmation.tsx` (project page overlay shape).

**Assumption recorded:** "the chat view" in the issue means the chat application's project view page (`/projects/view/:bucket/*`), as opposed to the admin panel. The pinned-project sidebar menu and the projects list are not covered (see Non-goals).

### Alternatives considered

- **Catalog-style in-place confirmation sub-view** — `ProjectView` has no details panel with sub-views; adding one for a single confirmation is more surface than a dialog. Rejected.
- **Show Publish while history loads, swap to Unpublish when it lands** — the catalog shipped this and had to fix the flicker in #9500. Rejected in favour of withholding the slot until settled.
- **Copy the conversation dialog JSX into the project page** — `apps.md` "Dedupe inside the app too" forbids two verbatim copies. Rejected in favour of `UnpublishConfirmationDialog`.

## Non-goals

- Any `apps/chat-api` or OpenAPI change — the endpoints already accept `project`.
- Unpublish from the pinned-project sidebar menu (`usePinnedProjectsPanel`) or from the projects list page. Recorded as a follow-up.
- Republishing an already-published project to a second folder: as in the conversation flow, Unpublish replaces Publish, so republishing means unpublishing first. The catalog differs on purpose: it keeps Publish on the source item and offers Unpublish on the public copy ([#8691](https://github.com/epam/ai-dial-chat/issues/8691)).
- Reflecting a pending removal in the UI (the folder stays published until an admin approves; history keeps listing it).

## Scope flags

- **Touches a shared lib** (`libs/projects`): one optional prop and one optional label; additive, no host-owned knowledge enters the lib. Ownership, admin status, history and the endpoint stay out of `libs/projects`: the decision is in `libs/chat-hooks` behind an injected client, the wiring in `apps/chat`, and `ProjectView` sees only the presence of `onUnpublish`.
- **Touches `libs/chat-hooks`**: one new module under `catalog/` with two additive exports (root and `./catalog`); no new dependency or peer, and `./project` is unchanged.
- **Touches `libs/publish-panel`**: one additive component, `UnpublishConfirmationDialog`, with its `*Labels`/`*Colors`/`*Props` types; strings by prop with English defaults, no new dependency or peer.
- **Touches the conversation panel** (`ConversationPanelOverlays.tsx`) only to swap its inline dialog for the shared `UnpublishConfirmationDialog` with identical strings and behaviour.
- No new context; the state is page-local to `ProjectViewPage` through the hook.

## i18n impact

New user-visible strings, under `projects.unpublish.*` in `apps/chat/src/i18n/locales/en.json` with `ProjectsI18nKeys` members, plus `entityNotifications.project.unpublishRequestedTitle` / `unpublishRequested` with `EntityNotificationsI18nKeys` members. The action label reuses `buttons.unpublish`. See the spec for the full list.

## Rollback / backward compatibility

Non-breaking. `onUnpublish` and `unpublishLabel` are optional, so every other `ProjectView` host renders unchanged. Reverting the change removes the action; requests already submitted stay in DIAL Core's admin queue and are unaffected.

## Acceptance criteria

- An owner whose project is published to ≥ 1 live folder sees Unpublish (not Publish) on the project view page, desktop and mobile; an owner of an unpublished project sees Publish.
- The publisher or an administrator opening the public copy sees Unpublish; any other user sees neither.
- Confirming sends `POST /api/v1/catalog/project/{id}/unpublish` with the chosen folder and shows the "unpublish requested" toast; a failure shows the shared publish error notification.
- With several published folders the user must pick one before confirming.
- The header never shows Publish and then swaps it for Unpublish on load.
- The conversation unpublish dialog behaves exactly as before after moving to the shared component.
- Tests cover the lib action, the hook's visibility matrix and request/notification paths, and the page wiring; `npm run validate:docs` and `npm run validate:specs` pass.

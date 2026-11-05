# project-unpublish-flow Specification

## ADDED Requirements

### Requirement: ProjectView offers Unpublish in Publish's slot

`ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`) SHALL accept an optional `onUnpublish?: () => void` prop (documented in `libs/projects/src/models/project-view-props.ts`) and an optional `ProjectViewLabels.unpublishLabel?: string`, defaulting to the lib's English `'Unpublish'`.

When `onUnpublish` is supplied, `ProjectView` SHALL render an Unpublish action in exactly the places Publish renders today:

- on desktop, a header `NeutralButton` labelled `labels.unpublishLabel` with `IconWorldOff` (`@tabler/icons-react`) at `DIAL_ICON_SIZE.MD`, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, hidden below `desktop:`;
- on mobile, the first item of the ⋮ `ActionMenu` (key `unpublish`), with `IconWorldOff` at `DIAL_ICON_SIZE.SM`.

Publish and Unpublish SHALL be mutually exclusive: when `onUnpublish` is supplied, Publish SHALL NOT render, whatever `onPublish` is. The Unpublish item SHALL NOT use the `danger` treatment — it removes the published copy only, and the project itself is untouched.

The lib SHALL perform no request and SHALL know nothing about publish history, ownership, administrator status, entity types or endpoints; the host expresses all of that only by supplying or omitting `onUnpublish`. Read-only mode stays the host omitting callbacks: a host may pass `onUnpublish` while omitting `onEdit`, `onShare`, `onDelete` and `onPublish` (a public copy viewed by its publisher).

#### Scenario: Unpublish replaces Publish on desktop

- **GIVEN** `ProjectView` renders with both `onPublish` and `onUnpublish`
- **THEN** an `Unpublish` button renders in the header and no `Publish` button or menu item renders

#### Scenario: Unpublish leads the mobile menu

- **GIVEN** `onUnpublish` is supplied on a mobile viewport
- **WHEN** the ⋮ menu opens
- **THEN** `Unpublish` is its first item, before Edit and Share, with a non-danger treatment

#### Scenario: Host label overrides the default

- **GIVEN** `labels.unpublishLabel` is `'Retirer'`
- **THEN** the action is named `'Retirer'`

#### Scenario: No callback, no action

- **GIVEN** `onUnpublish` is omitted
- **THEN** no Unpublish control renders and Publish behaves as before

### Requirement: chat-hooks decides who is offered Unpublish

The decision SHALL live in `libs/chat-hooks` (`libs/chat-hooks/src/catalog/use-unpublishable-folders.ts`), exported from the root and `./catalog` entry points, because it is pure logic over DIAL Core publish data that every DIAL-Core-backed host needs as-is. It is generic over the catalog entity type, so the catalog flow can adopt it later. It lives under `./catalog` rather than `./project` so the `./project` entry point gains no `@epam/ai-dial-publish-panel` peer.

- `resolveUnpublishableFolders(client, target, isAdmin)` returns `Promise<string[][]>` and rejects when a request fails.
- `useUnpublishableFolders(client, target, isAdmin)` returns `{ isResolved, folders, refresh }`.
- `client` is `Pick<PublishApiClient, 'getCatalogPublishHistory' | 'getCatalogUnpublishAccess'>` (`createPublishApiClient`), passed in already configured and referentially stable; `target` is `{ entityType, entityId, isOwner } | null`.
- The lib constructs no client and reads no app context, i18n, auth or feature flag.

Decision table:

| Target | Lookup | Folders |
| --- | --- | --- |
| Own entity (`isOwner`, id not public) | `getCatalogPublishHistory(entityType, entityId)` mapped with `mapPublishHistoryEntryDto` | each live entry's `folderPath`, de-duplicated by joined path, history order (newest first) |
| Public copy (`isPublicCatalogEntityId(id)`), administrator | none | `[getPublicCatalogEntityFolderPath(id)]` |
| Public copy, non-administrator | `getCatalogUnpublishAccess(entityType, entityId)` | `[getPublicCatalogEntityFolderPath(id)]` when `canUnpublish`, else `[]` |
| Anything else (not owned, not public) | none | `[]` |

"Live" is what the BFF already returns: an `APPROVED` removal cancels the folder, a `PENDING` one does not (`resolvePublicationsForSource` in `apps/chat-api/src/publish/publication.util.ts`).

Resolution states of `useUnpublishableFolders`:

| State | `isResolved` | `folders` |
| --- | --- | --- |
| No target (`null`) | `false` | `[]` |
| No lookup needed (rows 2 and 4) | `true` once the effect runs, with no request | as in the table |
| Lookup in flight | `false` | `[]` |
| Resolved | `true` | as in the table |
| Failed | `true` | `[]` — no notification is raised |

The lookup runs when the entity type, id, `isOwner`, `isAdmin` or `client` changes, inside `useEffect` with a cancelled flag so a response for a previous entity cannot land on the next one. `refresh()` re-runs it without clearing the folders already reported. `refresh` is `useCallback`-memoised and the result `useMemo`-memoised.

The server-side history (`publish-history:{entityType}:{entityId}`, 60 s) and unpublish-access (`unpublish-access:{bucket}:{entityType}:{entityId}`, 60 s) caches already exist in `PublishService`; the client adds no cache. The BFF drops the history entry on a successful publish/unpublish, which is when the host calls `refresh()`.

The app adapter `useProjectUnpublish` (`apps/chat/src/hooks/projects/useProjectUnpublish.ts`) SHALL call `useUnpublishableFolders(publishApiClient, { entityType: Project, entityId: project.id, isOwner: project.canManage }, isAdmin)`, with `publishApiClient` exported from `apps/chat/src/server-api/publish.api.ts` and `isAdmin` from `useUser().user?.isAdmin` (`apps/chat/src/context/auth/UserContext.tsx`). It exposes the result as `isPublishStateResolved`, `publishedFolders` and `refreshPublishState`, and owns only the confirmation dialog state, the unpublish request and its notifications. No context is introduced; the state is page-local. Its `requestUnpublish` and confirm/close handlers are `useCallback`-memoised and its result `useMemo`-memoised.

#### Scenario: Owner of a published project

- **GIVEN** `isOwner: true` and history resolves to one entry in `Organization/Data`
- **THEN** `folders` is `[['Organization', 'Data']]` and `isResolved` is `true`

#### Scenario: Owner of an unpublished project

- **GIVEN** `isOwner: true` and history resolves to `[]`
- **THEN** `folders` is `[]`

#### Scenario: Administrator on a public copy

- **GIVEN** `isAdmin: true` and the id is `projects/public/Data/Sales`
- **THEN** `folders` is `[['Data']]` without any request

#### Scenario: Publisher on a public copy

- **GIVEN** `isAdmin: false` and `getCatalogUnpublishAccess` answers `canUnpublish: true`
- **THEN** `folders` holds the copy's folder

#### Scenario: Other user on a public copy

- **GIVEN** `isAdmin: false` and `canUnpublish: false`
- **THEN** `folders` is `[]`

#### Scenario: Entity the caller does not own

- **GIVEN** an entity the caller does not own (`isOwner: false`, not public)
- **THEN** no request is issued and `folders` is `[]`

#### Scenario: Failed lookup settles silently

- **GIVEN** the history request rejects
- **THEN** `isResolved` is `true`, `folders` is `[]`, and no notification is shown

#### Scenario: Switching entities discards the previous response

- **WHEN** the entity id changes while the previous lookup is in flight
- **THEN** the previous response is ignored and the new entity's lookup decides `folders`

### Requirement: ProjectViewPage passes exactly one of Publish and Unpublish once settled

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL derive the callbacks from `useProjectUnpublish`:

| Condition | `onPublish` | `onUnpublish` |
| --- | --- | --- |
| `!isPublishStateResolved` | omitted | omitted |
| resolved, `publishedFolders.length > 0` | omitted | `requestUnpublish` |
| resolved, no folders, `canManage` | `handlePublish` | omitted |
| resolved, no folders, `!canManage` | omitted | omitted |

So the header never shows Publish and then swaps it for Unpublish on load; the slot appears once, settled. This refines the `onPublish` row of the `project-view-ui` gating table: `onPublish` still requires `canManage`, and additionally a settled lookup with no live folder.

After a successful publish through `PublishProjectPanelContainer` (its new `onPublished` callback), the page calls `refreshPublishState()`, so a published project offers Unpublish without a reload.

#### Scenario: No flash while loading

- **GIVEN** the owner opens a published project and history has not resolved
- **THEN** neither Publish nor Unpublish renders
- **WHEN** history resolves with one folder
- **THEN** Unpublish renders, and Publish never rendered

#### Scenario: Publishing then offers Unpublish

- **WHEN** the owner publishes the project and the request succeeds
- **THEN** the publish state is re-fetched and, once it lists the folder, Unpublish replaces Publish

#### Scenario: Recipient of a share sees neither

- **GIVEN** a project shared with edit access (`canEdit: true`, `canManage: false`)
- **THEN** neither Publish nor Unpublish renders

### Requirement: Project unpublish confirms in a dialog with a folder choice

Selecting Unpublish SHALL open `UnpublishConfirmationDialog` (`apps/chat/src/components/UnpublishConfirmationDialog/UnpublishConfirmationDialog.tsx`), a new app component that renders `ConfirmationDialog` (`@epam/ai-dial-chat-shared`) with `variant={ConfirmationPopupVariant.Danger}` and, when there are several folders, a kit `RadioGroup` — the body `ConversationPanelOverlays.tsx` renders inline today, lifted into one component.

Props: `isOpen`, `title`, `name`, `folders: string[]` (joined paths), `selectedFolder: string | null`, `onSelectedFolderChange`, `isLoading`, `confirmMessage: (name, folder) => string`, `selectFolderMessage: (name) => string`, `folderGroupAriaLabel`, `loadingStatusLabel`, `onConfirm`, `onClose`. Folder labels use `getPublishFolderLabel` (`apps/chat/src/utils/publish.ts`), so the public root reads as the translated Organization label. The confirm and cancel labels are `t(ButtonsI18nKeys.Unpublish)` and `t(ButtonsI18nKeys.Cancel)`.

Body rules, identical to the conversation flow:

- **One folder** — `confirmMessage(name, folder)`; confirm enabled immediately.
- **Several folders** — `selectFolderMessage(name)` and the folders as a single-select `RadioGroup` named `folderGroupAriaLabel`, none preselected; confirm disabled until one is picked.

Selecting a folder issues no request. The selection is cleared on cancel, on close and after confirm. While the request runs, confirm and cancel stay rendered and disabled, Escape and outside click are blocked, and `loadingStatusLabel` is announced through the footer's polite live region.

The conversation panel SHALL render the same component with its existing `conversationUnpublish.*` strings, with no change to its behaviour (see `conversation-unpublish-flow`).

The project page passes:

| Slot | Key |
| --- | --- |
| `title` | `projects.unpublish.confirmTitle` — "Unpublish project?" |
| `confirmMessage` | `projects.unpublish.confirmMessage` — "Unpublish \"{{name}}\" from \"{{folder}}\"? The request is submitted for admin approval." |
| `selectFolderMessage` | `projects.unpublish.selectFolderMessage` — "Choose which folder to unpublish \"{{name}}\" from. The request is submitted for admin approval." |
| `folderGroupAriaLabel` | `projects.unpublish.folderGroupAriaLabel` — "Published folders" |
| `loadingStatusLabel` | `projects.unpublish.requestingStatus` — "Requesting unpublish…" |

#### Scenario: Single folder confirms directly

- **GIVEN** the project is published to one folder
- **THEN** the dialog names that folder and confirm is enabled

#### Scenario: Several folders require a choice

- **GIVEN** the project is published to two folders
- **THEN** both render as radio options, none selected, and confirm is disabled until one is chosen

#### Scenario: Cancelling issues no request

- **WHEN** the user presses Escape or Cancel
- **THEN** the dialog closes, no request is issued, and the selection is discarded

#### Scenario: Conversation dialog is unchanged

- **WHEN** a conversation's Unpublish is confirmed through the shared component
- **THEN** its title, messages, folder group and loading status are the existing `conversationUnpublish.*` strings

### Requirement: Project unpublish calls the BFF and reports a pending request

Confirming SHALL call `unpublishCatalogEntity(CatalogPublishEntityType.Project, project.id, { folderPath })` (`apps/chat/src/server-api/publish.api.ts`, the positional wrapper from `createPublishApiClient`), where `folderPath` is the selected folder (or the only one) joined with `/` — `''` for the public root, which SHALL be sent rather than treated as "no folder". No `version` is sent: a project is unversioned.

Example request (owner, one folder):

```http
POST /api/v1/catalog/project/projects%2F{bucket}%2FSales/unpublish
{ "folderPath": "Organization/Data" }
```

On success the dialog closes and exactly one notification is raised: `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.UnpublishRequested, { name, folder: getPublishFolderLabel(folderPath, t) })`, using new entries in `apps/chat/src/utils/entity-notification.ts`. The hook then calls its own `refreshPublishState()`; because a pending removal keeps the folder live, Unpublish stays until an administrator approves.

On failure the dialog closes and `usePublishErrorNotification` (`apps/chat/src/hooks/publish/usePublishErrorNotification.ts`) raises the error with `EntityOperation.UnpublishRequested`, reusing its status, message, trace-id and offline handling — including the BFF's 403 for a caller who is neither publisher nor administrator. No new error copy is introduced.

The project itself is not refreshed and the page does not navigate: nothing about the caller's project changed.

New `en.json` keys, with `EntityNotificationsI18nKeys` members:

| Key | Member | English |
| --- | --- | --- |
| `entityNotifications.project.unpublishRequestedTitle` | `ProjectUnpublishRequestedTitle` | Project unpublish requested |
| `entityNotifications.project.unpublishRequested` | `ProjectUnpublishRequested` | Unpublish request for project "{{name}}" was submitted for folder "{{folder}}". It will be removed once an admin approves it. |

#### Scenario: Confirming issues the request

- **WHEN** the owner confirms unpublish for a project published to `Organization/Data`
- **THEN** `unpublishCatalogEntity` is called with `Project`, the project id and `{ folderPath: 'Organization/Data' }`

#### Scenario: Root-folder publication is unpublished

- **GIVEN** the project is published at the public root
- **WHEN** the user confirms
- **THEN** the request is sent with `folderPath: ''`

#### Scenario: Success reports a pending request

- **WHEN** the request resolves
- **THEN** one "Project unpublish requested" notification is shown and the project view stays open

#### Scenario: Failure reuses the shared publish error notification

- **WHEN** the request rejects with 403
- **THEN** the shared publish error notification is shown and no success notification is raised

### Requirement: Strings, RTL, accessibility and gating for project unpublish

All app strings SHALL come from `t()` with keys declared in `apps/chat/src/constants/translation-keys.ts`; `ProjectsI18nKeys` gains `UnpublishConfirmTitle`, `UnpublishConfirmMessage`, `UnpublishSelectFolderMessage`, `UnpublishFolderGroupAriaLabel` and `UnpublishRequestingStatus` for the `projects.unpublish.*` keys above. `useProjectViewLabels` (`apps/chat/src/hooks/projects/useProjectViewLabels.ts`) fills `unpublishLabel` with `t(ButtonsI18nKeys.Unpublish)`. The lib keeps its English default and imports no i18n.

**RTL:** the new surfaces use logical utilities only; `IconWorldOff` is conceptual and SHALL NOT be mirrored. The dialog and radio group inherit `dir` from `<html>`.

**Accessibility:** the desktop Unpublish button is named by its visible label (no `aria-label`); the menu item is keyboard-operable through the kit `ActionMenu`; the radio group has an accessible name and arrow-key navigation; the in-flight state is announced politely.

**Gating:** the action lives on the project view page, so it inherits the `projectsEnabled` feature flag; no new `ENABLED_FEATURES` key is added. Authorization is enforced by the BFF (`PublishService.canUnpublish`); the UI gate only keeps an action the caller cannot complete out of the header.

**Observability:** no new telemetry; the BFF already logs refused and submitted unpublish requests.

#### Scenario: Arabic locale mirrors the dialog but not the icon

- **WHEN** the UI language is Arabic and the dialog is open
- **THEN** the dialog content and footer mirror, and `IconWorldOff` is not flipped

#### Scenario: Flag off hides the page

- **GIVEN** `projectsEnabled` is off
- **THEN** the project view page, and with it the Unpublish action, is not reachable

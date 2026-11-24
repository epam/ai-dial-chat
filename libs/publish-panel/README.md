# @epam/ai-dial-publish-panel

Publish-to-folder UI and state flow shared by catalog entity publish and conversation publish.

## Overview

`@epam/ai-dial-publish-panel` implements the "Publish to folder" experience used across AI DIAL Chat: a destination-folder picker with search and inline folder creation, a pinned submit/cancel footer, a standalone `PublishHistoryList`, and the `usePublishFlow` hook that manages folder selection, optimistic folder creation, and submit state. The library has no knowledge of any specific host domain model — it only knows `PublishFlowItem` (anything with an optional `version` and an optional `id`; the id keeps a taken-target answer from carrying over between items) and `PublishResourceSummary` (a title/icon/version-only display shape). A host that needs a richer entity-specific summary (e.g. an icon and type badge for a catalog entity) supplies it via the `renderSummary` render-slot instead of the library reaching into a host-specific type. This is what lets both `libs/catalog`'s `DetailsPanel` (versioned catalog entities: Applications, Toolsets, Models) and `apps/chat`'s conversation publish flow (unversioned conversations) share the exact same folder-picker and submit UX without either one depending on the other's domain models.

Use this library whenever a host application needs the "publish to a folder, optionally as a new version" UX; use the lower-level `PublishHistoryList` directly only when assembling a custom layout around them.

## Installation

Publishing UI includes the external file-manager folder tree. Hosts should load
the publishing panel lazily when it opens. Only CSS/SCSS imports are declared as
side effects, allowing unused publishing UI to be removed from eager consumers.

```json
{
  "dependencies": {
    "@epam/ai-dial-publish-panel": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-publish-panel/styles.css';
```

`@epam/ai-dial-catalog/styles.css` already includes these styles, so a host that renders the publish flow only through the catalog skips this import.

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-react-file-manager`

`@epam/ai-dial-chat-shared` is kept external by the library build — a
consumer's own bundler resolves it, so installing it is required rather than
optional.

## Components

### PublishPanel

Scrollable body of the Publish flow, in two views like the save panel. The main view (`PublishPanelView.Main`) shows the entity summary row, a destination row — the committed path as one truncating name, or `noFolderSelectedLabel`, with a Change/Choose button — then the callouts, author and credentials. The folder view (`PublishPanelView.ChangeFolder`) shows only the folder search and tree, bound to `pendingFolderPath`. The host owns the view switch, header and footer; `usePublishFolderView` holds that state. Switching views moves focus into the folder view and back to the Change button. It does not render publish history; use `PublishHistoryList` directly to show history in a custom layout.

```tsx
import {
  PublishPanel,
  usePublishFolderView,
} from '@epam/ai-dial-publish-panel';

const folderView = usePublishFolderView({
  isOpen,
  selectedFolderPath,
  onSelectedFolderPathChange: setSelectedFolderPath,
});

<PublishPanel
  view={folderView.view}
  onChangeFolderClick={folderView.openFolderView}
  resource={{ title: 'Q3 planning notes' }}
  folderItems={folderItems}
  selectedFolderPath={selectedFolderPath}
  pendingFolderPath={folderView.pendingFolderPath}
  onPendingFolderPathChange={folderView.setPendingFolderPath}
  onCreateFolder={handleCreateFolder}
  hasExistingPublicationInFolder={false}
  hasWriteAccess
  isSubmitting={false}
  author={author}
  onAuthorChange={setAuthor}
/>;
```

`author` is the publication's display author, rendered as a text field after
the destination row. It is a controlled value: pass `usePublishFlow`'s `author`/`setAuthor` straight through. An
empty author is a valid state and never blocks submission — the host decides
what an unset author means (both AI DIAL Chat hosts omit the field from the
publish request so the backend falls back to the session's own display name).
The library resolves nothing about the signed-in user itself; the prefill
arrives through `usePublishFlow`'s `defaultAuthor`.

Override its copy through `labels.authorLabel`, `labels.authorPlaceholder`, and
`labels.authorHint`.

When a folder is selected, the user can publish to it and the version is not
already there, the panel shows an info callout under the destination row saying
the publication needs an administrator's approval. Its copy is
`labels.adminApprovalTitle` (default `'Admin approval required'`) and
`labels.adminApprovalMessage`; the default message says "it will appear in the
folder", so a host replaces it to name the entity being published. The replace,
no-access, submit-error and target-taken callouts take its place when they apply.

`isTargetTaken` and `isTargetChecking` (both default `false`) let the host say
that another resource already holds the published path in the selected folder.
While `isTargetChecking` is `true` the panel disables Publish and shows no
callout. When `isTargetTaken` is `true` it shows a warning callout under the
destination row, with the folder name in bold, and keeps Publish disabled, whatever
`allowReplace` says. The text is `labels.targetTakenVersionedLabel` when
`resource.version` is a non-empty string (`{version}` and `{folder}` are replaced; default
`'Version {version} of a resource with this name already exists in {folder}. Rename it, change its version or choose another folder.'`)
and `labels.targetTakenLabel` otherwise (`{folder}` is replaced; default
`'A resource with this name already exists in {folder}. Rename it or choose another folder.'`).
Precedence among the callouts: no access, then the check in flight, then submit error,
then the item's own publication in the folder, then a taken target, then the info callout.
Pass `usePublishFlow`'s `isTargetTaken` and `isTargetChecking` straight through.

Typography comes from four class props: `summaryTitleClassName` and
`headingClassName` (both `'dial-body-semi-text'`), `destinationClassName`
(`'dial-small-semi-text'`) for the destination path, and
`calloutFolderNameClassName` (`'dial-small-paragraph-semi-text'`) for the folder
name emphasised in the replace-warning, target-taken and no-access callouts.
`StandalonePublishPanel` forwards them as `panelSummaryTitleClassName`,
`panelHeadingClassName` and `panelCalloutFolderNameClassName`.

#### Credentials opt-in

Supply `onPublishCredentialsChange` to render an opt-in checkbox below the
author field, asking whether the publication should carry the publisher's own
credentials for the resource. Supplying the handler is what renders the
control at all — omit it and the panel is exactly what it was before, which is
what the conversation publish flow does. The value is controlled: pass
`usePublishFlow`'s `publishCredentials`/`setPublishCredentials` straight
through. The checkbox is disabled while `isSubmitting` is `true`.

```tsx
<PublishPanel
  resource={{ title: item.name, version: item.version }}
  onChangeFolderClick={openFolderView}
  folderItems={folderItems}
  onPendingFolderPathChange={setPendingFolderPath}
  onCreateFolder={handleCreateFolder}
  hasExistingPublicationInFolder={false}
  hasWriteAccess
  isSubmitting={false}
  author={author}
  onAuthorChange={setAuthor}
  publishCredentials={publishCredentials}
  onPublishCredentialsChange={setPublishCredentials}
  labels={{
    credentialsLabel: t('catalog.publish.credentialsLabel'),
    credentialsHint: t('catalog.publish.credentialsHint'),
  }}
/>
```

The library knows nothing about what the flag means to any backend: deciding
whether to offer the control, and all of its copy, belong to the host.
`labels.credentialsHint` is rendered as the checkbox's accessible description
by the kit, so it must state what ticking the box does rather than restate the
label.

Add `type` (and optionally `iconUrl`) to `resource` to get the richer entity
summary row — icon, type label, and the name followed by its version — rendered
by `ResourceSummary` from `@epam/ai-dial-chat-shared`. `libs/catalog`'s
`DetailsPanel` uses this for versioned catalog entities:

```tsx
<PublishPanel
  resource={{
    title: item.name,
    version: item.version,
    type: item.type,
    iconUrl: item.iconUrl,
  }}
  {...rest}
/>
```

For any other custom summary, pass `renderSummary={() => <CustomHeader />}`; it
replaces the default title-only row and is ignored once `resource.type` is set.

### StandalonePublishPanel

Standalone end-edge slide-in shell for the Publish flow: backdrop, header with Close, the `PublishPanel` body, and a pinned `PublishFooter`. It drives the drill-in itself through `usePublishFolderView`: Change opens the folder view titled `labels.changeFolderTitle` with a Back button, the footer turns into Cancel and Select, and only Select calls `onSelectedFolderPathChange`. The shell is the UI kit's `SideDrawer`, so focus is kept inside while it is open and Escape or a backdrop press closes it; `returnFocusRef` still decides where focus lands afterwards, and `colors` themes the backdrop, panel, divider, scrollbar and title.

While open it behaves as a modal dialog: it takes focus on mount, cycles Tab and Shift+Tab within itself, closes on Escape, and returns focus to `returnFocusRef` on close. Tab is left alone while focus sits outside the panel, so the folder-row menus it renders through portals stay keyboard-operable. While closed it is `inert`, so nothing inside it is reachable.

```tsx
import { StandalonePublishPanel } from '@epam/ai-dial-publish-panel';

<StandalonePublishPanel
  isOpen={isOpen}
  resource={resource}
  folderItems={folderItems}
  selectedFolderPath={selectedFolderPath}
  onSelectedFolderPathChange={setSelectedFolderPath}
  onCreateFolder={handleCreateFolder}
  hasExistingPublicationInFolder={false}
  hasWriteAccess
  isSubmitting={false}
  author={author}
  onAuthorChange={setAuthor}
  onClose={handleClose}
  onSubmit={handleSubmit}
/>;
```

### PublishFooter

Pinned action row with Cancel and Publish/Update buttons; with `view={PublishPanelView.ChangeFolder}` it renders Cancel and Select (`onSelectFolder`, `isSelectFolderDisabled`, `labels.selectFolderLabel`) instead. The submit button reads `Update version {version}` when `hasExistingPublicationInFolder` is true, unless `allowReplace` is `false` — pass the same `allowReplace` the panel gets when the backend cannot overwrite an existing publication.

```tsx
import { PublishFooter } from '@epam/ai-dial-publish-panel';

<PublishFooter
  hasExistingPublicationInFolder={false}
  isSubmitDisabled={false}
  isSubmitLoading={false}
  onCancel={handleCancel}
  onSubmit={handleSubmit}
/>;
```

### Folder tree

The destination folder tree, with search, lazy expansion and inline folder creation, is the file manager's `FolderDestinationTree` (`@epam/ai-dial-react-file-manager`). `PublishPanel` and `StandaloneSaveToFolderPanel` render it through `FolderDestinationPanelBody`, and this library no longer exports its own tree. A host that needs the tree on its own imports it from the file manager; `getDisabledReason(destination)` on both panels is forwarded to it (`rootKey` is `''` for `PublishPanel`, whose one root has an empty key, and `path: []` is the root itself).

### StandaloneSaveToFolderPanel

The "save to a folder, optionally as a new version" flow. `StandaloneSaveToFolderPanel` adapts the file manager's `FolderDestinationPanel` (`@epam/ai-dial-react-file-manager`), an end-edge side panel, to this flow: it supplies the summary, the version choice, the dependency notes and the history, and the package supplies the drawer, the destination row, the folder search and tree, and the Cancel / Save / Select footer. It has two views:

- **Main** — when `getDisabledReason` returns a reason for the committed destination, that reason is shown as an error under the destination (the host also disables Save); the entity summary (the entity header when `resource.type` is set, the title otherwise), the committed destination as a folder name with the file manager's folder icon (`FolderName`, the path joined with `/`) and a small **Change** action, an optional version choice, and a Cancel / Save footer.
- **Change folder** — a back button, folder search and the multi-root folder tree, with a Cancel / Select footer. A destination picked here is pending until Select commits it through `onDestinationChange`; Back and Cancel discard it.

The version section renders only when `version` (`SaveToFolderVersionProps`) is passed: a `RadioGroup` of "Keep version {version}" and "Save as new version", the latter revealing a required version input whose error the host supplies as `newVersionError`. Pass no `version` for an unversioned resource. `submitError` is announced through an assertive `LiveRegion`; `foldersError` shows above the tree with a Retry action when `onRetryFolders` is given. Every control is disabled while `isSubmitting`.

`StandaloneSaveToFolderPanel` also renders `PublishDependenciesList` as the last section but one of the main view (above the versions history) when the host passes `dependencies` (`PublishDependency[]`); they take its copy and colors as `dependenciesLabels` (`PublishDependenciesLabels`) and `dependenciesStyles` (`PublishDependenciesStyles`). The list is informational: it never changes what Save does, it renders nothing while empty or omitted, and the panel does not decide when it applies, so the host passes it only for the destinations that need it. When the list is empty or omitted, `dependenciesNote` renders one plain sentence under the section's heading (`dependenciesLabels.title`); the list wins when it has rows. `destinationNote` renders a plain notice under the destination path. Neither note is a live region, neither changes what Save does, and the host decides when each applies; both take `noteClassName` (default `'dial-small-text'`) and `panelStyles.colors.noteText` (falling back to `--text-secondary`).

The drawer is named by `labels.title` in both views; switching views moves focus to the new view's heading, and leaving the folder view returns it to Change. The panel never decides what a destination means — saving, moving and publishing are the host's.

```tsx
import {
  SaveVersionMode,
  StandaloneSaveToFolderPanel,
} from '@epam/ai-dial-publish-panel';

<StandaloneSaveToFolderPanel
  isOpen={isOpen}
  onClose={close}
  onSubmit={save}
  isSubmitDisabled={Boolean(versionError)}
  resource={{ title: 'Design Review Agent', version: '1.0.0' }}
  roots={roots}
  destination={destination}
  onDestinationChange={setDestination}
  onCreateFolder={handleCreateFolder}
  version={{
    versionMode,
    onVersionModeChange: setVersionMode,
    currentVersion: '1.0.0',
    newVersion,
    onNewVersionChange: setNewVersion,
    newVersionError: versionError,
  }}
  labels={{ title: 'Save QuickApp' }}
/>;
```

Copy comes from `labels` (`StandaloneSaveToFolderPanelLabels`: `title`, `changeFolderTitle`, `closeAriaLabel`, `backAriaLabel`, `cancelLabel`, `saveLabel`, `savingLabel`, `selectLabel`) and `panelLabels` (`SaveToFolderPanelLabels`), each with an English default. The drawer, summary row, destination row and tree are themed by the file manager's theme tokens, so the panel takes no shell colors; `panelStyles.colors` (`SaveToFolderPanelColors`) has `headingText` (section headings, default `--text-primary`) and `noteText` (the notes it adds), and `panelStyles.folderTree` forwards style overrides to the tree. `titleClassName` and `headingClassName` default to `'dial-body-semi-text'`, and `destinationClassName` (the destination path) to `'dial-small-semi-text'`. `SaveVersionMode` (`Keep`, `New`) is exported.

`onPendingDestinationChange` receives the folder view's pending destination whenever it changes, including the reset to `destination` when the folder view opens or closes; hosts use it to react to a folder before it is committed. `panelLabels.createFolderHiddenNameWarning` is the non-blocking notice for a new folder name that starts with a dot. When `onCreateFolder` rejects, the panel announces `panelLabels.createFolderFailedMessage` (default `'Failed to create the folder. Please try again.'`) through its assertive error slot unless the host's `submitError` is set, does not select the new folder, clears the message on the next creation attempt or folder pick, and calls the optional `onCreateFolderError(error)`.

### PublishHistoryList

Read-only list of previously published versions for the currently selected destination folder.

```tsx
import { PublishHistoryList } from '@epam/ai-dial-publish-panel';

<PublishHistoryList entries={folderHistory} currentVersion={currentVersion} />;
```

An entry whose `publishCredentials` is `true` is marked with a text label,
overridable through `sharedCredentialsLabel` (default
`'Shared credentials'`). The marker reports what that publication
_requested_ — the library never claims the credential was applied, and never
displays or accepts a credential value.

```tsx
<PublishHistoryList
  entries={folderHistory}
  currentVersion={currentVersion}
  sharedCredentialsLabel="Shared credentials"
/>
```

### PublishDependenciesList

Read-only list of the resources the item being published refers to that are not in the public bucket, so the publisher can publish those too. `PublishPanel` and `StandalonePublishPanel` render it as the last section of the main view when you pass `dependencies`; it renders nothing visible while the list is empty, and the hidden live region it keeps mounted announces the count when the list appears later.

```tsx
import {
  PublishDependencyType,
  StandalonePublishPanel,
  type PublishDependency,
} from '@epam/ai-dial-publish-panel';

const dependencies: PublishDependency[] = [
  {
    id: 'prompts/my-bucket/Support/Greeting',
    name: 'Greeting',
    type: PublishDependencyType.Prompt,
    location: 'Support',
  },
  {
    id: 'toolsets/my-bucket/Search__1.0.0',
    name: 'Search',
    version: '1.0.0',
    type: PublishDependencyType.Toolset,
    location: '',
  },
];

<StandalonePublishPanel
  {...publishPanelProps}
  dependencies={dependencies}
  labels={{ dependenciesLabels: { title: 'Private dependencies' } }}
/>;
```

The list is informational: rows are not interactive, and it never changes what the submit button does. The library receives the list as data and knows nothing of how it was found. A `PublishDependency` is `{ id, name, version?, type, location, iconUrl?, isFolder? }`, with `type` a `PublishDependencyType` (`Application`, `Toolset`, `Prompt`, `Skill`, `File`), shown as text next to the folder. `iconUrl` is the already-resolved icon of the entity: an application, toolset, prompt or skill shows it in `DeploymentIcon`, or the initials of its name when there is none, and a `File` shows the UI kit's `FileIcon`, whose glyph is picked from the extension in `name` (the folder glyph when `isFolder` is `true`). `location` is the folder path inside the owner's bucket, empty at the bucket root.

Copy comes from `PublishPanelLabels.dependenciesLabels` (`PublishDependenciesLabels`): `title` (default `'Private dependencies'`), `description` (the host names the published entity in it, such as application or conversation; the default says "this item"), `appearance` (a `PublishDependenciesAppearance`: `Warning`, the default, with a warning notification and compact rows, or `Published`, for a host that publishes the listed dependencies together with the item and says so in `title` and `description`: a plain caption instead of the notification and rows with a 40px icon next to the type label over the name; the library does not know why a host picks one), `typeLabels` (default `'Application'`, `'Toolset'`, `'Prompt'`, `'Skill'`, `'File'`) and `getAnnouncement(count)`, the screen-reader text for the count, so a host can pluralise it in its own language. Colors come from `PublishPanelStyles.dependencies.colors` (`PublishDependenciesColors`: `headingText`, `nameText`, `metaText`, falling back to `--text-primary` and `--text-secondary`, and for `Published` also `captionText` falling back to `--text-secondary`, `typeText` falling back to `--text-accent-tertiary` and `divider` falling back to `--stroke-tertiary`). `PublishDependenciesList` can also be used on its own; it then takes `labels`, `styles`, and the typography classes `headingClassName` (default `'dial-body-semi-text'`), `nameClassName` (default `'dial-small-semi-text'`, or `'dial-body-semi-text'` for `Published`), `metaClassName` (default `'dial-small-text'`), and for `Published` `captionClassName` (default `'dial-tiny-text'`) and `typeClassName` (default `'dial-tiny-lead-semi-text'`, which also upper-cases the label).

### VersionHistorySection

Read-only list of the other saved versions of an application or toolset (the version being edited or published is not listed), shown as the last section of `StandaloneSaveToFolderPanel` and `PublishPanel` (and so of `StandalonePublishPanel`) when the host passes the `versionHistory` prop. Without it neither panel renders the section. Rows carry no action and the section adds no version input: publishing still uses the saved version.

```tsx
import {
  VersionHistoryStatus,
  type VersionHistorySectionProps,
} from '@epam/ai-dial-publish-panel';

const versionHistory: VersionHistorySectionProps = {
  rows: [
    {
      id: 'applications/b1/Design/Review__beta-2',
      version: 'beta-2',
      status: VersionHistoryStatus.NotPublished,
      folder: 'Personal / Design',
      modifiedAt: '20 Jul 2026',
      author: 'by Ivan Petrov',
    },
    {
      id: 'applications/b1/Design/Review__1.0.0',
      version: '1.0.0',
      status: VersionHistoryStatus.Published,
      folder: 'Personal / Design',
      modifiedAt: '12 Jul 2026',
      author: 'Published by Jane Doe',
    },
  ],
  isLoading: false,
  hasError: false,
  onRetry: reloadStatuses,
};

<PublishPanel {...publishProps} versionHistory={versionHistory} />;
```

The library renders the rows it is given, in the given order; the host sorts them (the hook `useVersionHistory` from `@epam/ai-dial-chat-hooks` sorts by last modified time, newest first) and formats the folder, date and author text. Each row has the version and, for a published or in-review version, the status badge on the first line (a not published version has no badge, and the line keeps the badge height so rows do not change height when statuses load) with the date at the far end; the folder (with the kit folder icon) and the author on the second line. A row's `status` is left out while it loads; `VersionHistoryStatus.Unknown` (a version the user does not own) reads as "Status unavailable", never as Not published. `isLoading` draws a placeholder in the status slot of every row whose status has not loaded, so the layout does not shift when the badge arrives, and announces `loadingLabel` to screen readers without showing it; `hasError` shows the error message while the rows stay visible; `onRetry` backs the Retry link. The loading and error messages sit in live regions that are always mounted, so a change after the first render is announced (the error, and the loading message when `isLoading` turns on later); a section that mounts with `isLoading` already `true` announces the loading text one commit after it mounts, so the region exists before its text. With no rows the section shows its own empty message; a host that has nothing to show yet should leave `versionHistory` out instead.

Copy comes from `labels` (`VersionHistoryLabels`): `heading` (default `'Versions history'`), `inReviewLabel` (`'In review'`), `publishedLabel` (`'Published'`, the badge), `unknownLabel` (`'Status unavailable'`), `loadingLabel`, `emptyLabel` (`'No saved versions yet.'`), `errorLabel` and `retryLabel` (`'Retry'`). Colors come from `styles.colors` (`VersionHistoryColors`: `headingText`, `versionText` and `dateText` falling back to `--text-primary`; `metaText` falling back to `--text-secondary`; `skeleton` falling back to `--bg-control-disable-primary`; `rowBorder` falling back to `--stroke-tertiary`). Typography comes from `headingClassName` (default `'dial-body-semi-text'`, or the panel's own heading class), `versionClassName` (default `'dial-small-semi-text'`), `dateClassName` (default `'dial-small-text'`) and `metaClassName` (default `'dial-tiny-text'`). `VersionHistorySection` can also be used on its own.

### UnpublishConfirmationDialog

Confirms an unpublish request. One published folder is confirmed directly. When there are several folders, the user must pick one in a radio group before Unpublish is enabled. While `isLoading`, both buttons stay rendered and disabled, and the footer announces `loadingStatusLabel`.

```tsx
import { UnpublishConfirmationDialog } from '@epam/ai-dial-publish-panel';

<UnpublishConfirmationDialog
  isOpen={isOpen}
  name="Sales report"
  folders={['Team/Reports', '']}
  selectedFolder={selectedFolder}
  onSelectedFolderChange={setSelectedFolder}
  isLoading={isUnpublishing}
  labels={{ title: 'Unpublish project?' }}
  onConfirm={handleConfirm}
  onClose={handleClose}
/>;
```

`folders` are `/`-joined paths. A folder is shown by its last segment, and the public root (`''`) by `labels.rootFolderLabel`.

Copy comes from `labels` (`UnpublishConfirmationDialogLabels`). Each field has an English default:

- `title`: `'Unpublish?'`
- `confirmLabel`: `'Unpublish'`
- `cancelLabel`: `'Cancel'`
- `rootFolderLabel`: `'Organization'`
- `folderGroupAriaLabel`: `'Published folders'`
- `loadingStatusLabel`: `'Requesting unpublish…'`
- `confirmMessage(name, folder)`: `Unpublish "{name}" from "{folder}"?`
- `selectFolderMessage(name)`: `Choose which folder to unpublish "{name}" from.`

Folder options use the typography class `optionClassName` (default `'dial-small-text'`). Their text color is `colors.optionText` (`UnpublishConfirmationDialogColors`, falling back to `--text-primary`).

## Hooks

### usePublishFlow

Manages all state for the Publish flow: folder selection, optimistic local folder creation with rollback, existing-publication detection, the display author, and submit handling.

```tsx
import { usePublishFlow } from '@epam/ai-dial-publish-panel';

const publishFlow = usePublishFlow({
  item,
  history,
  folderItems,
  defaultAuthor: currentUserDisplayName,
  onPublish: async (item, folderPath, author, publishCredentials) => {
    /* ... */
  },
  onPublishSuccess: (item, folderPath, isDirectWrite) => {
    /* host-owned success notification; `isDirectWrite` is `true` after `onPublishDirectly` */
  },
  onPublishError: (item, folderPath, error) => {
    /* host-owned error notification; the hook only sets `hasSubmitError` */
  },
});
```

`defaultAuthor` seeds the returned `author` and is what `reset()` restores.
The library holds no notion of a session, so the host resolves the signed-in
user's display name and passes it here. It may resolve after the first render:
while the user has not edited the field, a later `defaultAuthor` replaces the
current value; once `setAuthor` has been called, it no longer does.
`handleSubmit` forwards the trimmed `author` to `onPublish` as its third
argument.

The hook also owns `publishCredentials` (a `boolean`) and
`setPublishCredentials`, forwarded to `onPublish` as its fourth argument. It
starts `false`, `reset()` restores it to `false`, and it is never pre-filled
from history or the selected folder — a folder whose previous publication
carried shared credentials still opens with the option cleared. A host
callback declaring only the first three parameters stays assignable. Earlier releases passed access rules as the third argument and
rendered an access-rules section; both were removed, so a host callback that
still declares a `rules` parameter must drop it.

`onCheckTargetExists(item, folderPath)` is an optional callback resolving to
`true` when another resource already holds the published path of `item` in
`folderPath`. The hook calls it when the selected folder changes to a defined
folder and when `item.version` changes while one is selected, and exposes the
answer as `isTargetTaken` and the request's state as `isTargetChecking`. It does
not call it for a folder created in this session (or one beneath it), nor for a
folder whose publish history already holds the item, and it discards an answer
that arrives after the folder or version changed again. A rejected callback
leaves `isTargetTaken` and `isTargetChecking` `false` and sets no submit error:
the host's backend refusing on submit is the safety net. The hook knows nothing of
how the path is derived or checked; that stays with the host.

`isTargetTakenError(error)` is an optional synchronous predicate over the
rejection of `onPublish`. When it returns `true` the hook marks the selected
folder's target as taken (`isTargetTaken`) instead of setting `hasSubmitError`,
so the panel shows the target-taken callout; `onPublishError` is still called.
`reset()` clears both.

```tsx
const publishFlow = usePublishFlow({
  /* ... */
  onCheckTargetExists: (item, folderPath) => checkTarget(item, folderPath),
  isTargetTakenError: (error) => error instanceof TargetTakenError,
});

<StandalonePublishPanel
  /* ... */
  isTargetTaken={publishFlow.isTargetTaken}
  isTargetChecking={publishFlow.isTargetChecking}
/>;
```

#### Direct write

`canPublishDirectlyTo(folderPath)` and `onPublishDirectly(item, folderPath)` are
two optional options that let a host write the item straight into a folder
instead of filing a request. `usePublishFlow` returns `isDirectWrite`: `true`
when a folder is selected, both options are supplied and the predicate holds for
it. While it is `true`, `handleSubmit` calls `onPublishDirectly` instead of
`onPublish`, with the same `onPublishSuccess`, `onPublishError`,
`isTargetTakenError` and `hasSubmitError` handling, and sends no author or
credentials. For a direct folder the hook also reports `hasExistingPublicationInFolder` as `false` (a direct write leaves no
history), and clears the credentials choice on entering it. A host that supplies
neither option sees no change. The library learns nothing about endpoints, rights
data or namespaces: both arrive from the host.

Pass the flow's `isDirectWrite` to `PublishPanel`. For `true` the panel renders
no author field or credentials checkbox, drops the
admin-approval callout and shows `labels.directWriteNote` (a plain line, nothing
when the host supplies none) in the credentials checkbox's place.
`directUnavailableNote` is a finished host sentence rendered as an information
callout when a request is filed although the host would otherwise write directly.
`styles.colors.directNoteText` (default `--text-secondary`) and
`directNoteClassName` (default `'dial-small-text'`) restyle the note.

```tsx
const publishFlow = usePublishFlow({
  /* ... */
  canPublishDirectlyTo: (folderPath) => isApprover(folderPath),
  onPublishDirectly: (item, folderPath) => saveIntoFolder(item, folderPath),
});

<PublishPanel
  /* ... */
  isDirectWrite={publishFlow.isDirectWrite}
  directUnavailableNote={note}
  labels={{ directWriteNote: 'Credentials are not shared by a direct save.' }}
/>;
```

### usePublishFolderView

Holds the publish panel's main/folder view switch and the folder picked in the folder view before Select commits it. Every opening (`isOpen` turning `true`) starts on the main view, and `backToMain` discards the pending folder.

```tsx
import { usePublishFolderView } from '@epam/ai-dial-publish-panel';

const {
  view,
  pendingFolderPath,
  setPendingFolderPath,
  openFolderView,
  backToMain,
  selectFolder,
} = usePublishFolderView({
  isOpen,
  selectedFolderPath: publishFlow.selectedFolderPath,
  onSelectedFolderPathChange: publishFlow.setSelectedFolderPath,
});
```

## Enums

### PublishDependenciesAppearance

`Warning` (default) and `Published`: how the dependencies section is presented, a warning notification with compact rows or a plain caption with larger rows for a host that publishes the dependencies with the item. Set through `PublishDependenciesLabels.appearance`.

### PublishDependencyType

`Application`, `Toolset`, `Prompt`, `Skill` and `File`: the kind of a `PublishDependency`, which picks its default type label.

### PublishCalloutKind

`None`, `Info`, `ReplaceWarning`, `TargetTaken`, `NoAccess` and `SubmitError`: the callout `derivePublishState` picks for the panel. `TargetTaken` means another resource already holds the published path in the selected folder.

### PublishPanelView

`Main` (summary, destination row, author and credentials) and `ChangeFolder` (folder search and tree).

## Utilities

```tsx
import {
  derivePublishState,
  formatPublishedDate,
  filterFolderTree,
  sortFolderTree,
  mergeFolderPaths,
  collectFolderKeys,
  toFolderPathKey,
  fromFolderPathKey,
  toDialFileTree,
  validateFolderName,
  getUniqueFolderName,
  getSiblingFolderNames,
} from '@epam/ai-dial-publish-panel';
```

## Building

```sh
npm exec nx build publish-panel
```

## Testing

```sh
npm exec nx test publish-panel
```

## Rollback

`publish-panel` is published by `tools/publish-lib.mjs`, which reads the version from this
package's `package.json` and writes it into `dist/package.json` before `npm publish`. To roll a
consuming host back to a previous `@epam/ai-dial-publish-panel` release:

1. Pin the host's dependency back to the previous version (e.g.
   `"@epam/ai-dial-publish-panel": "1.1.0-dev.410"` instead of `"1.1.0-dev.412"`).
2. `publish-panel` declares `@epam/ai-dial-chat-shared` as a peer and `@epam/ai-dial-catalog`
   depends on `publish-panel` in turn — both are published from the same repository revision;
   revert every package from this change's release set to its own matching previous version in
   the same host update, rather than leaving a newer sibling installed against an older
   `publish-panel` (or vice versa).
3. Reinstall (`npm install`) so the host's lockfile records every reverted package's previous
   resolved version and integrity hash, rather than a partial mix of pre- and post-change
   versions.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key                | Class                                  | Element                                                |
| ------------------ | -------------------------------------- | ------------------------------------------------------ |
| `panel`            | `dial-publish-panel-panel`             | The panel body, which carries the themed CSS variables |
| `dependencies`     | `dial-publish-panel-dependencies`      | The private-dependencies section                       |
| `dependenciesList` | `dial-publish-panel-dependencies-list` | The list inside the private-dependencies section       |
| `dependenciesItem` | `dial-publish-panel-dependencies-item` | One row of the private-dependencies list               |

```tsx
import { PUBLISH_PANEL_CLASS } from '@epam/ai-dial-publish-panel';

PUBLISH_PANEL_CLASS.panel; // 'dial-publish-panel-panel'
PUBLISH_PANEL_CLASS.dependencies; // 'dial-publish-panel-dependencies'
```

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.

## Tablet drawer sizing

StandalonePublishPanel preserves SideDrawer's modal focus, scroll lock and close behavior. At 768-1279px it uses a 540px preferred width capped to the available inline width minus 32px. Phone and desktop presentation, form state and host callbacks are unchanged.

# @epam/ai-dial-publish-panel

Publish-to-folder UI and state flow shared by catalog entity publish and conversation publish.

## Overview

`@epam/ai-dial-publish-panel` implements the "Publish to folder" experience used across AI DIAL Chat: a destination-folder picker with search and inline folder creation, a pinned submit/cancel footer, a standalone `PublishHistoryList`, and the `usePublishFlow` hook that manages folder selection, optimistic folder creation, and submit state. The library has no knowledge of any specific host domain model — it only knows `PublishFlowItem` (anything with an optional `version`) and `PublishResourceSummary` (a title/icon/version-only display shape). A host that needs a richer entity-specific summary (e.g. an icon and type badge for a catalog entity) supplies it via the `renderSummary` render-slot instead of the library reaching into a host-specific type. This is what lets both `libs/catalog`'s `DetailsPanel` (versioned catalog entities: Applications, Toolsets, Models) and `apps/chat`'s conversation publish flow (unversioned conversations) share the exact same folder-picker and submit UX without either one depending on the other's domain models.

Use this library whenever a host application needs the "publish to a folder, optionally as a new version" UX; use the lower-level `PublishFoldersTree`/`PublishHistoryList` directly only when assembling a custom layout around them.

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

Scrollable body of the Publish flow, in two views like the save panel. The main view (`PublishPanelView.Main`) shows the entity summary row, a destination row — the committed path as one truncating name, or `noFolderSelectedLabel`, with a Change/Choose button — then the callouts, author, credentials and access rules. The folder view (`PublishPanelView.ChangeFolder`) shows only the folder search and tree, bound to `pendingFolderPath`. The host owns the view switch, header and footer; `usePublishFolderView` holds that state. Switching views moves focus into the folder view and back to the Change button. It does not render publish history; use `PublishHistoryList` directly to show history in a custom layout.

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
  rules={rules}
  onRulesChange={setRules}
  ruleSourceOptions={['title', 'roles', 'dial_roles']}
/>;
```

`author` is the publication's display author, rendered as a text field between
the destination row and the access-rules section. It is a controlled value like
`rules`: pass `usePublishFlow`'s `author`/`setAuthor` straight through. An
empty author is a valid state and never blocks submission — the host decides
what an unset author means (both AI DIAL Chat hosts omit the field from the
publish request so the backend falls back to the session's own display name).
The library resolves nothing about the signed-in user itself; the prefill
arrives through `usePublishFlow`'s `defaultAuthor`.

Override its copy through `labels.authorLabel`, `labels.authorPlaceholder`, and
`labels.authorHint`.

Typography comes from four class props: `summaryTitleClassName` and
`headingClassName` (both `'dial-body-semi-text'`), `destinationClassName`
(`'dial-small-semi-text'`) for the destination path, and
`calloutFolderNameClassName` (`'dial-small-paragraph-semi-text'`) for the folder
name emphasised in the replace-warning and no-access callouts.
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
  rules={rules}
  onRulesChange={setRules}
  ruleSourceOptions={['title', 'roles', 'dial_roles']}
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

While open it behaves as a modal dialog: it takes focus on mount, cycles Tab and Shift+Tab within itself, closes on Escape, and returns focus to `returnFocusRef` on close. Tab is left alone while focus sits outside the panel, so the folder-row menus and the rule source picker it renders through portals stay keyboard-operable. While closed it is `inert`, so nothing inside it is reachable.

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
  rules={rules}
  onRulesChange={setRules}
  ruleSourceOptions={['title', 'roles', 'dial_roles']}
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

### PublishAccessRules

Access-rules section of the Publish flow: one removable chip per rule, an "Add rule" trigger opening `PublishAccessRuleEditor`, and a "Clear all" control shown only when rules exist. Pass `folderName` so the section states which destination folder the rules apply to; leave it `undefined` while no folder is selected and the section prompts the user to pick one instead, warning when rules already exist without a destination.

```tsx
import { PublishAccessRules } from '@epam/ai-dial-publish-panel';

<PublishAccessRules
  rules={rules}
  onRulesChange={setRules}
  sourceOptions={['title', 'roles', 'dial_roles']}
  folderName={selectedFolderName}
/>;
```

### PublishFoldersTree

Destination folder tree with search, lazy expansion, and inline folder creation (trailing button and per-row context menu). Folders are displayed in name order at every level, and filtering is suspended while the inline create row is open so creating a folder from a search that matched nothing works (the unmatched query becomes the pre-filled name). Creating a folder under a parent listed in `loadingPaths` (as "Add child" on a collapsed folder makes it) opens the inline editor only once that parent leaves `loadingPaths`, so the name is checked against the children that actually exist; `loadingPaths` must therefore use the same `/`-joined keys as the folder paths. A new folder may not take its parent folder's name (case-insensitive) — the editor shows `sameAsParentFolderNameError` (`createFolderSameAsParentNameError` on `PublishPanel` / `SaveToFolderPanel`), and the default name skips it; a folder directly under a root may share the root's label.

```tsx
import { PublishFoldersTree } from '@epam/ai-dial-publish-panel';

<PublishFoldersTree
  items={folderItems}
  selectedPath={selectedPath}
  onSelectedPathChange={setSelectedPath}
  onCreateFolder={handleCreateFolder}
  searchQuery={searchQuery}
/>;
```

#### Multi-root mode

Pass `roots` (a list of `FolderDestinationRoot`: `key`, `label`, `items`, and optional `canCreateFolders`, `expandedPaths`, `onExpandedPathsChange`, `loadingPaths`) to render one always-expanded top-level node per root, in the given order, instead of the single `rootLabel` root. Selection then travels as a `FolderDestination` (`{ rootKey, path }`, where `path: []` is the root itself) through `destination` / `onDestinationChange`, and a confirmed new folder reaches `onCreateDestinationFolder(rootKey, parentPath, name)`. Folders are name-ordered inside each root, search filters every root, a new name is validated against its siblings in the same root, and a root with `canCreateFolders: false` offers no create actions. `items`, `selectedPath`, `onSelectedPathChange`, `onCreateFolder`, `rootLabel`, `expandedPaths` and `loadingPaths` are ignored in this mode — each root carries its own.

```tsx
import {
  PublishFoldersTree,
  type FolderDestination,
} from '@epam/ai-dial-publish-panel';

<PublishFoldersTree
  roots={[
    {
      key: 'personal',
      label: 'Personal',
      items: personal.folderItems,
      expandedPaths: personal.expandedPaths,
      onExpandedPathsChange: personal.onExpandedPathsChange,
      loadingPaths: personal.loadingPaths,
    },
    { key: 'organization', label: 'Organization', items: organizationItems },
  ]}
  destination={destination}
  onDestinationChange={setDestination}
  onCreateDestinationFolder={handleCreateFolder}
  searchQuery={searchQuery}
/>;
```

### SaveToFolderPanel / StandaloneSaveToFolderPanel

The "save to a folder, optionally as a new version" flow. `StandaloneSaveToFolderPanel` is an end-edge `SideDrawer` with two views:

- **Main** — the entity summary (`ResourceSummary`), the committed destination as a folder name with the file manager's folder icon (`FolderName`, the path joined with `/`) and a small **Change** action, an optional version choice, and a Cancel / Save footer.
- **Change folder** — a back button, folder search and the multi-root `PublishFoldersTree`, with a Cancel / Select footer. A destination picked here is pending until Select commits it through `onDestinationChange`; Back and Cancel discard it. While a folder of a root with `hasAccessRules` is pending and `accessRules` (`SaveToFolderAccessRulesProps`) is passed, `PublishAccessRules` renders below the tree for that folder; `onPendingDestinationChange` tells the host which folder is pending — including the reset to `destination` on entering and leaving the view — so it can load that folder's existing rules.

The version section renders only when `version` (`SaveToFolderVersionProps`) is passed: a `RadioGroup` of "Keep version {version}" and "Save as new version", the latter revealing a required version input whose error the host supplies as `newVersionError`. Pass no `version` for an unversioned resource. `submitError` is announced through an assertive `LiveRegion`; `foldersError` shows above the tree with a Retry action when `onRetryFolders` is given. Every control is disabled while `isSubmitting`.

The drawer is named by `labels.title` in both views; switching views moves focus to the new view's heading, and leaving the folder view returns it to Change. `SaveToFolderPanel` is the controlled body (`view`, `pendingDestination`, `onPendingDestinationChange`, `onChangeFolderClick`) for a host that renders its own shell. The panel never decides what a destination means — saving, moving and publishing are the host's.

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

Copy comes from `labels` (`StandaloneSaveToFolderPanelLabels`: `title`, `changeFolderTitle`, `closeAriaLabel`, `backAriaLabel`, `cancelLabel`, `saveLabel`, `savingLabel`, `selectLabel`) and `panelLabels` (`SaveToFolderPanelLabels`), each with an English default. Colors come from `colors` (`StandaloneSaveToFolderPanelColors`: `backdropBackground`, `panelBackground`, `panelBorder`, `dividerBorder`, `scrollbarThumb`, `titleText`) and `panelStyles.colors` (`SaveToFolderPanelColors`: `headingText`, `destinationText` and the `summary*` colors). `titleClassName` and `headingClassName` default to `'dial-body-semi-text'`, and `destinationClassName` (the destination path) to `'dial-small-semi-text'`. `SaveToFolderView` (`Main`, `ChangeFolder`) and `SaveVersionMode` (`Keep`, `New`) are exported.

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

Copy comes from `PublishPanelLabels.dependenciesLabels` (`PublishDependenciesLabels`): `title` (default `'Private dependencies'`), `description`, `rootLocation` (default `'Root folder'`), `typeLabels` (default `'Application'`, `'Toolset'`, `'Prompt'`, `'Skill'`, `'File'`) and `getAnnouncement(count)`, the screen-reader text for the count, so a host can pluralise it in its own language. Colors come from `PublishPanelStyles.dependencies.colors` (`PublishDependenciesColors`: `headingText`, `nameText`, `metaText`, falling back to `--text-primary` and `--text-secondary`). `PublishDependenciesList` can also be used on its own; it then takes `labels`, `styles`, and the typography classes `headingClassName` (default `'dial-body-semi-text'`), `nameClassName` (default `'dial-small-semi-text'`) and `metaClassName` (default `'dial-small-text'`).

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

Manages all state for the Publish flow: folder selection, optimistic local folder creation with rollback, existing-publication detection, access rules, the display author, and submit handling.

```tsx
import { usePublishFlow } from '@epam/ai-dial-publish-panel';

const publishFlow = usePublishFlow({
  item,
  history,
  folderItems,
  defaultAuthor: currentUserDisplayName,
  onPublish: async (item, folderPath, rules, author, publishCredentials) => {
    /* ... */
  },
  onPublishSuccess: (item, folderPath) => {
    /* host-owned success notification */
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
`handleSubmit` forwards the trimmed `author` to `onPublish` as its fourth
argument.

The hook also owns `publishCredentials` (a `boolean`) and
`setPublishCredentials`, forwarded to `onPublish` as its fifth argument. It
starts `false`, `reset()` restores it to `false`, and it is never pre-filled
from history or the selected folder — a folder whose previous publication
carried shared credentials still opens with the option cleared. The argument
is additive, so a host callback declaring only the first four parameters stays
assignable and keeps behaving as it did.

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

### PublishDependencyType

`Application`, `Toolset`, `Prompt`, `Skill` and `File`: the kind of a `PublishDependency`, which picks its default type label.

### PublishPanelView

`Main` (summary, destination row, author, credentials and rules) and `ChangeFolder` (folder search and tree).

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

# @epam/ai-dial-publish-panel

Publish-to-folder UI and state flow shared by catalog entity publish and conversation publish.

## Overview

`@epam/ai-dial-publish-panel` implements the "Publish to folder" experience used across AI DIAL Chat: a destination-folder picker with search and inline folder creation, a publish-history list, a pinned submit/cancel footer, and the `usePublishFlow` hook that manages folder selection, optimistic folder creation, and submit state. The library has no knowledge of any specific host domain model — it only knows `PublishFlowItem` (anything with an optional `version`) and `PublishResourceSummary` (a title/icon/version-only display shape). A host that needs a richer entity-specific summary (e.g. an icon and type badge for a catalog entity) supplies it via the `renderSummary` render-slot instead of the library reaching into a host-specific type. This is what lets both `libs/catalog`'s `DetailsPanel` (versioned catalog entities: Applications, Toolsets, Models) and `apps/chat`'s conversation publish flow (unversioned conversations) share the exact same folder-picker, history-list, and submit UX without either one depending on the other's domain models.

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

## Peer Dependencies

- `react`
- `@tabler/icons-react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-react-file-manager`

`@epam/ai-dial-chat-shared` is kept external by the library build — a
consumer's own bundler resolves it, so installing it is required rather than
optional.

## Components

### PublishPanel

Scrollable body of the Publish flow: entity summary row, destination folder picker with search, callouts, and publish history.

```tsx
import { PublishPanel } from '@epam/ai-dial-publish-panel';

<PublishPanel
  resource={{ title: 'Q3 planning notes' }}
  history={history}
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
/>;
```

`author` is the publication's display author, rendered as a text field between
the folder tree and the access-rules section. It is a controlled value like
`rules`: pass `usePublishFlow`'s `author`/`setAuthor` straight through. An
empty author is a valid state and never blocks submission — the host decides
what an unset author means (both AI DIAL Chat hosts omit the field from the
publish request so the backend falls back to the session's own display name).
The library resolves nothing about the signed-in user itself; the prefill
arrives through `usePublishFlow`'s `defaultAuthor`.

Override its copy through `labels.authorLabel`, `labels.authorPlaceholder`, and
`labels.authorHint`.

Add `type` (and optionally `iconUrl`) to `resource` to get the richer entity
summary row — icon, type label, name, and a current-version tag — rendered by
`ResourceSummary` from `@epam/ai-dial-chat-shared`. `libs/catalog`'s
`DetailsPanel` uses this for versioned catalog entities:

```tsx
<PublishPanel
  resource={{
    title: item.name,
    version: item.version,
    type: item.type,
    iconUrl: item.iconUrl,
  }}
  labels={{ summaryVersionLabel: t(...) }}
  {...rest}
/>;
```

For any other custom summary, pass `renderSummary={() => <CustomHeader />}`; it
replaces the default title-only row and is ignored once `resource.type` is set.

### StandalonePublishPanel

Standalone end-edge slide-in shell for the Publish flow: backdrop, header with Close, the `PublishPanel` body, and a pinned `PublishFooter`.

While open it behaves as a modal dialog: it takes focus on mount, cycles Tab and Shift+Tab within itself, closes on Escape, and returns focus to `returnFocusRef` on close. Tab is left alone while focus sits outside the panel, so the folder-row menus and the rule source picker it renders through portals stay keyboard-operable. While closed it is `inert`, so nothing inside it is reachable.

```tsx
import { StandalonePublishPanel } from '@epam/ai-dial-publish-panel';

<StandalonePublishPanel
  isOpen={isOpen}
  resource={resource}
  history={history}
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

Pinned action row with Cancel and Publish/Update buttons.

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

Destination folder tree with search, lazy expansion, and inline folder creation (trailing button and per-row context menu). Folders are displayed in name order at every level, and filtering is suspended while the inline create row is open so creating a folder from a search that matched nothing works (the unmatched query becomes the pre-filled name).

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

### PublishHistoryList

Read-only list of previously published versions for the currently selected destination folder.

```tsx
import { PublishHistoryList } from '@epam/ai-dial-publish-panel';

<PublishHistoryList entries={folderHistory} currentVersion={currentVersion} />;
```

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
  onPublish: async (item, folderPath, rules, author) => {
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

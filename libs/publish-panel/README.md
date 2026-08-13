# @epam/ai-dial-publish-panel

Publish-to-folder UI and state flow shared by catalog entity publish and conversation publish.

## Overview

`@epam/ai-dial-publish-panel` implements the "Publish to folder" experience used across AI DIAL Chat: a destination-folder picker with search and inline folder creation, a publish-history list, a pinned submit/cancel footer, and the `usePublishFlow` hook that manages folder selection, optimistic folder creation, and submit state. The library has no knowledge of any specific host domain model — it only knows `PublishFlowItem` (anything with an optional `version`) and `PublishResourceSummary` (a title/icon/version-only display shape). A host that needs a richer entity-specific summary (e.g. an icon and type badge for a catalog entity) supplies it via the `renderSummary` render-slot instead of the library reaching into a host-specific type. This is what lets both `libs/catalog`'s `DetailsPanel` (versioned catalog entities: Applications, Toolsets, Models) and `apps/chat`'s conversation publish flow (unversioned conversations) share the exact same folder-picker, history-list, and submit UX without either one depending on the other's domain models.

Use this library whenever a host application needs the "publish to a folder, optionally as a new version" UX; use the lower-level `PublishFoldersTree`/`PublishHistoryList` directly only when assembling a custom layout around them.

## Installation

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
- `@epam/ai-dial-sidebar`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

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
/>;
```

Pass `renderSummary={() => <CustomHeader />}` instead of `resource` when the host needs to render a richer, domain-specific summary (icon, type badge, version pill) — see `libs/catalog`'s `DetailsPanel` for an example that renders its own `EntityHeader` plus a version tag this way.

### StandalonePublishPanel

Standalone end-edge slide-in shell for the Publish flow: backdrop, header with Close, the `PublishPanel` body, and a pinned `PublishFooter`.

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

Manages all state for the Publish flow: folder selection, optimistic local folder creation with rollback, existing-publication detection, and submit handling.

```tsx
import { usePublishFlow } from '@epam/ai-dial-publish-panel';

const publishFlow = usePublishFlow({
  item,
  history,
  folderItems,
  onPublish: async (item, folderPath) => {
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

# @epam/ai-dial-folder-destination-panel

Destination folder tree and side panel for choosing where an item is copied, moved, saved or published.

## Overview

`@epam/ai-dial-folder-destination-panel` is the one place that knows how to pick a destination folder in AI DIAL Chat. It provides `FolderDestinationTree` — a name-ordered folder hierarchy with search, lazy expansion and inline folder creation, in a single-root or multi-root form — and `FolderDestinationPanel`, an end-edge `SideDrawer` that shows the item being acted on (its name, or an entity header with icon and type), the committed destination with a Change action, and a folder view for picking another one.

The panel renders its own primary button; the host supplies only what it says and does through `action` (`label`, optional `icon`, optional `busyLabel`, `onClick`, optional `isDisabled`). That is what lets one panel serve Copy, Move, Save and Publish without the library knowing any of them. It never decides what a destination means: saving, copying, moving and publishing are the host's.

The library was extracted from `@epam/ai-dial-publish-panel` so that features that are not publishing — the file manager's Copy and Move — can use the same hierarchy without depending on the publish UI. `@epam/ai-dial-publish-panel` now builds its publish and save flows on top of it. Reach for this library when you need a destination picker; reach for `publish-panel` when you need version choice, access rules or publish history.

Today the Save flow (`StandaloneSaveToFolderPanel`) is built on `FolderDestinationPanel`, while the Publish flow (`PublishPanel`) still owns its own drawer and shares only `FolderDestinationTree`, so the two panels duplicate their layout until Publish is moved onto this one. The tree renders `DialFoldersTree` from `@epam/ai-dial-react-file-manager`, which is why that package is a peer. That package ships no Copy/Move destination UI of its own: it calls the host's `onDestinationRequest`, and this panel is the UI to show for it (see [Copy and Move in the file manager](#copy-and-move-in-the-file-manager)).

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-folder-destination-panel": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-folder-destination-panel/styles.css';
```

`@epam/ai-dial-publish-panel/styles.css` already includes these styles, so a host that renders the destination picker only through the publish panel skips this import.

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-react-file-manager`

## Components

### FolderDestinationPanel

End-edge slide-in panel with two views. The **main** view shows the item summary, the committed destination as a folder name with the file manager's folder icon (the path joined with `/`) and a small **Change** action, any `mainSections` the host adds below it, and a Cancel / action footer. The **folder** view shows a back button, folder search and the multi-root `FolderDestinationTree`, with a Cancel / Select footer. A folder picked there is pending until Select commits it through `onDestinationChange`; Back and Cancel discard it. `onPendingDestinationChange` reports the pending folder, including the reset to `destination` on entering and leaving the view, and `renderFolderViewFooter(pendingDestination)` renders host content below the tree for it. `onPendingDestinationChange` belongs to this Steps layout only.

The drawer is named by `labels.title` in both views; switching views moves focus to the new view's heading, and leaving the folder view returns it to Change. `submitError` is announced through an assertive `LiveRegion`; `foldersError` shows above the tree with a Retry action when `onRetryFolders` is given. Every control is disabled while `isSubmitting`, and the action shows `action.busyLabel` meanwhile.

```tsx
import {
  FolderDestinationPanel,
  type FolderDestination,
  type FolderDestinationRoot,
} from '@epam/ai-dial-folder-destination-panel';

const roots: FolderDestinationRoot[] = [
  { key: 'files', label: 'Files', items: folderItems },
];
const [destination, setDestination] = useState<FolderDestination>({
  rootKey: 'files',
  path: [],
});

<FolderDestinationPanel
  isOpen={isOpen}
  onClose={close}
  item={{ title: 'report.pdf' }}
  roots={roots}
  destination={destination}
  onDestinationChange={setDestination}
  onCreateFolder={handleCreateFolder}
  action={{
    label: 'Copy',
    busyLabel: 'Copying…',
    onClick: copy,
    isDisabled: false,
  }}
  labels={{ title: 'Copy report.pdf' }}
  panelLabels={{ destinationHeading: 'Copy to folder' }}
/>;
```

`layout` chooses how the picker is presented. `FolderDestinationLayout.Steps` (the default) is the two-view flow above. `FolderDestinationLayout.Inline` puts the heading (`panelLabels.destinationHeading`), search and folder tree straight into the main view: a pick is the destination and is reported through `onDestinationChange` only (`onPendingDestinationChange` is never called, so react to a pick there, for example to preload the folder), clearing the selection keeps the previous destination, and there is no Change action, back button or Select step, so the footer is only Cancel and the action. `item.iconKind` (`FolderDestinationItemIcon.File` or `.Folder`) shows a kit `FileName` icon beside the item's name in the title-only summary row. `collapsibleRoots` lets the user collapse and expand the root nodes (default `false`, which keeps every root open); roots start expanded and a search expands them again. Only the folder tree scrolls in this layout; the item, heading and search stay visible. Expand the tree the way you want it opened through each root's `expandedPaths`.

```tsx
import {
  FolderDestinationItemIcon,
  FolderDestinationLayout,
  FolderDestinationPanel,
} from '@epam/ai-dial-folder-destination-panel';

<FolderDestinationPanel
  isOpen={isOpen}
  onClose={close}
  layout={FolderDestinationLayout.Inline}
  item={{ title: 'api keys.xls', iconKind: FolderDestinationItemIcon.File }}
  roots={roots}
  destination={destination}
  onDestinationChange={setDestination}
  onCreateFolder={handleCreateFolder}
  action={{ label: 'Move', onClick: move }}
  labels={{ title: 'Move file' }}
  panelLabels={{ destinationHeading: 'Move to folder' }}
/>;
```

### FolderDestinationPanelBody

The controlled body of the panel (`view`, `pendingDestination`, `onPendingDestinationChange`, `onChangeFolderClick`) for a host that renders its own shell. It takes the same `item`, `roots`, `destination`, `mainSections` and `renderFolderViewFooter` props as the panel.

### FolderDestinationTree

Destination folder tree with search, lazy expansion, and inline folder creation (trailing button and per-row context menu). Folders are displayed in name order at every level, and filtering is suspended while the inline create row is open so creating a folder from a search that matched nothing works (the unmatched query becomes the pre-filled name). Creating a folder under a parent listed in `loadingPaths` opens the inline editor only once that parent leaves `loadingPaths`; `loadingPaths` must therefore use the same `/`-joined keys as the folder paths. A new folder may not take its parent folder's name (case-insensitive) — the editor shows `sameAsParentFolderNameError`.

```tsx
import { FolderDestinationTree } from '@epam/ai-dial-folder-destination-panel';

<FolderDestinationTree
  items={folderItems}
  selectedPath={selectedPath}
  onSelectedPathChange={setSelectedPath}
  onCreateFolder={handleCreateFolder}
  searchQuery={searchQuery}
/>;
```

#### Multi-root mode

Pass `roots` (a list of `FolderDestinationRoot`: `key`, `label`, `items`, and optional `canCreateFolders`, `expandedPaths`, `onExpandedPathsChange`, `loadingPaths`, `hasAccessRules`) to render one always-expanded top-level node per root, in the given order, instead of the single `rootLabel` root. Selection then travels as a `FolderDestination` (`{ rootKey, path }`, where `path: []` is the root itself) through `destination` / `onDestinationChange`, and a confirmed new folder reaches `onCreateDestinationFolder(rootKey, parentPath, name)`. A root with `canCreateFolders: false` offers no create actions. Roots stay expanded unless `collapsibleRoots` is set. `items`, `selectedPath`, `onSelectedPathChange`, `onCreateFolder`, `rootLabel`, `expandedPaths` and `loadingPaths` are ignored in this mode — each root carries its own. `hasAccessRules` is a host flag this library carries and never reads; `@epam/ai-dial-publish-panel` uses it to decide which roots show access rules. `rootLabel` (default `'Root'`) names the root node of the single-root form.

```tsx
import { FolderDestinationTree } from '@epam/ai-dial-folder-destination-panel';

<FolderDestinationTree
  roots={[
    { key: 'personal', label: 'Personal', items: personalItems },
    { key: 'organization', label: 'Organization', items: organizationItems },
  ]}
  destination={destination}
  onDestinationChange={setDestination}
  onCreateDestinationFolder={handleCreateFolder}
  searchQuery={searchQuery}
/>;
```

### Copy and Move in the file manager

The file manager calls `onDestinationRequest(request)` instead of opening a popup. Show the panel in the Inline layout and drive it with `useFileManagerDestination` from `@epam/ai-dial-chat-hooks`, which builds the roots from the file manager's items, opens the hierarchy on the source folder, preloads a folder when it is picked or expanded, and reports whether the destination is loading or restricted. Call `request.confirm(path)` from the action and `request.cancel()` when the panel is dismissed. `onDestinationRequest` exists in the file manager release that follows `0.4.1`; the peer range still reads `^0.4.1` and is raised when that release is published.

```tsx
const {
  roots,
  destination,
  onDestinationChange,
  onCreateFolder,
  destinationVirtualPath,
  isDestinationLoading,
  restriction,
} = useFileManagerDestination({
  request,
  items,
  loadingPaths,
  onPreloadFolder,
  onCreateFolder: createFolder,
});

<FolderDestinationPanel
  isOpen
  onClose={() => request.cancel()}
  layout={FolderDestinationLayout.Inline}
  item={{ title: request.items[0].name }}
  roots={roots}
  destination={destination}
  onDestinationChange={onDestinationChange}
  onCreateFolder={onCreateFolder}
  action={{
    label: 'Copy',
    onClick: () =>
      destinationVirtualPath && request.confirm(destinationVirtualPath),
    isDisabled: isDestinationLoading || restriction != null,
  }}
/>;
```

## Utilities

Pure helpers over `FolderNode` trees: `sortFolderTree`, `filterFolderTree`, `mergeFolderPaths`, `collectFolderKeys`, `toFolderPathKey` / `fromFolderPathKey` (the `/`-joined keys), `getFolderDisplayName`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName` and `getSiblingFolderNames`.

## Enums

- `FolderDestinationView` — `Main`, `ChangeFolder`: the view `FolderDestinationPanelBody` renders.
- `FolderDestinationLayout` — `Steps`, `Inline`: how the folder picker is presented.
- `FolderDestinationItemIcon` — `File`, `Folder`: the icon beside the item's name.

## Types

`FolderNode`, `FolderDestination`, `FolderDestinationRoot`, `FolderDestinationItem`, `FolderDestinationAction`, `FolderNameValidationMessages`, and the props, `*Labels`, `*Colors` and `*Styles` types of the three components.

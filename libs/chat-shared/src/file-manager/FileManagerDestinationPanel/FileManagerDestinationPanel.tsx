import {
  DestinationFolderMode,
  DialFileNodeType,
  FolderDestinationLayout,
  FolderDestinationPanel,
  fromFolderPathKey,
  toFolderPathKey,
  type DialDestinationRequest,
  type DialFile,
  type FolderDestination,
} from '@epam/ai-dial-react-file-manager';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DialItemType,
  FileName,
} from '@epam/ai-dial-ui-kit';
import { IconFolderShare } from '@tabler/icons-react';
import { FC, useCallback, useMemo, useState } from 'react';
import {
  findFolder,
  findSectionRoot,
  isSameOrInsidePath,
  toDestinationFolderNodes,
  toDestinationPath,
  toPathSegments,
} from '../destination-folders';
import type { FileManagerController } from '../file-manager-controller';
import type { FileManagerDestinationPanelLabels } from '../labels';
import { isHiddenPath } from '../path';

/* The panel shows the one section the items come from, so it has one root; the key is not shown anywhere. */
const ROOT_KEY = 'files';
/* The placeholder file the folder-creation request carries, as the file manager's own panel sends it. */
const FOLDER_PLACEHOLDER_NAME = '.dial_folder';

/** Props of {@link FileManagerDestinationPanel}. */
export interface FileManagerDestinationPanelProps {
  /** The Copy or Move the user started. */
  request: DialDestinationRequest;
  /** The roots of every enabled section; the panel shows the one the items come from. */
  roots: DialFile[];
  /** Virtual paths whose contents are already loaded. */
  loadedPaths: Set<string>;
  /** Virtual paths whose contents are being loaded. */
  loadingPaths: Set<string>;
  /** Loads a folder's contents without changing the browsed path. */
  onFolderPopupPathChange: FileManagerController['onFolderPopupPathChange'];
  /** Creates a folder; called with the folder's full virtual path. */
  onCreateFolder: FileManagerController['onCreateFolder'];
  /** Text of the panel. */
  labels: FileManagerDestinationPanelLabels;
  /** Called once the user confirmed or dismissed the panel, so the host can stop rendering it. */
  onFinish: () => void;
}

/** Side panel for choosing where Copy or Move puts the items, limited to the section the items come from. */
export const FileManagerDestinationPanel: FC<
  FileManagerDestinationPanelProps
> = ({
  request,
  roots,
  loadedPaths,
  loadingPaths,
  onFolderPopupPathChange,
  onCreateFolder,
  labels,
  onFinish,
}) => {
  const root = findSectionRoot(roots, request.sourceFolder);
  const rootPath = root?.path ?? '';
  const rootSegmentCount = toPathSegments(rootPath).length;
  const isMove = request.mode === DestinationFolderMode.Move;

  const movedFolderPaths = useMemo(
    () =>
      request.items
        .filter((item) => item.nodeType === DialFileNodeType.FOLDER)
        .map((item) => item.path),
    [request.items],
  );

  const getDisabledReason = useCallback(
    ({ path }: FolderDestination): string | undefined => {
      if (!isMove) return undefined;
      const destinationPath = toDestinationPath(rootPath, path);
      if (
        movedFolderPaths.some((moved) =>
          isSameOrInsidePath(destinationPath, moved),
        )
      ) {
        return labels.movedIntoItselfTooltip;
      }
      if (
        toPathSegments(destinationPath).join('/') ===
        toPathSegments(request.sourceFolder).join('/')
      ) {
        return labels.sourceFolderTooltip;
      }
      return undefined;
    },
    [isMove, rootPath, movedFolderPaths, request.sourceFolder, labels],
  );

  const sourcePath = toPathSegments(request.sourceFolder).slice(
    rootSegmentCount,
  );
  const [destination, setDestination] = useState<FolderDestination>(() => {
    const source = { rootKey: ROOT_KEY, path: sourcePath };
    if (!isMove || getDisabledReason(source) == null) return source;
    /* Move disables the source folder, so the panel opens on the first folder it accepts instead of an error state. */
    const candidates = [
      { rootKey: ROOT_KEY, path: [] },
      ...(root?.items ?? [])
        .filter(
          (item) =>
            item.nodeType === DialFileNodeType.FOLDER &&
            !isHiddenPath(item.name),
        )
        .map((item) => ({
          rootKey: ROOT_KEY,
          path: toPathSegments(item.path).slice(rootSegmentCount),
        })),
    ];
    return candidates.find((c) => getDisabledReason(c) == null) ?? source;
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const loadFolder = useCallback(
    (path: string[]) =>
      onFolderPopupPathChange(toDestinationPath(rootPath, path)),
    [onFolderPopupPathChange, rootPath],
  );

  const folderItems = useMemo(
    () =>
      toDestinationFolderNodes(
        root?.items,
        rootSegmentCount,
        (virtualPath) =>
          loadedPaths.has(virtualPath) ||
          loadedPaths.has(toDestinationPath(virtualPath, [])),
      ),
    [root, rootSegmentCount, loadedPaths],
  );

  const loadingPathKeys = useMemo(
    () =>
      new Set(
        [...loadingPaths]
          .filter((virtualPath) => isSameOrInsidePath(virtualPath, rootPath))
          .map((virtualPath) =>
            toFolderPathKey(
              toPathSegments(virtualPath).slice(rootSegmentCount),
            ),
          ),
      ),
    [loadingPaths, rootPath, rootSegmentCount],
  );

  const handleExpandedPathsChange = useCallback(
    (paths: Set<string>) => {
      paths.forEach((key) => {
        if (!expandedPaths.has(key)) loadFolder(fromFolderPathKey(key));
      });
      setExpandedPaths(paths);
    },
    [expandedPaths, loadFolder],
  );

  const panelRoots = useMemo(
    () => [
      {
        key: ROOT_KEY,
        label: root?.name ?? '',
        items: folderItems,
        expandedPaths,
        onExpandedPathsChange: handleExpandedPathsChange,
        loadingPaths: loadingPathKeys,
      },
    ],
    [
      root,
      folderItems,
      expandedPaths,
      handleExpandedPathsChange,
      loadingPathKeys,
    ],
  );

  const handleCreateFolder = useCallback(
    async (_rootKey: string, parentPath: string[], name: string) => {
      const folderPath = `${toDestinationPath(rootPath, parentPath)}/${name}`;
      await onCreateFolder(
        {
          fileContent: new File([], FOLDER_PLACEHOLDER_NAME, {
            type: 'text/plain',
          }),
          name: FOLDER_PLACEHOLDER_NAME,
        },
        folderPath,
        `${folderPath}/${FOLDER_PLACEHOLDER_NAME}`,
      );
    },
    [onCreateFolder, rootPath],
  );

  /* A pick is the destination in the inline layout, so it also loads that folder for conflict detection. */
  const handleDestinationChange = useCallback(
    (picked: FolderDestination) => {
      setDestination(picked);
      loadFolder(picked.path);
    },
    [loadFolder],
  );

  if (!root) return null;

  const destinationPath = toDestinationPath(rootPath, destination.path);
  const isDestinationLoading = loadingPathKeys.has(
    toFolderPathKey(destination.path),
  );
  const itemCount = request.items.length;
  const [firstItem] = request.items;
  const isSingleFolder =
    itemCount === 1 && firstItem.nodeType === DialFileNodeType.FOLDER;
  const title = isMove
    ? labels.getMoveTitle(itemCount, isSingleFolder)
    : labels.getCopyTitle(itemCount, isSingleFolder);
  /* Every affected item is listed, so the user sees what the action touches. */
  const affectedItems = (
    <ul className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto">
      {request.items.map((item) => (
        <li key={item.path} className="min-w-0">
          <FileName
            name={item.name}
            type={
              item.nodeType === DialFileNodeType.FOLDER
                ? DialItemType.Folder
                : DialItemType.File
            }
          />
        </li>
      ))}
    </ul>
  );

  const handleClose = () => {
    request.cancel();
    onFinish();
  };
  const handleConfirm = () => {
    request.confirm(destinationPath, findFolder(root, destinationPath)?.items);
    onFinish();
  };

  return (
    <FolderDestinationPanel
      isOpen
      onClose={handleClose}
      item={{
        title: firstItem.name,
        summary: affectedItems,
      }}
      roots={panelRoots}
      destination={destination}
      layout={FolderDestinationLayout.Inline}
      onDestinationChange={handleDestinationChange}
      onCreateFolder={handleCreateFolder}
      getDisabledReason={getDisabledReason}
      labels={{ title }}
      panelLabels={{
        destinationHeading: isMove ? labels.moveHeading : labels.copyHeading,
        createFolderLabel: labels.addFolderLabel,
      }}
      action={{
        label: isMove ? labels.moveButtonLabel : labels.copyButtonLabel,
        icon: (
          <IconFolderShare
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        ),
        isDisabled:
          isDestinationLoading || getDisabledReason(destination) != null,
        onClick: handleConfirm,
      }}
    />
  );
};

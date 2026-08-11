import type { DialCopiedItem } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import type {
  CopyItemDto,
  MoveItemDto,
  RenameItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  CopyItemDtoNodeTypeEnum,
  MoveItemDtoNodeTypeEnum,
  RenameItemDtoNodeTypeEnum,
} from '@epam/ai-dial-chat-api-client';
import {
  getParentFolderPath,
  virtualPathToApiPath,
} from '../../utils/resolve-dial-file-api-path';
import { getVirtualPathName } from './dial-file-manager-path.util';
import type { PreparedCopyMoveItem } from './dial-file-manager.model';

/** Builds the `copyFiles` DTOs (with their destination display name) for `onCopyFiles`. */
export const prepareCopyItems = (
  copiedItems: DialCopiedItem[],
  bucket: string,
  rootLabel: string,
): PreparedCopyMoveItem<CopyItemDto>[] =>
  copiedItems.map((item) => {
    const isFolder = item.nodeType === DialFileNodeType.FOLDER;
    const sourcePath = virtualPathToApiPath(item.sourceUrl, rootLabel);
    const destinationPath = virtualPathToApiPath(
      item.destinationUrl,
      rootLabel,
    );
    const name = getVirtualPathName(item.sourceUrl, sourcePath);
    const destinationName = getVirtualPathName(
      item.destinationUrl,
      destinationPath,
    );
    return {
      destinationName,
      dto: {
        bucket,
        sourcePath: isFolder
          ? sourcePath.endsWith('/')
            ? sourcePath
            : `${sourcePath}/`
          : sourcePath.replace(/\/$/, ''),
        destinationPath: isFolder
          ? destinationPath.endsWith('/')
            ? destinationPath
            : `${destinationPath}/`
          : destinationPath.replace(/\/$/, ''),
        overwrite: item.overwrite === true,
        nodeType: isFolder
          ? CopyItemDtoNodeTypeEnum.Folder
          : CopyItemDtoNodeTypeEnum.Item,
        name,
      },
    };
  });

interface BuiltMoveRenameEntry {
  isFolder: boolean;
  name: string;
  destinationName: string;
  overwrite: boolean;
  sourcePath: string;
  destinationPath: string;
  sourceParent: string;
  destinationParent: string;
}

/**
 * Rename-vs-move disambiguation (design.md D3): entries whose parent folder
 * is unchanged become `renameDtos`; entries whose parent folder changed
 * become `preparedMoveItems`.
 */
export const prepareMoveRenameItems = (
  copiedItems: DialCopiedItem[],
  bucket: string,
  rootLabel: string,
): {
  renameDtos: RenameItemDto[];
  preparedMoveItems: PreparedCopyMoveItem<MoveItemDto>[];
} => {
  const built: BuiltMoveRenameEntry[] = copiedItems.map((item) => {
    const isFolder = item.nodeType === DialFileNodeType.FOLDER;
    const sourcePath = virtualPathToApiPath(item.sourceUrl, rootLabel);
    const destinationPath = virtualPathToApiPath(
      item.destinationUrl,
      rootLabel,
    );
    const name = getVirtualPathName(item.sourceUrl, sourcePath);
    const destinationName = getVirtualPathName(
      item.destinationUrl,
      destinationPath,
    );
    const normalizedSourcePath = isFolder
      ? sourcePath.endsWith('/')
        ? sourcePath
        : `${sourcePath}/`
      : sourcePath.replace(/\/$/, '');
    const normalizedDestinationPath = isFolder
      ? destinationPath.endsWith('/')
        ? destinationPath
        : `${destinationPath}/`
      : destinationPath.replace(/\/$/, '');
    return {
      isFolder,
      name,
      destinationName,
      overwrite: item.overwrite === true,
      sourcePath: normalizedSourcePath,
      destinationPath: normalizedDestinationPath,
      sourceParent: getParentFolderPath(normalizedSourcePath),
      destinationParent: getParentFolderPath(normalizedDestinationPath),
    };
  });

  const renameDtos: RenameItemDto[] = built
    .filter((b) => b.sourceParent === b.destinationParent)
    .map((b) => ({
      bucket,
      sourcePath: b.sourcePath,
      destinationPath: b.destinationPath,
      nodeType: b.isFolder
        ? RenameItemDtoNodeTypeEnum.Folder
        : RenameItemDtoNodeTypeEnum.Item,
      name: b.name,
    }));

  const preparedMoveItems: PreparedCopyMoveItem<MoveItemDto>[] = built
    .filter((b) => b.sourceParent !== b.destinationParent)
    .map((b) => ({
      destinationName: b.destinationName,
      dto: {
        bucket,
        sourcePath: b.sourcePath,
        destinationPath: b.destinationPath,
        overwrite: b.overwrite,
        nodeType: b.isFolder
          ? MoveItemDtoNodeTypeEnum.Folder
          : MoveItemDtoNodeTypeEnum.Item,
        name: b.name,
      },
    }));

  return { renameDtos, preparedMoveItems };
};

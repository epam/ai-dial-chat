import type { components } from '@epam/ai-dial-typescript-sdk';
import type { SkillMetadataItemDto } from '../dto/skill-metadata.dto';
import { SkillNodeType } from '../dto/skill-node-type';

export type DialMetadataBase = components['schemas']['MetadataBase'];

/**
 * Maps DIAL Core's `MetadataBase` (`ResourceFolderMetadata |
 * ResourceItemMetadata`, discriminated by `nodeType: 'FOLDER' | 'ITEM'`)
 * into a normalized `SkillMetadataItemDto`, lowercasing `nodeType` to match
 * `ListFilesItemDto`'s existing normalization convention. Malformed
 * upstream metadata with no recognizable `nodeType` is skipped rather than
 * throwing, since a single bad entry should not fail the whole listing.
 * Shared by `SkillsListingService` and `SkillsLookupService`.
 */
export const mapToSkillMetadataItem = (
  item: DialMetadataBase,
): SkillMetadataItemDto | null => {
  const nodeType =
    item.nodeType === 'FOLDER'
      ? SkillNodeType.Folder
      : item.nodeType === 'ITEM'
        ? SkillNodeType.Item
        : null;
  if (nodeType == null || item.bucket == null || item.name == null) {
    return null;
  }

  const path =
    item.parentPath != null ? `${item.parentPath}${item.name}` : item.name;

  return {
    name: item.name,
    path: nodeType === SkillNodeType.Folder ? `${path}/` : path,
    url: item.url ?? `skills/${item.bucket}/${path}`,
    bucket: item.bucket,
    nodeType,
    parentPath: item.parentPath,
    permissions: item.permissions,
    etag: 'etag' in item ? item.etag : undefined,
    author: 'author' in item ? item.author : undefined,
    createdAt: 'createdAt' in item ? item.createdAt : undefined,
    updatedAt: 'updatedAt' in item ? item.updatedAt : undefined,
  };
};

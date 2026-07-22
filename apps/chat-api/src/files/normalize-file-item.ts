import { lookup } from 'mime-types';
import { FileNodeType } from './dto/list-files.dto';
import type { ListFilesItemDto } from './dto/list-files.dto';

interface SharedUserInfo {
  user?: string;
}

export interface DialFileItem {
  name?: string;
  url?: string;
  nodeType?: string;
  parentPath?: string;
  contentLength?: number;
  contentType?: string;
  updatedAt?: number;
  permissions?: string[];
  resourceType?: string;
  author?: string;
  owner?: string;
  sharedBy?: string | SharedUserInfo[];
  items?: DialFileItem[];
}

const getSharedByAuthor = (
  sharedBy: DialFileItem['sharedBy'],
): string | undefined =>
  Array.isArray(sharedBy)
    ? sharedBy.find((item) => item.user != null)?.user
    : sharedBy;

const getItemAuthor = (item: DialFileItem): string | undefined =>
  item.author ??
  item.owner ??
  getSharedByAuthor(item.sharedBy) ??
  item.items
    ?.map(
      (child) =>
        child.author ?? child.owner ?? getSharedByAuthor(child.sharedBy),
    )
    .find((author) => author != null);

export const normalizeFileItem = (
  item: DialFileItem,
  bucket: string,
): ListFilesItemDto => {
  const rawNodeType = (item.nodeType ?? '').toLowerCase();
  const isFolder = rawNodeType === FileNodeType.Folder;

  const rawPath =
    item.url ??
    (item.parentPath != null
      ? `${item.parentPath}/${item.name ?? ''}`
      : (item.name ?? ''));
  const normalizedPath =
    isFolder && !rawPath.endsWith('/') ? `${rawPath}/` : rawPath;

  const folderId = isFolder
    ? `${bucket}:${normalizedPath}`
    : `${bucket}:${item.parentPath ?? ''}`;

  const result: ListFilesItemDto = {
    name: item.name ?? '',
    path: normalizedPath,
    folderId,
    nodeType: rawNodeType,
    bucket,
    parentPath: item.parentPath,
    url: item.url,
    updatedAt: item.updatedAt,
    permissions: item.permissions,
    resourceType: item.resourceType,
    author: getItemAuthor(item),
  };

  if (!isFolder) {
    result.contentLength = item.contentLength;
    result.contentType =
      (item.contentType ?? lookup(item.name ?? rawPath)) || undefined;
  }

  return result;
};

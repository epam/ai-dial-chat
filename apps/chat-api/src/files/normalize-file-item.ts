import type { ListFilesItemDto } from './dto/list-files.dto';

interface DialFileItem {
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
}

export const normalizeFileItem = (
  item: DialFileItem,
  bucket: string,
): ListFilesItemDto => {
  const rawNodeType = (item.nodeType ?? '').toLowerCase();
  const isFolder = rawNodeType === 'folder';

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
    author: item.author,
  };

  if (!isFolder) {
    result.contentLength = item.contentLength;
    result.contentType = item.contentType;
  }

  return result;
};

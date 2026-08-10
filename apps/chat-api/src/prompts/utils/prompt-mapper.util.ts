import type { components } from '@epam/ai-dial-typescript-sdk';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { FOLDER_SENTINEL } from '../constants/prompt.constants';
import type { PromptFolderResponseDto } from '../dto/prompt-folder-response.dto';
import type { PromptResponseDto } from '../dto/prompt-response.dto';

export const PUBLIC_BUCKET = 'public';

/* Prompt payload stored in DIAL Core. Timestamps remain resource metadata. */
export type CorePrompt = components['schemas']['Prompt'];
export type PromptMetadataItem = components['schemas']['ResourceItemMetadata'];
export type PromptMetadataFolder =
  components['schemas']['ResourceFolderMetadata'];

export type PromptPayload = CorePrompt & {
  description?: string;
};

export interface PromptMetadataListResult {
  data?: PromptMetadataFolder;
  error?: unknown;
  response?: globalThis.Response;
}

export interface PromptReadResult {
  data?: PromptPayload;
  error?: unknown;
  response?: globalThis.Response;
}

export interface PromptWriteResult {
  data?: PromptMetadataItem;
  error?: unknown;
  response?: globalThis.Response;
}

export interface SharedResourceItem {
  nodeType?: string;
  url?: string;
  name?: string;
  parentPath?: string;
}

export interface SharedResourcesResult {
  data?: { resources?: SharedResourceItem[] };
  error?: unknown;
}

/* ---- path helpers ---- */

export const folderIdFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? '' : id.slice(0, lastSlash);
};

export const nameFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? id : id.slice(lastSlash + 1);
};

export const isSentinelPath = (path: string): boolean =>
  path === FOLDER_SENTINEL || path.endsWith(`/${FOLDER_SENTINEL}`);

/* Parses a full DIAL resource URL back to the SDK-relative prompt path. */
export const urlToPromptPath = (url: string, bucket: string): string | null => {
  const decoded = safeDecodeURIComponent(url);
  const prefix = `prompts/${bucket}/`;
  return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : null;
};

export const metadataItemToPromptPath = (
  item: PromptMetadataItem,
  bucket: string,
): string | null => {
  const raw =
    item.url ??
    (item.parentPath != null && item.name != null
      ? `${item.parentPath}/${item.name}`
      : null);
  return raw != null ? urlToPromptPath(raw, bucket) : null;
};

export const mapPromptToResponse = (
  prompt: PromptPayload,
  id: string,
  metadata: PromptMetadataItem,
): PromptResponseDto => ({
  id,
  name: prompt.name ?? nameFromId(id),
  description: prompt.description,
  content: prompt.content ?? '',
  folderId: prompt.folderId ?? folderIdFromId(id),
  createdAt: metadata.createdAt ?? 0,
  updatedAt: metadata.updatedAt ?? 0,
});

export const deriveFolders = (
  promptIds: string[],
): PromptFolderResponseDto[] => {
  const folderSet = new Set<string>();
  for (const id of promptIds) {
    let parent = folderIdFromId(id);
    while (parent !== '') {
      folderSet.add(parent);
      parent = folderIdFromId(parent);
    }
  }
  return [...folderSet].sort().map((folderPath) => ({
    id: folderPath,
    name: nameFromId(folderPath),
  }));
};

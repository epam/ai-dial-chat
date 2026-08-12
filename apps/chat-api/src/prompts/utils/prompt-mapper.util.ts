import type { components } from '@epam/ai-dial-typescript-sdk';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { HIDDEN_FILE } from '../../constants/dial.constants';
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

/*
 * DIAL Core writes a `.dial_folder` marker to keep an otherwise-empty folder
 * alive. It is a storage artefact, not a prompt: reading it as one yields a
 * broken entry in every listing, so it is dropped before any prompt is read.
 */
export const isHiddenPromptPath = (path: string): boolean =>
  path.split('/').includes(HIDDEN_FILE);

/**
 * First segment of every DIAL Core prompt resource url, which is shaped
 * `prompts/{bucket}/{path}`. Owned here rather than per-module so the publish
 * and share flows cannot drift on whether the trailing slash is part of it.
 */
export const PROMPT_RESOURCE_PREFIX = 'prompts';

/**
 * Qualifies a bucket-relative prompt path into a full DIAL Core resource url.
 * The prompts endpoints address a prompt by a bucket-relative path because they
 * already scope to the caller's bucket, so the bucket is re-attached here
 * rather than being leaked to the frontend, which never sees it.
 */
export const toPromptResourceUrl = (
  promptPath: string,
  bucket: string,
): string => `${PROMPT_RESOURCE_PREFIX}/${bucket}/${promptPath}`;

/** Whether `url` is a DIAL Core prompt resource url, i.e. `prompts/{bucket}/{path}`. */
export const isPromptResourceUrl = (url: string): boolean =>
  url.startsWith(`${PROMPT_RESOURCE_PREFIX}/`);

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
  author: metadata.author,
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

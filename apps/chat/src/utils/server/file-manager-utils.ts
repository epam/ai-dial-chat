import { constructPath } from '@/src/utils/app/file';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { sanitizeUri } from 'micromark-util-sanitize-uri';

export interface FileMetadata {
  name: string;
  url: string;
  nodeType: string;
}

export async function fetchAllFilesRecursive(
  folderUrl: string,
  authToken: string,
): Promise<FileMetadata[]> {
  const allFiles: FileMetadata[] = [];
  let nextToken: string | undefined = undefined;

  do {
    const encodeFolderSlugs = encodeUrlSlugs(folderUrl);
    const path = constructPath(
      process.env.DIAL_API_HOST as string,
      'v1/metadata',
      encodeFolderSlugs,
    );
    const searchParams = new URLSearchParams();
    searchParams.set('limit', '1000');
    searchParams.set('recursive', 'true');
    searchParams.set('permissions', 'true');
    const url = !nextToken
      ? `${sanitizeUri(path)}/?${searchParams}`
      : `${sanitizeUri(path)}/?${searchParams}&token=${nextToken}`;
    const response = await fetch(url, {
      headers: getApiHeaders({ jwt: authToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Failed to fetch metadata for folder ${folderUrl}: ${errorText}`,
      );
      throw new Error(`Failed to fetch metadata for folder: ${folderUrl}`);
    }

    const json = (await response.json()) as BackendFileFolder & {
      nextToken?: string;
    };
    const items = json.items || [];

    for (const file of items) {
      if (file.nodeType === 'ITEM') {
        const backendFile = file as BackendFile;
        allFiles.push({
          name: backendFile.name,
          url: decodeURIComponent(backendFile.url),
          nodeType: file.nodeType,
        });
      }
    }

    nextToken = json.nextToken;
  } while (nextToken);

  return allFiles;
}

export async function processBatch<T, R>(
  items: T[],
  processItem: (item: T, index: number) => Promise<R>,
  batchSize: number,
): Promise<{
  succeeded: { index: number; result: R }[];
  errors: { index: number; item: T; error: string }[];
}> {
  const succeeded: { index: number; result: R }[] = [];
  const errors: { index: number; item: T; error: string }[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const promises = batch.map((item, batchIndex) => {
      const globalIndex = i + batchIndex;
      return processItem(item, globalIndex);
    });

    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((result, batchIndex) => {
      const globalIndex = i + batchIndex;
      if (result.status === 'fulfilled') {
        succeeded.push({
          index: globalIndex,
          result: result.value,
        });
      } else {
        errors.push({
          index: globalIndex,
          item: batch[batchIndex],
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
  }

  return { succeeded, errors };
}

export function encodeUrlSlugs(url: string): string {
  return ServerUtils.encodeSlugs(url.split('/'));
}

export function buildApiUrl(endpoint: string, slugs?: string): string {
  const host = process.env.DIAL_API_HOST as string;

  const path = slugs
    ? constructPath(host, endpoint, slugs)
    : constructPath(host, endpoint);

  return sanitizeUri(path);
}

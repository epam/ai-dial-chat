import {
  buildApiUrl,
  encodeUrlSlugs,
  fetchAllFilesRecursive as fetchFiles,
} from '@/src/utils/server/file-manager-utils';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { Readable } from 'stream';

export interface FileToDownload {
  name: string;
  url: string;
  path: string;
}

export async function fetchAllFilesForDownload(
  folderUrl: string,
  authToken: string,
  basePath = '',
): Promise<FileToDownload[]> {
  const files = await fetchFiles(folderUrl, authToken);

  return files.map((file) => {
    const relativePath = file.url.replace(folderUrl, '').replace(/^\//, '');
    const archivePath = basePath ? `${basePath}/${relativePath}` : relativePath;

    return {
      name: file.name,
      url: file.url,
      path: archivePath,
    };
  });
}

export async function downloadFileAsStream(
  fileUrl: string,
  authToken: string,
): Promise<Readable> {
  const downloadUrl = buildApiUrl('v1', encodeUrlSlugs(fileUrl));

  const response = await fetch(downloadUrl, {
    headers: {
      ...getApiHeaders({ jwt: authToken }),
      'Accept-Encoding': 'identity',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Failed to download file ${fileUrl}: ${errorText}`);
    throw new Error(`Failed to download file: ${fileUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return Readable.from(buffer);
}

export function waitForStream(stream: Readable): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

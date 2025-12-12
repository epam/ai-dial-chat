import {
  encodeUrlSlugs,
  fetchAllFilesRecursive as fetchFiles,
  processBatch,
} from '@/src/utils/server/file-manager-utils';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { MoveModel } from '@/src/types/common';
import { OperationData, OperationDataError } from '@/src/types/files';

import fetch from 'node-fetch';

export async function fetchAllFilesRecursive(
  folderUrl: string,
  authToken: string,
  parentDest: string,
): Promise<MoveModel[]> {
  const files = await fetchFiles(folderUrl, authToken);

  return files.map((file) => {
    const decodedDestUrl = decodeURIComponent(
      parentDest + file.url.replace(folderUrl, ''),
    );
    return {
      sourceUrl: file.url,
      destinationUrl: decodedDestUrl,
      overwrite: false,
    };
  });
}

export async function copyFilesInBatches(
  files: MoveModel[],
  authToken: string,
  batchSize = 100,
): Promise<{
  succeeded: OperationData<MoveModel>[];
  errors: OperationDataError<MoveModel>[];
}> {
  const baseUrl = `${process.env.DIAL_API_HOST}/v1/ops/resource/copy`;

  const result = await processBatch(
    files,
    async (file) => {
      const body = JSON.stringify({
        sourceUrl: encodeUrlSlugs(file.sourceUrl),
        destinationUrl: encodeUrlSlugs(file.destinationUrl),
        overwrite: file.overwrite ?? false,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          ...getApiHeaders({ jwt: authToken }),
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to copy ${file.sourceUrl}: ${errorText}`);
        throw new Error(errorText || `Failed to copy ${file.sourceUrl}`);
      }

      return file;
    },
    batchSize,
  );

  return {
    succeeded: result.succeeded.map((s) => ({
      index: s.index,
      data: s.result,
    })),
    errors: result.errors.map((e) => ({
      index: e.index,
      data: e.item,
      error: e.error,
    })),
  };
}

export async function moveFilesInBatches(
  files: MoveModel[],
  authToken: string,
  batchSize = 100,
): Promise<{
  succeeded: OperationData<MoveModel>[];
  errors: OperationDataError<MoveModel>[];
}> {
  const baseUrl = `${process.env.DIAL_API_HOST}/v1/ops/resource/move`;

  const result = await processBatch(
    files,
    async (file) => {
      const body = JSON.stringify({
        sourceUrl: encodeUrlSlugs(file.sourceUrl),
        destinationUrl: encodeUrlSlugs(file.destinationUrl),
        overwrite: file.overwrite ?? false,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          ...getApiHeaders({ jwt: authToken }),
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to move ${file.sourceUrl}: ${errorText}`);
        throw new Error(errorText || `Failed to move ${file.sourceUrl}`);
      }

      return file;
    },
    batchSize,
  );

  return {
    succeeded: result.succeeded.map((s) => ({
      index: s.index,
      data: s.result,
    })),
    errors: result.errors.map((e) => ({
      index: e.index,
      data: e.item,
      error: e.error,
    })),
  };
}

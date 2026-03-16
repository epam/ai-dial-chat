import {
  buildApiUrl,
  encodeUrlSlugs,
  fetchAllFilesRecursive as fetchFiles,
  processBatch,
} from '@/src/utils/server/file-manager-utils';
import { getApiHeaders } from '@/src/utils/server/get-headers';

import { MoveModel } from '@/src/types/common';
import { OperationData, OperationDataError } from '@/src/types/files';

export async function fetchAllFilesRecursive(
  folderUrl: string,
  authToken: string,
): Promise<MoveModel[]> {
  const files = await fetchFiles(folderUrl, authToken);

  return files.map((file) => ({
    sourceUrl: file.url,
    destinationUrl: '',
    overwrite: false,
  }));
}

export async function deleteFilesInBatches(
  fileUrls: string[],
  authToken: string,
  batchSize = 100,
): Promise<{
  succeeded: OperationData<string>[];
  errors: OperationDataError<string>[];
}> {
  const result = await processBatch(
    fileUrls,
    async (url) => {
      const deleteUrl = buildApiUrl('v1', encodeUrlSlugs(url));

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: getApiHeaders({ jwt: authToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete ${url}: ${errorText}`);
      }

      return url;
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

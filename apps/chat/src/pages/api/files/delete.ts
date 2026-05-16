import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import {
  deleteFilesInBatches,
  fetchAllFilesRecursive,
} from '@/src/utils/server/file-delete-utils';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { FileOperationsResult } from '@/src/types/files';

import { DialDeletedItem, DialFileNodeType } from '@epam/ai-dial-ui-kit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const traceparent = setTraceparentHeader(res);
  if (req.method !== 'POST') {
    throw new DialAIError('Method not allowed', 405, req);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const { files } = req.body as { files: DialDeletedItem[] };

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new DialAIError(
        'files array is required and must not be empty',
        400,
        req,
      );
    }

    const authToken = await getToken({ req });

    let allFilesToDelete: string[] = [];
    for (const item of files) {
      if (item.nodeType === DialFileNodeType.FOLDER) {
        const folderFiles = await fetchAllFilesRecursive(
          item.sourceUrl,
          authToken ?? '',
        );
        allFilesToDelete = allFilesToDelete.concat(
          folderFiles.map((f) => f.sourceUrl),
        );
      } else {
        allFilesToDelete.push(item.sourceUrl);
      }
    }

    if (allFilesToDelete.length === 0) {
      const emptyResult: FileOperationsResult<string> = {
        success: true,
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
      return res.status(200).json(emptyResult);
    }

    const { succeeded, errors } = await deleteFilesInBatches(
      allFilesToDelete,
      authToken ?? '',
      100,
    );

    if (errors.length === allFilesToDelete.length) {
      return res.status(500).json({
        success: false,
        message: 'All delete operations failed',
        errors,
        traceparent,
      });
    }

    const response: FileOperationsResult<string> = {
      success: errors.length === 0,
      total: allFilesToDelete.length,
      succeeded: succeeded.length,
      failed: errors.length,
      results: succeeded,
      errors: errors.length > 0 ? errors : undefined,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error(error);
    ServerUtils.sendAPIError(res, error);
  }
};

export default handler;

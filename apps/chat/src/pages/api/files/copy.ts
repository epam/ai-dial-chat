import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import {
  copyFilesInBatches,
  fetchAllFilesRecursive,
} from '@/src/utils/server/file-copy-utils';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { MoveModel } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { FileOperationsResult } from '@/src/types/files';

import { DialCopiedItem } from '@epam/ai-dial-ui-kit';

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
    const { files } = req.body as { files: DialCopiedItem[] };

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new DialAIError(
        'files array is required and must not be empty',
        400,
        req,
      );
    }

    const authToken = await getToken({ req });

    let allFilesToCopy: MoveModel[] = [];
    for (const item of files) {
      if (item.nodeType === 'folder') {
        const parentDest = item.destinationUrl;
        const folderFiles = await fetchAllFilesRecursive(
          item.sourceUrl,
          authToken ?? '',
          parentDest,
        );
        allFilesToCopy = allFilesToCopy.concat(folderFiles);
      } else {
        const fileToCopy: MoveModel = {
          sourceUrl: item.sourceUrl,
          destinationUrl: item.destinationUrl,
          overwrite: item.overwrite ?? false,
        };
        allFilesToCopy.push(fileToCopy);
      }
    }

    if (allFilesToCopy.length === 0) {
      throw new DialAIError('No files to copy after folder listing', 400, req);
    }

    for (const file of allFilesToCopy) {
      if (!file.sourceUrl || !file.destinationUrl) {
        throw new DialAIError(
          'Each file must have sourceUrl and destinationUrl',
          400,
          req,
        );
      }
    }

    const { succeeded, errors } = await copyFilesInBatches(
      allFilesToCopy,
      authToken ?? '',
      100,
    );

    if (errors.length === allFilesToCopy.length) {
      return res.status(500).json({
        success: false,
        message: 'All copy operations failed',
        errors,
        traceparent,
      });
    }

    const response: FileOperationsResult<MoveModel> = {
      success: errors.length === 0,
      total: allFilesToCopy.length,
      succeeded: succeeded.length,
      failed: errors.length,
      results: succeeded,
      errors: errors.length > 0 ? errors : undefined,
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;

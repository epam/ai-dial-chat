import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import {
  fetchAllFilesRecursive,
  moveFilesInBatches,
} from '@/src/utils/server/file-copy-utils';
import { logger } from '@/src/utils/server/logger';

import { MoveModel } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { DialCopiedItem } from '@epam/ai-dial-ui-kit';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    let allFilesToMove: MoveModel[] = [];
    for (const item of files) {
      if (item.nodeType === 'folder') {
        const parentDest = item.destinationUrl;
        const folderFiles = await fetchAllFilesRecursive(
          item.sourceUrl,
          authToken?.access_token as string,
          parentDest,
        );
        allFilesToMove = allFilesToMove.concat(folderFiles);
      } else {
        const fileToMove: MoveModel = {
          sourceUrl: item.sourceUrl,
          destinationUrl: item.destinationUrl,
          overwrite: item.overwrite ?? false,
        };
        allFilesToMove.push(fileToMove);
      }
    }

    if (allFilesToMove.length === 0) {
      throw new DialAIError('No files to move after folder listing', 400, req);
    }

    for (const file of allFilesToMove) {
      if (!file.sourceUrl || !file.destinationUrl) {
        throw new DialAIError(
          'Each file must have sourceUrl and destinationUrl',
          400,
          req,
        );
      }
    }

    const { succeeded, errors } = await moveFilesInBatches(
      allFilesToMove,
      authToken?.access_token as string,
      100,
    );

    if (errors.length === allFilesToMove.length) {
      return res.status(500).json({
        success: false,
        message: 'All move operations failed',
        errors,
      });
    }

    return res.status(200).json({
      success: errors.length === 0,
      total: allFilesToMove.length,
      succeeded: succeeded.length,
      failed: errors.length,
      results: succeeded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error(error);
    if (error instanceof DialAIError) {
      const statusCode = parseInt(error.code, 10) || 500;
      return res.status(statusCode).json({ error: error.message });
    }
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;

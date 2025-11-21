import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import {
  deleteFilesInBatches,
  fetchAllFilesRecursive,
} from '@/src/utils/server/file-delete-utils';
import { logger } from '@/src/utils/server/logger';

import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { DialDeletedItem } from '@epam/ai-dial-ui-kit';

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
      if (item.nodeType === 'folder') {
        const folderFiles = await fetchAllFilesRecursive(
          item.sourceUrl,
          authToken?.access_token as string,
        );
        allFilesToDelete = allFilesToDelete.concat(
          folderFiles.map((f) => f.sourceUrl),
        );
      } else {
        allFilesToDelete.push(item.sourceUrl);
      }
    }

    if (allFilesToDelete.length === 0) {
      throw new DialAIError(
        'No files to delete after folder listing',
        400,
        req,
      );
    }

    const { succeeded, errors } = await deleteFilesInBatches(
      allFilesToDelete,
      authToken?.access_token as string,
      100,
    );

    if (errors.length === allFilesToDelete.length) {
      return res.status(500).json({
        success: false,
        message: 'All delete operations failed',
        errors,
      });
    }

    return res.status(200).json({
      success: errors.length === 0,
      total: allFilesToDelete.length,
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

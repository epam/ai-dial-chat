import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import {
  downloadFileAsStream,
  fetchAllFilesForDownload,
  waitForStream,
} from '@/src/utils/server/file-download-utils';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';

import { DialFile } from '@epam/ai-dial-ui-kit';
import archiver from 'archiver';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  if (req.method !== 'POST') {
    throw new DialAIError('Method not allowed', 405, req);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const { files } = req.body as { files: DialFile[] };

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new DialAIError(
        'files array is required and must not be empty',
        400,
        req,
      );
    }

    const authToken = await getToken({ req });

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn(err.message);
      } else {
        logger.error(err.message);
        throw err;
      }
    });

    archive.on('error', (err) => {
      try {
        archive.abort();
      } catch (e) {
        logger.error(e);
      }
      throw err;
    });

    const archiveName = files.length === 1 ? files[0].name : 'files';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archiveName}.zip"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');

    archive.pipe(res);

    (async () => {
      try {
        const filesToDownload = [];

        for (const item of files) {
          if (item.nodeType === 'folder') {
            const folderFiles = await fetchAllFilesForDownload(
              item.path,
              authToken ?? '',
              item.name,
            );
            filesToDownload.push(...folderFiles);
          } else {
            filesToDownload.push({
              name: item.name,
              url: item.path,
              path: item.name,
            });
          }
        }

        if (filesToDownload.length === 0) {
          throw new Error('No files to download');
        }

        for (const file of filesToDownload) {
          try {
            const fileStream = await downloadFileAsStream(
              file.url,
              authToken ?? '',
            );

            archive.append(fileStream, { name: file.path });

            await waitForStream(fileStream);
          } catch {
            logger.error(`Failed to add file to archive: ${file.path}`);
          }
        }

        await archive.finalize();
      } catch (err) {
        try {
          archive.abort();
        } catch {
          logger.error(err);
        }

        if (!res.headersSent) {
          throw new DialAIError('Failed to create archive', 500, req);
        }
      }
    })();
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;

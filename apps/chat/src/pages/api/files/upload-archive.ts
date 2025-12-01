import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import {
  buildApiUrl,
  encodeUrlSlugs,
  processBatch,
} from '@/src/utils/server/file-manager-utils';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import FormData from 'form-data';
import JSZip from 'jszip';
import fetch from 'node-fetch';

interface UploadArchiveSucceededItem {
  path: string;
}

interface UploadArchiveErrorItem {
  path: string;
  error: string;
}

interface UploadArchiveResponse {
  succeeded: UploadArchiveSucceededItem[];
  errors: UploadArchiveErrorItem[];
}

function readRequestBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

function normalizeEntryPath(entryPath: string): string {
  const segments = entryPath
    .split(/[/\\]+/)
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');

  return segments.join('/');
}

function joinDestinationWithEntryPath(
  destinationUrl: string,
  relativePath: string,
): string {
  const destParts = destinationUrl.split('/').filter(Boolean);
  const relParts = relativePath.split('/').filter(Boolean);

  if (destParts.length > 0 && relParts.length > 0) {
    const destLast = destParts[destParts.length - 1];
    if (destLast === relParts[0]) {
      relParts.shift();
    }
  }

  return [...destParts, ...relParts].join('/');
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<UploadArchiveResponse | { error: string }>,
) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const destinationParam = req.query.destination;
    if (!destinationParam || typeof destinationParam !== 'string') {
      return res.status(400).json({ error: 'Missing destination parameter' });
    }

    const destinationUrl = decodeURIComponent(destinationParam);

    const archiveBuffer = await readRequestBody(req);
    if (!archiveBuffer.length) {
      return res.status(400).json({ error: 'Empty archive body' });
    }

    const zip = await JSZip.loadAsync(archiveBuffer);

    const filesToUpload: { relativePath: string; content: Buffer }[] = [];

    await Promise.all(
      Object.keys(zip.files).map(async (key) => {
        const entry = zip.files[key];

        if (entry.dir) {
          return;
        }

        const normalizedPath = normalizeEntryPath(entry.name);
        if (!normalizedPath) {
          return;
        }

        const content = (await entry.async('nodebuffer')) as Buffer;

        filesToUpload.push({
          relativePath: normalizedPath,
          content,
        });
      }),
    );

    if (!filesToUpload.length) {
      return res.status(400).json({ error: 'Archive does not contain files' });
    }

    const authToken = await getToken({ req });
    const jwt = authToken?.access_token as string;

    const batchSize = 50;

    const result = await processBatch(
      filesToUpload,
      async (file) => {
        const targetPath = joinDestinationWithEntryPath(
          destinationUrl,
          file.relativePath,
        );

        const slugs = encodeUrlSlugs(targetPath);
        const uploadUrl = buildApiUrl('v1', slugs);

        logger.debug(`Uploading file to: ${uploadUrl}`);

        const fileName = targetPath.split('/').filter(Boolean).pop() ?? 'file';

        const formData = new FormData();
        formData.append('file', file.content, {
          filename: fileName,
        });

        const baseHeaders = getApiHeaders({ jwt }) as Record<string, string>;
        delete baseHeaders['Content-Type'];

        const multipartHeaders = formData.getHeaders() as Record<
          string,
          string
        >;

        const headers: Record<string, string> = {
          ...baseHeaders,
          ...multipartHeaders,
        };

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(
            `Failed to upload ${targetPath}: ${
              errorText || response.statusText
            }`,
          );
          throw new Error(errorText || `Failed to upload ${targetPath}`);
        }

        return targetPath;
      },
      batchSize,
    );

    const succeeded: UploadArchiveSucceededItem[] = result.succeeded.map(
      (item) => ({
        path: item.result,
      }),
    );

    const errors: UploadArchiveErrorItem[] = result.errors.map((item) => ({
      path: item.item.relativePath,
      error: item.error,
    }));

    return res.status(200).json({ succeeded, errors });
  } catch (error) {
    logger.error(error);

    if (error instanceof DialAIError) {
      const statusCode = parseInt(error.code, 10) || 500;
      return res.status(statusCode).json({ error: error.message });
    }

    return res.status(500).json({ error: errorsMessages.generalServer });
  }
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;

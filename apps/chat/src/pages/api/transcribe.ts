import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { ApiUtils } from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { getFullToken } from '@/src/utils/server/server';

import { HTTPMethod } from '@/src/types/http';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '@/src/constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

interface TranscribeRequestBody {
  audioData: string;
  mimeType: string;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== HTTPMethod.POST) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const asrModelId = process.env.ASR_MODEL;
  if (!asrModelId) {
    logger.error('ASR_MODEL environment variable is not configured');
    return res.status(500).json({ error: errorsMessages.generalServer });
  }

  const { audioData, mimeType } = req.body as TranscribeRequestBody;
  if (!audioData || !mimeType) {
    return res.status(400).json({ error: errorsMessages[400] });
  }

  try {
    const token = await getFullToken({ req });

    const url = `${DIAL_API_HOST}/openai/deployments/${ApiUtils.encodeApiUrl(asrModelId)}/chat/completions?api-version=${DIAL_API_VERSION}`;

    const requestHeaders = getApiHeaders({
      jwt: token?.token ?? '',
      jobTitle: token?.jobTitle,
    });

    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: 'Transcribe this audio.',
          custom_content: {
            attachments: [
              {
                type: mimeType.split(';')[0],
                title: 'voice-recording',
                data: audioData,
              },
            ],
          },
        },
      ],
      stream: false,
      model: asrModelId,
    });

    const response = await fetch(url, {
      headers: requestHeaders,
      method: HTTPMethod.POST,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, body: errorText },
        `Transcription request to ASR model '${asrModelId}' failed`,
      );
      return res.status(response.status).json({
        error: `Transcription failed with status ${response.status}`,
      });
    }

    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const transcript = result.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({ transcript });
  } catch (error) {
    logger.error({ error }, 'Error during audio transcription');
    return res.status(500).json({ error: errorsMessages.generalServer });
  }
};

// sizeLimit must be a static literal — Next.js does not resolve imported
// identifiers in `config`. Keep in sync with TRANSCRIBE_SIZE_LIMIT_BYTES
// in src/constants/audio.ts (currently 5 MB = 5 * 1024 * 1024).
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default handler;

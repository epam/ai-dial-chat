import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { getHeaders } from '../../utils/server/getHeaders';
import { OPENAI_API_HOST } from '@/utils/app/const';

import { RateBody } from '../../types/chat';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  try {
    const { key, message, model, value } = req.body as RateBody;

    const url = `${OPENAI_API_HOST}/v1/rate`;

    await fetch(url, {
      headers: getHeaders(key),
      method: 'POST',
      body: JSON.stringify({
        model: model.id,
        rate: value,
        message: message.content,
      }),
    }).then((r) => r.status);
  } catch (error) {
    console.error(error);
  }

  return res.status(200).json({});
};

export default handler;

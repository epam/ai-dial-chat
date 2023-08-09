import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getApiHeaders } from '../../utils/server/getHeaders';
import { OPENAI_API_HOST } from '@/utils/app/const';

import { RateBody } from '../../types/chat';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';
import { validate } from 'uuid';

// export const config = {
//   runtime: 'edge',
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  try {
    const { key, messageId, model, value, id } = req.body as RateBody;

    if (!id || !validate(id) || !messageId) {
      return res.status(400).send(errorsMessages[400]);
    }

    const url = `${OPENAI_API_HOST}/v1/rate`;
    const token = await getToken({ req });

    await fetch(url, {
      headers: getApiHeaders({
        key,
        chatId: id,
        jwt: token?.access_token as string,
      }),
      method: 'POST',
      body: JSON.stringify({
        model: model.id,
        rate: value,
        responseId: messageId,
      }),
    }).then((r) => r.status);
  } catch (error) {
    console.error(error);
  }

  return res.status(200).json({});
};

export default handler;

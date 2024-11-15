import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

import NextClient from '@/src/utils/auth/nextauth-client';
import { logger } from '@/src/utils/server/logger';

const DEFAULT_LOGOUT_REDIRECT_URI =
  process.env.NEXTAUTH_URL || 'http://localhost:3000/';

/**
 * Federated logout handler
 *
 * 1. Retrieves the user's authentication token via JWT.
 * 2. Validates the presence and type of `providerId` in the token.
 * 3. If the provider supports logout, generates a URL for session termination.
 * 4. Returns the logout URL in JSON format or `null` if logout is not possible.
 *
 * @param req - HTTP request (NextApiRequest)
 * @param res - HTTP response (NextApiResponse)
 *
 * @returns A JSON response with the logout URL or `null` in case of an error.
 */
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> => {
  try {
    const token = await getToken({ req });

    if (!token || typeof token.providerId !== 'string') {
      logger.warn('Token is missing or providerId not found.');
      res.status(200).json({ url: null });
      return;
    }

    const client = NextClient.getClient(token.providerId);

    if (!client) {
      logger.warn(`Client for providerId ${token.providerId} not found.`);
      res.status(200).json({ url: null });
      return;
    }

    const url = client.endSessionUrl({
      post_logout_redirect_uri: DEFAULT_LOGOUT_REDIRECT_URI,
      id_token_hint: token.idToken as string,
    });

    if (!url) {
      logger.warn(
        `End session URL not found for providerId ${token.providerId}.`,
      );
      res.status(200).json({ url: null });
      return;
    }

    res.status(200).json({ url });
  } catch (error) {
    logger.error('Error during federated logout:', error);
    res.status(200).json({ url: null });
  }
};

export default handler;

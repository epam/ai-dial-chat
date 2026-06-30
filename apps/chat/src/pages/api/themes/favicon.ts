import { NextApiRequest, NextApiResponse } from 'next';

import { isAbsoluteUrl } from '@/src/utils/app/file';
import { getImageUrl } from '@/src/utils/app/themes';
import { logger } from '@/src/utils/server/logger';

import { HTTPMethod } from '@/src/types/http';
import { ThemesConfig } from '@/src/types/themes';

import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

const FAVICON_NAMES = ['chat-favicon', 'favicon'] as const;

let cachedTheme: ThemesConfig | undefined = undefined;
let cachedThemeExpiration: number | undefined;

const fetchFavicon = async (
  res: NextApiResponse,
  theme: ThemesConfig,
): Promise<unknown> => {
  for (const name of FAVICON_NAMES) {
    const imageUrl = getImageUrl(theme, name);
    let finalUrl = imageUrl || name;
    if (!isAbsoluteUrl(finalUrl)) {
      finalUrl = `${process.env.THEMES_CONFIG_HOST}/${finalUrl}`;
    }

    const response = await fetch(finalUrl);

    if (!response.ok) {
      continue;
    }

    const contentType = response.headers.get('content-type');
    return res
      .status(200)
      .setHeader('Content-Type', contentType || 'image/png')
      .setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
      .send(Buffer.from(await response.arrayBuffer()));
  }

  return res.status(404).send('Image not found');
};

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (!process.env.THEMES_CONFIG_HOST) {
      return res.status(500).send(errorsMessages.customThemesConfigNotProvided);
    }

    if (
      cachedThemeExpiration &&
      cachedTheme &&
      cachedThemeExpiration > Date.now()
    ) {
      return fetchFavicon(res, cachedTheme);
    }

    const controller = new AbortController();
    const response = await fetch(
      `${process.env.THEMES_CONFIG_HOST}/config.json`,
      {
        method: HTTPMethod.GET,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=604800',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      logger.error(
        `Received error when fetching config file: ${response.status} ${
          response.statusText
        } ${await response.text()}`,
      );
      return res.status(500).send(errorsMessages.generalServer);
    }

    const json = (await response.json()) as ThemesConfig;

    const dayInMs = 86400000;
    cachedThemeExpiration = Date.now() + dayInMs;
    cachedTheme = json;

    return fetchFavicon(res, cachedTheme);
  } catch (e) {
    logger.error(e);
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;

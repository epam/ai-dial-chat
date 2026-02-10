import { NextApiRequest, NextApiResponse } from 'next';

import { logger } from '@/src/utils/server/logger';

import { HTTPMethod } from '@/src/types/http';
import { ThemesConfig } from '@/src/types/themes';

import { errorsMessages } from '@/src/constants/errors';
import { FALLBACK_THEME_CONFIG } from '@/src/constants/themes';

import fetch from 'node-fetch';

let cachedThemes: ThemesConfig = FALLBACK_THEME_CONFIG;
let cachedThemesExpiration: number | undefined;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.THEMES_CONFIG_HOST) {
    return res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .send(FALLBACK_THEME_CONFIG);
  }

  if (
    cachedThemesExpiration &&
    cachedThemes &&
    cachedThemesExpiration > Date.now()
  ) {
    return res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .send(cachedThemes);
  }

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.THEMES_CONFIG_HOST}/config.json`,
    {
      method: HTTPMethod.GET,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
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

  cachedThemes = {
    ...json,
    themes: Array.isArray(json.themes) ? json.themes : [],
  };
  cachedThemesExpiration = Date.now() + dayInMs;

  return res
    .status(200)
    .setHeader('Content-Type', 'application/json')
    .send(cachedThemes);
};

export default handler;

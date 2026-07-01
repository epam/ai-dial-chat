import { NextApiResponse } from 'next';

import { logger } from '@/src/utils/server/logger';

import { HTTPMethod } from '@/src/types/http';
import { ThemesConfig } from '@/src/types/themes';

import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

let cachedTheme: ThemesConfig | undefined = undefined;
let cachedThemeExpiration: number | undefined;

const loadThemesConfig = async (): Promise<ThemesConfig> => {
  if (
    cachedTheme &&
    cachedThemeExpiration &&
    cachedThemeExpiration > Date.now()
  ) {
    return cachedTheme;
  }

  const response = await fetch(
    `${process.env.THEMES_CONFIG_HOST}/config.json`,
    {
      method: HTTPMethod.GET,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=604800',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Received error when fetching config file: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as ThemesConfig;
  const dayInMs = 86400000;
  cachedThemeExpiration = Date.now() + dayInMs;
  cachedTheme = json;
  return cachedTheme;
};

export const withThemesConfig = async (
  res: NextApiResponse,
  callback: (theme: ThemesConfig) => Promise<unknown>,
): Promise<unknown> => {
  try {
    if (!process.env.THEMES_CONFIG_HOST) {
      return res.status(500).send(errorsMessages.customThemesConfigNotProvided);
    }

    const theme = await loadThemesConfig();
    return callback(theme);
  } catch (e) {
    logger.error(e);
    return res.status(500).send(errorsMessages.generalServer);
  }
};

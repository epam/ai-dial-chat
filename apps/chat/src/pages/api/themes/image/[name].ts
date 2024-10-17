import { NextApiRequest, NextApiResponse } from 'next';

import { isAbsoluteUrl } from '@/src/utils/app/file';
import { logger } from '@/src/utils/server/logger';

import { HTTPMethod } from '@/src/types/http';
import { ThemesConfig } from '@/src/types/themes';

import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

let cachedTheme: ThemesConfig | undefined = undefined;
let cachedThemeExpiration: number | undefined;

const getImageUrl = (theme: ThemesConfig, name: string): string | undefined => {
  return theme.images[name as keyof ThemesConfig['images']];
};

const getImage = async (
  req: NextApiRequest,
  res: NextApiResponse,
  cachedTheme: ThemesConfig,
  name: string,
) => {
  const imageUrl = getImageUrl(cachedTheme, name);

  let finalUrl = imageUrl || name;
  if (!isAbsoluteUrl(finalUrl)) {
    finalUrl = `${process.env.THEMES_CONFIG_HOST}/${finalUrl}`;
  }
  const response = await fetch(finalUrl);
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    if (name === 'default-model' || name === 'default-addon') {
      return res.redirect(
        307,
        `//${req.headers.host}/images/icons/message-square-lines-alt.svg`,
      );
    }
    return res.status(404).send('Image not found');
  }

  return res
    .status(200)
    .setHeader('Content-Type', contentType || 'image/png')
    .send(Buffer.from(await response.arrayBuffer()));
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    if (!process.env.THEMES_CONFIG_HOST) {
      return res.status(500).send(errorsMessages.customThemesConfigNotProvided);
    }

    const name = req.query.name;

    if (!name || Array.isArray(name)) {
      return res
        .status(500)
        .send('Name parameter not provided for theme image');
    }

    if (
      cachedThemeExpiration &&
      cachedTheme &&
      cachedThemeExpiration > Date.now()
    ) {
      return getImage(req, res, cachedTheme, name);
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

    return getImage(req, res, cachedTheme, name);
  } catch (e) {
    logger.error(e);
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;

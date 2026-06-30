import { NextApiRequest, NextApiResponse } from 'next';

import { isAbsoluteUrl } from '@/src/utils/app/file';
import { getImageUrl } from '@/src/utils/app/themes';
import { withThemesConfig } from '@/src/utils/server/themes-config';

import { ThemesConfig } from '@/src/types/themes';

import fetch from 'node-fetch';

const FAVICON_NAMES = ['chat-favicon', 'favicon'] as const;

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
  return withThemesConfig(res, (theme) => fetchFavicon(res, theme));
};

export default handler;

import { NextApiRequest, NextApiResponse } from 'next';

import { isAbsoluteUrl } from '@/src/utils/app/file';
import { getImageUrl } from '@/src/utils/app/themes';
import { withThemesConfig } from '@/src/utils/server/themes-config';

import { ThemesConfig } from '@/src/types/themes';

import fetch from 'node-fetch';

const getImage = async (
  _req: NextApiRequest,
  res: NextApiResponse,
  cachedTheme: ThemesConfig,
  name: string,
) => {
  const imageUrl = getImageUrl(cachedTheme, name);

  // Block absolute URLs passed directly as name to prevent SSRF
  if (!imageUrl && isAbsoluteUrl(name)) {
    return res.status(404).send('Image not found');
  }

  let finalUrl = imageUrl || name;
  if (!isAbsoluteUrl(finalUrl)) {
    finalUrl = `${process.env.THEMES_CONFIG_HOST}/${finalUrl}`;
  }

  const response = await fetch(finalUrl);
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    return res.status(404).send('Image not found');
  }

  return res
    .status(200)
    .setHeader('Content-Type', contentType || 'image/png')
    .setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    .send(Buffer.from(await response.arrayBuffer()));
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const name = req.query.name;

  if (!name || Array.isArray(name)) {
    return res.status(500).send('Name parameter not provided for theme image');
  }

  return withThemesConfig(res, (theme) => getImage(req, res, theme, name));
};

export default handler;

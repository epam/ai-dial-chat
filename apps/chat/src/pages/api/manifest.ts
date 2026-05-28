import { NextApiRequest, NextApiResponse } from 'next';

import { faviconUrl } from '@/src/utils/app/themes';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  description: string;
}

interface ManifestShortcut {
  name: string;
  url: string;
  description: string;
}

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  description: string;
  lang: string;
  dir: string;
  theme_color: string;
  background_color: string;
  orientation: string;
  icons: ManifestIcon[];
  screenshots: ManifestScreenshot[];
  related_applications: unknown[];
  prefer_related_applications: boolean;
  shortcuts: ManifestShortcut[];
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'DIAL';
  res.setHeader('Content-Type', 'application/json');

  const response: Manifest = {
    name: appName,
    short_name: appName,
    start_url: '/',
    display: 'standalone',
    description: 'ChatGPT but better.',
    lang: 'en-US',
    dir: 'auto',
    theme_color: '#0C101DB3',
    background_color: '#0C101DB3',
    orientation: 'any',
    icons: [],
    screenshots: [],
    related_applications: [],
    prefer_related_applications: false,
    shortcuts: [
      {
        name: appName,
        url: '/',
        description: 'ChatGPT but better.',
      },
    ],
  };

  if (process.env.THEMES_CONFIG_HOST) {
    response.icons.push({
      src: faviconUrl,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    });

    response.screenshots.push({
      src: faviconUrl,
      sizes: '2880x1800',
      type: 'image/png',
      description: 'Logo',
    });
  }

  res.status(200).json(response);
}

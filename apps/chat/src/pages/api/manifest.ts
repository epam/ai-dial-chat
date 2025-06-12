import { NextApiRequest, NextApiResponse } from 'next';

import { getThemeIconUrl } from '@/src/utils/app/themes';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'AI DIAL';
  const iconUrl = getThemeIconUrl('favicon');
  const logoUrl = getThemeIconUrl('dark-logo');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    name: appName,
    short_name: appName,
    start_url: '/',
    display: 'standalone',
    description: 'ChatGPT but better.',
    lang: 'en-US',
    dir: 'auto',
    theme_color: '#090D13B3',
    background_color: '#090D13B3',
    orientation: 'any',
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: logoUrl,
        sizes: '2880x1800',
        type: 'image/png',
        description: 'Logo',
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
    shortcuts: [
      {
        name: appName,
        url: '/',
        description: 'ChatGPT but better.',
      },
    ],
  });
}

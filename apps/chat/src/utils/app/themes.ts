import { ThemesConfig } from '@/src/types/themes';

import { isAbsoluteUrl } from './file';

export const getThemeIconUrl = (iconUrl: string) =>
  isAbsoluteUrl(iconUrl)
    ? iconUrl
    : `/api/themes/image/${encodeURIComponent(iconUrl)}`;

export const faviconUrl = '/api/themes/favicon';

export const getImageUrl = (theme: ThemesConfig, name: string): string => {
  return theme.images[name as keyof ThemesConfig['images']] as string;
};

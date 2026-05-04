import { ThemesConfig } from '@src/utils/app/themes';
import { isAbsoluteUrl } from './file';

export const getThemeIconUrl = (iconUrl: string) =>
  isAbsoluteUrl(iconUrl)
    ? iconUrl
    : `/api/themes/image/${encodeURIComponent(iconUrl)}`;

    export const getFavIconUrl = (config: ThemesConfig) => getThemeIconUrl('favicon');

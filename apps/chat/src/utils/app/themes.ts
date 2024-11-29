import { isAbsoluteUrl } from './file';

export const getThemeIconUrl = (iconUrl: string) =>
  isAbsoluteUrl(iconUrl)
    ? iconUrl
    : `/api/themes/image/${encodeURIComponent(iconUrl)}`;

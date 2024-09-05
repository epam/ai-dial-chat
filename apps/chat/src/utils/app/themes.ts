import { constructPath, isAbsoluteUrl } from './file';
import { isFileId } from './id';

export const getThemeIconUrl = (iconUrl: string) => {
  if (isFileId(iconUrl)) {
    return constructPath('api', iconUrl);
  }

  if (isAbsoluteUrl(iconUrl)) {
    return iconUrl;
  }

  return constructPath('api', 'themes', 'image', encodeURIComponent(iconUrl));
};

import { DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';

export class IconApiHelper extends BaseApiHelper {
  public getEntityIcon(entity: DialAIEntityModel) {
    const iconUrl = entity.iconUrl;
    if (iconUrl) {
      return this.isAbsoluteUrl(iconUrl)
        ? iconUrl
        : `${API.themeUrl}/${encodeURIComponent(iconUrl)}`;
    } else {
      return API.defaultIconHost();
    }
  }

  public static getNonCachedIconSource(iconSource: string | null) {
    return iconSource ? iconSource.replace('?v2', '') : '';
  }

  private isAbsoluteUrl = (url: string): boolean => {
    const urlLower = url.toLowerCase();
    return [
      'data:',
      '//',
      'http://',
      'https://',
      'file://',
      'ftp://',
      'mailto:',
      'telnet://',
    ].some((prefix) => urlLower.startsWith(prefix));
  };
}

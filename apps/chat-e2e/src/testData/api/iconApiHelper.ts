import { EntityType } from '@/chat/types/common';
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
      switch (entity.type) {
        case EntityType.Model:
        case EntityType.Application:
          return API.defaultModelIconHost();
        case EntityType.Addon:
          return API.defaultAddonIconHost();
        default:
          return '';
      }
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

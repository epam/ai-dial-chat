import { DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { Tags } from '@/src/ui/domData';

export class IconApiHelper extends BaseApiHelper {
  public async getDefaultEntityIcon() {
    return API.defaultIconHost();
  }

  public async getEntityIcon(entity: DialAIEntityModel) {
    const iconUrl = entity.iconUrl;
    if (iconUrl && iconUrl.includes(Tags.svg)) {
      return this.isAbsoluteUrl(iconUrl)
        ? iconUrl
        : `${API.themeUrl}/${encodeURIComponent(iconUrl)}`;
    } else {
      return await this.getDefaultEntityIcon();
    }
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

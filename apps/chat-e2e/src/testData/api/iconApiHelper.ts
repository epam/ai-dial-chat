import { DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { Tags } from '@/src/ui/domData';

export class IconApiHelper extends BaseApiHelper {
  public async getDefaultEntityIcon() {
    const response = await this.request.get(API.defaultIconHost());
    return this.formatIconResponse(response.text());
  }

  public async getEntityIcon(entity: DialAIEntityModel) {
    let icon;
    const iconUrl = entity.iconUrl;
    if (iconUrl && iconUrl.includes(Tags.svg)) {
      const url = this.isAbsoluteUrl(iconUrl)
        ? iconUrl
        : `${API.themeUrl}/${encodeURIComponent(iconUrl)}`;
      const response = await this.request.get(url);
      icon = await this.formatIconResponse(response.text());
    } else {
      icon = await this.getDefaultEntityIcon();
    }
    return icon;
  }

  private async formatIconResponse(responseText: Promise<string>) {
    return responseText.then((resp) =>
      resp
        .replaceAll('\n', '')
        .replaceAll(/.*<svg[^>]*>/g, '')
        .replaceAll(/<\/svg>/g, '')
        .replaceAll(/\s{2,}/g, '')
        .replaceAll(/><\/path>$/g, Tags.closingTag),
    );
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

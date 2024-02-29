import { OpenAIEntityModel } from '@/chat/types/openai';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { Tags } from '@/src/ui/domData';

export class IconApiHelper extends BaseApiHelper {
  public async getDefaultEntityIcon() {
    const response = await this.request.get(API.defaultIconHost);
    return this.formatIconResponse(response.text());
  }

  public async getEntityIcon(entity: OpenAIEntityModel) {
    let icon;
    if (entity.iconUrl && entity.iconUrl.includes(Tags.svg)) {
      const response = await this.request.get(entity.iconUrl);
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
}

import { InfoTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatInfoTooltip extends BaseElement {
  constructor(page: Page) {
    super(page, InfoTooltip.infoTooltip);
  }

  public modelInfo = this.getChildElementBySelector(InfoTooltip.modelInfo);
  public versionInfo = this.getChildElementBySelector(InfoTooltip.versionInfo);

  public async getModelInfo() {
    return this.modelInfo.getElementInnerContent();
  }

  public async getVersionInfo() {
    const isVersionVisible = await this.versionInfo.isVisible();
    return isVersionVisible
      ? this.versionInfo.getElementInnerContent()
      : undefined;
  }
}

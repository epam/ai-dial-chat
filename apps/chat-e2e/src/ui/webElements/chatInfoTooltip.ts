import { ModelTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatInfoTooltip extends BaseElement {
  constructor(page: Page) {
    super(page, ModelTooltip.modelTooltip);
  }

  public modelInfo = this.getChildElementBySelector(ModelTooltip.modelInfo);
  public versionInfo = this.getChildElementBySelector(ModelTooltip.versionInfo);

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

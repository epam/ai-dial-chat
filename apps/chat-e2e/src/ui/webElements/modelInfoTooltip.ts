import { ModelTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ModelInfoTooltip extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, ModelTooltip.modelTooltip, parentLocator);
  }

  public title = this.getChildElementBySelector(ModelTooltip.title);
  public modelInfo = this.getChildElementBySelector(ModelTooltip.modelInfo);
  public versionInfo = this.getChildElementBySelector(ModelTooltip.versionInfo);

  public async getModelInfo() {
    return this.modelInfo.getElementInnerContent();
  }

  public getModelIcon() {
    return this.getElementIcon(this.modelInfo.getElementLocator());
  }

  public async getVersionInfo() {
    const isVersionVisible = await this.versionInfo.isVisible();
    return isVersionVisible
      ? this.versionInfo.getElementInnerContent()
      : undefined;
  }
}

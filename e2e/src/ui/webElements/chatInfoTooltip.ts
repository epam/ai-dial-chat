import { Tags } from '@/e2e/src/ui/domData';
import { InfoTooltip } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement, EntityIcon } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatInfoTooltip extends BaseElement {
  constructor(page: Page) {
    super(page, InfoTooltip.infoTooltip);
  }

  public modelInfo = this.getChildElementBySelector(InfoTooltip.modelInfo);
  public applicationInfo = this.getChildElementBySelector(
    InfoTooltip.applicationInfo,
  );
  public assistantInfo = this.getChildElementBySelector(
    InfoTooltip.assistantInfo,
  );
  public assistantModelInfo = this.getChildElementBySelector(
    InfoTooltip.assistantModelInfo,
  );
  public promptInfo = this.getChildElementBySelector(InfoTooltip.promptInfo);
  public temperatureInfo = this.getChildElementBySelector(InfoTooltip.tempInfo);
  public addonsInfo = this.getChildElementBySelector(InfoTooltip.addonsInfo);

  public async getModelInfo() {
    return this.modelInfo.getElementInnerContent();
  }

  public async getModelIcon() {
    return this.getElementIconHtml(this.modelInfo.getElementLocator());
  }

  public async getApplicationInfo() {
    return this.applicationInfo.getElementInnerContent();
  }

  public async getAssistantInfo() {
    return this.assistantInfo.getElementInnerContent();
  }

  public async getAssistantModelInfo() {
    return this.assistantModelInfo.getElementInnerContent();
  }

  public async getPromptInfo() {
    return (await this.promptInfo.isVisible())
      ? await this.promptInfo.getElementInnerContent()
      : '';
  }

  public async getTemperatureInfo() {
    return this.temperatureInfo.getElementInnerContent();
  }

  public async getAddonsInfo() {
    return this.addonsInfo.getElementsInnerContent();
  }

  public async getAddonIcons() {
    const allIcons: EntityIcon[] = [];
    const addonsCount = await this.addonsInfo.getElementsCount();
    for (let i = 1; i <= addonsCount; i++) {
      const addon = await this.addonsInfo.getNthElement(i);
      const addonName = await addon.locator(Tags.desc).textContent();
      const iconHtml = await this.getElementIconHtml(addon);
      allIcons.push({ entityName: addonName!, icon: iconHtml });
    }
    return allIcons;
  }
}

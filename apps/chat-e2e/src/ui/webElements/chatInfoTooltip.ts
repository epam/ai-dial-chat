import { Attributes } from '../domData';

import { InfoTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
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
  public versionInfo = this.getChildElementBySelector(InfoTooltip.versionInfo);

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

  public async getVersionInfo() {
    const isVersionVisible = await this.versionInfo.isVisible();
    return isVersionVisible
      ? this.versionInfo.getElementInnerContent()
      : undefined;
  }

  public async getPromptInfo(isPromptExpected = true) {
    if (isPromptExpected) {
      await this.promptInfo.waitForState({ state: 'attached' });
      return this.promptInfo.getElementInnerContent();
    }
    return '';
  }

  public async getTemperatureInfo() {
    return this.temperatureInfo.getElementInnerContent();
  }

  public async getAddonsInfo() {
    return this.addonsInfo.getElementsInnerContent();
  }

  public async getAddonIcons() {
    return this.getElementIcons(this.addonsInfo, Attributes.title);
  }
}

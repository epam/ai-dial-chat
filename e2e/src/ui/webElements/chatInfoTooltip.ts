import { Attributes } from '@/e2e/src/ui/domData';
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { InfoTooltip } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatInfoTooltip extends BaseElement {
  constructor(page: Page) {
    super(page, InfoTooltip.infoTooltip);
  }

  public modelInfo = this.getChildElementBySelector(InfoTooltip.modelInfo);
  public modelInfoIcon = this.getChildElementBySelector(
    `${InfoTooltip.modelInfo} >> ${ChatSelectors.chatIcon}`,
  );
  public applicationInfo = this.getChildElementBySelector(
    InfoTooltip.applicationInfo,
  );
  public applicationInfoIcon = this.getChildElementBySelector(
    `${InfoTooltip.applicationInfo} >> ${ChatSelectors.chatIcon}`,
  );
  public assistantInfo = this.getChildElementBySelector(
    InfoTooltip.assistantInfo,
  );
  public assistantInfoIcon = this.getChildElementBySelector(
    `${InfoTooltip.assistantInfo} >> ${ChatSelectors.chatIcon}`,
  );
  public assistantModelInfo = this.getChildElementBySelector(
    InfoTooltip.assistantModelInfo,
  );
  public assistantModelInfoIcon = this.getChildElementBySelector(
    `${InfoTooltip.assistantModelInfo} >> ${ChatSelectors.chatIcon}`,
  );
  public promptInfo = this.getChildElementBySelector(InfoTooltip.promptInfo);
  public temperatureInfo = this.getChildElementBySelector(InfoTooltip.tempInfo);
  public addonsInfo = this.getChildElementBySelector(InfoTooltip.addonsInfo);
  public addonIcon = this.getChildElementBySelector(
    `${InfoTooltip.addonsInfo} >> ${ChatSelectors.chatIcon}`,
  );

  public async getModelInfo() {
    return this.modelInfo.getElementInnerContent();
  }

  public async getModelIcon() {
    return this.modelInfoIcon.getAttribute(Attributes.src);
  }

  public async getApplicationInfo() {
    return this.applicationInfo.getElementInnerContent();
  }

  public async getApplicationIcon() {
    return this.applicationInfoIcon.getAttribute(Attributes.src);
  }

  public async getAssistantInfo() {
    return this.assistantInfo.getElementInnerContent();
  }

  public async getAssistantIcon() {
    return this.assistantInfoIcon.getAttribute(Attributes.src);
  }

  public async getAssistantModelInfo() {
    return this.assistantModelInfo.getElementInnerContent();
  }

  public async getAssistantModelIcon() {
    return this.assistantModelInfoIcon.getAttribute(Attributes.src);
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
    const iconUrls = [];
    const addonsCount = await this.addonIcon.getElementsCount();
    for (let i = 0; i < addonsCount; i++) {
      iconUrls.push(
        await this.addonIcon.getNthElement(i + 1).getAttribute(Attributes.src),
      );
    }
    return iconUrls;
  }
}

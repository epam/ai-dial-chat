import { SettingsTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatSettingsTooltip extends BaseElement {
  constructor(page: Page) {
    super(page, SettingsTooltip.settingsTooltip);
  }

  public applicationInfo = this.getChildElementBySelector(
    SettingsTooltip.applicationInfo,
  );
  public assistantInfo = this.getChildElementBySelector(
    SettingsTooltip.assistantInfo,
  );
  public assistantModelInfo = this.getChildElementBySelector(
    SettingsTooltip.assistantModelInfo,
  );
  public promptInfo = this.getChildElementBySelector(
    SettingsTooltip.promptInfo,
  );
  public temperatureInfo = this.getChildElementBySelector(
    SettingsTooltip.tempInfo,
  );
  public addonsInfo = this.getChildElementBySelector(
    SettingsTooltip.addonsInfo,
  );

  public async getApplicationInfo() {
    return this.applicationInfo.getElementInnerContent();
  }

  public async getAssistantInfo() {
    return this.assistantInfo.getElementInnerContent();
  }

  public async getAssistantModelInfo() {
    return this.assistantModelInfo.getElementInnerContent();
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
    return this.getElementIcons(this.addonsInfo);
  }
}

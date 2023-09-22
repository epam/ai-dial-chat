import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Addons } from '@/e2e/src/ui/webElements/addons';
import { ModelSelector } from '@/e2e/src/ui/webElements/modelSelector';
import { MoreInfo } from '@/e2e/src/ui/webElements/moreInfo';
import { PromptList } from '@/e2e/src/ui/webElements/promptList';
import { TemperatureSlider } from '@/e2e/src/ui/webElements/temperatureSlider';
import { Page } from '@playwright/test';

export class EntitySettings extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.entitySettings);
  }

  public systemPrompt = this.getChildElementBySelector(
    ChatSelectors.systemPrompt,
  );
  private temperatureSlider!: TemperatureSlider;
  private addons!: Addons;
  private modelSelector!: ModelSelector;
  private moreInfo!: MoreInfo;
  private promptList!: PromptList;

  getPromptList() {
    if (!this.promptList) {
      this.promptList = new PromptList(this.page);
    }
    return this.promptList;
  }

  getTemperatureSlider(): TemperatureSlider {
    if (!this.temperatureSlider) {
      this.temperatureSlider = new TemperatureSlider(this.page);
    }
    return this.temperatureSlider;
  }

  getAddons(): Addons {
    if (!this.addons) {
      this.addons = new Addons(this.page);
    }
    return this.addons;
  }

  getModelSelector(): ModelSelector {
    if (!this.modelSelector) {
      this.modelSelector = new ModelSelector(this.page);
    }
    return this.modelSelector;
  }

  getMoreInfo(): MoreInfo {
    if (!this.moreInfo) {
      this.moreInfo = new MoreInfo(this.page);
    }
    return this.moreInfo;
  }

  public async setSystemPrompt(prompt: string) {
    await this.systemPrompt.fillInInput(prompt);
  }

  public async getSystemPrompt() {
    return this.systemPrompt.getElementContent();
  }

  public async clearSystemPrompt() {
    return this.systemPrompt.fillInInput('');
  }
}

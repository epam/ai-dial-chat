import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Addons } from '@/e2e/src/ui/webElements/addons';
import { ModelSelector } from '@/e2e/src/ui/webElements/modelSelector';
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
  private seeFullListButton = this.getChildElementBySelector(
    ChatSelectors.seeFullList,
  );
  private addons!: Addons;
  private modelSelector!: ModelSelector;

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

  public async setSystemPrompt(prompt: string) {
    await this.systemPrompt.fillInInput(prompt);
  }

  public async getSystemPrompt() {
    return this.systemPrompt.getElementContent();
  }
}

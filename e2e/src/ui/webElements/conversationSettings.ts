import { ChatSelectors } from '../selectors';
import { Addons } from './addons';
import { BaseElement } from './baseElement';
import { EntitySelector } from './entitySelector';
import { TemperatureSlider } from './temperatureSlider';

import { Page } from '@playwright/test';

export class ConversationSettings extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.conversationSettingsSelector);
  }

  private entitySelector!: EntitySelector;
  private temperatureSlider!: TemperatureSlider;
  private addons!: Addons;
  public systemPrompt = this.getChildElementBySelector(
    ChatSelectors.systemPrompt,
  );

  getEntitySelector(): EntitySelector {
    if (!this.entitySelector) {
      this.entitySelector = new EntitySelector(this.page);
    }
    return this.entitySelector;
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

  public async setSystemPrompt(prompt: string) {
    await this.systemPrompt.fillInInput(prompt);
  }
}

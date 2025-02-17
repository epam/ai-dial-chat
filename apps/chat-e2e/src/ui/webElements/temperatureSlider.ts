import { ChatSettingsModalSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class TemperatureSlider extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsModalSelectors.temperatureSlider, parentLocator);
  }
  public slider = this.getChildElementBySelector(
    ChatSettingsModalSelectors.slider,
  );

  async getTemperature() {
    return this.slider.getElementContent();
  }

  async setTemperature(temperature: string | number) {
    const numericTemperature =
      typeof temperature === 'string' ? parseFloat(temperature) : temperature;

    await this.slider.scrollIntoElementView();
    const bounding = await this.slider.getElementBoundingBox();
    await this.page.mouse.move(
      bounding!.x + bounding!.width! * numericTemperature,
      bounding!.y + bounding!.height! / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.up();
  }
}

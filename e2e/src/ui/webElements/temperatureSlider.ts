import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class TemperatureSlider extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.temperatureSlider);
  }
  public slider = this.getChildElementBySelector(ChatSelectors.slider);

  async getTemperature() {
    return this.slider.getElementContent();
  }

  async setTemperature(temperature: number) {
    const bounding = await this.slider.getElementBoundingBox();
    await this.page.mouse.move(
      bounding!.x + bounding!.width! * temperature,
      bounding!.y + bounding!.height! / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.up();
  }
}

import { Attributes } from '../domData';
import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class TemperatureSlider extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.temperatureSlider);
  }
  private slider = this.getChildElementBySelector(Tags.input);

  async getTemperatureValue() {
    return this.slider.getAttribute(Attributes.value);
  }
}

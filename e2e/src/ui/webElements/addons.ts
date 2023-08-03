import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class Addons extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.addons);
  }
  public addons = this.getChildElementBySelector(Tags.button);
  private addon = (option: string): Locator =>
    this.getChildElementBySelector(Tags.button).getElementLocatorByText(option);
}

import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class EntitySelectorMenu extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.entityMenu);
  }

  private entityMenuOption = (option: string): Locator =>
    this.getChildElementBySelector(Tags.span).getElementLocatorByText(option);

  public async selectEntity(option: string) {
    await this.entityMenuOption(option).click();
  }
}

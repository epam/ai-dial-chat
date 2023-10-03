import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Locator, Page } from '@playwright/test';

export class PromptList extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.promptList, parentLocator);
  }

  public getPromptByName(name: string) {
    return this.getChildElementBySelector(
      ChatSelectors.promptOption,
    ).getElementLocatorByText(name);
  }

  public async selectPrompt(name: string) {
    await this.getPromptByName(name).click();
  }
}

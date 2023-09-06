import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class PromptList extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.promptList);
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

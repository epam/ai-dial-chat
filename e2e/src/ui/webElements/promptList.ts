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
    const promptOption = this.getPromptByName(name);
    const listBounding = await promptOption.boundingBox();
    await this.page.mouse.move(
      listBounding!.x + listBounding!.width / 2,
      listBounding!.y + listBounding!.height / 2,
    );
    await promptOption.click();
  }
}

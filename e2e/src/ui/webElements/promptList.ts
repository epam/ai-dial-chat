import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ExpectedConstants } from '@/e2e/src/testData';
import { Attributes } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { Locator, Page } from '@playwright/test';

export class PromptList extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.promptList, parentLocator);
  }

  public getPromptOptions() {
    return this.getChildElementBySelector(ChatSelectors.promptOption);
  }

  public getPromptByName(name: string) {
    return this.getPromptOptions().getElementLocatorByText(name);
  }

  public async selectPrompt(name: string) {
    const optionsCount = await this.getPromptOptions().getElementsCount();
    let optionIndex = 1;
    let promptOption;
    while (optionIndex < optionsCount) {
      await this.page.keyboard.press(keys.arrowDown);
      promptOption = this.getPromptByName(name);
      const classValue = await promptOption.getAttribute(Attributes.class);
      if (classValue!.includes(ExpectedConstants.backgroundAccentAttribute)) {
        await this.page.keyboard.press(keys.enter);
        return;
      }
      optionIndex++;
    }
    await this.getPromptByName(name).click();
  }
}

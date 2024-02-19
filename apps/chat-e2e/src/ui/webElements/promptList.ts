import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
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

  public async selectOptionFromList(name: string) {
    let isSelected = false;
    const promptOption = this.getPromptByName(name);
    const classValue = await promptOption.getAttribute(Attributes.class);
    if (classValue!.includes(ExpectedConstants.backgroundAccentAttribute)) {
      if (isApiStorageType) {
        const respPromise = this.page.waitForResponse(
          (resp) => resp.request().method() === 'GET',
        );
        await this.page.keyboard.press(keys.enter);
        await respPromise;
      } else {
        await this.page.keyboard.press(keys.enter);
      }
      await this.waitForState({ state: 'hidden' });
      isSelected = true;
    }
    return isSelected;
  }

  public async selectPrompt(name: string) {
    let isPromptSelected = await this.selectOptionFromList(name);
    if (!isPromptSelected) {
      const optionsCount = await this.getPromptOptions().getElementsCount();
      let optionIndex = 1;
      while (optionIndex < optionsCount) {
        await this.page.keyboard.press(keys.arrowDown);
        isPromptSelected = await this.selectOptionFromList(name);
        if (!isPromptSelected) {
          optionIndex++;
        }
      }
    }
  }
}

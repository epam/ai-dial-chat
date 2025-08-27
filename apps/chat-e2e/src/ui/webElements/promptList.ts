import { PromptListSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { PROMPT_APPLY_DELAY } from '@/src/ui/webElements/chat';
import { Locator, Page } from '@playwright/test';

export class PromptList extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PromptListSelectors.promptList, parentLocator);
  }

  public getPromptOptions() {
    return this.getChildElementBySelector(PromptListSelectors.promptOption);
  }

  public getPromptByName(name: string) {
    return this.getPromptOptions().getElementLocatorByText(name);
  }

  public getPromptOption(name: string) {
    return this.createElementFromLocator(this.getPromptByName(name));
  }

  private async selectOptionFromList(
    name: string,
    method: () => Promise<void>,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'GET' } = {},
  ) {
    let isSelected = false;
    const promptOption = this.getPromptByName(name);
    const classValue = await promptOption.getAttribute(Attributes.class);
    if (classValue!.includes(ExpectedConstants.backgroundAccentAttribute)) {
      if (isApiStorageType) {
        const respPromise = this.page.waitForResponse(
          (resp) => resp.request().method() === triggeredHttpMethod,
        );
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await this.page.waitForTimeout(PROMPT_APPLY_DELAY);
        await method();
        await respPromise;
      } else {
        await method();
      }
      await this.waitForState({ state: 'hidden' });
      isSelected = true;
    }
    return isSelected;
  }

  private async selectOptionFromListWithKeyboard(
    name: string,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'GET' } = {},
  ) {
    return this.selectOptionFromList(
      name,
      () => this.page.keyboard.press(keys.enter),
      { triggeredHttpMethod },
    );
  }

  private async selectOptionFromListWithMouse(
    name: string,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'GET' } = {},
  ) {
    return this.selectOptionFromList(
      name,
      () => this.getPromptByName(name).click(),
      {
        triggeredHttpMethod,
      },
    );
  }

  public async selectPromptWithKeyboard(
    name: string,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'GET' } = {},
  ) {
    let isPromptSelected = await this.selectOptionFromListWithKeyboard(name, {
      triggeredHttpMethod,
    });
    if (!isPromptSelected) {
      const optionsCount = await this.getPromptOptions().getElementsCount();
      let optionIndex = 1;
      while (optionIndex < optionsCount) {
        await this.page.keyboard.press(keys.arrowDown);
        isPromptSelected = await this.selectOptionFromListWithKeyboard(name, {
          triggeredHttpMethod,
        });
        if (isPromptSelected) {
          break;
        }
        optionIndex++;
      }
    }
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(PROMPT_APPLY_DELAY);
  }

  public async selectPromptWithMouse(
    name: string,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'GET' } = {},
  ) {
    let isPromptSelected = await this.selectOptionFromListWithMouse(name, {
      triggeredHttpMethod,
    });
    if (!isPromptSelected) {
      const optionsCount = await this.getPromptOptions().getElementsCount();
      let optionIndex = 1;
      while (optionIndex < optionsCount) {
        await this.getPromptOptions().getNthElement(optionIndex).hover();
        isPromptSelected = await this.selectOptionFromListWithMouse(name, {
          triggeredHttpMethod,
        });
        if (isPromptSelected) {
          break;
        }
        optionIndex++;
      }
    }
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(PROMPT_APPLY_DELAY);
  }
}

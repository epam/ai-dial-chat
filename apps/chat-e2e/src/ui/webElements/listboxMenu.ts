import { MenuSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/index';
import { RegexUtil } from '@/src/utils';
import { Page } from '@playwright/test';

export class ListboxMenu extends BaseElement {
  constructor(page: Page) {
    super(page, MenuSelectors.listboxMenu);
  }

  public menuOptions = this.getChildElementBySelector(MenuSelectors.menuOption);

  // Method to get all available options from the list
  public async getAllOptions(): Promise<string[]> {
    return this.menuOptions.getElementsInnerContent();
  }

  // Method to select an option by its text
  public async selectOption(option: string) {
    const escapedTopicName = RegexUtil.escapeRegexChars(option);
    const exactMatchRegex = new RegExp(`^${escapedTopicName}$`);
    const optionElement = this.menuOptions
      .getElementLocator()
      .filter({ hasText: exactMatchRegex });
    await optionElement.click();
  }
}

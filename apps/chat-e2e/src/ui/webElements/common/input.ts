import { Tags } from '@/src/ui/domData';
import { IconSelectors, InputSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Input extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, InputSelectors.inputContainer, parentLocator);
  }

  public inputField = this.getChildElementBySelector(Tags.input);
  public alertIcon = this.getChildElementBySelector(IconSelectors.alertIcon);

  public inputContainerByValue(value: string) {
    return this.rootLocator.filter({
      has: this.page.locator(`${Tags.input}${InputSelectors.value(value)}`),
    });
  }

  public alertIconByValue(value: string) {
    return this.inputContainerByValue(value).locator(IconSelectors.alertIcon);
  }
}

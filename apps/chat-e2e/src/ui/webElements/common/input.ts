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
}

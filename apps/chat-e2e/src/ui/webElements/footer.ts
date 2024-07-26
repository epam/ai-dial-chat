import { Tags } from '@/src/ui/domData';
import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class Footer extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.footer, parentLocator);
  }

  public async openFooterLink(linkText?: string) {
    linkText
      ? await this.getElementLocatorByText(linkText).click()
      : await this.getChildElementBySelector(Tags.a).getNthElement(1).click();
  }
}

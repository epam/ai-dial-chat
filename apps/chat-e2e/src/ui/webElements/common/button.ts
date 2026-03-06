import { ButtonSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Button extends BaseElement {
  constructor(page: Page, ariaLabel: string, parentLocator?: Locator) {
    super(page, ButtonSelectors.buttonContainer(ariaLabel), parentLocator);
  }
}

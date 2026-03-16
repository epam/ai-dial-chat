import { Tags } from '@/src/ui/domData';
import { SwitcherSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class Switcher extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, SwitcherSelectors.switcherContainer, parentLocator);
  }

  public switcher = this.getChildElementBySelector(Tags.label);
  public switcherTitle = this.getChildElementBySelector(
    SwitcherSelectors.switcherTitle,
  );
}

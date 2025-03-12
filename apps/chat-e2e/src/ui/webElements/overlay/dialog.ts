import { Tags } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class Dialog extends BaseElement {
  constructor(page: Page) {
    super(page, Tags.dialog);
  }

  public closeButton = this.getChildElementBySelector(Tags.button);
  public content = this.getChildElementBySelector(Tags.p);
}

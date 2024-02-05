import { InfoTooltip } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Tooltip extends BaseElement {
  constructor(page: Page) {
    super(page, InfoTooltip.tooltip);
  }

  public async getContent() {
    return this.getElementInnerContent();
  }
}

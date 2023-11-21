import { InfoTooltip } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Tooltip extends BaseElement {
  constructor(page: Page) {
    super(page, InfoTooltip.tooltip);
  }

  public async getContent() {
    return this.getElementInnerContent();
  }
}

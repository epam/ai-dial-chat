import { TooltipSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class TooltipPortal extends BaseElement {
  constructor(page: Page) {
    super(page, TooltipSelectors.tooltipContainer);
  }
}

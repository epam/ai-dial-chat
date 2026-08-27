import { TooltipSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class TooltipPortal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, TooltipSelectors.tooltipContainer, parentLocator);
  }
}

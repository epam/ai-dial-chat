import { GridSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

/**
 * AG-Grid checkbox wrapper
 * Uses standard AG-Grid selectors (not custom aria-description)
 */
export class Checkbox extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    // AG-Grid checkbox container
    super(page, '.ag-selection-checkbox', parentLocator);
  }

  public checkboxInput = this.getChildElementBySelector(
    GridSelectors.gridCheckboxInput,
  );
}

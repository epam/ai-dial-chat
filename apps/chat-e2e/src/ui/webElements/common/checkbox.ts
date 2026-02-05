import { GridSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

/**
 * AG-Grid checkbox wrapper
 * Uses standard AG-Grid selectors (not custom aria-description)
 */
export class Checkbox extends BaseElement {
  private parentLocator: Locator;

  constructor(page: Page, parentLocator: Locator) {
    // AG-Grid checkbox input (was container)
    // Targeting input directly allows toBeChecked() and other standard assertions to work
    super(page, GridSelectors.gridCheckboxInput, parentLocator);
    this.parentLocator = parentLocator;
  }

  // Backward compatibility: existing tests access .checkboxInput
  // Since the Checkbox object now wraps the input, this property can return the instance itself
  public get checkboxInput(): BaseElement {
    return this;
  }

  // AG-Grid styles (border, background) are applied to the wrapper div, not the input
  public get wrapper(): BaseElement {
    return new BaseElement(
      this.page,
      GridSelectors.gridCheckboxWrapper,
      this.parentLocator,
    );
  }
}


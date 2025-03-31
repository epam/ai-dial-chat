import { Tags } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class FieldLabel extends BaseElement {
  constructor(page: Page, locator: Locator) {
    super(page, '', locator);
  }

  public getFieldLabel(labelText: string): BaseElement {
    const allLabels = this.getChildElementBySelector(Tags.label);
    const labelLocator = allLabels.getElementLocatorByText(
      new RegExp(`^${RegexUtil.escapeRegexChars(labelText)}\\b`),
    );
    return this.createElementFromLocator(labelLocator);
  }

  public async getFieldRequiredIndicator(fieldName: string) {
    const asteriskLocator =
      this.getFieldLabel(fieldName).getElementLocatorByText('*');
    return this.createElementFromLocator(asteriskLocator);
  }
}

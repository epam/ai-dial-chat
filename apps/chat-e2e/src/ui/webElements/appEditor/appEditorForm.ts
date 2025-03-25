import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { AddApplicationFormSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export abstract class AppEditorForm extends BaseElement {
  public getFieldLabel2(fieldName: string): BaseElement {
    const labelLocator = this.rootLocator.locator(`label[for="${fieldName}"]`);
    return this.createElementFromLocator(labelLocator);
  }

  public getFieldLabel(labelText: string): BaseElement {
    const allLabels = this.getChildElementBySelector(Tags.label);
    const labelLocator = allLabels.getElementLocatorByText(
      new RegExp(`^${RegexUtil.escapeRegexChars(labelText)}\\b`),
    );
    return this.createElementFromLocator(labelLocator);
  }

  public getRequiredIndicator(fieldName: string): BaseElement {
    const labelElement = this.getFieldLabel(fieldName);
    const asteriskLocator = labelElement
      .getElementLocator()
      .locator(`${Tags.span}:has-text("*")`);
    return this.createElementFromLocator(asteriskLocator);
  }
}

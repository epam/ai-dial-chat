import { Tags } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';

export abstract class AppEditorForm extends BaseElement {
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

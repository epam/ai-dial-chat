import { BaseElement } from '@/src/ui/webElements';
import { FieldLabel } from '@/src/ui/webElements/fieldLabel';
import { Locator, Page } from '@playwright/test';

export abstract class AppEditorForm extends BaseElement {
  protected fieldLabelHelper: FieldLabel;

  public getRequiredIndicator(fieldName: string) {
    return this.fieldLabelHelper.getFieldRequiredIndicator(fieldName);
  }

  protected constructor(page: Page, selector: string, parentLocator: Locator) {
    super(page, selector, parentLocator);
    this.fieldLabelHelper = new FieldLabel(page, this.rootLocator);
  }
}

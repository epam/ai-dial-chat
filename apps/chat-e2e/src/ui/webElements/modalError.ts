import { ErrorLabelSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ModalError extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, ErrorLabelSelectors.errorContainer, parentLocator);
  }

  public errorMessage = this.getChildElementBySelector(
    ErrorLabelSelectors.errorText,
  );
}

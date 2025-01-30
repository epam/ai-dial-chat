import { IconSelectors, RequestApiKeyModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class RequestApiKeyModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      RequestApiKeyModalSelectors.requestApiKeyContainer,
      parentLocator,
    );
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
}

import { ChangePathElement } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ChangePath extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChangePathElement.changePathContainer, parentLocator);
  }

  public path = this.getChildElementBySelector(ChangePathElement.path);

  public changeButton = this.getChildElementBySelector(
    ChangePathElement.changeButton,
  );
}

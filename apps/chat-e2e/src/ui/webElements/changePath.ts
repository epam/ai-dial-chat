import { AttributeValues } from '@/src/ui/domData';
import { ChangePathElement } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { Locator, Page } from '@playwright/test';

export class ChangePath extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChangePathElement.changePathContainer, parentLocator);
  }

  public path = this.getChildElementBySelector(ChangePathElement.path);

  public changeButton = new Button(
    this.page,
    AttributeValues.change,
    this.rootLocator,
  );
}

import { DragFileSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class DragFile extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, DragFileSelectors.dragFileContainer, parentLocator);
  }

  public dragFileIcon = this.getChildElementBySelector(
    DragFileSelectors.dragFileIcon,
  );
  public dragFileNotAllowedIcon = this.getChildElementBySelector(
    DragFileSelectors.dragFileNotAllowedIcon,
  );
  public dragFileTitle = this.getChildElementBySelector(
    DragFileSelectors.dragFileTitle,
  );
  public dragFileDescription = this.getChildElementBySelector(
    DragFileSelectors.dragFileDescription,
  );
}

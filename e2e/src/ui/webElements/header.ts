import { HeaderSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Header extends BaseElement {
  constructor(page: Page) {
    super(page, HeaderSelectors.headerContainer);
  }

  public chatPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.chatPanelToggle,
  );
  public promptsPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.promptsPanelToggle,
  );
}

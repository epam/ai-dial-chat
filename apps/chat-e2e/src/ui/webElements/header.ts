import { HeaderSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class Header extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, HeaderSelectors.headerContainer, parentLocator);
  }

  public leftPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.leftPanelToggle,
  );
  public rightPanelToggle = this.getChildElementBySelector(
    HeaderSelectors.rightPanelToggle,
  );

  public newEntityButton = this.getChildElementBySelector(
    HeaderSelectors.newEntity,
  );

  public logo = this.getChildElementBySelector(HeaderSelectors.logo);

  public async createNewConversation() {
    await this.newEntityButton.click();
  }
}

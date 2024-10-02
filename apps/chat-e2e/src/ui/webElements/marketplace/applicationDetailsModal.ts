import { IconSelectors } from '@/src/ui/selectors';
import { MarketplaceDetailsModal } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Page } from '@playwright/test';

export class ApplicationDetailsModal extends BaseElement {
  constructor(page: Page) {
    super(page, MarketplaceDetailsModal.modalContainer);
  }

  public versionDropdownMenu!: DropdownButtonMenu;

  getVersionDropdownMenu(): DropdownButtonMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.versionDropdownMenu;
  }

  public applicationName = this.getChildElementBySelector(
    MarketplaceDetailsModal.applicationName,
  );
  public applicationVersion = this.getChildElementBySelector(
    MarketplaceDetailsModal.applicationVersion,
  );
  public useButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.useButton,
  );
  public versionMenuTrigger = this.getChildElementBySelector(
    MarketplaceDetailsModal.versionMenuTrigger,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async clickUseButton() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'PUT',
    );
    await this.useButton.click();
    await responsePromise;
  }
}

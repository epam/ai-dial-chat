import { MarketplaceDetailsModal } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, DropdownMenu } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class ApplicationDetailsModal extends BaseElement {
  constructor(page: Page) {
    super(page, MarketplaceDetailsModal.modalContainer);
  }

  public versionDropdownMenu!: DropdownMenu;

  getVersionDropdownMenu(): DropdownMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownMenu(this.page);
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

  public async clickUseButton() {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'PUT',
    );
    await this.useButton.click();
    await responsePromise;
  }
}

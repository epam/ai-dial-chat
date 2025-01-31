import { IconSelectors } from '@/src/ui/selectors';
import { MarketplaceDetailsModal } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Page } from '@playwright/test';

export class AgentDetailsModal extends BaseElement {
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

  public agentName = this.getChildElementBySelector(
    MarketplaceDetailsModal.agentName,
  );
  public agentVersion = this.getChildElementBySelector(
    MarketplaceDetailsModal.agentVersion,
  );
  public useButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.useButton,
  );
  public versionMenuTrigger = this.getChildElementBySelector(
    MarketplaceDetailsModal.versionMenuTrigger,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async clickUseButton({
    isInstalledDeploymentsUpdated = false,
  }: {
    isInstalledDeploymentsUpdated?: boolean;
  }) {
    if (isInstalledDeploymentsUpdated) {
      const responsePromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'PUT',
      );
      await this.useButton.click();
      await responsePromise;
    } else {
      await this.useButton.click();
    }
  }
}

import { isApiStorageType } from '@/src/hooks/global-setup';
import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { IconSelectors, MarketplaceEntitySelectors } from '@/src/ui/selectors';
import { MarketplaceDetailsModal } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Page } from '@playwright/test';

export class EntityDetailsModal extends BaseElement {
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

  public entityName = this.getChildElementBySelector(
    MarketplaceDetailsModal.entityName,
  );
  public entityVersion = this.getChildElementBySelector(
    MarketplaceDetailsModal.entityVersion,
  );
  public entityTopics = this.getChildElementBySelector(
    MarketplaceEntitySelectors.topicsContainer,
  );
  public entityTopic = this.entityTopics.getChildElementBySelector(
    MarketplaceEntitySelectors.topic,
  );
  public useButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.useButton,
  );
  public editButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.editButton,
  );
  public deleteButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.deleteButton,
  );
  public publishButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.publishButton,
  );
  public shareButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.shareButton,
  );
  public unshareButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.unshareButton,
  );
  public viewButton = new Button(this.page, MarketplaceDetailsModal.viewButton);
  public loginButton = new Button(
    this.page,
    MarketplaceDetailsModal.loginButton,
    this.rootLocator,
  );
  public logoutButton = new Button(
    this.page,
    MarketplaceDetailsModal.logoutButton,
    this.rootLocator,
  );
  public manageCredsButton = new Button(
    this.page,
    MarketplaceDetailsModal.manageCredsButton,
    this.rootLocator,
  );
  public arrowIcon = this.getChildElementBySelector(
    MarketplaceEntitySelectors.arrowIcon,
  ).getChildElementBySelector(Tags.svg);
  public unpublishButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.unpublishButton,
  );
  public versionMenuTrigger = this.getChildElementBySelector(
    MarketplaceDetailsModal.versionMenuTrigger,
  );
  public addBookmarkIcon = this.getChildElementBySelector(
    MarketplaceEntitySelectors.addBookmarkIcon,
  ).getChildElementBySelector(Tags.svg);
  public removeBookmarkIcon = this.getChildElementBySelector(
    MarketplaceEntitySelectors.removeBookmarkIcon,
  ).getChildElementBySelector(Tags.svg);
  public copyLink = this.getChildElementBySelector(
    MarketplaceEntitySelectors.copyLink,
  );
  public copyLinkText = this.copyLink.getChildElementBySelector(
    MarketplaceEntitySelectors.copyLinkText,
  );
  public copyLinkIcon = this.copyLink.getChildElementBySelector(
    MarketplaceEntitySelectors.copyIcon,
  );
  public copiedLink = this.getChildElementBySelector(
    MarketplaceEntitySelectors.copiedLink,
  );
  public copiedLinkIcon = this.copiedLink.getChildElementBySelector(
    MarketplaceEntitySelectors.copiedIcon,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public entityContent = this.getChildElementBySelector(
    MarketplaceDetailsModal.entityContentContainer,
  );
  public entityDescription = this.entityContent.getChildElementBySelector(
    MarketplaceDetailsModal.entityDescription,
  );
  public entityInformation = this.entityContent.getChildElementBySelector(
    MarketplaceDetailsModal.entityInformation,
  );
  public entityAuthor = this.entityInformation.getChildElementBySelector(
    MarketplaceDetailsModal.entityAuthor,
  );
  public entityReleaseDate = this.entityInformation.getChildElementBySelector(
    MarketplaceDetailsModal.entityReleaseDate,
  );
  public iconContainer = this.getChildElementBySelector(
    MarketplaceEntitySelectors.iconContainer,
  );
  public icon = this.getElementIcon(this.iconContainer);
  public defaultToolsetIcon = this.iconContainer.getChildElementBySelector(
    IconSelectors.defaultToolsetIcon,
  );
  public externalAppIcon = this.iconContainer.getChildElementBySelector(
    IconSelectors.externalAppIcon,
  );
  public openInNewTabButton = this.getChildElementBySelector(
    MarketplaceEntitySelectors.openInNewTab,
  );
  public openInNewTabButtonTitle =
    this.openInNewTabButton.getChildElementBySelector(Tags.span);
  public openInNewTabButtonIcon =
    this.openInNewTabButton.getChildElementBySelector(
      IconSelectors.externalAppIcon,
    );
  public credsLabel = this.getChildElementBySelector(
    MarketplaceDetailsModal.credsLabel,
  );
  public connectButton = new Button(
    this.page,
    MarketplaceDetailsModal.connectButton,
    this.rootLocator,
  );

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
    await this.waitForState({ state: 'hidden' });
  }

  public async addEntityToWorkspace() {
    const respPromise = this.page.waitForResponse(
      (r) =>
        r.url().includes(API.installedDeploymentsHost()) && r.status() === 200,
    );
    await this.addBookmarkIcon.click();
    await respPromise;
  }

  public async clickEditButton({
    triggeredHttpMethod,
  }: {
    triggeredHttpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  } = {}): Promise<void> {
    if (isApiStorageType && triggeredHttpMethod) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === triggeredHttpMethod,
      );
      await this.editButton.click();
      await respPromise;
    } else {
      await this.editButton.click();
    }
  }

  public async clickShareButton(
    options: {
      expectedHttpStatus: number;
    } = { expectedHttpStatus: 200 },
  ) {
    await this.openShareAppModal(() => this.shareButton.click(), options);
  }

  private async openShareAppModal(
    method: () => Promise<void>,
    options: {
      expectedHttpStatus: number;
    },
  ) {
    await this.openAppModal(() => method(), {
      expectedHttpMethod: 'POST',
      expectedUrl: API.shareEntityHost,
      expectedHttpStatus: options.expectedHttpStatus,
    });
  }

  private async openAppModal(
    method: () => Promise<void>,
    options: {
      expectedHttpMethod: string;
      expectedUrl: string;
      expectedHttpStatus: number;
    },
  ) {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.request().method() === options.expectedHttpMethod &&
        resp.url().includes(options.expectedUrl) &&
        resp.status() === options.expectedHttpStatus,
    );
    await method();
    await respPromise;
  }
}

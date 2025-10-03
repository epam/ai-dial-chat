import { isApiStorageType } from '@/src/hooks/global-setup';
import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { IconSelectors, MarketplaceAgentSelectors } from '@/src/ui/selectors';
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
  public agentTopics = this.getChildElementBySelector(
    MarketplaceAgentSelectors.topicsContainer,
  );
  public agentTopic = this.agentTopics.getChildElementBySelector(
    MarketplaceAgentSelectors.topic,
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
  public arrowIcon = this.getChildElementBySelector(
    MarketplaceAgentSelectors.arrowIcon,
  ).getChildElementBySelector(Tags.svg);
  public unpublishButton = this.getChildElementBySelector(
    MarketplaceDetailsModal.unpublishButton,
  );
  public versionMenuTrigger = this.getChildElementBySelector(
    MarketplaceDetailsModal.versionMenuTrigger,
  );
  public addBookmarkIcon = this.getChildElementBySelector(
    MarketplaceAgentSelectors.addBookmarkIcon,
  ).getChildElementBySelector(Tags.svg);
  public removeBookmarkIcon = this.getChildElementBySelector(
    MarketplaceAgentSelectors.removeBookmarkIcon,
  ).getChildElementBySelector(Tags.svg);
  public copyLink = this.getChildElementBySelector(
    MarketplaceAgentSelectors.copyLink,
  );
  public copyLinkText = this.copyLink.getChildElementBySelector(
    MarketplaceAgentSelectors.copyLinkText,
  );
  public copyLinkIcon = this.copyLink.getChildElementBySelector(
    MarketplaceAgentSelectors.copyIcon,
  );
  public copiedLink = this.getChildElementBySelector(
    MarketplaceAgentSelectors.copiedLink,
  );
  public copiedLinkIcon = this.copiedLink.getChildElementBySelector(
    MarketplaceAgentSelectors.copiedIcon,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public applicationContent = this.getChildElementBySelector(
    MarketplaceDetailsModal.applicationContentContainer,
  );
  public applicationDescription =
    this.applicationContent.getChildElementBySelector(
      MarketplaceDetailsModal.applicationDescription,
    );
  public applicationInformation =
    this.applicationContent.getChildElementBySelector(
      MarketplaceDetailsModal.applicationInformation,
    );
  public agentAuthor = this.applicationInformation.getChildElementBySelector(
    MarketplaceDetailsModal.agentAuthor,
  );
  public agentReleaseDate =
    this.applicationInformation.getChildElementBySelector(
      MarketplaceDetailsModal.agentReleaseDate,
    );
  public icon = this.getElementIcon(this.rootLocator);

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

  public async addAgentToWorkspace() {
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

  public async clickPublishButton(
    options: {
      expectedHttpStatus: number;
    } = { expectedHttpStatus: 200 },
  ) {
    await this.openPublishRequestModal(
      () => this.publishButton.click(),
      options,
    );
  }

  public async clickUnpublishButton(
    options: {
      expectedHttpStatus: number;
    } = { expectedHttpStatus: 200 },
  ) {
    await this.openPublishRequestModal(
      () => this.unpublishButton.click(),
      options,
    );
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

  private async openPublishRequestModal(
    method: () => Promise<void>,
    options: {
      expectedHttpStatus: number;
    },
  ) {
    await this.openAppModal(() => method(), {
      expectedHttpMethod: 'GET',
      expectedUrl: API.applicationCreateHost,
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

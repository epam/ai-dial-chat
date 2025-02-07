import { DialAIEntityModel } from '@/chat/types/models';
import { API, ExpectedConstants } from '@/src/testData';
import { MarketplacePage } from '@/src/ui/pages';
import { OverlayMarketplacePage } from '@/src/ui/pages/overlay/overlayMarketplacePage';
import {
  IconSelectors,
  MarketplaceAgentSelectors,
  TalkToAgentDialogSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { MarketplaceAgents } from '@/src/ui/webElements/marketplace/marketplaceAgents';
import { ModelsUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class TalkToAgentDialog extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, TalkToAgentDialogSelectors.talkToAgentModal, parentLocator);
  }

  private agents!: MarketplaceAgents;
  private versionDropdownMenu!: DropdownButtonMenu;
  public goToMyWorkspaceButton = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.goToMyWorkspaceButton,
  );
  public searchAgentInput = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.searchAgent,
  );
  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );

  getAgents(): MarketplaceAgents {
    if (!this.agents) {
      this.agents = new MarketplaceAgents(this.page, this.rootLocator);
    }
    return this.agents;
  }

  getVersionDropdownMenu(): DropdownButtonMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.versionDropdownMenu;
  }

  public async selectAgent(
    entity: DialAIEntityModel,
    marketplacePage: MarketplacePage | OverlayMarketplacePage,
  ) {
    //check if agent is among recent ones
    const isRecentEntitySelected = await this.isRecentAgent(entity);
    //otherwise open marketplace page
    if (!isRecentEntitySelected) {
      await this.goToMyWorkspace();
      await marketplacePage.waitForPageLoaded(); // Wait for "My Applications" page to load
      //use agent if it is visible on "My applications" tab
      const marketplaceContainer = marketplacePage.getMarketplaceContainer();
      const marketplace = marketplaceContainer.getMarketplace();
      const isMyApplicationUsed = await marketplace
        .getAgents()
        .isAgentUsed(entity);
      //otherwise go to marketplace "DIAL Marketplace page"
      if (!isMyApplicationUsed) {
        await marketplaceContainer.goToMarketplaceHome();
        await marketplacePage.waitForPageLoaded(); // Wait for "Home Page" to load
        const expectedAgents = ModelsUtil.getLatestOpenAIEntities();
        const allAgents = marketplace.getAgents();
        await allAgents.waitForAgentByIndex(expectedAgents.length);
        const isAllApplicationUsed = await allAgents.isAgentUsed(entity, {
          isInstalledDeploymentsUpdated: true,
        });
        if (!isAllApplicationUsed) {
          throw new Error(
            `Entity with name: ${entity.name} and version: ${entity.version ?? 'N/A'} is not found!`,
          );
        }
      }
    }
  }

  private async isRecentAgent(entity: DialAIEntityModel): Promise<boolean> {
    let isAgentSelected = false;
    const agents = this.getAgents();
    const agentLocator = agents.getAgent(entity);
    //select agent if it is visible
    if (await agentLocator.isVisible()) {
      await agentLocator.click();
      isAgentSelected = true;
    } else {
      //if agent is not visible
      //check if agent name stays among visible agents
      const agentWithVersionToSetLocator =
        await agents.agentWithVersionToSet(entity);
      //select agent version if name is found
      if (agentWithVersionToSetLocator) {
        const isVersionSelected = await this.selectAgentVersion(
          agentWithVersionToSetLocator,
          entity.version!,
        );
        if (isVersionSelected) {
          isAgentSelected = true;
        }
      }
    }
    return isAgentSelected;
  }

  private async selectAgentVersion(agentLocator: Locator, version: string) {
    let isVersionSelected = false;
    const menuTrigger = agentLocator.locator(
      MarketplaceAgentSelectors.agentVersionMenuTrigger,
    );
    //check if version menu is available
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      const menuVersion = this.getVersionDropdownMenu().menuOption(version);
      //check if menu contains version
      if (await menuVersion.isVisible()) {
        await this.getVersionDropdownMenu().selectMenuOption(version);
        isVersionSelected = true;
      }
    }
    return isVersionSelected;
  }

  public async goToMyWorkspace() {
    const responsePromise = this.page.waitForResponse((resp) =>
      resp.url().includes(API.marketplaceHost),
    );
    await this.goToMyWorkspaceButton.click();
    await responsePromise;
  }

  public async selectReplayAsIs() {
    await this.getAgents().getAgent(ExpectedConstants.replayAsIsLabel).click();
  }

  //select agent available on 'Talk to' modal
  public async selectRecentAgent(agent: DialAIEntityModel) {
    const resp = this.page.waitForResponse((r) =>
      r.url().includes(API.moveHost),
    );
    await this.getAgents().getAgent(agent).click();
    await resp;
  }
}

import { DialAIEntityModel } from '@/chat/types/models';
import config from '@/config/chat.playwright.config';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
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

  public getTalkToAgent(entity: DialAIEntityModel | string) {
    return this.getAgents().getAgent(entity);
  }

  public async selectAgent(
    entity: DialAIEntityModel,
    marketplacePage: MarketplacePage | OverlayMarketplacePage,
    options?: {
      isInstalledDeploymentsUpdated?: boolean;
      isWorkspaceAgent?: boolean;
      isEditable?: boolean;
    },
  ) {
    //check if agent is among recent ones
    const isRecentAgentUsed = await this.useRecentAgent(entity);
    //otherwise open marketplace page
    if (!isRecentAgentUsed) {
      await this.goToMyWorkspace();
      await marketplacePage.waitForPageLoaded(); // Wait for "My Workspace" page to load
      //use agent if it is visible on "My Workspace" tab
      const marketplaceContainer = marketplacePage.getMarketplaceContainer();
      const marketplace = marketplaceContainer.getMarketplace();
      const marketplaceAgentsSection =
        marketplace.getMarketplaceAgentsSection();
      await marketplace
        .getMarketplaceHeader()
        .searchInput.fillInInput(entity.name);
      const isMyWorkspaceAgentUsed =
        await marketplaceAgentsSection.findAndUseAgent(entity, options);
      if (!isMyWorkspaceAgentUsed) {
        throw new Error(
          `Agent with name: ${entity.name} and version: ${entity.version ?? 'N/A'} is not found!`,
        );
      }
    }
  }

  private async useRecentAgent(entity: DialAIEntityModel): Promise<boolean> {
    let isAgentSelected = false;
    const agents = this.getAgents();
    const agentLocator = this.getTalkToAgent(entity);
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
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(API.marketplaceHost),
      { timeout: config.use!.actionTimeout! * 3 },
    );
    await this.goToMyWorkspaceButton.click();
    await responsePromise;
  }

  public async selectReplayAsIs() {
    await this.getTalkToAgent(ExpectedConstants.replayAsIsLabel).click();
  }

  //select agent available on 'Talk to' modal
  public async selectRecentAgent(agent: DialAIEntityModel) {
    const resp = this.page.waitForResponse((r) =>
      r.url().includes(API.moveHost),
    );
    await this.getTalkToAgent(agent).click();
    await resp;
  }

  public async getSelectedAgent() {
    const agents = this.getAgents();
    const agentsCount = await agents.getElementsCount();
    for (let i = 1; i <= agentsCount; i++) {
      const agent = agents.getNthElement(i);
      const selectedAttr = await agent.getAttribute(Attributes.ariaSelected);
      if (selectedAttr && JSON.parse(selectedAttr.toLowerCase())) {
        const selectedAgent = agent.locator(
          MarketplaceAgentSelectors.agentName,
        );
        return selectedAgent.innerText();
      }
    }
  }
}

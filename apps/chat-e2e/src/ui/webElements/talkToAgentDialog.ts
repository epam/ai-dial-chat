import { DialAIEntityModel } from '@/chat/types/models';
import config from '@/config/chat.playwright.config';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import {
  ErrorLabelSelectors,
  MarketplaceEntitySelectors,
  MenuSelectors,
  TalkToAgentDialogSelectors,
} from '@/src/ui/selectors';
import { Search } from '@/src/ui/webElements';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { MarketplaceEntities } from '@/src/ui/webElements/marketplace/marketplaceEntities';
import { Locator, Page } from '@playwright/test';

export class TalkToAgentDialog extends AgentsBrowserModal {
  constructor(page: Page, selector?: string, parentLocator?: Locator) {
    super(page, selector, parentLocator);
  }

  private versionDropdownMenu!: DropdownButtonMenu;
  private search!: Search;
  public goToMyWorkspaceButton = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.goToMyWorkspaceButton,
  );
  public goToDialMarketplaceButton = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.goToDialMarketplaceButton,
  );
  public myAgentsTab = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.myAgentsTab,
  );
  public allAgentsTab = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.allAgentsTab,
  );
  public nextArrowButton = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.nextArrowButton,
  );
  public previousArrowButton = this.getChildElementBySelector(
    TalkToAgentDialogSelectors.previousArrowButton,
  );
  public noResultFound = this.getChildElementBySelector(
    ErrorLabelSelectors.noResultFound,
  );

  getAgents(): MarketplaceEntities {
    return this.getEntities();
  }

  getVersionDropdownMenu(): DropdownButtonMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.versionDropdownMenu;
  }

  getSearch(): Search {
    if (!this.search) {
      this.search = new Search(this.page, this.rootLocator);
    }
    return this.search;
  }

  public getTalkToAgent(entity: DialAIEntityModel | string) {
    return this.getAgents().getEntity(entity);
  }

  public getVersionMenuTrigger(agentElement: Locator | BaseElement) {
    const agentLocator = BaseElement.getElementLocator(agentElement);
    return agentLocator.locator(
      MarketplaceEntitySelectors.agentVersionMenuTrigger,
    );
  }

  getVersionChevronIcon(agentElement: Locator | BaseElement) {
    return this.getVersionMenuTrigger(agentElement).locator(Tags.svg);
  }

  public async getAllAgentNames() {
    const allAgentNames = await this.getAgents().getEntityNames();
    while (
      (await this.nextArrowButton.isVisible()) &&
      (await this.nextArrowButton.isElementEnabled())
    ) {
      await this.nextArrowButton.click();
      const visibleAgentNames = await this.getAgents().getEntityNames();
      for (const visibleAgentName of visibleAgentNames) {
        if (!allAgentNames.includes(visibleAgentName)) {
          allAgentNames.push(visibleAgentName);
        }
      }
    }
    return allAgentNames;
  }

  public async selectAgent(
    entity: DialAIEntityModel | string,
    options: {
      isHttpMethodTriggered?: boolean;
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
      isAgentVisible?: boolean;
    } = {
      isHttpMethodTriggered: true,
      triggeredHttpMethod: 'PUT',
      isAgentVisible: true,
    },
  ) {
    //check if agent is among recent ones
    const isRecentAgentUsed = await this.useAgent(entity, options);
    //otherwise switch to "All agents" tab
    if (!isRecentAgentUsed) {
      await this.allAgentsTab.click();
      const isMarketplaceAgentUsed = await this.useAgent(entity, options);
      if (!isMarketplaceAgentUsed && options.isAgentVisible) {
        throw new Error(
          `Agent with name: ${entity} and version: ${typeof entity !== 'string' ? (entity.version ?? 'N/A') : 'N/A'} is not found!`,
        );
      }
    }
  }

  //the function returns an agent card or a dropdown agent version locator to select for the further usage
  public async findAgent(entity: DialAIEntityModel | string) {
    const isEntityOfStringType = typeof entity === 'string';
    await this.getSearch().inputField.fillInInput(
      isEntityOfStringType ? entity : entity.name,
    );
    const agents = this.getAgents();
    const agentLocator = this.getTalkToAgent(entity);
    //select agent if it is visible
    if (await agentLocator.isVisible()) {
      return agentLocator;
    } else {
      //if agent is not visible
      //check if agent name stays among visible agents
      if (!isEntityOfStringType) {
        const agentWithVersionToSetLocator =
          await agents.entityWithVersionToSet(entity);
        //get agent version from dropdown menu if the name is found
        if (agentWithVersionToSetLocator) {
          return this.getAgentVersionFromMenu(
            agentWithVersionToSetLocator,
            entity.version!,
          );
        }
      }
    }
  }

  public async useAgent(
    entity: DialAIEntityModel | string,
    options: {
      isHttpMethodTriggered?: boolean;
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
    } = {},
  ): Promise<boolean> {
    let isAgentSelected = false;
    const agentElement = await this.findAgent(entity);
    //if agent's card or dropdown menu version are found, click on it
    if (agentElement !== undefined) {
      if (options.isHttpMethodTriggered && options.triggeredHttpMethod) {
        const respPromise = this.page.waitForResponse(
          (r) => r.request().method() === options.triggeredHttpMethod,
        );
        await agentElement.click();
        await respPromise;
      } else {
        await agentElement.click();
      }
      isAgentSelected = true;
    }
    return isAgentSelected;
  }

  private async getAgentVersionFromMenu(
    agentLocator: Locator,
    version: string,
  ) {
    let menuVersion: Locator;
    const menuTrigger = this.getVersionMenuTrigger(agentLocator);
    //check if version menu is available
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      menuVersion = this.getVersionDropdownMenu().menuOption(version);
      //check if menu contains version
      if (await menuVersion.isVisible()) {
        return menuVersion;
      }
    }
  }

  public async goToMyWorkspace() {
    await this.goMarketplacePage(() => this.goToMyWorkspaceButton.click());
  }

  public async goToDialMarketplace() {
    await this.goMarketplacePage(() => this.goToDialMarketplaceButton.click());
  }

  public async goMarketplacePage(method: () => Promise<void>) {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(API.marketplaceHost),
      { timeout: config.use!.actionTimeout! * 3 },
    );
    await method();
    await responsePromise;
  }

  public async selectReplayAsIs() {
    await this.getTalkToAgent(ExpectedConstants.replayAsIsLabel).click();
  }

  public async openAgentDotsMenu(agentElement: Locator | BaseElement) {
    const agentLocator = BaseElement.getElementLocator(agentElement);
    await agentLocator.hover();
    await agentLocator.locator(MenuSelectors.menuTrigger).click();
    return new DropdownButtonMenu(this.page);
  }

  public async getSelectedAgent() {
    const agents = this.getAgents();
    const agentsCount = await agents.getElementsCount();
    for (let i = 1; i <= agentsCount; i++) {
      const agent = agents.getNthElement(i);
      const selectedAttr = await agent.getAttribute(Attributes.ariaSelected);
      if (selectedAttr && JSON.parse(selectedAttr.toLowerCase())) {
        const selectedAgent = agent.locator(
          MarketplaceEntitySelectors.entityName,
        );
        return selectedAgent.innerText();
      }
    }
  }
}

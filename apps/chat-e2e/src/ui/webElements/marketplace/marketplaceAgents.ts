import { DialAIEntityModel } from '@/chat/types/models';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { MenuSelectors } from '@/src/ui/selectors';
import { MarketplaceAgentSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, DropdownMenu } from '@/src/ui/webElements';
import { AgentDetailsModal } from '@/src/ui/webElements/marketplace/agentDetailsModal';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export enum FoundMarketplaceAgents {
  suggested,
  filtered,
}

export interface MarketplaceAgentProperties {
  name: string;
  isSuggested: boolean;
  isWorkspaceAgent: boolean;
}

export class MarketplaceAgents extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceAgentSelectors.agent, parentLocator);
  }

  private applicationDetailsModal!: AgentDetailsModal;
  private agentDropdownMenu!: DropdownMenu;

  getAgentDetailsModal(): AgentDetailsModal {
    if (!this.applicationDetailsModal) {
      this.applicationDetailsModal = new AgentDetailsModal(this.page);
    }
    return this.applicationDetailsModal;
  }

  getAgentDropdownMenu(): DropdownMenu {
    if (!this.agentDropdownMenu) {
      this.agentDropdownMenu = new DropdownMenu(this.page);
    }
    return this.agentDropdownMenu;
  }

  public agentNames = this.getChildElementBySelector(
    MarketplaceAgentSelectors.agentName,
  );

  public agentName = (name: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceAgentSelectors.agentName}:text-is('${RegexUtil.escapeRegexChars(name)}')`,
    ).getElementLocator();

  public agentVersion = (version: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceAgentSelectors.version}:text-is('${version}')`,
    ).getElementLocator();

  public agentVersionWithPrefix = (version: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceAgentSelectors.version}:text-is('${ExpectedConstants.versionPrefix}${version}')`,
    ).getElementLocator();

  public getAgent = (entity: DialAIEntityModel | string) => {
    let agent;
    if (typeof entity === 'string') {
      agent = this.rootLocator.filter({ has: this.agentName(entity) }).first();
    } else {
      //if agent has version in the config
      if (entity.version) {
        agent = this.rootLocator
          .filter({
            has: this.agentName(entity.name),
          })
          .filter({
            has: this.agentVersion(entity.version).or(
              this.agentVersionWithPrefix(entity.version),
            ),
          })
          .first();
      } else {
        //init agent locator if no version is available in the config
        agent = this.rootLocator
          .filter({
            has: this.agentName(entity.name),
          })
          .first();
      }
    }
    return this.createElementFromLocator(agent);
  };

  public getAgentDescription(entity: DialAIEntityModel | string) {
    return this.getAgent(entity)
      .getChildElementBySelector(MarketplaceAgentSelectors.description)
      .getChildElementBySelector(`${Attributes.visible}=true`);
  }

  public getAgentVersion(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.version,
    );
  }

  public getAgentElementWithVersion(
    agentElement: BaseElement,
    version?: string,
  ) {
    return agentElement.getElementLocator().filter({
      has: this.agentVersion(version!).or(
        this.agentVersionWithPrefix(version!),
      ),
    });
  }

  public getAgentElementTopics(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.topics,
    );
  }

  public getAgentDotsMenu(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
      MenuSelectors.dotsMenu,
    );
  }

  public getAgentElementDotsMenu(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(MenuSelectors.dotsMenu);
  }

  public getAgentElementAddBookmarkIcon(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.addBookmarkIcon,
    );
  }

  public getAgentElementRemoveBookmarkIcon(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.removeBookmarkIcon,
    );
  }

  public async agentWithVersionToSet(entity: DialAIEntityModel) {
    if (entity.version) {
      const agentNameLocator = this.rootLocator.filter({
        has: this.agentName(entity.name),
      });
      if (await agentNameLocator.isVisible()) {
        return agentNameLocator;
      }
    }
  }

  public async getAgentNames() {
    return this.agentNames.getElementsInnerContent();
  }

  public async getAgentsIcons() {
    return this.getElementIcons(this);
  }

  public async addAgentToWorkspace(agentElement: BaseElement) {
    const respPromise = this.page.waitForResponse(
      (r) =>
        r.url().includes(API.installedDeploymentsHost()) && r.status() === 200,
    );
    await this.getAgentElementAddBookmarkIcon(agentElement).click();
    await respPromise;
  }
}

import { DialAIEntityModel } from '@/chat/types/models';
import { ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { MarketplaceAgentSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { AgentDetailsModal } from '@/src/ui/webElements/marketplace/agentDetailsModal';
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

  getAgentDetailsModal(): AgentDetailsModal {
    if (!this.applicationDetailsModal) {
      this.applicationDetailsModal = new AgentDetailsModal(this.page);
    }
    return this.applicationDetailsModal;
  }

  public agentNames = this.getChildElementBySelector(
    MarketplaceAgentSelectors.agentName,
  );

  public agentName = (name: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceAgentSelectors.agentName}:text-is('${name}')`,
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
          .filter({ has: this.agentName(entity.name) })
          .filter({
            has: this.agentVersion(entity.version).or(
              this.agentVersionWithPrefix(entity.version),
            ),
          })
          .first();
      } else {
        //init agent locator if no version is available in the config
        agent = this.rootLocator
          .filter({ has: this.agentName(entity.name) })
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
}

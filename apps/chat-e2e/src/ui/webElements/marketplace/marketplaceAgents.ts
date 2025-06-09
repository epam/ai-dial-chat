import { DialAIEntityModel } from '@/chat/types/models';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
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
  version?: string;
  isSuggested: boolean;
  isWorkspaceAgent: boolean;
  isEditable: boolean;
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
      agent = this.rootLocator.filter({ has: this.agentName(entity) });
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
          });
      } else {
        //init agent locator if no version is available in the config
        agent = this.rootLocator.filter({
          has: this.agentName(entity.name),
        });
      }
    }
    return this.createElementFromLocator(agent);
  };

  public getAgentDescription(entity: DialAIEntityModel | string | BaseElement) {
    return this.getAgentDescriptionContainer(entity).getChildElementBySelector(
      Tags.p,
    );
  }

  public getAgentDescriptionContainer(
    entity: DialAIEntityModel | string | BaseElement,
  ) {
    const element =
      entity instanceof BaseElement ? entity : this.getAgent(entity);
    return this.createElementFromLocator(
      element
        .getChildElementBySelector(MarketplaceAgentSelectors.description)
        .getChildElementBySelector(`${Attributes.visible}=true`)
        .getElementLocator()
        .filter({ has: this.page.locator(Tags.p) }),
    );
  }

  public getAgentVersion(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.version,
    );
  }

  public getAgentName(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.agentName,
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

  public getAgentTopicsContainer(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(
      MarketplaceAgentSelectors.topicsContainer,
    );
  }

  public getAgentVisibleTopics(agentElement: BaseElement) {
    return this.getAgentTopicsContainer(agentElement).getChildElementBySelector(
      MarketplaceAgentSelectors.topic,
    );
  }

  public getAgentHiddenTopics(agentElement: BaseElement) {
    return this.getAgentTopicsContainer(agentElement).getChildElementBySelector(
      MarketplaceAgentSelectors.hiddenTopics,
    );
  }

  public getAgentElementDotsMenu(agentElement: BaseElement) {
    return agentElement.getChildElementBySelector(MenuSelectors.menuTrigger);
  }

  public getAgentElementAddBookmarkIcon(agentElement: BaseElement) {
    return agentElement
      .getChildElementBySelector(MarketplaceAgentSelectors.addBookmarkIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public getAgentElementRemoveBookmarkIcon(agentElement: BaseElement) {
    return agentElement
      .getChildElementBySelector(MarketplaceAgentSelectors.removeBookmarkIcon)
      .getChildElementBySelector(Tags.svg);
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

  public getAgentPencilIcon(agentElement: BaseElement) {
    return agentElement
      .getChildElementBySelector(MarketplaceAgentSelectors.pencilIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public getNotAvailableAgentElement = (reference: string) => {
    const agent = this.rootLocator.filter({ has: this.agentName(reference) });
    return this.createElementFromLocator(agent);
  };

  public async getAgentNames() {
    return this.agentNames.getElementsInnerContent();
  }

  public async getAgentsIcons() {
    return this.getElementIcons(this);
  }

  public async getAgentIcon(agentElement: BaseElement) {
    return this.getElementIcon(agentElement.getElementLocator());
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

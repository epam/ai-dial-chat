import { DialAIEntityModel } from '@/chat/types/models';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { MenuSelectors } from '@/src/ui/selectors';
import { MarketplaceAgentSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, DropdownMenu } from '@/src/ui/webElements';
import { AgentDetailsModal } from '@/src/ui/webElements/marketplace/agentDetailsModal';
import { Locator, Page } from '@playwright/test';

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

  public getAgentVersion(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
      MarketplaceAgentSelectors.version,
    );
  }

  public getAgentWithVersion(
    entity: DialAIEntityModel | string,
    version?: string,
  ) {
    let name = '';
    if (typeof entity !== 'string') {
      version = entity.version;
      name = entity.name;
    } else {
      name = entity;
    }
    return this.rootLocator.filter({ has: this.agentName(name) }).filter({
      has: this.agentVersion(version!).or(
        this.agentVersionWithPrefix(version!),
      ),
    });
  }

  public getAgentTopics(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
      MarketplaceAgentSelectors.topics,
    );
  }

  public getAgentDotsMenu(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
      MenuSelectors.dotsMenu,
    );
  }

  public getAgentAddBookmarkIcon(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
      MarketplaceAgentSelectors.addBookmarkIcon,
    );
  }

  public getAgentRemoveBookmarkIcon(entity: DialAIEntityModel | string) {
    return this.getAgent(entity).getChildElementBySelector(
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

  public async waitForAgentByIndex(index: number) {
    const agent = this.getNthElement(index);
    await agent.waitFor();
  }

  public async getAgentsIcons() {
    return this.getElementIcons(this);
  }

  public async getSelectedAgent() {
    const agentsCount = await this.getElementsCount();
    for (let i = 1; i <= agentsCount; i++) {
      const selectedAttr = await this.getNthElement(i).getAttribute(
        Attributes.ariaSelected,
      );
      if (selectedAttr && JSON.parse(selectedAttr.toLowerCase())) {
        const selectedAgent = this.getNthElement(i).locator(
          MarketplaceAgentSelectors.agentName,
        );
        return selectedAgent.innerText();
      }
    }
  }

  public async addAgentToWorkspace(entity: DialAIEntityModel | string) {
    const respPromise = this.page.waitForResponse(
      (r) =>
        r.url().includes(API.installedDeploymentsHost()) && r.status() === 200,
    );
    await this.getAgentAddBookmarkIcon(entity).click();
    await respPromise;
  }

  public async isAgentUsed(
    entity: DialAIEntityModel,
    {
      isInstalledDeploymentsUpdated = false,
    }: { isInstalledDeploymentsUpdated?: boolean } = {},
  ): Promise<boolean> {
    let isAgentVisible = false;
    const entityLocator = this.agentName(entity.name);
    //open entity details modal if it is visible
    if (await entityLocator.isVisible()) {
      //open agent details modal
      await entityLocator.click();
      const agentDetailsModal = this.getAgentDetailsModal();
      //if entity has more than one version in the config
      if (entity.version) {
        //check if current version match expected
        const currentVersion =
          await agentDetailsModal.agentVersion.getElementInnerContent();
        //select version from dropdown menu if it does not match the current one
        if (currentVersion !== entity.version) {
          const menuTrigger = agentDetailsModal.versionMenuTrigger;
          //check if version menu is available
          if (await menuTrigger.isVisible()) {
            await menuTrigger.click();
            //check if menu includes version
            const version = agentDetailsModal
              .getVersionDropdownMenu()
              .menuOption(entity.version);
            if (await version.isVisible()) {
              await agentDetailsModal
                .getVersionDropdownMenu()
                .selectMenuOption(entity.version);
              await agentDetailsModal.clickUseButton({
                isInstalledDeploymentsUpdated,
              });
              isAgentVisible = true;
            } else {
              await agentDetailsModal.closeButton.click();
            }
          } else {
            await agentDetailsModal.closeButton.click();
          }
        } else {
          await agentDetailsModal.clickUseButton({
            isInstalledDeploymentsUpdated,
          });
          isAgentVisible = true;
        }
      } else {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated,
        });
        isAgentVisible = true;
      }
    }
    return isAgentVisible;
  }
}

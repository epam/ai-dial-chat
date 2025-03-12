import { DialAIEntityModel } from '@/chat/types/models';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { MarketplaceSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  FoundMarketplaceAgents,
  MarketplaceAgentProperties,
  MarketplaceAgents,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class MarketplaceAgentsSection extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSelectors.marketplaceAgentSection, parentLocator);
  }

  private agents!: MarketplaceAgents;

  getAgents(): MarketplaceAgents {
    if (!this.agents) {
      this.agents = new MarketplaceAgents(this.page, this.rootLocator);
    }
    return this.agents;
  }

  public agentsRow = this.getChildElementBySelector(
    MarketplaceSelectors.marketplaceAgentsRow,
  );

  public async useAgent(
    agent: DialAIEntityModel,
    {
      isInstalledDeploymentsUpdated = false,
    }: { isInstalledDeploymentsUpdated?: boolean } = {},
  ) {
    let isAgentUsed = false;
    const visibleAgents = this.getAgents();
    const visibleAgentNames = await visibleAgents.getAgentNames();
    //open agent details modal if it is found
    if (visibleAgentNames.includes(agent.name)) {
      //open agent's details card
      await visibleAgents.agentName(agent.name).click();
      const agentDetailsModal = visibleAgents.getAgentDetailsModal();

      //if agent has more than one version in the config
      if (agent.version) {
        //check if current version match expected
        const currentVersion =
          await agentDetailsModal.agentVersion.getElementInnerContent();
        //select version from dropdown menu if it does not match the current one
        if (currentVersion !== agent.version) {
          const menuTrigger = agentDetailsModal.versionMenuTrigger;
          //check if version menu is available
          if (await menuTrigger.isVisible()) {
            await menuTrigger.click();
            //check if menu includes version
            const version = agentDetailsModal
              .getVersionDropdownMenu()
              .menuOption(agent.version);
            if (await version.isVisible()) {
              await agentDetailsModal
                .getVersionDropdownMenu()
                .selectMenuOption(agent.version);
              await agentDetailsModal.clickUseButton({
                isInstalledDeploymentsUpdated,
              });
              isAgentUsed = true;
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
          isAgentUsed = true;
        }
      } else {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated,
        });
        isAgentUsed = true;
      }
    }
    return isAgentUsed;
  }

  public async findAndUseAgent(
    agent: DialAIEntityModel,
    {
      isInstalledDeploymentsUpdated = false,
    }: { isInstalledDeploymentsUpdated?: boolean } = {},
  ) {
    let scrollPosition: { scrollTop: number; clientHeight: number };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    let isAgentFoundAndUsed = false;
    do {
      isAgentFoundAndUsed = await this.useAgent(agent, {
        isInstalledDeploymentsUpdated: isInstalledDeploymentsUpdated,
      });
      if (isAgentFoundAndUsed) {
        break;
      }
      scrollPosition = await this.getPositionAndScrollInto();
    } while (
      scrollPosition.clientHeight <
      Math.round(scrollHeight - scrollPosition.scrollTop)
    );
    return isAgentFoundAndUsed;
  }

  public async findAgentElement(agent: DialAIEntityModel | string) {
    let scrollPosition: { scrollTop: number; clientHeight: number };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    let agentElement;
    do {
      const visibleAgents = this.getAgents();
      const visibleAgentNames = await visibleAgents.getAgentNames();
      //if agent stays among visible
      if (
        visibleAgentNames.includes(
          typeof agent === 'string' ? agent : agent.name,
        )
      ) {
        agentElement = visibleAgents.getAgent(agent);
        break;
      }
      scrollPosition = await this.getPositionAndScrollInto();
    } while (
      scrollPosition.clientHeight <
      Math.round(scrollHeight - scrollPosition.scrollTop)
    );
    if (agentElement === undefined) {
      throw new Error(`Agent : ${JSON.stringify(agent)} is not found!`);
    }
    return agentElement;
  }

  public async getAllAgents() {
    const allAgents: MarketplaceAgentProperties[] = [];
    let scrollPosition: { scrollTop: number; clientHeight: number };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    do {
      const visibleAgents = this.getAgents();
      const visibleAgentNames = await visibleAgents.getAgentNames();
      const visibleAgentsCount = visibleAgentNames.length;
      for (let i = 0; i < visibleAgentsCount; i++) {
        const agentName = visibleAgentNames[i];
        //iterate through visible agents to define filtered/suggested type
        if (!allAgents.map((a) => a.name).includes(agentName)) {
          const agentType = await visibleAgents
            .getAgent(agentName)
            .getAttribute(Attributes.ariaDetails);
          allAgents.push({
            name: agentName,
            isSuggested:
              agentType ===
              FoundMarketplaceAgents[FoundMarketplaceAgents.suggested],
            isWorkspaceAgent:
              agentType ===
              FoundMarketplaceAgents[FoundMarketplaceAgents.filtered],
          });
        }
      }
      scrollPosition = await this.getPositionAndScrollInto();
    } while (
      scrollPosition.clientHeight <
      Math.ceil(scrollHeight - scrollPosition.scrollTop)
    );
    return allAgents;
  }

  public async goTop() {
    const bounding = await this.getElementBoundingBox();
    await this.page.mouse.click(bounding!.x, bounding!.y);
    await this.page.keyboard.press(keys.home);
  }

  private async getPositionAndScrollInto() {
    const scrollTop = await this.rootLocator.evaluate((p) => p.scrollTop);
    const clientHeight = await this.rootLocator.evaluate((p) => p.clientHeight);
    const rowsCount = await this.agentsRow.getElementsCount();
    await this.agentsRow.getNthElement(rowsCount).scrollIntoViewIfNeeded();
    return {
      scrollTop: Math.ceil(scrollTop),
      clientHeight: Math.ceil(clientHeight),
    };
  }
}

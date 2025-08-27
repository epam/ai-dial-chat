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

export const marketplaceContentDisplayTimeout = 200;

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

  public async findAndUseAgent(
    agent: DialAIEntityModel,
    options?: {
      isInstalledDeploymentsUpdated?: boolean;
      isWorkspaceAgent?: boolean;
      isEditable?: boolean;
    },
  ) {
    let isAgentFoundAndUsed = false;
    const agentElement = await this.findAgentElement(agent, options);
    //open agent's details card
    await agentElement.click();
    const agentDetailsModal = this.getAgents().getAgentDetailsModal();

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
              isInstalledDeploymentsUpdated:
                options?.isInstalledDeploymentsUpdated,
            });
            isAgentFoundAndUsed = true;
          } else {
            await agentDetailsModal.closeButton.click();
          }
        } else {
          await agentDetailsModal.closeButton.click();
        }
      } else {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: options?.isInstalledDeploymentsUpdated,
        });
        isAgentFoundAndUsed = true;
      }
    } else {
      await agentDetailsModal.clickUseButton({
        isInstalledDeploymentsUpdated: options?.isInstalledDeploymentsUpdated,
      });
      isAgentFoundAndUsed = true;
    }
    return isAgentFoundAndUsed;
  }

  public async findAgentElement(
    agent: DialAIEntityModel | string,
    options?: { isWorkspaceAgent?: boolean; isEditable?: boolean },
  ) {
    const scrollPosition: { scrollTop: number; clientHeight: number } = {
      scrollTop: 0,
      clientHeight: await this.rootLocator.evaluate((p) => p.clientHeight),
    };
    let rowHeight = 0;
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    await this.moveToAgentsSection();
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
        const agentElements = visibleAgents.getAgent(agent);
        const agentsCount = await agentElements.getElementsCount();
        //if need to find an agent from a specific section
        if (options?.isWorkspaceAgent !== undefined) {
          //marketplace agent cannot be editable
          if (!options.isWorkspaceAgent) {
            options.isEditable = false;
          }
          for (let j = 1; j <= agentsCount; j++) {
            const nthAgentElement = agentElements.getNthElement(j);
            const agentType = await nthAgentElement.getAttribute(
              Attributes.ariaDetails,
            );
            const isWorkspaceAgent =
              agentType ===
              FoundMarketplaceAgents[FoundMarketplaceAgents.filtered];
            agentElement = this.createElementFromLocator(nthAgentElement);
            const hasPencilIcon = await visibleAgents
              .getAgentPencilIcon(agentElement)
              .isVisible();
            if (
              options.isWorkspaceAgent === isWorkspaceAgent &&
              options?.isEditable === hasPencilIcon
            ) {
              return agentElement;
            }
          }
        } else {
          agentElement = this.createElementFromLocator(
            agentElements.getNthElement(1),
          );
          return agentElement;
        }
      }
      rowHeight = await this.scrollIntoLastRow();
    } while (
      Math.ceil(scrollHeight - scrollPosition.scrollTop) >
      2 * scrollPosition.clientHeight - rowHeight
    );
    if (agentElement === undefined) {
      throw new Error(`Agent : ${JSON.stringify(agent)} is not found!`);
    }
    return agentElement;
  }

  public async getAllAgents() {
    const allAgents: MarketplaceAgentProperties[] = [];
    if (!(await this.rootLocator.isVisible())) {
      return allAgents;
    }
    //wait for available cards are displayed
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(marketplaceContentDisplayTimeout);
    await this.moveToAgentsSection();
    let scrollPosition: { scrollTop: number; clientHeight: number } = {
      scrollTop: 0,
      clientHeight: await this.rootLocator.evaluate((p) => p.clientHeight),
    };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    let rowHeight = 0;
    let iteration = 1;
    let shouldProceed = true;
    while (shouldProceed) {
      if (iteration !== 1) {
        rowHeight = await this.scrollIntoLastRow();
      }
      const visibleAgents = this.getAgents();
      const visibleAgentNames = await visibleAgents.getAgentNames();
      const visibleAgentsCount = visibleAgentNames.length;
      for (let i = 0; i < visibleAgentsCount; i++) {
        const agentName = visibleAgentNames[i];
        //agent's name may be duplicated on "My Workspace" tab in the filtered and suggested results
        const visibleAgent = visibleAgents.getAgent(agentName);
        const agentsCount = await visibleAgent.getElementsCount();
        //iterate through agents with duplicated name
        for (let j = 1; j <= agentsCount; j++) {
          const agentElement = visibleAgent.getNthElement(j);
          const agentType = await agentElement.getAttribute(
            Attributes.ariaDetails,
          );
          const isWorkspaceAgent =
            agentType ===
            FoundMarketplaceAgents[FoundMarketplaceAgents.filtered];

          const agentBaseElement = this.createElementFromLocator(agentElement);
          const hasPencilIcon = await visibleAgents
            .getAgentPencilIcon(agentBaseElement)
            .isVisible();
          //check whether agent's name+editable+section exists in the allAgents array
          if (
            !allAgents.some(
              (a) =>
                a.name === agentName &&
                a.isWorkspaceAgent === isWorkspaceAgent &&
                a.isEditable === hasPencilIcon,
            )
          ) {
            const versionElement =
              visibleAgents.getAgentVersion(agentBaseElement);
            let agentVersion;
            if (await versionElement.isVisible()) {
              agentVersion = await versionElement.getElementInnerContent();
            }
            allAgents.push({
              name: agentName,
              version: agentVersion ?? undefined,
              isSuggested:
                agentType ===
                FoundMarketplaceAgents[FoundMarketplaceAgents.suggested],
              isWorkspaceAgent:
                agentType ===
                FoundMarketplaceAgents[FoundMarketplaceAgents.filtered],
              isEditable: hasPencilIcon,
            });
          }
        }
      }
      scrollPosition = await this.getScrollPosition();
      //by default 2 agent rows are out of view but available in DOM
      shouldProceed =
        Math.ceil(scrollHeight - scrollPosition.scrollTop) >
        2 * scrollPosition.clientHeight - rowHeight;
      iteration++;
    }
    return allAgents;
  }

  public async goTop() {
    const bounding = await this.getElementBoundingBox();
    await this.page.mouse.click(bounding!.x, bounding!.y);
    await this.page.keyboard.press(keys.home);
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(1500);
  }

  private async getScrollPosition() {
    const scrollTop = await this.rootLocator.evaluate((p) => p.scrollTop);
    const clientHeight = await this.rootLocator.evaluate((p) => p.clientHeight);
    return {
      scrollTop: Math.ceil(scrollTop),
      clientHeight: Math.ceil(clientHeight),
    };
  }

  private async scrollIntoLastRow() {
    const rowsCount = await this.agentsRow.getElementsCount();
    const lastRowBounding = await this.agentsRow
      .getNthElement(rowsCount)
      .boundingBox();
    await this.page.mouse.wheel(
      lastRowBounding!.x + lastRowBounding!.width,
      lastRowBounding!.y + lastRowBounding!.height,
    );
    const rowHeight = lastRowBounding!.height;
    //need to wait the scrolling is finished
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(marketplaceContentDisplayTimeout);
    return rowHeight;
  }

  private async moveToAgentsSection() {
    const agentsSectionBounding = await this.getElementBoundingBox();
    await this.page.mouse.move(
      agentsSectionBounding!.x + agentsSectionBounding!.width / 2,
      agentsSectionBounding!.y + agentsSectionBounding!.height / 2,
    );
  }
}

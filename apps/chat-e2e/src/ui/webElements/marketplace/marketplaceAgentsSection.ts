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
                isInstalledDeploymentsUpdated: isInstalledDeploymentsUpdated,
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
            isInstalledDeploymentsUpdated: isInstalledDeploymentsUpdated,
          });
          isAgentUsed = true;
        }
      } else {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: isInstalledDeploymentsUpdated,
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
    const scrollPosition: { scrollTop: number; clientHeight: number } = {
      scrollTop: 0,
      clientHeight: await this.rootLocator.evaluate((p) => p.clientHeight),
    };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    let isAgentFoundAndUsed = false;
    do {
      isAgentFoundAndUsed = await this.useAgent(agent, {
        isInstalledDeploymentsUpdated: isInstalledDeploymentsUpdated,
      });
      if (isAgentFoundAndUsed) {
        break;
      }
      await this.scrollIntoLastRow();
    } while (
      scrollPosition.clientHeight <
      Math.round(scrollHeight - scrollPosition.scrollTop)
    );
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
        const agentElements = visibleAgents.getAgent(agent, {
          isUnique: false,
        });
        const agentsCount = await agentElements.getElementsCount();
        //if need to find an agent from a specific section
        if (options?.isWorkspaceAgent !== undefined) {
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
              options?.isWorkspaceAgent === isWorkspaceAgent &&
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
      await this.scrollIntoLastRow();
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
    if (!(await this.rootLocator.isVisible())) {
      return allAgents;
    }
    let scrollPosition: { scrollTop: number; clientHeight: number } = {
      scrollTop: 0,
      clientHeight: await this.rootLocator.evaluate((p) => p.clientHeight),
    };
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    let iteration = 1;
    let shouldProceed = true;
    while (shouldProceed) {
      let startAgentIndex = 0;
      if (iteration !== 1) {
        await this.scrollIntoLastRow();
        const rowsCount = await this.agentsRow.getElementsCount();
        //by default 2 agent rows are out of view but available in DOM
        if (rowsCount >= 2) {
          const columnsCount = await this.agentsRow
            .getNthElement(1)
            .getAttribute(Attributes.ariaColcount);
          startAgentIndex = 2 * +columnsCount!;
        }
      }
      const visibleAgents = this.getAgents();
      const visibleAgentNames = await visibleAgents.getAgentNames();
      const visibleAgentsCount = visibleAgentNames.length;
      for (let i = startAgentIndex; i < visibleAgentsCount; i++) {
        const agentName = visibleAgentNames[i];
        //agent's name may be duplicated on "My Workspace" tab in the filtered and suggested results
        const visibleAgent = visibleAgents.getAgent(agentName, {
          isUnique: false,
        });
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
      shouldProceed =
        scrollPosition.clientHeight <
        Math.ceil(scrollHeight - scrollPosition.scrollTop);
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
    await this.agentsRow.getNthElement(rowsCount).scrollIntoViewIfNeeded();
  }
}

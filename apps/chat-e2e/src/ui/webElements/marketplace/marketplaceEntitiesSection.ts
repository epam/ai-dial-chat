import { DialAIEntityModel } from '@/chat/types/models';
import { ToolsetModel } from '@/chat/types/toolsets';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { MarketplaceSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  FoundMarketplaceEntities,
  MarketplaceEntities,
  MarketplaceEntityProperties,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export const marketplaceContentDisplayTimeout = 200;

export class MarketplaceEntitiesSection extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSelectors.marketplaceEntitiesSection, parentLocator);
  }

  private entities!: MarketplaceEntities;

  getEntities(): MarketplaceEntities {
    if (!this.entities) {
      this.entities = new MarketplaceEntities(this.page, this.rootLocator);
    }
    return this.entities;
  }

  public entitiesRow = this.getChildElementBySelector(
    MarketplaceSelectors.marketplaceEntitiesRow,
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
    const agentElement = await this.findEntityElement(agent, options);
    //open agent's details card
    await agentElement.click();
    const agentDetailsModal = this.getEntities().getEntityDetailsModal();

    //if agent has more than one version in the config
    if (agent.version) {
      //check if current version match expected
      const currentVersion =
        await agentDetailsModal.entityVersion.getElementInnerContent();
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

  public async findEntityElement(
    entity: DialAIEntityModel | ToolsetModel | string,
    options?: { isWorkspaceEntity?: boolean; isEditable?: boolean },
  ) {
    const scrollPosition: { scrollTop: number; clientHeight: number } = {
      scrollTop: 0,
      clientHeight: await this.rootLocator.evaluate((p) => p.clientHeight),
    };
    let rowHeight = 0;
    const scrollHeight = await this.rootLocator.evaluate((p) => p.scrollHeight);
    await this.moveToEntitiesSection();
    let entityElement;
    do {
      const visibleEntities = this.getEntities();
      const visibleEntityNames = await visibleEntities.getEntityNames();
      //if entity stays among visible
      if (
        visibleEntityNames.includes(
          typeof entity === 'string' ? entity : entity.name,
        )
      ) {
        const entityElements = visibleEntities.getEntity(entity);
        const entitiesCount = await entityElements.getElementsCount();
        //if need to find an entity from a specific section
        if (options?.isWorkspaceEntity !== undefined) {
          //marketplace entity cannot be editable
          if (!options.isWorkspaceEntity) {
            options.isEditable = false;
          }
          for (let j = 1; j <= entitiesCount; j++) {
            const nthEntityElement = entityElements.getNthElement(j);
            const entityType = await nthEntityElement.getAttribute(
              Attributes.ariaDetails,
            );
            const isWorkspaceEntity =
              entityType ===
              FoundMarketplaceEntities[FoundMarketplaceEntities.filtered];
            entityElement = this.createElementFromLocator(nthEntityElement);
            const hasPencilIcon = await visibleEntities
              .getEntityPencilIcon(entityElement)
              .isVisible();
            if (
              options.isWorkspaceEntity === isWorkspaceEntity &&
              options?.isEditable === hasPencilIcon
            ) {
              return entityElement;
            }
          }
        } else {
          entityElement = this.createElementFromLocator(
            entityElements.getNthElement(1),
          );
          return entityElement;
        }
      }
      rowHeight = await this.scrollIntoLastRow();
    } while (
      Math.ceil(scrollHeight - scrollPosition.scrollTop) >
      2 * scrollPosition.clientHeight - rowHeight
    );
    if (entityElement === undefined) {
      throw new Error(`Entity : ${JSON.stringify(entity)} is not found!`);
    }
    return entityElement;
  }

  public async getAllEntities() {
    const allEntities: MarketplaceEntityProperties[] = [];
    if (!(await this.rootLocator.isVisible())) {
      return allEntities;
    }
    //wait for available cards are displayed
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(marketplaceContentDisplayTimeout);
    await this.moveToEntitiesSection();
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
      const visibleEntities = this.getEntities();
      const visibleEntityNames = await visibleEntities.getEntityNames();
      const visibleEntitiesCount = visibleEntityNames.length;
      for (let i = 0; i < visibleEntitiesCount; i++) {
        const entityName = visibleEntityNames[i];
        //entity's name may be duplicated on "My Workspace" tab in the filtered and suggested results
        const visibleEntity = visibleEntities.getEntity(entityName);
        const entitiesCount = await visibleEntity.getElementsCount();
        //iterate through entities with duplicated name
        for (let j = 1; j <= entitiesCount; j++) {
          const entityElement = visibleEntity.getNthElement(j);
          const entityType = await entityElement.getAttribute(
            Attributes.ariaDetails,
          );
          const isWorkspaceEntity =
            entityType ===
            FoundMarketplaceEntities[FoundMarketplaceEntities.filtered];

          const entityBaseElement =
            this.createElementFromLocator(entityElement);
          const hasPencilIcon = await visibleEntities
            .getEntityPencilIcon(entityBaseElement)
            .isVisible();
          //check whether entity's name+editable+section exists in the allAgents array
          if (
            !allEntities.some(
              (a) =>
                a.name === entityName &&
                a.isWorkspaceEntity === isWorkspaceEntity &&
                a.isEditable === hasPencilIcon,
            )
          ) {
            const versionElement =
              visibleEntities.getEntityVersion(entityBaseElement);
            let entityVersion;
            if (await versionElement.isVisible()) {
              entityVersion = await versionElement.getElementInnerContent();
            }
            allEntities.push({
              name: entityName,
              version: entityVersion ?? undefined,
              isSuggested:
                entityType ===
                FoundMarketplaceEntities[FoundMarketplaceEntities.suggested],
              isWorkspaceEntity:
                entityType ===
                FoundMarketplaceEntities[FoundMarketplaceEntities.filtered],
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
    return allEntities;
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
    const rowsCount = await this.entitiesRow.getElementsCount();
    const lastRowBounding = await this.entitiesRow
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

  private async moveToEntitiesSection() {
    const agentsSectionBounding = await this.getElementBoundingBox();
    await this.page.mouse.move(
      agentsSectionBounding!.x + agentsSectionBounding!.width / 2,
      agentsSectionBounding!.y + agentsSectionBounding!.height / 2,
    );
  }
}

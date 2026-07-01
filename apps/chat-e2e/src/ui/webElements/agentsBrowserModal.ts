import { AgentsBrowserModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Popup } from '@/src/ui/webElements/common/popup';
import { MarketplaceEntities } from '@/src/ui/webElements/marketplace/marketplaceEntities';
import { Locator, Page } from '@playwright/test';

// Base for the agents/toolsets picker: search, tabs and the entity grid.
// Both TalkToAgentDialog and AgentAndToolsetSelectModal extend it.
export class AgentsBrowserModal extends Popup {
  constructor(page: Page, selector?: string, parentLocator?: Locator) {
    super(page, selector, parentLocator);
  }

  private entities!: MarketplaceEntities;

  public searchInput = this.getChildElementBySelector(
    AgentsBrowserModalSelectors.searchInput,
  );
  public myWorkspaceTab = this.getChildElementBySelector(
    AgentsBrowserModalSelectors.myWorkspaceTab,
  );
  public marketplaceTab = this.getChildElementBySelector(
    AgentsBrowserModalSelectors.marketplaceTab,
  );
  // Shown in the entity grid when a search returns nothing.
  public noResultsFound = this.getChildElementBySelector(
    AgentsBrowserModalSelectors.noResultsFound,
  );

  getEntities(): MarketplaceEntities {
    if (!this.entities) {
      this.entities = new MarketplaceEntities(this.page, this.rootLocator);
    }
    return this.entities;
  }

  public getEntityByName(name: string): BaseElement {
    return this.getEntities().getEntity(name);
  }

  // The tab carries the accent-border class only when it is the active one.
  public getActiveTab(tab: BaseElement): BaseElement {
    return this.createElementFromLocator(
      tab
        .getElementLocator()
        .and(this.page.locator(AgentsBrowserModalSelectors.selectedTab)),
    );
  }

  // Search for an entity by name and return its card.
  public async searchForEntity(name: string): Promise<BaseElement> {
    await this.searchInput.fillInInput(name);
    return this.getEntityByName(name);
  }
}

import { ExpectedConstants } from '@/src/testData/expectedConstants';
import { AgentsBrowserModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Popup } from '@/src/ui/webElements/common/popup';
import { SliderDots } from '@/src/ui/webElements/common/sliderDots';
import { MarketplaceEntities } from '@/src/ui/webElements/marketplace/marketplaceEntities';
import { Locator, Page } from '@playwright/test';

// Base for the agents/toolsets picker: search, tabs and the entity grid.
// Both TalkToAgentDialog and AgentAndToolsetSelectModal extend it.
export class AgentsBrowserModal extends Popup {
  constructor(page: Page, selector?: string, parentLocator?: Locator) {
    super(page, selector, parentLocator);
  }

  private entities!: MarketplaceEntities;
  private sliderDots!: SliderDots;

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
  // Empty state when the user has no created/bookmarked items (no data-qa — by text).
  public noItemsPlaceholder = this.createElementFromLocator(
    this.rootLocator.getByText(ExpectedConstants.noAgentsAndToolsets, {
      exact: true,
    }),
  );
  public goToMarketplaceLink = this.createElementFromLocator(
    this.rootLocator.getByText(ExpectedConstants.goToMarketplaceLink),
  );
  // Suggestion under "No results found in My workspace" (no data-qa — by text).
  public seeResultsFromMarketplaceLink = this.createElementFromLocator(
    this.rootLocator.getByText(ExpectedConstants.seeResultsFromMarketplaceLink),
  );

  getEntities(): MarketplaceEntities {
    if (!this.entities) {
      this.entities = new MarketplaceEntities(this.page, this.rootLocator);
    }
    return this.entities;
  }

  getSliderDots(): SliderDots {
    if (!this.sliderDots) {
      this.sliderDots = new SliderDots(this.page, this.rootLocator);
    }
    return this.sliderDots;
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

  // Only the active page and its neighbours are rendered, so the names of the
  // rest are collected by walking the pages with the next arrow.
  public async getAllEntityNames(): Promise<string[]> {
    const sliderDots = this.getSliderDots();
    const allNames = await this.getEntities().getEntityNames();
    while (
      (await sliderDots.nextArrow.isVisible()) &&
      (await sliderDots.nextArrow.isElementEnabled())
    ) {
      await sliderDots.nextArrow.click();
      const pageNames = await this.getEntities().getEntityNames();
      for (const pageName of pageNames) {
        if (!allNames.includes(pageName)) {
          allNames.push(pageName);
        }
      }
    }
    return allNames;
  }
}

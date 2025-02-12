import { Tags } from '@/src/ui/domData';
import {
  ErrorLabelSelectors,
  MarketplaceAgentSelectors,
  MarketplaceSelectors,
  marketplaceContainer,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { MarketplaceAgents } from '@/src/ui/webElements/marketplace/marketplaceAgents';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { Locator, Page } from '@playwright/test';

export class Marketplace extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, marketplaceContainer, parentLocator);
  }

  private agents!: MarketplaceAgents;
  private filteredAgents!: MarketplaceAgents;
  private suggestedAgents!: MarketplaceAgents;
  private marketplaceHeader!: MarketplaceHeader;

  getAgents(): MarketplaceAgents {
    if (!this.agents) {
      this.agents = new MarketplaceAgents(this.page, this.rootLocator);
    }
    return this.agents;
  }

  getFilteredAgents(): MarketplaceAgents {
    if (!this.filteredAgents) {
      this.filteredAgents = new MarketplaceAgents(
        this.page,
        this.rootLocator.locator(MarketplaceAgentSelectors.filteredAgents),
      );
    }
    return this.filteredAgents;
  }

  getSuggestedAgents(): MarketplaceAgents {
    if (!this.suggestedAgents) {
      this.suggestedAgents = new MarketplaceAgents(
        this.page,
        this.rootLocator.locator(MarketplaceAgentSelectors.suggestedAgents),
      );
    }
    return this.suggestedAgents;
  }

  getMarketplaceHeader(): MarketplaceHeader {
    if (!this.marketplaceHeader) {
      this.marketplaceHeader = new MarketplaceHeader(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceHeader;
  }

  public marketplaceSuggestionsLabel = this.getChildElementBySelector(
    MarketplaceSelectors.marketplaceSuggestions,
  );

  public noWorkspaceResultsFound = this.getChildElementBySelector(Tags.section)
    .getElementLocator()
    .filter({
      has: new BaseElement(
        this.page,
        MarketplaceAgentSelectors.filteredAgents,
      ).getElementLocator(),
    })
    .locator(`~${MarketplaceSelectors.noWorkspaceResultsFound}`);

  public noWorkspaceResultsFoundIcon = this.noWorkspaceResultsFound.locator(
    Tags.svg,
  );
  public noResultsFound = this.getChildElementBySelector(
    ErrorLabelSelectors.noResultFound,
  );
  public noResultsFoundIcon = this.noResultsFound.getChildElementBySelector(
    Tags.svg,
  );
  public noResultsFoundDescription = this.getChildElementBySelector(
    MarketplaceSelectors.noResultsFoundDescription,
  );
}

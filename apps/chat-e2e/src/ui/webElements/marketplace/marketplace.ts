import { Tags } from '@/src/ui/domData';
import {
  ErrorLabelSelectors,
  MarketplaceSelectors,
  marketplaceContainer,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { MarketplaceAgentsSection } from '@/src/ui/webElements/marketplace/marketplaceAgentsSection';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { Locator, Page } from '@playwright/test';

export class Marketplace extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, marketplaceContainer, parentLocator);
  }

  private marketplaceHeader!: MarketplaceHeader;
  private marketplaceAgentsSection!: MarketplaceAgentsSection;

  getMarketplaceHeader(): MarketplaceHeader {
    if (!this.marketplaceHeader) {
      this.marketplaceHeader = new MarketplaceHeader(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceHeader;
  }

  getMarketplaceAgentsSection(): MarketplaceAgentsSection {
    if (!this.marketplaceAgentsSection) {
      this.marketplaceAgentsSection = new MarketplaceAgentsSection(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceAgentsSection;
  }

  public marketplaceSuggestionsLabel = this.getChildElementBySelector(
    MarketplaceSelectors.marketplaceSuggestions,
  );
  public noWorkspaceResultsFound = this.getChildElementBySelector(
    MarketplaceSelectors.noWorkspaceResultsFound,
  );
  public noWorkspaceResultsFoundIcon =
    this.noWorkspaceResultsFound.getChildElementBySelector(Tags.svg);
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

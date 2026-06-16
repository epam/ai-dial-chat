import { Tags } from '@/src/ui/domData';
import {
  ErrorLabelSelectors,
  IconSelectors,
  MarketplaceSelectors,
  marketplaceContainer,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { MarketplaceEntitiesSection } from '@/src/ui/webElements/marketplace/marketplaceEntitiesSection';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { Locator, Page } from '@playwright/test';

export class Marketplace extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, marketplaceContainer, parentLocator);
  }

  private marketplaceHeader!: MarketplaceHeader;
  private marketplaceEntitiesSection!: MarketplaceEntitiesSection;

  getMarketplaceHeader(): MarketplaceHeader {
    if (!this.marketplaceHeader) {
      this.marketplaceHeader = new MarketplaceHeader(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceHeader;
  }

  getMarketplaceEntitiesSection(): MarketplaceEntitiesSection {
    if (!this.marketplaceEntitiesSection) {
      this.marketplaceEntitiesSection = new MarketplaceEntitiesSection(
        this.page,
        this.rootLocator,
      );
    }
    return this.marketplaceEntitiesSection;
  }

  public marketplaceSuggestionsLabel = this.getChildElementBySelector(
    MarketplaceSelectors.marketplaceSuggestions,
  );
  public marketplaceNoDataContainer = this.getChildElementBySelector(
    `${MarketplaceSelectors.marketplaceNoDataContainer}:visible`,
  );
  public noWorkspaceResultsFound = this.getChildElementBySelector(
    MarketplaceSelectors.noWorkspaceResultsFound,
  );
  public noWorkspaceResultsFoundIcon =
    this.noWorkspaceResultsFound.getChildElementBySelector(Tags.svg);
  public noResultsFound =
    this.marketplaceNoDataContainer.getChildElementBySelector(
      ErrorLabelSelectors.noResultFound,
    );
  public noResultsFoundIcon = this.noResultsFound.getChildElementBySelector(
    Tags.svg,
  );
  public noDataHeader =
    this.marketplaceNoDataContainer.getChildElementBySelector(
      MarketplaceSelectors.noDataHeader,
    );
  public noResultsFoundDescription =
    this.marketplaceNoDataContainer.getChildElementBySelector(
      MarketplaceSelectors.noResultsFoundDescription,
    );
  public noToolsetsIcon =
    this.marketplaceNoDataContainer.getChildElementBySelector(
      IconSelectors.noToolsetIcon,
    );
}

import { EntityType } from '@/chat/types/common';
import {
  BaseUrlBuilder,
  ExpectedConstants,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/testData';

export class MarketplaceUrlBuilder extends BaseUrlBuilder {
  constructor(includeBaseURL = true) {
    super(ExpectedConstants.marketplacePath, includeBaseURL);
  }

  withTypes(...types: string[]): MarketplaceUrlBuilder {
    this.addArrayParam('types', types);
    return this;
  }

  withSources(...sources: string[]): MarketplaceUrlBuilder {
    this.addArrayParam('sources', sources);
    return this;
  }

  withTopics(...topics: string[]): MarketplaceUrlBuilder {
    this.addArrayParam('topics', topics);
    return this;
  }

  withTab(tab: MarketplaceTabs): MarketplaceUrlBuilder {
    this.addParam('tab', tab);
    return this;
  }

  withSearch(search: string): MarketplaceUrlBuilder {
    this.addParam('search', search);
    return this;
  }

  withModel(model: string): MarketplaceUrlBuilder {
    this.addParam('model', model);
    return this;
  }

  withEntitiesTab(entitiesTab: MarketplaceEntitiesTabs): MarketplaceUrlBuilder {
    this.addParam('entitiesTab', entitiesTab);
    return this;
  }

  withReference(
    entityType: EntityType,
    reference: string,
  ): MarketplaceUrlBuilder {
    this.addParam(entityType, reference);
    return this;
  }

  build(): string {
    const url = this.baseUrl + this.buildQueryString();
    this.resetParams();
    return url;
  }
}

import config from '@/config/chat.playwright.config';
import { ExpectedConstants } from '@/src/testData';

export class MarketplaceUrlBuilder {
  private readonly baseUrl: string = config.use!.baseURL!.concat(
    ExpectedConstants.marketplacePath,
  );
  private types: string[] = [];
  private sources: string[] = [];
  private topics: string[] = [];
  private tab: string | null = null;
  private search: string | null = null;

  withTypes(...types: string[]): MarketplaceUrlBuilder {
    this.types = types;
    return this;
  }

  withSources(...sources: string[]): MarketplaceUrlBuilder {
    this.sources = sources;
    return this;
  }

  withTopics(...topics: string[]): MarketplaceUrlBuilder {
    this.topics = topics;
    return this;
  }

  withTab(tab: string): MarketplaceUrlBuilder {
    this.tab = tab;
    return this;
  }

  withSearch(search: string): MarketplaceUrlBuilder {
    this.search = search;
    return this;
  }

  build(): string {
    const queryParams = [];

    if (this.types.length > 0) {
      queryParams.push(`types=${this.types.join(',')}`);
    }

    if (this.sources.length > 0) {
      queryParams.push(`sources=${this.sources.join(',')}`);
    }

    if (this.topics.length > 0) {
      queryParams.push(`topics=${this.topics.join(',')}`);
    }

    if (this.tab) {
      queryParams.push(`tab=${this.tab}`);
    }

    if (this.search) {
      queryParams.push(`search=${this.search}`);
    }

    const url = `${this.baseUrl}?${queryParams.join('&')}`;
    this.resetParams();
    return url;
  }

  private resetParams(): void {
    this.types = [];
    this.sources = [];
    this.topics = [];
    this.tab = null;
    this.search = null;
  }
}

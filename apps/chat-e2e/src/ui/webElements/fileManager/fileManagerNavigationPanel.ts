import { FileManagerNavigationPanelSelectors } from '@/src/ui/selectors';
import { BaseElement, Breadcrumb, Search } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FileManagerNavigationPanel extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      FileManagerNavigationPanelSelectors.navigationPanelContainer,
      parentLocator,
    );
  }

  private breadcrumb!: Breadcrumb;
  private search!: Search;

  getSearch(): Search {
    if (!this.search) {
      this.search = new Search(this.page, this.rootLocator);
    }
    return this.search;
  }

  getBreadcrumb(): Breadcrumb {
    if (!this.breadcrumb) {
      this.breadcrumb = new Breadcrumb(this.page, this.rootLocator);
    }
    return this.breadcrumb;
  }
}

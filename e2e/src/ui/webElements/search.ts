import { Tags } from '@/e2e/src/ui/domData';
import { SideBarSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Filter } from '@/e2e/src/ui/webElements/filter';
import { Locator, Page } from '@playwright/test';

export class Search extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, SideBarSelectors.search, parentLocator);
  }

  private filter!: Filter;

  getFilter(): Filter {
    if (!this.filter) {
      this.filter = new Filter(this.page, this.rootLocator);
    }
    return this.filter;
  }

  public searchInput = this.getChildElementBySelector(Tags.input);

  public async setSearchValue(value: string) {
    await this.searchInput.fillInInput(value);
  }
}

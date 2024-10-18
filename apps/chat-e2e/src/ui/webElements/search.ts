import { Tags } from '@/src/ui/domData';
import { SideBarSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Filter } from '@/src/ui/webElements/filter';
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
  public async setSearchValue(value: string) {
    await this.fillInInput(value);
  }
}

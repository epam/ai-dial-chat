import { BreadcrumbSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';


export class Breadcrumb extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, BreadcrumbSelectors.breadcrumbContainer, parentLocator);
  }

  public items = this.getChildElementBySelector(
    BreadcrumbSelectors.breadcrumbItem,
  );

  public itemByName = (name: string) =>
    this.items.getElementLocator().filter({
      has: this.page.locator(BreadcrumbSelectors.breadcrumbItemContent, {
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`),
      }),
    });

  public itemByNameContent = (name: string) =>
    this.itemByName(name).locator(BreadcrumbSelectors.breadcrumbItemContent);

  public async clickBreadcrumbByName(name: string) {
    await this.itemByNameContent(name).click();
  }
}

import { Tags } from '@/src/ui/domData';
import { FileManagerNavigationPanelSelectors } from '@/src/ui/selectors';
import { BaseElement, Breadcrumb } from '@/src/ui/webElements';
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

  public searchField = this.getChildElementBySelector(
    FileManagerNavigationPanelSelectors.searchField,
  );

  public searchFieldInput = this.searchField.getChildElementBySelector(
    Tags.input,
  );

  getBreadcrumb(): Breadcrumb {
    if (!this.breadcrumb) {
      this.breadcrumb = new Breadcrumb(this.page, this.rootLocator);
    }
    return this.breadcrumb;
  }
}

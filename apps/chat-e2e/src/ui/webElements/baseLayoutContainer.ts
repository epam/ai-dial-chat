import { layoutContainer } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { NavigationPanel } from '@/src/ui/webElements/navigationPanel';
import { Page } from '@playwright/test';

export abstract class BaseLayoutContainer<
  T extends BaseElement,
> extends BaseElement {
  constructor(page: Page) {
    super(page, layoutContainer);
  }

  protected header!: T;
  protected navigationPanel!: NavigationPanel;

  abstract getHeader(): T;

  getNavigationPanel(): NavigationPanel {
    if (!this.navigationPanel) {
      this.navigationPanel = new NavigationPanel(this.page, this.rootLocator);
    }
    return this.navigationPanel;
  }
}

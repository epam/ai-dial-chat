import { layoutContainer } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Header } from '@/src/ui/webElements/header';
import { Page } from '@playwright/test';

export class BaseLayoutContainer extends BaseElement {
  constructor(page: Page) {
    super(page, layoutContainer);
  }

  private header!: Header;

  getHeader(): Header {
    if (!this.header) {
      this.header = new Header(this.page, this.rootLocator);
    }
    return this.header;
  }
}

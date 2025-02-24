import { layoutContainer } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export abstract class BaseLayoutContainer<
  T extends BaseElement,
> extends BaseElement {
  constructor(page: Page) {
    super(page, layoutContainer);
  }

  protected header!: T;

  abstract getHeader(): T;
}

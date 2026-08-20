import { favicon } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class Favicon extends BaseElement {
  constructor(page: Page) {
    super(page, favicon);
  }
}

import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class PromptBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }
}

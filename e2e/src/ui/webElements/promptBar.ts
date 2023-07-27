import { SideBarSelectors } from '../selectors/sideBarSelectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class PromptBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }
}

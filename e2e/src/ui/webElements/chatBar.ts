import { SideBarSelectors } from '../selectors/sideBarSelectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class ChatBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }
}

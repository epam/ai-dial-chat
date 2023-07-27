import { ChatSelectors } from '../selectors/chatSelectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class Chat extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chat);
  }
}

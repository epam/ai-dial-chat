import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { RecentEntities } from './recentEntities';

import { Page } from '@playwright/test';

export class EntitySelector extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.entitySelector);
  }

  private recentEntities!: RecentEntities;
  private seeFullListButton = this.getChildElementBySelector(
    ChatSelectors.seeFullList,
  );

  getRecentEntities(): RecentEntities {
    if (!this.recentEntities) {
      this.recentEntities = new RecentEntities(this.page);
    }
    return this.recentEntities;
  }
}

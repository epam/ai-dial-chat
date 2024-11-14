import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { TalkToEntities } from '@/src/ui/webElements/talkToEntities';
import { Locator, Page } from '@playwright/test';

export class TalkToGroup extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ModelDialog.talkToGroup, parentLocator);
  }

  public talkToEntities!: TalkToEntities;

  getTalkToEntities(): TalkToEntities {
    if (!this.talkToEntities) {
      this.talkToEntities = new TalkToEntities(this.page, this.rootLocator);
    }
    return this.talkToEntities;
  }
}

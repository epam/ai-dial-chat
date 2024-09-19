import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { GroupEntities } from '@/src/ui/webElements/groupEntities';
import { Locator, Page } from '@playwright/test';

export class TalkToGroup extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ModelDialog.talkToGroup(), parentLocator);
  }

  public groupEntities!: GroupEntities;

  getGroupEntities(groupName?: string): GroupEntities {
    if (!this.groupEntities) {
      this.groupEntities = new GroupEntities(
        this.page,
        groupName
          ? this.rootLocator.filter({
              has: this.page.getByText(groupName, { exact: true }),
            })
          : this.rootLocator,
      );
    }
    return this.groupEntities;
  }
}

import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { GroupEntity } from '@/src/ui/webElements/groupEntity';
import { Locator, Page } from '@playwright/test';

export class TalkToGroup extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ModelDialog.talkToGroup(), parentLocator);
  }

  public groupEntity!: GroupEntity;

  getGroupEntity(groupName?: string): GroupEntity {
    if (!this.groupEntity) {
      this.groupEntity = new GroupEntity(
        this.page,
        groupName
          ? this.rootLocator.filter({
              has: this.page.getByText(groupName, { exact: true }),
            })
          : this.rootLocator,
      );
    }
    return this.groupEntity;
  }
}

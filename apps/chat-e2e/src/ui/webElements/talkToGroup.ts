import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { GroupEntity } from '@/src/ui/webElements/groupEntity';
import { Locator, Page } from '@playwright/test';

export class TalkToGroup extends BaseElement {
  constructor(page: Page, parentLocator: Locator, groupName?: string) {
    super(page, ModelDialog.talkToGroup(groupName), parentLocator);
  }

  public groupEntity!: GroupEntity;

  getGroupEntity(): GroupEntity {
    if (!this.groupEntity) {
      this.groupEntity = new GroupEntity(this.page, this.rootLocator);
    }
    return this.groupEntity;
  }
}

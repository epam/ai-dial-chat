import { ErrorLabelSelectors, ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Groups } from '@/src/testData';
import { GroupEntity } from '@/src/ui/webElements/groupEntity';
import { TalkToGroup } from '@/src/ui/webElements/talkToGroup';
import { Page } from '@playwright/test';

export class ModelsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ModelDialog.modelDialog);
  }

  public talkToModelEntities!: GroupEntity;
  public talkToAssistantEntities!: GroupEntity;
  public talkToApplicationEntities!: GroupEntity;

  getTalkToModelEntities(): GroupEntity {
    if (!this.talkToModelEntities) {
      this.talkToModelEntities = new TalkToGroup(
        this.page,
        this.rootLocator,
      ).getGroupEntity(Groups.models);
    }
    return this.talkToModelEntities;
  }

  getTalkToAssistantEntities(): GroupEntity {
    if (!this.talkToAssistantEntities) {
      this.talkToAssistantEntities = new TalkToGroup(
        this.page,
        this.rootLocator,
      ).getGroupEntity(Groups.assistants);
    }
    return this.talkToAssistantEntities;
  }

  getTalkToApplicationEntities(): GroupEntity {
    if (!this.talkToApplicationEntities) {
      this.talkToApplicationEntities = new TalkToGroup(
        this.page,
        this.rootLocator,
      ).getGroupEntity(Groups.applications);
    }
    return this.talkToApplicationEntities;
  }

  public searchInput = this.getChildElementBySelector(ModelDialog.searchInput);

  public closeButton = this.getChildElementBySelector(ModelDialog.closeDialog);
  public noResultFoundIcon = this.getChildElementBySelector(
    ErrorLabelSelectors.noResultFound,
  );
  public modelsTab = this.getChildElementBySelector(ModelDialog.modelsTab);
  public assistantsTab = this.getChildElementBySelector(
    ModelDialog.assistantsTab,
  );
  public applicationsTab = this.getChildElementBySelector(
    ModelDialog.applicationsTab,
  );

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}

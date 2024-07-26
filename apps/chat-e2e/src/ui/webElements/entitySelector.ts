import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { DialAIEntityModel } from '@/chat/types/models';
import { Groups } from '@/src/testData';
import { ModelsDialog } from '@/src/ui/webElements/modelsDialog';
import { RecentEntities } from '@/src/ui/webElements/recentEntities';
import { Locator, Page } from '@playwright/test';

export class EntitySelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.entitySelector, parentLocator);
  }

  private recentEntities!: RecentEntities;
  private modelsDialog!: ModelsDialog;
  private seeFullListButton = this.getChildElementBySelector(
    ChatSettingsSelectors.seeFullList,
  );

  getRecentEntities(): RecentEntities {
    if (!this.recentEntities) {
      this.recentEntities = new RecentEntities(this.page, this.rootLocator);
    }
    return this.recentEntities;
  }

  getModelsDialog(): ModelsDialog {
    if (!this.modelsDialog) {
      this.modelsDialog = new ModelsDialog(this.page);
    }
    return this.modelsDialog;
  }

  public async seeFullList() {
    await this.seeFullListButton.click();
  }

  public async selectAssistant(assistant: DialAIEntityModel) {
    await this.selectEntity(assistant, Groups.assistants);
  }

  public async selectApplication(application: DialAIEntityModel) {
    await this.selectEntity(application, Groups.applications);
  }

  public async selectModel(model: DialAIEntityModel) {
    await this.selectEntity(model, Groups.models);
  }

  public async selectEntity(entity: DialAIEntityModel, group: Groups) {
    const recentEntities = this.getRecentEntities();
    const recentGroupEntity = recentEntities.getTalkToGroup().getGroupEntity();
    const isEntityVisible = await recentGroupEntity
      .groupEntity(entity)
      .isVisible();
    if (isEntityVisible) {
      await recentGroupEntity.selectGroupEntity(entity);
    } else {
      const talkToGroup = this.getTalkToGroup(group);
      await this.seeFullList();
      await talkToGroup.selectGroupEntity(entity);
    }
  }

  private getTalkToGroup(group: Groups) {
    const dialog = this.getModelsDialog();
    switch (group) {
      case Groups.models:
        return dialog.getTalkToModelEntities();
      case Groups.assistants:
        return dialog.getTalkToAssistantEntities();
      case Groups.applications:
        return dialog.getTalkToApplicationEntities();
    }
  }
}

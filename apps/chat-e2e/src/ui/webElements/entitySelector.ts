import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Groups } from '@/src/testData';
import { ModelsDialog } from '@/src/ui/webElements/modelsDialog';
import { RecentEntities } from '@/src/ui/webElements/recentEntities';
import { Locator, Page } from '@playwright/test';

export class EntitySelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.entitySelector, parentLocator);
  }

  private recentEntities!: RecentEntities;
  private modelsDialog!: ModelsDialog;
  private seeFullListButton = this.getChildElementBySelector(
    ChatSelectors.seeFullList,
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

  public async selectAssistant(assistant: string) {
    await this.selectEntity(assistant, Groups.assistants);
  }

  public async selectApplication(application: string) {
    await this.selectEntity(application, Groups.applications);
  }

  public async selectModel(model: string, iconHost?: string) {
    if (isApiStorageType && iconHost) {
      const resp = this.page.waitForResponse(
        (response) =>
          response.url().includes(iconHost!) && response.status() === 200,
      );
      await this.selectEntity(model, Groups.models);
      return resp;
    }
    await this.selectEntity(model, Groups.models);
  }

  public async selectEntity(entity: string, group: Groups) {
    const recentEntities = this.getRecentEntities();
    await recentEntities.waitForState({ state: 'attached' });
    const recentGroupEntity = recentEntities.getTalkToGroup().getGroupEntity();
    const isEntityVisible = await recentGroupEntity
      .groupEntity(entity)
      .isVisible();
    if (isEntityVisible) {
      await recentGroupEntity.selectGroupEntity(entity);
    } else {
      const talkToGroup = this.getTalkToGroup(group);
      await this.seeFullList();
      await talkToGroup.getGroupEntity().selectGroupEntity(entity);
    }
  }

  private getTalkToGroup(group: Groups) {
    const dialog = this.getModelsDialog();
    switch (group) {
      case Groups.models:
        return dialog.getTalkToModels();
      case Groups.assistants:
        return dialog.getTalkToAssistants();
      case Groups.applications:
        return dialog.getTalkToApplications();
    }
  }
}

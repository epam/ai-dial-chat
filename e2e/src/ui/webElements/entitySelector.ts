import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { RecentEntities } from './recentEntities';

import { Groups } from '@/e2e/src/testData';
import { ModelsDialog } from '@/e2e/src/ui/webElements/modelsDialog';
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

  public async selectModel(model: string) {
    await this.selectEntity(model, Groups.models);
  }

  public async selectEntity(entity: string, group: Groups) {
    const recentEntities = await this.getRecentEntities();
    const isEntityVisible = await recentEntities
      .getRecentEntity(entity)
      .isVisible();
    if (isEntityVisible) {
      await recentEntities.selectEntity(entity);
    } else {
      await this.seeFullList();
      await this.getModelsDialog().selectGroupEntity(entity, group);
    }
  }
}

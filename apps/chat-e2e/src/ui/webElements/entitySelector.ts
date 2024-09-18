import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { DialAIEntityModel } from '@/chat/types/models';
import { Groups } from '@/src/testData';
import { GroupEntities } from '@/src/ui/webElements/groupEntities';
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
    const recentGroupEntities = recentEntities
      .getTalkToGroup()
      .getGroupEntities();
    const isRecentEntitySelected = await this.isEntitySelected(
      recentGroupEntities,
      entity,
    );
    if (!isRecentEntitySelected) {
      await this.seeFullList();
      const talkToGroupEntities = this.getTalkToGroupEntities(group);
      const isFullListEntitySelected = await this.isEntitySelected(
        talkToGroupEntities,
        entity,
      );
      if (!isFullListEntitySelected) {
        throw new Error(
          `Entity with name: ${entity.name} and version: ${entity.version} is not found!`,
        );
      }
    }
  }

  private async isEntitySelected(
    groupEntities: GroupEntities,
    entity: DialAIEntityModel,
  ): Promise<boolean> {
    let isEntitySelected = false;
    const entityLocator = groupEntities.getGroupEntity(entity);
    //select entity if it is visible
    if (await entityLocator.isVisible()) {
      await entityLocator.click();
      isEntitySelected = true;
    } else {
      //if entity is not visible
      //check if entity name stays among visible entities
      const entityWithVersionToSetLocator =
        await groupEntities.entityWithVersionToSet(entity);
      //select entity version if name is found
      if (entityWithVersionToSetLocator) {
        await groupEntities.selectEntityVersion(
          entityWithVersionToSetLocator,
          entity.version!,
        );
        isEntitySelected = true;
      }
    }
    return isEntitySelected;
  }

  private getTalkToGroupEntities(group: Groups) {
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

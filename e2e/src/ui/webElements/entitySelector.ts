import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { EntitySelectorMenu } from './entitySelectorMenu';

import { Page } from '@playwright/test';

export class EntitySelector extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.entitySelector);
  }

  private entitySelectorMenu!: EntitySelectorMenu;

  getEntitySelectorMenu(): EntitySelectorMenu {
    if (!this.entitySelectorMenu) {
      this.entitySelectorMenu = new EntitySelectorMenu(this.page);
    }
    return this.entitySelectorMenu;
  }

  public async selectEntity(name: string) {
    await this.click();
    const entitySelectorMenu = await this.getEntitySelectorMenu();
    await entitySelectorMenu.waitForState();
    await entitySelectorMenu.selectEntity(name);
  }
}

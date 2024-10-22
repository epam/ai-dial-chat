import { MenuSelectors, SideBarSelectors } from '../../../selectors';

import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { EditInput } from '@/src/ui/webElements/editInput';
import { EditInputActions } from '@/src/ui/webElements/editInputActions';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class SideBarEntitiesTree extends EntitiesTree {
  private editEntityInput!: EditInput;

  getEditEntityInput(): EditInput {
    if (!this.editEntityInput) {
      this.editEntityInput = new EditInput(
        this.page,
        this.getElementLocator(),
        this.entitySelector,
      );
    }
    return this.editEntityInput;
  }

  private editInputActions!: EditInputActions;

  getEditInputActions(): EditInputActions {
    if (!this.editInputActions) {
      this.editInputActions = new EditInputActions(
        this.page,
        this.getElementLocator(),
        this.entitySelector,
      );
    }
    return this.editInputActions;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  entityDotsMenu = (name: string, indexOrOptions?: number | { exactMatch: boolean, index?: number }) => {
    let entity;
    let index: number | undefined;

    if (typeof indexOrOptions === 'number') {
      // Existing behavior
      index = indexOrOptions;
      entity = this.getEntityByName(name, index);
    } else if (typeof indexOrOptions === 'object' && indexOrOptions.exactMatch) {
      // New exact match behavior
      index = indexOrOptions.index;
      entity = this.getEntityByExactName(name, index);
    } else {
      // Default behavior (partial match, no index)
      entity = this.getEntityByName(name);
    }

    return entity.locator(MenuSelectors.dotsMenu);
  };

  getEntityArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  async openEntityDropdownMenu(name: string, indexOrOptions?: number | { exactMatch: boolean, index?: number }) {
    let entity;
    let index: number | undefined;

    if (typeof indexOrOptions === 'number') {
      // Existing behavior
      index = indexOrOptions;
      entity = this.getEntityByName(name, index);
    } else if (typeof indexOrOptions === 'object' && indexOrOptions.exactMatch) {
      // New exact match behavior
      index = indexOrOptions.index;
      entity = this.getEntityByExactName(name, index);
    } else {
      // Default behavior (partial match, no index)
      entity = this.getEntityByName(name);
    }

    await entity.hover();
    await this.entityDotsMenu(name, indexOrOptions).click();
    await this.getDropdownMenu().waitForState();
  }
  async openEditEntityNameMode(newName: string) {
    const input = this.getEditEntityInput();
    await input.editValue(newName);
    return input;
  }

  public async selectMoveToMenuOption(
    name: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    return this.getDropdownMenu().selectMenuOption(name, {
      triggeredHttpMethod: 'DELETE',
      isHttpMethodTriggered,
    });
  }
}

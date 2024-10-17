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

  entityDotsMenu = (name: string, index?: number) => {
    return this.getEntityByName(name, index).locator(MenuSelectors.dotsMenu);
  };

  getEntityArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  async openEntityDropdownMenu(name: string, index?: number) {
    const entity = this.getEntityByName(name, index);
    await entity.hover();
    await this.entityDotsMenu(name, index).click();
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

import {
  EntitySelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../../../selectors';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Colors } from '@/src/ui/domData';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { EditInput } from '@/src/ui/webElements/editInput';
import { EditInputActions } from '@/src/ui/webElements/editInputActions';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class SideBarEntitiesTree extends EntitiesTree {
  private editEntityInput!: EditInput;

  public treeEntityNames = this.getChildElementBySelector(
    EntitySelectors.entityName,
  );

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

  entityDotsMenu = (
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) => {
    return this.getTreeEntity(name, indexOrOptions).locator(
      MenuSelectors.dotsMenu,
    );
  };

  getEntityArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  async openEntityDropdownMenu(
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) {
    const entity = this.getTreeEntity(name, indexOrOptions);
    // eslint-disable-next-line playwright/no-force-option
    await entity.hover({ force: true });
    // eslint-disable-next-line playwright/no-force-option
    await this.entityDotsMenu(name, indexOrOptions).click({ force: true });
    await this.getDropdownMenu().waitForState();
  }

  async openEditEntityNameMode(newName: string) {
    const input = this.getEditEntityInput();
    await input.editValue(newName);
    return input;
  }

  public async selectEntity(
    name: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) {
    const entityToSelect = this.getTreeEntity(name, indexOrOptions);
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'GET',
      );
      await entityToSelect.click();
      return respPromise;
    }
    await entityToSelect.click();
  }

  public selectedEntity(name: string, index?: number) {
    if (index) {
      return this.getEntityByName(name, index).locator(
        SideBarSelectors.selectedEntity,
      );
    } else {
      return this.getEntityByExactName(name).locator(
        SideBarSelectors.selectedEntity,
      );
    }
  }

  public async getSelectedEntities(): Promise<
    { name: string; index?: number }[]
  > {
    const allNames = await this.getAllTreeEntitiesNames();
    const selectedEntities = [];

    for (const name of allNames) {
      const hasSelectedClass = (await this.selectedEntity(name).count()) > 0;
      const backgroundColor = await this.getEntityBackgroundColor(name);

      if (
        hasSelectedClass ||
        backgroundColor === Colors.backgroundAccentSecondary
      ) {
        selectedEntities.push({ name });
      }
    }
    return selectedEntities;
  }
}

import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ExpectedConstants } from '@/src/testData';
import { Styles, Tags } from '@/src/ui/domData';
import { EditSelectors } from '@/src/ui/selectors/editSelectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { EditInput } from '@/src/ui/webElements/editInput';
import { EditInputActions } from '@/src/ui/webElements/editInputActions';
import { Page } from '@playwright/test';

export class SideBarEntities extends BaseElement {
  protected entitySelector: string;

  constructor(page: Page, rootSelector: string, entitySelector: string) {
    super(page, rootSelector);
    this.entitySelector = entitySelector;
  }

  private editEntityInput!: EditInput;

  getEditEntityInput(selector: string): EditInput {
    if (!this.editEntityInput) {
      this.editEntityInput = new EditInput(
        this.page,
        this.getElementLocator(),
        `${selector} >> ${EditSelectors.editContainer}`,
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

  protected entityDotsMenu = (
    selector: string,
    name: string,
    index?: number,
  ) => {
    return this.getEntityByName(selector, name, index).locator(
      SideBarSelectors.dotsMenu,
    );
  };

  protected getEntityByName(selector: string, name: string, index?: number) {
    return this.getChildElementBySelector(selector).getElementLocatorByText(
      name,
      index,
    );
  }

  protected getEntityName(
    entitySelector: string,
    nameSelector: string,
    name: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getEntityByName(entitySelector, name, index).locator(nameSelector),
    );
  }

  protected getEntityArrowIcon(selector: string, name: string, index?: number) {
    return this.getEntityByName(selector, name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  protected getEntityArrowIconColor(
    selector: string,
    name: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getEntityArrowIcon(selector, name, index).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }

  protected async openEntityDropdownMenu(
    selector: string,
    name: string,
    index?: number,
  ) {
    const entity = this.getEntityByName(selector, name, index);
    await entity.hover();
    await this.entityDotsMenu(selector, name, index).click();
    await this.getDropdownMenu().waitForState();
  }

  protected async openEditEntityNameMode(selector: string, newName: string) {
    const input = await this.getEditEntityInput(selector);
    await input.editValue(newName);
    return input;
  }

  protected async getEntityIcon(
    selector: string,
    name: string,
    index?: number,
  ) {
    const entity = this.getEntityByName(selector, name, index);
    return this.getElementIconHtml(entity);
  }

  public async getEntityBackgroundColor(
    selector: string,
    name: string,
    index?: number,
  ) {
    const backgroundColor = await this.createElementFromLocator(
      this.getEntityByName(selector, name, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
    backgroundColor[0] = backgroundColor[0].replace(
      ExpectedConstants.backgroundColorPattern,
      '$1)',
    );
    return backgroundColor[0];
  }

  public async selectMoveToMenuOption(name: string) {
    return this.selectEntityMenuOption(name, { triggeredHttpMethod: 'DELETE' });
  }

  public async selectEntityMenuOption(
    option: string,
    {
      triggeredHttpMethod = undefined,
    }: { triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE' } = {},
  ) {
    const menu = this.getDropdownMenu();
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === triggeredHttpMethod,
      );
      await menu.selectMenuOption(option);
      return respPromise;
    }
    await menu.selectMenuOption(option);
  }
}

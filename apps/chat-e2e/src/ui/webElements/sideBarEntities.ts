import { MenuSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ExpectedConstants } from '@/src/testData';
import { Attributes, Styles, Tags } from '@/src/ui/domData';
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

  protected entityDotsMenu = (
    selector: string,
    name: string,
    index?: number,
  ) => {
    return this.getEntityByName(selector, name, index).locator(
      MenuSelectors.dotsMenu,
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

  protected getEntityCheckbox(selector: string, name: string, index?: number) {
    return this.getEntityByName(selector, name, index).getByRole('checkbox');
  }

  protected async getEntityCheckboxState(
    selector: string,
    name: string,
    index?: number,
  ) {
    return this.getEntityCheckbox(selector, name, index).getAttribute(
      Attributes.dataQA,
    );
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

  protected async openEditEntityNameMode(newName: string) {
    const input = this.getEditEntityInput();
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

  public async selectMoveToMenuOption(
    name: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    return this.selectEntityMenuOption(name, {
      triggeredHttpMethod: 'DELETE',
      isHttpMethodTriggered,
    });
  }

  public async selectEntityMenuOption(
    option: string,
    {
      triggeredHttpMethod = undefined,
      isHttpMethodTriggered = true,
    }: {
      triggeredHttpMethod?: 'PUT' | 'POST' | 'DELETE';
      isHttpMethodTriggered?: boolean;
    } = {},
  ) {
    const menu = this.getDropdownMenu();

    if (isApiStorageType && isHttpMethodTriggered && triggeredHttpMethod) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === triggeredHttpMethod,
      );
      await menu.selectMenuOption(option);
      return respPromise;
    }

    await menu.selectMenuOption(option);
  }
}

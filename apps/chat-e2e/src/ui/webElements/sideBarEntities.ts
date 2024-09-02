import { MenuSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { MenuOptions } from '@/src/testData';
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

  entityDotsMenu = (name: string, index?: number) => {
    return this.getEntityByName(name, index).locator(MenuSelectors.dotsMenu);
  };

  getEntityByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementLocatorByText(name, index);
  }

  protected getEntityName(nameSelector: string, name: string, index?: number) {
    return this.createElementFromLocator(
      this.getEntityByName(name, index).locator(nameSelector),
    );
  }

  getEntityArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  getEntityArrowIconColor(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getEntityArrowIcon(name, index).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }

  getEntityCheckbox(name: string, index?: number) {
    return this.getEntityByName(name, index).getByRole('checkbox');
  }

  getEntityCheckboxElement(name: string, index?: number) {
    return this.createElementFromLocator(this.getEntityCheckbox(name, index));
  }

  async getEntityCheckboxState(name: string, index?: number) {
    return this.getEntityCheckbox(name, index).getAttribute(Attributes.dataQA);
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

  async getEntityIcon(name: string, index?: number) {
    const entity = this.getEntityByName(name, index);
    return this.getElementIconHtml(entity);
  }

  public async getEntityBackgroundColor(name: string, index?: number) {
    const backgroundColor = await this.createElementFromLocator(
      this.getEntityByName(name, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
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

  public async shareEntity() {
    const response = await this.selectEntityMenuOption(MenuOptions.share, {
      triggeredHttpMethod: 'POST',
    });
    if (response !== undefined) {
      const responseText = await response.text();
      const request = await response.request().postDataJSON();
      return {
        request: request as ShareRequestModel,
        response: JSON.parse(responseText) as ShareByLinkResponseModel,
      };
    }
  }

  public async getEntitiesCount() {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementsCount();
  }
}

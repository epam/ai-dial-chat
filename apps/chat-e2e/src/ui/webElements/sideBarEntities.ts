import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ExpectedConstants } from '@/src/testData';
import { Styles, Tags } from '@/src/ui/domData';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { Input } from '@/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class SideBarEntities extends BaseElement {
  protected entitySelector: string;
  constructor(page: Page, rootSelector: string, entitySelector: string) {
    super(page, rootSelector);
    this.entitySelector = entitySelector;
  }

  private entityInput!: Input;

  getEntityInput(selector: string, name: string): Input {
    if (!this.entityInput) {
      this.entityInput = new Input(
        this.page,
        `${selector} >> ${SideBarSelectors.renameDefaultNameInput(name)}`,
      );
    }
    return this.entityInput;
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

  protected async openEditEntityNameMode(
    selector: string,
    name: string,
    newName: string,
  ) {
    const input = await this.getEntityInput(selector, name);
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
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await this.getDropdownMenu().selectMenuOption(name);
      return respPromise;
    }
    await this.getDropdownMenu().selectMenuOption(name);
  }

  public async deleteEntityWithTick(selector: string, name: string) {
    const input = await this.getEntityInput(selector, name);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await input.clickTickButton();
      await respPromise;
    } else {
      await input.clickTickButton();
    }
    await this.getEntityByName(selector, name).waitFor({ state: 'hidden' });
  }
}

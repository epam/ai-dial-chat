import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ExpectedConstants } from '@/e2e/src/testData';
import { Styles, Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
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

  protected async editEntityNameWithTick(
    selector: string,
    name: string,
    newName: string,
  ) {
    const input = await this.openEditEntityNameMode(selector, name, newName);
    await input.clickTickButton();
  }

  protected async editEntityNameWithEnter(
    selector: string,
    name: string,
    newName: string,
  ) {
    await this.openEditEntityNameMode(selector, name, newName);
    await this.page.keyboard.press(keys.enter);
    await this.getEntityByName(selector, name).waitFor({ state: 'hidden' });
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
}

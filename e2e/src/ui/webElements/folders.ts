import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class Folders extends BaseElement {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  private folderInput!: Input;

  getFolderInput(name: string): Input {
    if (!this.folderInput) {
      this.folderInput = new Input(
        this.page,
        `${SideBarSelectors.folder} >> ${SideBarSelectors.renameInput(name)}`,
      );
    }
    return this.folderInput;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public folderDotsMenu = (name: string, index?: number) => {
    return this.getFolderByName(name, index).locator(SideBarSelectors.dotsMenu);
  };

  public getFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      SideBarSelectors.folder,
    ).getElementLocatorByText(name, index);
  }

  public async openFolderDropdownMenu(name: string, index?: number) {
    const folderToEdit = this.getFolderByName(name, index);
    await folderToEdit.hover();
    await this.folderDotsMenu(name, index).click();
    await this.getDropdownMenu().waitForState();
  }

  public async editFolderNameWithEnter(name: string, newName: string) {
    await this.editFolderName(name, newName);
    await this.page.keyboard.press(keys.enter);
  }

  public async editFolderNameWithTick(name: string, newName: string) {
    const folderInput = await this.editFolderName(name, newName);
    await folderInput.clickTickButton();
  }

  public async editFolderName(name: string, newName: string) {
    const folderInput = await this.getFolderInput(name);
    await folderInput.editValue(newName);
    return folderInput;
  }

  public async expandCollapseFolder(name: string, index?: number) {
    await this.getFolderByName(name, index).click();
  }
}

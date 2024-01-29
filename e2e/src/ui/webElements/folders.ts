import { SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ExpectedConstants } from '@/e2e/src/testData';
import { Attributes, Styles, Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class Folders extends BaseElement {
  private readonly entitySelector: string;

  constructor(page: Page, folderSelector: string, entitySelector: string) {
    super(page, folderSelector);
    this.entitySelector = entitySelector;
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

  public getFolderName(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getFolderByName(name, index).locator(SideBarSelectors.folderName),
    );
  }

  public getFolderCaret(name: string, index?: number) {
    return this.getFolderByName(name, index)
      .locator(Tags.span)
      .getAttribute(Attributes.class);
  }

  public foldersGroup = (parentFolderName: string) => {
    return this.createElementFromLocator(
      this.getChildElementBySelector(
        SideBarSelectors.folderGroup,
      ).getElementLocatorByText(parentFolderName),
    );
  };

  public async waitForFolderGroupIsHighlighted(parentFolderName: string) {
    await this.getChildElementBySelector(
      `${SideBarSelectors.folderGroup}.${ExpectedConstants.backgroundAccentAttribute}`,
    )
      .getElementLocatorByText(parentFolderName)
      .waitFor({ state: 'attached' });
  }

  public async getFoldersCount() {
    return this.getChildElementBySelector(
      SideBarSelectors.folder,
    ).getElementsCount();
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

  public async getFolderNameColor(name: string, index?: number) {
    const folder = this.createElementFromLocator(
      this.getFolderByName(name, index).getByText(name),
    );
    return folder.getComputedStyleProperty(Styles.color);
  }

  public getFolderEntities(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `~${Tags.div} ${this.entitySelector}`,
    );
  }

  public getFolderEntity(folderName: string, entityName: string) {
    return this.getFolderEntities(folderName).filter({
      hasText: entityName,
    });
  }

  public folderEntityDotsMenu = (folderName: string, entityName: string) => {
    return this.getFolderEntity(folderName, entityName).locator(
      SideBarSelectors.dotsMenu,
    );
  };

  public getFolderEntitiesCount(folderName: string) {
    return this.getFolderEntities(folderName).count();
  }

  public async isFolderEntityVisible(folderName: string, entityName: string) {
    return this.getFolderEntity(folderName, entityName).isVisible();
  }

  public async selectFolderEntity(
    folderName: string,
    conversationName: string,
  ) {
    await this.getFolderEntity(folderName, conversationName).click();
  }

  public async openFolderEntityDropdownMenu(
    folderName: string,
    entityName: string,
  ) {
    const folderEntity = await this.getFolderEntity(folderName, entityName);
    await folderEntity.waitFor({
      state: 'attached',
    });
    await folderEntity.hover();
    await this.folderEntityDotsMenu(folderName, entityName).click();
    await this.getDropdownMenu().waitForState();
  }
}
